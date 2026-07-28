// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IDojangScore} from "./interfaces/IDojangScroll.sol";

contract WonVault is ERC4626 {
    using Math for uint256;

    IDojangScore public immutable dojangScore;
    address public treasury;

    uint256 public constant FEE_TIER_0 = 200; // 2.00%
    uint256 public constant FEE_TIER_1 = 150; // 1.50%
    uint256 public constant FEE_TIER_2 = 100; // 1.00%
    uint256 public constant FEE_TIER_3 = 50;  // 0.50%

    event DepositWithTier(
        address indexed caller, address indexed receiver,
        uint256 assets, uint256 shares, uint8 tier, uint256 feeBps
    );

    constructor(IERC20 asset_, IDojangScore score_, address treasury_)
        ERC20("WonVault KRW", "vKRW")
        ERC4626(asset_)
    {
        dojangScore = score_;
        treasury = treasury_;
    }

    /// @dev THE FIX: opt into OpenZeppelin's inflation / first-deposit protection.
    ///      Without this, an empty vault can mint zero shares and trap assets,
    ///      which is exactly the 1e21 share-price bug we hit. Forcing a virtual
    ///      share offset makes the first deposit mint a healthy, proportional
    ///      share amount and keeps the price anchored at ~1.0 forever.
    function _decimalsOffset() internal view virtual override returns (uint8) {
        return 18;
    }

    function feeTierOf(address user) public view returns (uint256 bps, string memory name) {
        uint8 tier;
        try dojangScore.tierOf(user) returns (uint8 t) {
            tier = t;
        } catch {
            tier = 0;
        }
        if (tier == 3) return (FEE_TIER_3, "Platinum");
        if (tier == 2) return (FEE_TIER_2, "Gold");
        if (tier == 1) return (FEE_TIER_1, "Silver");
        return (FEE_TIER_0, "Standard");
    }

    /// @dev Take the trust-tiered entry fee, then hand the net amount to
    ///      OpenZeppelin's own deposit() so the share math (and the empty-vault
    ///      safe path) is exactly the audited library code — not hand-rolled.
    function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
        (uint256 feeBps, ) = feeTierOf(receiver);
        uint256 fee = assets * feeBps / 10_000;

        if (fee > 0 && treasury != address(0)) {
            IERC20(asset()).transferFrom(msg.sender, treasury, fee);
        }

        uint256 net = assets - fee;
        shares = super.deposit(net, receiver); // library handles transferFrom(net) + safe mint

        uint8 tier;
        try dojangScore.tierOf(receiver) returns (uint8 t) {
            tier = t;
        } catch {}
        emit DepositWithTier(msg.sender, receiver, net, shares, tier, feeBps);
    }

    function previewDepositAfterFee(uint256 assets, address receiver)
        external view returns (uint256)
    {
        (uint256 feeBps, ) = feeTierOf(receiver);
        uint256 fee = assets.mulDiv(feeBps, 10_000, Math.Rounding.Floor);
        return previewDeposit(assets - fee);
    }
}