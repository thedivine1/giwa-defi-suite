"use strict";
const { JsonRpcProvider, Contract } = require("ethers");

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

// ─── RPC Failover ──────────────────────────────────────────────────────────────
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

// ─── Upstash KV Helpers ────────────────────────────────────────────────────────
function kvBase() {
    let { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: tok } = process.env;
    if (url && url.endsWith('/')) url = url.slice(0, -1);
    return { url, tok };
}

function kvConfigured() {
    const { url, tok } = kvBase();
    return !!(url && tok);
}

async function kvGet(k) {
    const { url, tok } = kvBase();
    if (!url || !tok) return null;
    try {
        const r = await fetch(`${url}/get/${encodeURIComponent(k)}`, {
            headers: { Authorization: `Bearer ${tok}` }
        });
        if (!r.ok) {
            console.error("kvGet HTTP error:", r.status, await r.text());
            return null;
        }
        const j = await r.json();
        if (j.result == null) return null;
        try { return JSON.parse(j.result); } catch { return j.result; }
    } catch (e) {
        console.error("kvGet err:", e);
        return null;
    }
}

async function kvSet(k, v, ttlSec) {
    const { url, tok } = kvBase();
    if (!url || !tok) throw new Error("KV_NOT_CONFIGURED");
    const qs = ttlSec ? `?EX=${ttlSec}` : "";
    const r = await fetch(`${url}/set/${encodeURIComponent(k)}${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
        body: JSON.stringify(v)
    });
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Upstash kvSet error: ${r.status} ${text}`);
    }
}

// Returns new value after increment. Applies TTL on first creation (count == 1).
async function kvIncr(k, ttlSec) {
    const { url, tok } = kvBase();
    if (!url || !tok) return null;
    try {
        const r = await fetch(`${url}/incr/${encodeURIComponent(k)}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tok}` }
        });
        if (!r.ok) return null;
        const j = await r.json();
        const val = j.result;
        // Apply TTL on first creation so we don't persist forever
        if (val === 1 && ttlSec) {
            fetch(`${url}/expire/${encodeURIComponent(k)}/${ttlSec}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tok}` }
            }).catch(() => {});
        }
        return val;
    } catch (e) {
        console.error("kvIncr err:", e);
        return null;
    }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
// Returns a key-record or null. Does NOT write to res; callers handle 401.
async function authKey(req) {
    const token = req.headers["x-proven-key"] || "";
    if (!token) return null;

    // 1) Manual pilot keys (env PROVEN_KEYS always wins)
    let envKeys = [];
    try { envKeys = JSON.parse(process.env.PROVEN_KEYS || "[]"); } catch {}
    const envMatch = envKeys.find(k => k.key === token);
    if (envMatch) {
        return { name: envMatch.name || "pilot", tier: "pilot", cap: envMatch.cap || 1000000, burst: 300, _token: token, _env: true };
    }

    // 2) KV trial key
    const record = await kvGet("key:" + token);
    if (record && record.cap) {
        return { ...record, _token: token, _env: false };
    }
    return null;
}

// ─── Rate Burst ───────────────────────────────────────────────────────────────
async function burst(record, token) {
    if (record._env) return; // pilot keys: no burst enforcement
    const bucket = Math.floor(Date.now() / 60000);
    const k = `burst:${token}:${bucket}`;
    const current = await kvIncr(k, 65);
    if (current !== null && current > record.burst) {
        const err = new Error("Rate limit exceeded");
        err.status = 429;
        err.code = "RATE_LIMITED";
        err.retryAfter = String(60 - (Date.now() % 60000) / 1000 | 0 + 1);
        throw err;
    }
}

// ─── Metering ─────────────────────────────────────────────────────────────────
// Returns { used, cap, remaining, notice? }. Throws on exhaustion.
async function meter(record, token, n = 1) {
    if (record._env) {
        // Pilot keys: in-memory counter only, no hard cap enforcement
        return { used: null, cap: record.cap, remaining: null };
    }
    const k = `used:${token}`;
    const TTL_30D = 30 * 24 * 3600;
    // Increment first, then inspect
    const used = await kvIncr(k, TTL_30D);
    if (used === null) {
        // KV unavailable; allow through silently
        return { used: null, cap: record.cap, remaining: null };
    }
    // Adjust for batch (we incremented by 1 but n may be > 1; do remaining increments)
    let finalUsed = used;
    if (n > 1) {
        // pipeline remaining n-1 increments — fire-and-forget for speed
        for (let i = 1; i < n; i++) {
            kvIncr(k, TTL_30D).catch(() => {});
        }
        finalUsed = used + (n - 1);
    }
    // Check cap against pre-call count (used - n = calls before this batch)
    const preCall = finalUsed - n;
    if (preCall >= record.cap) {
        const err = new Error("Trial quota exhausted (1,000 calls). Subscribe for more than 1,000 calls/mo: proven.defi@gmail.com");
        err.status = 402;
        err.code = "TRIAL_EXHAUSTED";
        throw err;
    }
    const remaining = Math.max(0, record.cap - finalUsed);
    const result = { used: finalUsed, cap: record.cap, remaining };
    if (finalUsed >= 900) {
        result.notice = `You've used ${finalUsed} of ${record.cap} trial calls — hope you're finding this useful! Kindly subscribe for more than 1,000 calls/mo: proven.defi@gmail.com`;
    }
    return result;
}

// ─── Score Cache (L1 + L2) ────────────────────────────────────────────────────
const L1 = new Map();
const CACHE_TTL_MS = 45 * 1000;

async function getCached(key) {
    const l1 = L1.get(key);
    if (l1 && l1.expiresAt > Date.now()) {
        return { data: l1.data, level: "l1" };
    }
    const { url, tok } = kvBase();
    if (url && tok) {
        try {
            const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
                headers: { Authorization: `Bearer ${tok}` }
            });
            if (r.ok) {
                const j = await r.json();
                if (j.result) {
                    const data = JSON.parse(j.result);
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
    const { url, tok } = kvBase();
    if (url && tok) {
        try {
            await fetch(`${url}/set/${encodeURIComponent(key)}?EX=45`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tok}` },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error("L2 cache set err:", e);
        }
    }
}

// ─── Misc ──────────────────────────────────────────────────────────────────────
function validateAddress(address) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

module.exports = {
    withFailover,
    authKey,
    burst,
    meter,
    kvGet,
    kvSet,
    kvIncr,
    kvConfigured,
    getCached,
    setCached,
    validateAddress,
    TIER_NAMES,
    PROV_NAMES,
    ONCHAIN_FEES,
    CHAIN_ID,
    CONTRACT_ADDRESS
};
