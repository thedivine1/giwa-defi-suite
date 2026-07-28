// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDojangScore} from "./interfaces/IDojangScroll.sol";

contract GIWASwapPool is ERC20 {
    address public immutable token0;
    address public immutable token1;
    IDojangScore public immutable dojangScore;

    uint256 public reserve0;
    uint256 public reserve1;

    event Swap(
        address indexed sender, address indexed tokenIn,
        uint256 amountIn, uint256 amountOut,
        address indexed to, uint256 feeBps
    );
    event Mint(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Sync(uint256 reserve0, uint256 reserve1);

    constructor(address _token0, address _token1, address _dojangScore)
        ERC20("GIWASwap LP", "GLP")
    {
        token0 = _token0;
        token1 = _token1;
        dojangScore = IDojangScore(_dojangScore);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserve0, reserve1);
    }

    function feeBpsFor(address user) public view returns (uint256) {
        try dojangScore.tierOf(user) returns (uint8 tier) {
            if (tier == 3) return 10;
            if (tier == 2) return 15;
            if (tier == 1) return 20;
        } catch {}
        return 30;
    }

    function getAmountOut(uint256 amountIn, address tokenIn, address swapper)
        external view returns (uint256)
    {
        require(tokenIn == token0 || tokenIn == token1, "INVALID_TOKEN");
        (uint256 rIn, uint256 rOut) = tokenIn == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
        uint256 fee = feeBpsFor(swapper);
        uint256 amtAfterFee = amountIn * (10_000 - fee) / 10_000;
        return amtAfterFee * rOut / (rIn + amtAfterFee);
    }

    function mint(address to) external returns (uint256 liquidity) {
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = bal0 - reserve0;
        uint256 amount1 = bal1 - reserve1;

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - 1000;
        } else {
            liquidity = _min(
                amount0 * _totalSupply / reserve0,
                amount1 * _totalSupply / reserve1
            );
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        reserve0 = bal0;
        reserve1 = bal1;
        emit Mint(msg.sender, amount0, amount1, liquidity);
        emit Sync(reserve0, reserve1);
    }

    function burn(address to) external returns (uint256 amount0, uint256 amount1) {
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));
        uint256 _totalSupply = totalSupply();

        amount0 = liquidity * bal0 / _totalSupply;
        amount1 = liquidity * bal1 / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");

        _burn(address(this), liquidity);
        IERC20(token0).transfer(to, amount0);
        IERC20(token1).transfer(to, amount1);

        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
        emit Burn(msg.sender, amount0, amount1, liquidity);
        emit Sync(reserve0, reserve1);
    }

    function swap(address tokenIn, uint256 amountIn, uint256 amountOutMin, address to)
        external returns (uint256 amountOut)
    {
        require(tokenIn == token0 || tokenIn == token1, "INVALID_TOKEN");
        bool isToken0 = tokenIn == token0;
        (uint256 rIn, uint256 rOut) = isToken0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        uint256 fee = feeBpsFor(msg.sender);
        uint256 amtAfterFee = amountIn * (10_000 - fee) / 10_000;
        amountOut = amtAfterFee * rOut / (rIn + amtAfterFee);

        require(amountOut >= amountOutMin, "SLIPPAGE_EXCEEDED");
        require(amountOut > 0 && amountOut < rOut, "INSUFFICIENT_LIQUIDITY");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(isToken0 ? token1 : token0).transfer(to, amountOut);

        if (isToken0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut, to, fee);
        emit Sync(reserve0, reserve1);
    }

    function _sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        y = x;
        uint256 z = (x + 1) / 2;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}