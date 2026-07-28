// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDojangScrollCompat {
    function isVerified(address addr, bytes32 attesterId) external view returns (bool);
    function getVerifiedAddressAttestationUid(address addr, bytes32 attesterId)
        external view returns (bytes32);
    function getBalanceRootAttestationUid(uint256 coinType, uint64 snapshotAt, bytes32 attesterId)
        external view returns (bytes32);
    function getVerifiedBalance(address recipient, uint256 coinType, uint64 snapshotAt, bytes32 attesterId)
        external view returns (uint256);
    function getVerifiedBalanceAttestationUid(
        address recipient, uint256 coinType, uint64 snapshotAt, bytes32 attesterId
    ) external view returns (bytes32);
    function isVerifiedCode(bytes32 codeHash, string calldata domain, bytes32 attesterId)
        external view returns (bool);
    function getVerifyCodeAttestationUid(bytes32 codeHash, string calldata domain, bytes32 attesterId)
        external view returns (bytes32);
}

struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

interface IEASCompat {
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

interface IDojangScore {
    function score(address wallet) external view returns (uint256);
    function tierOf(address wallet) external view returns (uint8);
}