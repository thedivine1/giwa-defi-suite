const { JsonRpcProvider, Contract } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://sepolia-rpc.giwa.io";
const CHAIN_ID = 91342;
const CONTRACT_ADDRESS = "0xDe9De6f3d4a50BF414927EF6D523aFa65355492a";

const ABI = [
 "function score(address) view returns (uint16)",
 "function tierOfWallet(address) view returns (uint8)",
 "function tierName(uint8) view returns (string)",
 "function scoreBreakdown(address) view returns (tuple(uint16 baseAttestation,uint16 trustlessState,uint16 reporterActivity,uint16 consentedProofs,uint16 rawSum,uint16 ceiling,uint8 ceilingProvenance,uint16 finalScore,uint8 tier,bool holdsLP,bool holdsVault))"
];

const PROV_NAMES = {0:"NONE",1:"BEHAVIORAL",2:"CONSENTED",3:"ATTESTER"};
const ONCHAIN_FEES = {0:{swap:"0.30%",vault:"2.00%"},1:{swap:"0.20%",vault:"1.50%"},2:{swap:"0.15%",vault:"1.00%"},3:{swap:"0.10%",vault:"0.50%"}};

let provider;
let contract;

function getContract() {
    if (!provider) {
        provider = new JsonRpcProvider(RPC_URL);
        contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
    }
    return { provider, contract };
}

// In-memory key usage counter
const keyUsage = new Map();

function authenticate(req, res) {
    const key = req.headers['x-proven-key'];
    if (!key) {
        res.status(401).json({ error: "Missing x-proven-key header" });
        return false;
    }

    let keys = [];
    try {
        keys = JSON.parse(process.env.PROVEN_KEYS || '[]');
    } catch (e) {
        console.error("Failed to parse PROVEN_KEYS", e);
    }

    const validKey = keys.find(k => k.key === key);
    if (!validKey) {
        res.status(401).json({ error: "Invalid x-proven-key" });
        return false;
    }

    // Increment usage
    const usage = (keyUsage.get(key) || 0) + 1;
    keyUsage.set(key, usage);

    return { key, usage };
}

// Simple in-memory cache: Map<url, { data, expiresAt }>
const cache = new Map();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

function getCached(key) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    return null;
}

function setCached(key, data) {
    cache.set(key, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
}

function validateAddress(address) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

module.exports = {
    getContract,
    authenticate,
    getCached,
    setCached,
    validateAddress,
    PROV_NAMES,
    ONCHAIN_FEES,
    CHAIN_ID
};
