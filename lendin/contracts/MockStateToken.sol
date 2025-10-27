// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// This is a simple ERC-20 token for testing purposes.
// It allows the owner to mint new tokens.
contract MockStakeToken is ERC20, Ownable {
    constructor() ERC20("Mock Stake Token", "MST") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}