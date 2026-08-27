const { JsonRpcProvider, Contract } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://sepolia-rpc.giwa.io";
const CHAIN_ID = 91342;
const CONTRACT_ADDRESS = "0xDe9De6f3d4a50BF414927EF6D523aFa65355492a";

const ABI = [
 "function score(address) view returns (uint16)",
 "function tierOfWallet(address) view returns (uint8)",
 "function scoreBreakdown(address) view returns (tuple(uint16 baseAttestation,uint16 trustlessState,uint16 reporterActivity,uint16 consentedProofs,uint16 rawSum,uint16 ceiling,uint8 ceilingProvenance,uint16 finalScore,uint8 tier,bool holdsLP,bool holdsVault))"
];

const TIER_NAMES = ["Standard","Silver","Gold","Platinum"];
const PROV_NAMES = {0:"NONE",1:"BEHAVIORAL",2:"CONSENTED",3:"ATTESTER"};
const ONCHAIN_FEES = {0:{swap:"0.30%",vault:"2.00%"},1:{swap:"0.20%",vault:"1.50%"},2:{swap:"0.15%",vault:"1.00%"},3:{swap:"0.10%",vault:"0.50%"}};

const RPCS = [process.env.GIWA_RPC || "https://sepolia-rpc.giwa.io", "https://sepolia-rpc-flashblocks.giwa.io"];

async function withFailover(fn) {
    let lastErr;
    for (let i = 0; i < RPCS.length; i++) {
        try {
            const provider = new JsonRpcProvider(RPCS[i]);
            const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
            
            const ac = new AbortController();
            const to = setTimeout(() => ac.abort(), 2500);
            
            const p1 = fn({ contract, provider });
            const p2 = new Promise((_, reject) => {
                ac.signal.addEventListener("abort", () => reject(new Error("TIMEOUT")));
            });
            
            const res = await Promise.race([p1, p2]);
            clearTimeout(to);
            return res;
        } catch (e) {
            lastErr = e;
        }
    }
    const err = new Error("upstream RPC unavailable");
    err.code = "RPC_DOWN";
    throw err;
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

const L1 = new Map();
const CACHE_TTL_MS = 45 * 1000;

async function getCached(key) {
    const l1 = L1.get(key);
    if (l1 && l1.expiresAt > Date.now()) {
        return { data: l1.data, level: "l1" };
    }
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
    if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
        try {
            const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
                headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
            });
            if (res.ok) {
                const json = await res.json();
                if (json.result) {
                    const data = JSON.parse(json.result);
                    L1.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
                    return { data, level: "l2" };
                }
            }
        } catch (e) {
            console.error("L2 cache get err:", e);
        }
    }
    return null;
}

async function setCached(key, data) {
    L1.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
    if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
        try {
            await fetch(`${UPSTASH_REDIS_REST_URL}/set/${key}?EX=45`, {
                method: "POST",
                headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error("L2 cache set err:", e);
        }
    }
}

function validateAddress(address) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

module.exports = {
    withFailover,
    authenticate,
    getCached,
    setCached,
    validateAddress,
    TIER_NAMES,
    PROV_NAMES,
    ONCHAIN_FEES,
    CHAIN_ID
};
