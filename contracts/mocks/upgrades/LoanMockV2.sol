// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../../Loan.sol";
import "./MockUpgrade.sol";

/**
 * @dev Simulated new Loan implementation
 */
contract LoanMockV2 is Loan, MockUpgrade {

}
