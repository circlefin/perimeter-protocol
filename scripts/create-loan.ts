import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Inputs
  const loanFactoryAddress = "0x4c22610414B9C8FD9d25054cbCC6feB1F39791e5";
  const borrowerAddress = "0x96375b944491Bb3CD6D4850ff55c265bE5276945";
  const poolAddress = "0x4c9d66B3c89Aa1E4C4EBa58920858d6447F4d97A";
  const liquidityAssetAddress = "0x07865c6e87b9f70255377e024ace6630c1eaa37f";

  const SEVEN_DAYS = 6 * 60 * 60 * 24;
  const loanSettings = {
    duration: 180,
    paymentPeriod: 30,
    apr: 500,
    principal: 1_000000,
    dropDeadTimestamp: Math.floor(Date.now() / 1000) + SEVEN_DAYS,
    latePaymentFee: 0,
    latePayment: 0,
    originationBps: 0,
    loanType: 0
  };

  const [admin, operator, deployer, pauser, other] =
    await hre.ethers.getSigners();

  const LoanFactory = await await ethers.getContractFactory("LoanFactory");
  const loanFactory = LoanFactory.attach(loanFactoryAddress);

  const tx = await loanFactory
    .connect(other)
    .createLoan(borrowerAddress, poolAddress, liquidityAssetAddress, {
      loanType: loanSettings.loanType,
      principal: loanSettings.principal,
      apr: loanSettings.apr,
      duration: loanSettings.duration,
      paymentPeriod: loanSettings.paymentPeriod,
      dropDeadTimestamp: loanSettings.dropDeadTimestamp,
      latePayment: loanSettings.latePayment,
      originationBps: loanSettings.originationBps
    });
  const receipt = await tx.wait();
  const loanCreatedEvent = receipt.events?.find(
    (e: any) => e.event == "LoanCreated"
  );
  const loanAddress = loanCreatedEvent?.args?.[0];
  console.log("Loan address: ", loanAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
