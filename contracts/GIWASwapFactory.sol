// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {GIWASwapPool} from "./GIWASwapPool.sol";

contract GIWASwapFactory {
    address public immutable dojangScore;
    mapping(address => mapping(address => address)) public getPool;
    address[] public allPools;

    event PoolCreated(
        address indexed token0, address indexed token1,
        address pool, uint256 index
    );

    constructor(address _dojangScore) {
        dojangScore = _dojangScore;
    }

    function createPool(address tokenA, address tokenB) external returns (address pool) {
        require(tokenA != tokenB, "IDENTICAL_TOKENS");
        require(tokenA != address(0) && tokenB != address(0), "ZERO_ADDRESS");
        require(getPool[tokenA][tokenB] == address(0), "POOL_EXISTS");

        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        pool = address(new GIWASwapPool(token0, token1, dojangScore));
        getPool[tokenA][tokenB] = pool;
        getPool[tokenB][tokenA] = pool;
        allPools.push(pool);

        emit PoolCreated(token0, token1, pool, allPools.length - 1);
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}