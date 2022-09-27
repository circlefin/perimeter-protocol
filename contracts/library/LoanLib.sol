import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/ILoan.sol";

library LoanLib {
    using SafeERC20 for IERC20;

    /**
     * @dev Emitted when collateral is posted to the loan.
     */
    event PostedCollateral(address asset, uint256 amount);

    /**
     * @dev Post ERC20 tokens as collateral
     */
    function postFungibleCollateral(
        address collateralVault,
        address asset,
        uint256 amount
    ) external returns (ILoanLifeCycleState) {
        IERC20(asset).safeTransferFrom(msg.sender, collateralVault, amount);
        emit PostedCollateral(asset, amount);
        return ILoanLifeCycleState.Collateralized;
    }
}
