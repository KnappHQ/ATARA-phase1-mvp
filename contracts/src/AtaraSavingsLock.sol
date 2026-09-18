// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Sepolia beta: one owner, one lock date, nothing leaves before it.
/// @dev No admin, upgrades, arbitrary calls, yield or early-exit path. The owner
/// cannot withdraw before unlockAt either: an owner-only escape hatch would undo
/// the only thing this contract is for. A saver who could take the money back at
/// any moment has a wallet, not a commitment.
contract AtaraSavingsLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable owner;
    string public name;
    uint64 public immutable unlockAt;
    uint256 public immutable maxTotalDeposits;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    mapping(bytes32 => bool) public usedDepositIds;

    struct Snapshot {
        string name;
        address owner;
        uint64 unlockAt;
        uint256 chainTimestamp;
        uint256 balance;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 maxTotalDeposits;
    }

    error NotOwner();
    error InvalidTerms();
    error FundingClosed();
    error InvalidAmount();
    error Locked();
    error UnsupportedToken();
    error DuplicateDeposit();

    event Deposited(bytes32 indexed depositId, uint256 amount);
    event Withdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IERC20 token_, address owner_, string memory name_, uint64 unlockAt_, uint256 cap_) {
        if (block.chainid != 84532 || address(token_).code.length == 0 || cap_ == 0 ||
            owner_ == address(0) || owner_ == address(this) || owner_ == address(token_) ||
            bytes(name_).length == 0 || bytes(name_).length > 64 ||
            unlockAt_ < block.timestamp + 5 minutes || unlockAt_ > block.timestamp + 365 days) {
            revert InvalidTerms();
        }
        token = token_;
        owner = owner_;
        name = name_;
        unlockAt = unlockAt_;
        maxTotalDeposits = cap_;
    }

    /// @notice Funding closes at the unlock date. The lock covers a fixed period;
    /// topping it up on the last day would make that period meaningless.
    function deposit(uint256 amount, bytes32 depositId) external onlyOwner nonReentrant {
        if (usedDepositIds[depositId]) revert DuplicateDeposit();
        if (block.timestamp >= unlockAt) revert FundingClosed();
        if (amount == 0 || amount > maxTotalDeposits - totalDeposited) revert InvalidAmount();
        uint256 beforeBalance = token.balanceOf(address(this));
        usedDepositIds[depositId] = true;
        totalDeposited += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        // A fee-on-transfer/rebasing token cannot silently corrupt accounting.
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
        emit Deposited(depositId, amount);
    }

    function withdraw(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (block.timestamp < unlockAt) revert Locked();
        if (recipient == address(0) || recipient == address(this) || recipient == address(token)) revert InvalidTerms();
        if (amount == 0 || amount > token.balanceOf(address(this))) revert InvalidAmount();
        totalWithdrawn += amount;
        token.safeTransfer(recipient, amount);
        emit Withdrawn(recipient, amount);
    }

    function snapshot() external view returns (Snapshot memory s) {
        s.name = name;
        s.owner = owner;
        s.unlockAt = unlockAt;
        s.chainTimestamp = block.timestamp;
        s.balance = token.balanceOf(address(this));
        s.totalDeposited = totalDeposited;
        s.totalWithdrawn = totalWithdrawn;
        s.maxTotalDeposits = maxTotalDeposits;
    }
}
