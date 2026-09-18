// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AtaraSavingsLock} from "./AtaraSavingsLock.sol";

/// @notice Immutable Sepolia factory. Never holds funds or controls deployed locks.
contract AtaraSavingsLockFactory {
    IERC20Metadata public immutable token;
    uint256 public constant MAX_TOTAL_DEPOSITS = 10_000 * 1e6;
    mapping(address => bool) public isSavingsLock;
    mapping(bytes32 => address) public lockByKey;
    mapping(bytes32 => bytes32) private termsByKey;
    mapping(address => address[]) private ownerLocks;

    error InvalidConfiguration();
    error CreationConflict();
    error InvalidPage();

    event SavingsLockCreated(address indexed lock, address indexed owner, uint64 unlockAt, string name);

    constructor(IERC20Metadata token_) {
        if (block.chainid != 84532 || address(token_).code.length == 0 || token_.decimals() != 6) revert InvalidConfiguration();
        token = token_;
    }

    function createSavingsLock(string calldata name, uint64 unlockAt, bytes32 salt) external returns (address lock) {
        bytes32 key = keccak256(abi.encode(msg.sender, salt));
        bytes32 terms = keccak256(abi.encode(name, unlockAt));
        lock = lockByKey[key];
        // A retry of a submitted create operation must not create another lock.
        if (lock != address(0)) {
            if (terms != termsByKey[key]) revert CreationConflict();
            return lock;
        }
        lock = address(new AtaraSavingsLock(token, msg.sender, name, unlockAt, MAX_TOTAL_DEPOSITS));
        isSavingsLock[lock] = true;
        lockByKey[key] = lock;
        termsByKey[key] = terms;
        ownerLocks[msg.sender].push(lock);
        emit SavingsLockCreated(lock, msg.sender, unlockAt, name);
    }

    function getSavingsLocks(address owner, uint256 offset, uint256 limit) external view returns (address[] memory result, uint256 total) {
        if (limit == 0 || limit > 20) revert InvalidPage();
        address[] storage list = ownerLocks[owner];
        total = list.length;
        if (offset >= total) return (new address[](0), total);
        uint256 count = total - offset;
        if (count > limit) count = limit;
        result = new address[](count);
        // Newest first, bounded even for an owner with a long history.
        for (uint256 i; i < count; ++i) result[i] = list[total - 1 - offset - i];
    }
}
