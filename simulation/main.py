from dataclasses import dataclass
from datetime import datetime 
import os
import csv
import argparse
from decimal import *

@dataclass
class Loan:
    loan_id: int
    principal: int
    payment: int
    number_payments: int 
    start: int 
    end: int

    def payment_required(self, time):
        if self.start > time:
            return False 

        if self.start == time:
            return True

        return (time - self.start) % self.interval == 0

    @property 
    def interval(self):
        return (self.end - self.start) / self.number_payments

    def current_payment_period(self, time) -> tuple[int, int]:
        if self.start > time: return None 
        if time > self.end: return None

        period_start = self.start 
        while period_start + self.interval < time:
            period_start += self.interval
        
        return period_start, period_start + self.interval

class Pool: 

    def __init__(self):
        self.liquidity = 0
        self.defaults = 0
        self.active_loans = [] 
        self.matured_loans = []
        self.defaulted_loans = []

        self.pool_token_balances = {}
        self.pool_token_supply = 0

        self.payment_count_by_loan_id = {}
        self.lender_payouts = {}

    def lend(self, lender_id, liquidity_amount, time):
        if self.liquidity == 0 and len(self.active_loans) == 0:
            tokens = liquidity_amount
        else:
            tokens = Decimal(self._liquidity_to_token_rate(time) * Decimal(liquidity_amount))

        self.liquidity += liquidity_amount
        self._mint(lender_id, tokens)
        return tokens 

    def withdraw(self, lender_id, token_amount, time):
        liquidity = float((Decimal(1) / self._liquidity_to_token_rate(time)) * Decimal(token_amount))
        print(f'Lender ID {lender_id}, liquidity {liquidity}, pool liquidity {self.liquidity}')
        assert self.liquidity >= liquidity, "Not enough liquidity"

        self.liquidity -= liquidity
        self._burn(lender_id, token_amount)
        return liquidity

    def make_payment(self, loan: Loan):
        assert loan in self.active_loans, "Loan not active, can't make payment"

        self.liquidity += loan.payment 
        self.payment_count_by_loan_id[loan.loan_id] = self.payment_count_by_loan_id.get(loan.loan_id, 0) + 1
        if (self.payment_count_by_loan_id[loan.loan_id] == loan.number_payments):
            # paypack principal 
            self.liquidity += loan.principal
            # loan matures 
            self.matured_loans.append(loan)
            self.active_loans.remove(loan)

    def fund_loan(self, loan: Loan):
        assert self.liquidity >= loan.principal, "Not enough liquidity to fund loan"
        self.active_loans.append(loan)
        self.liquidity -= loan.principal

    def mark_loan_in_default(self, loan_id: int):
        matching_loan = None 
        for each in self.active_loans:
            if each.loan_id == loan_id:
                matching_loan = each 
                break

        assert matching_loan is not None, "Loan not active"

        self.active_loans.remove(matching_loan)
        self.defaulted_loans.append(matching_loan)
        self.defaults += matching_loan.principal

    def close(self, time):
        for lender_id, token_balance in self.pool_token_balances.items():
            if not token_balance: continue 
            self.lender_payouts[lender_id] = self.withdraw(lender_id, token_balance, time)

    def _burn(self, lender_id, amount):
        assert self.pool_token_supply >= amount, "Not enough tokens in circulation"
        assert self.pool_token_balances[lender_id] >= amount, "Not enough tokens in balance" 

        self.pool_token_supply -= amount 
        self.pool_token_balances[lender_id] -= amount

    def _mint(self, lender_id, amount):
        self.pool_token_balances[lender_id] = self.pool_token_balances.get(lender_id, 0) + amount 
        self.pool_token_supply += amount

    def _liquidity_to_token_rate(self, time):
        return Decimal(self.pool_token_supply) / Decimal(self._nav(time))

    def _nav(self, time):
        outstanding_principals = sum([each.principal for each in self.active_loans]) 
        accrued_interest = 0 
        for each in self.active_loans:
            period = each.current_payment_period(time)
            if not period: continue 

            period_start, period_end = period
            accrued_interest += (time - period_start) * each.payment / (period_end - period_start)

        return self.liquidity + outstanding_principals + accrued_interest

@dataclass 
class LoanSchedule:
    loans_by_start_date: list[tuple[int, Loan]]

@dataclass 
class LenderSchedule:
    deposits_by_date_and_id: list[tuple[int, int, int]]

@dataclass
class DefaultSchedule:
    defaults_by_loan_id_date: list[tuple[int, int]]

def process_input(simulation) -> tuple[LoanSchedule, LenderSchedule, DefaultSchedule]:
    loan_schedule = []
    with open(f'simulations/{simulation}/loan_input.csv') as csvfile:        
        reader = csv.reader(csvfile)
        next(reader)
        for row in reader:
            number_payments = int(row[3].strip())
            interval = int(row[4].strip())
            start = int(row[5].strip())
            end = start + number_payments * interval

            loan = Loan(int(row[0].strip()), int(row[1].strip()), int(row[2].strip()), number_payments, start, end)
            loan_schedule.append(
                (start, loan)
            )

    lender_schedule = []
    with open(f'simulations/{simulation}/lender_input.csv') as csvfile:        
        reader = csv.reader(csvfile)
        next(reader)
        for row in reader:
            lender_schedule.append(
                (int(row[0].strip()), int(row[1].strip()), int(row[2].strip()))
            )
    
    defaults_schedule = []
    with open(f'simulations/{simulation}/default_input.csv') as csvfile:        
        reader = csv.reader(csvfile)
        next(reader)
        for row in reader:
            defaults_schedule.append(
                (int(row[0].strip()), int(row[1].strip()))
            )

    return LoanSchedule(loan_schedule), LenderSchedule(lender_schedule), DefaultSchedule(defaults_schedule)

def run_simulation(simulation):
    assert isinstance(simulation, int), "Simulation must be number"

    loan_schedule, lender_schedule, defaults_schedule = process_input(simulation)
    pool = Pool()

    time = 0 
    output = {}
    while True:
        # process lenders 
        for each in lender_schedule.deposits_by_date_and_id:
            lender_id, deposit_time, amount = each
            if deposit_time == time:
                pool.lend(lender_id, amount, time)
            else:
                continue

        # process loans 
        for each in loan_schedule.loans_by_start_date:
            start_time, loan = each 
            if start_time == time:
                pool.fund_loan(loan)
            elif loan in pool.defaulted_loans:
                continue
            elif loan.payment_required(time):
                pool.make_payment(loan)

        # process defaults 
        for each in defaults_schedule.defaults_by_loan_id_date:
            loan_id, default_time = each
            if default_time == time:
                pool.mark_loan_in_default(loan_id)

        time += 1

        completed_loan_count = len(pool.matured_loans) + len(pool.defaulted_loans)
        assert completed_loan_count <= len(loan_schedule.loans_by_start_date), "Too many loans!"

        if completed_loan_count == len(loan_schedule.loans_by_start_date):
            pool.close(time)
            break

    return pool.lender_payouts, pool.liquidity
    
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run a simulation.')
    parser.add_argument('simulation', metavar='s', type=int, nargs=1, help='simulation number to run')
    
    simulation = parser.parse_args().simulation[0]
    print(f'Running simulation {simulation}...')
    print("-----------------")
    lender_payouts, liquidity = run_simulation(simulation)
    for lender_id, payout in sorted(lender_payouts.items(), key=lambda e: e[0]):
        print(f'Lender ID: {lender_id}, payout: {payout}')
    print("-----------------")
    print(f'Remaining pool liquidity: {liquidity}')