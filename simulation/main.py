from dataclasses import dataclass
from datetime import datetime 
import os
import csv
import uuid
import argparse

@dataclass
class Loan:
    uuid: str
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

        self.pool_token_balances = {}
        self.pool_token_supply = 0

        self.payment_count_by_loan_id = {}
        self.lender_payouts = {}

    def lend(self, lender_id, liquidity_amount, time):
        if self.liquidity == 0 and len(self.active_loans) == 0:
            tokens = liquidity_amount
        else:
            tokens = self._liquidity_to_token_rate(time) * liquidity_amount

        self.liquidity += liquidity_amount
        self._mint(lender_id, tokens)
        return tokens 

    def withdraw(self, lender_id, token_amount):
        liquidity = (1 / self.liquidity_to_token_rate()) * token_amount
        assert(self.liquidity >= liquidity, "Not enough liquidity")

        self.liquidity -= liquidity
        self._burn(lender_id, token_amount)
        return liquidity

    def make_payment(self, loan: Loan):
        self.liquidity += loan.payment 
        self.payment_count_by_loan_id[loan.uuid] = self.payment_count_by_loan_id.get(loan.uuid, 0) + 1
        if (self.payment_count_by_loan_id[loan.uuid] == loan.number_payments):
            # paypack principal 
            self.liquidity += loan.principal
            # loan matures 
            self.matured_loans.append(loan)
            self.active_loans.remove(loan)

    def fund_loan(self, loan: Loan):
        assert(self.liquidity >= loan.principal, "Not enough liquidity to fund loan")
        self.active_loans.append(loan)
        self.liquidity -= loan.principal

    def close(self, time):
        for lender_id, token_balance in self.pool_token_balances.items():
            if not token_balance: continue 

            liquidity = (1 / self._liquidity_to_token_rate(time)) * token_balance
            self.lender_payouts[lender_id] = liquidity
            self._burn(lender_id, token_balance)
            self.liquidity -= liquidity

    def _burn(self, lender_id, amount):
        assert(self.pool_token_supply >= amount, "Not enough tokens in circulation")
        assert(self.pool_token_balances[lender_id] >= amount, "Not enough tokens in balance")
        self.pool_token_supply -= amount 
        self.pool_token_balances[lender_id] -= amount

    def _mint(self, lender_id, amount):
        self.pool_token_balances[lender_id] = self.pool_token_balances.get(lender_id, 0) + amount 
        self.pool_token_supply += amount

    def _liquidity_to_token_rate(self, time):
        return self.pool_token_supply / self._nav(time)

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

def process_input(simulation) -> tuple[LoanSchedule, LenderSchedule]:
    loan_schedule = []
    with open(f'simulations/{simulation}/loan_input.csv') as csvfile:        
        reader = csv.reader(csvfile)
        next(reader)
        for row in reader:
            number_payments = int(row[2].strip())
            interval = int(row[3].strip())
            start = int(row[4].strip())
            end = start + number_payments * interval

            loan = Loan(uuid.uuid4(), int(row[0].strip()), int(row[1].strip()), number_payments, start, end)
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

    return LoanSchedule(loan_schedule), LenderSchedule(lender_schedule)

def run_simulation(simulation):
    assert(isinstance(simulation, int), "Simulation must be number")

    loan_schedule, lender_schedule = process_input(simulation)
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
            elif loan.payment_required(time):
                pool.make_payment(loan)
        
        time += 1

        if len(pool.matured_loans) == len(loan_schedule.loans_by_start_date):
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