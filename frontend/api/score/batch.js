"use strict";
const { withFailover, authKey, burst, meter, getCached, setCached, TIER_NAMES, PROV_NAMES } = require("../utils");
const CONC = 8, MAX = 500;
const isAddr = a => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);

async function readOne(a) {
    const cacheKey = `score:${a.toLowerCase()}`;
    const hit = await getCached(cacheKey);
    if (hit) {
        const data = hit.data;
        return { ...data, cached: true, cacheLevel: hit.level, cachedAt: new Date(data.cachedAt).toISOString() };
    }
    const bd = await withFailover(async ({ contract }) => contract.scoreBreakdown(a));
    const tierName = TIER_NAMES[Number(bd.tier)];
    const val = {
        address: a, score: Number(bd.finalScore), tier: Number(bd.tier), tierName,
        ceiling: Number(bd.ceiling), ceilingProvenance: PROV_NAMES[Number(bd.ceilingProvenance)] || "UNKNOWN",
        provenance: {
            baseAttestation: Number(bd.baseAttestation), trustlessState: Number(bd.trustlessState),
            reporterActivity: Number(bd.reporterActivity), consentedProofs: Number(bd.consentedProofs)
        },
        rawSum: Number(bd.rawSum), holdsLP: bd.holdsLP, holdsVault: bd.holdsVault,
        cached: false, cachedAt: Date.now()
    };
    await setCached(cacheKey, val);
    return { ...val, cachedAt: new Date(val.cachedAt).toISOString() };
}

async function mapLimit(items, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function w() {
        for (;;) {
            const idx = i++;
            if (idx >= items.length) return;
            try { out[idx] = await fn(items[idx]); }
            catch (e) { out[idx] = { address: items[idx], error: String((e && e.shortMessage) || e.message || e) }; }
        }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, items.length) }, w));
    return out;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

    const token = req.headers["x-proven-key"] || "";
    const record = await authKey(req);
    if (!record) return res.status(401).json({ error: "missing or invalid x-proven-key" });

    // Burst check
    try { await burst(record, token); } catch (e) {
        if (e.status === 429) {
            res.setHeader("Retry-After", e.retryAfter || "60");
            return res.status(429).json({ error: e.message, code: e.code });
        }
    }

    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "invalid JSON body" }); }

    const addrs = body && body.addresses;
    if (!Array.isArray(addrs) || addrs.length === 0) return res.status(400).json({ error: "addresses must be a non-empty array" });
    if (addrs.length > MAX) return res.status(400).json({ error: "max 500 addresses per batch" });

    const validCount = addrs.filter(isAddr).length;

    // Meter by number of valid addresses
    let usage = { used: null, cap: record.cap, remaining: null };
    try { usage = await meter(record, token, validCount || 1); } catch (e) {
        if (e.status === 402) return res.status(402).json({ error: e.message, code: e.code });
    }

    try {
        const results = await mapLimit(addrs, async a => isAddr(a) ? readOne(a) : { address: a, error: "invalid address" });
        const failed = results.filter(r => r.error).length;
        res.setHeader("X-RateLimit-Limit", record.cap || 1000);
        const out = { results, count: results.length, failed, usage };
        if (usage.notice) out.notice = usage.notice;
        return res.status(200).json(out);
    } catch (error) {
        if (error.code === "RPC_DOWN") {
            res.setHeader("Retry-After", "5");
            return res.status(503).json({ error: "upstream RPC unavailable", code: "RPC_DOWN" });
        }
        return res.status(500).json({ error: "Internal server error" });
    }
};
