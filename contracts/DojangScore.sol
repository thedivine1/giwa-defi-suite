// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDojangScrollCompat, IEASCompat, Attestation, IDojangScore}
    from "./interfaces/IDojangScroll.sol";

contract DojangScore is IDojangScore {
    IDojangScrollCompat public immutable dojang;
    IEASCompat public immutable eas;

    bytes32 public constant UPBIT_KOREA =
        0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034;

    address public owner;

    uint256 public weightVerifiedAddress = 400;
    uint256 public weightVerifiedBalance = 300;
    uint256 public weightAccountAge      = 200;
    uint256 public weightVerifiedCode    = 100;

    mapping(address => uint256) public manualScores;

    event ManualScoreSet(address indexed wallet, uint256 score);
    event WeightsUpdated(uint256 addr, uint256 bal, uint256 age, uint256 code);

    error NotOwner();
    error ScoreTooHigh();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _dojangScroll, address _eas) {
        if (_dojangScroll == address(0) || _eas == address(0)) revert ZeroAddress();
        dojang = IDojangScrollCompat(_dojangScroll);
        eas    = IEASCompat(_eas);
        owner  = msg.sender;
    }

    function score(address wallet) public view override returns (uint256) {
        uint256 manual = manualScores[wallet];
        if (manual > 0) return manual;

        uint256 total = 0;

        try dojang.isVerified(wallet, UPBIT_KOREA) returns (bool verified) {
            if (verified) {
                total += weightVerifiedAddress;

                try dojang.getVerifiedAddressAttestationUid(wallet, UPBIT_KOREA)
                    returns (bytes32 uid)
                {
                    Attestation memory att = eas.getAttestation(uid);
                    if (att.time > 0 && block.timestamp > uint256(att.time) + 90 days) {
                        total += weightAccountAge;
                    }
                } catch {}
            }
        } catch {}

        try dojang.getVerifiedBalance(wallet, 0, uint64(block.timestamp), UPBIT_KOREA)
            returns (uint256 bal)
        {
            if (bal > 0) total += weightVerifiedBalance;
        } catch {}

        try dojang.isVerifiedCode(bytes32(0), "giwa.io", UPBIT_KOREA)
            returns (bool codeVerified)
        {
            if (codeVerified) total += weightVerifiedCode;
        } catch {}

        return total > 1000 ? 1000 : total;
    }

    function tierOf(address wallet) external view override returns (uint8) {
        uint256 s = score(wallet);
        if (s >= 800) return 3;
        if (s >= 500) return 2;
        if (s >= 200) return 1;
        return 0;
    }

    function tierName(address wallet) external view returns (string memory) {
        uint8 t = this.tierOf(wallet);
        if (t == 3) return "Platinum";
        if (t == 2) return "Gold";
        if (t == 1) return "Silver";
        return "Unverified";
    }

    function setManualScore(address wallet, uint256 score_) external onlyOwner {
        if (score_ > 1000) revert ScoreTooHigh();
        manualScores[wallet] = score_;
        emit ManualScoreSet(wallet, score_);
    }

    function setWeights(uint256 _a, uint256 _b, uint256 _c, uint256 _d) external onlyOwner {
        weightVerifiedAddress = _a;
        weightVerifiedBalance = _b;
        weightAccountAge      = _c;
        weightVerifiedCode    = _d;
        emit WeightsUpdated(_a, _b, _c, _d);
    }
}