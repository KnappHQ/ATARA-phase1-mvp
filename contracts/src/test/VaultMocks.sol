// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract TestSmartAccount {
    address private immutable owner = msg.sender;
    function execute(address target, bytes calldata data) external {
        require(msg.sender == owner, "owner only");
        (bool ok, bytes memory result) = target.call(data);
        if (!ok) assembly { revert(add(result, 32), mload(result)) }
    }
}

contract AdversarialToken is TestUSDC {
    bool public fail;
    bool public fee;
    address public callback;
    bytes public callbackData;
    bool public callbackSucceeded;
    function configure(bool fail_, bool fee_, address target_, bytes calldata data_) external {
        fail = fail_; fee = fee_; callback = target_; callbackData = data_;
    }
    function transfer(address to, uint256 value) public override returns (bool) {
        if (fail) return false;
        if (callback != address(0)) (callbackSucceeded,) = callback.call(callbackData);
        return super.transfer(to, value);
    }
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (fail) return false;
        if (callback != address(0)) (callbackSucceeded,) = callback.call(callbackData);
        bool result = super.transferFrom(from, to, value);
        if (fee) _burn(to, 1);
        return result;
    }
    function asMember(address target, bytes calldata data) external {
        (bool ok, bytes memory result) = target.call(data);
        if (!ok) assembly { revert(add(result, 32), mload(result)) }
    }
}
