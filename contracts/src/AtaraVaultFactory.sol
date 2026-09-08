// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AtaraGroupVault} from "./AtaraGroupVault.sol";

/// @notice Immutable Sepolia factory. Never holds funds or controls deployed Vaults.
contract AtaraVaultFactory {
    IERC20Metadata public immutable token;
    uint256 public constant MAX_TOTAL_DEPOSITS = 10_000 * 1e6;
    mapping(address => bool) public isVault;
    mapping(bytes32 => address) public vaultByKey;
    mapping(bytes32 => bytes32) private termsByKey;
    mapping(address => address[]) private memberVaults;

    error InvalidConfiguration();
    error CreatorMustBeMember();
    error CreationConflict();
    error InvalidPage();

    event VaultCreated(address indexed vault, address indexed creator, uint64 unlockAt, address[] members);

    constructor(IERC20Metadata token_) {
        if (block.chainid != 84532 || address(token_).code.length == 0 || token_.decimals() != 6) revert InvalidConfiguration();
        token = token_;
    }

    function createVault(string calldata name, address[] calldata members, uint64 unlockAt, bytes32 salt) external returns (address vault) {
        bytes32 key = keccak256(abi.encode(msg.sender, salt));
        bytes32 terms = keccak256(abi.encode(name, members, unlockAt));
        vault = vaultByKey[key];
        // A retry of a submitted create operation must not create another Vault.
        if (vault != address(0)) {
            if (terms != termsByKey[key]) revert CreationConflict();
            return vault;
        }
        bool creatorIncluded;
        for (uint256 i; i < members.length; ++i) {
            if (members[i] == msg.sender) creatorIncluded = true;
        }
        if (!creatorIncluded) revert CreatorMustBeMember();
        vault = address(new AtaraGroupVault(token, name, members, unlockAt, MAX_TOTAL_DEPOSITS));
        isVault[vault] = true;
        vaultByKey[key] = vault;
        termsByKey[key] = terms;
        for (uint256 i; i < members.length; ++i) memberVaults[members[i]].push(vault);
        emit VaultCreated(vault, msg.sender, unlockAt, members);
    }

    function getVaults(address member, uint256 offset, uint256 limit) external view returns (address[] memory result, uint256 total) {
        if (limit == 0 || limit > 20) revert InvalidPage();
        address[] storage list = memberVaults[member];
        total = list.length;
        if (offset >= total) return (new address[](0), total);
        uint256 count = total - offset;
        if (count > limit) count = limit;
        result = new address[](count);
        // Newest first, bounded even for members with a long history.
        for (uint256 i; i < count; ++i) result[i] = list[total - 1 - offset - i];
    }
}
