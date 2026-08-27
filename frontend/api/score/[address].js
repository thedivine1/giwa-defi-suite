"use strict";
const { withFailover, authKey, burst, meter, getCached, setCached, validateAddress, PROV_NAMES, TIER_NAMES, CHAIN_ID } = require('../utils');

module.exports = async function handler(req, res) {
    const token = req.headers["x-proven-key"] || "";
    const record = await authKey(req);
    if (!record) return res.status(401).json({ error: "Missing or invalid x-proven-key" });

    const { address } = req.query;
    if (!validateAddress(address)) {
        return res.status(400).json({ error: "Invalid address format" });
    }

    // Burst check
    try { await burst(record, token); } catch (e) {
        if (e.status === 429) {
            res.setHeader("Retry-After", e.retryAfter || "60");
            return res.status(429).json({ error: e.message, code: e.code });
        }
    }

    const cacheKey = `score:${address.toLowerCase()}`;
    const cachedHit = await getCached(cacheKey);
    if (cachedHit) {
        // Meter even on cache hit
        let usage = { used: null, cap: record.cap, remaining: null };
        try { usage = await meter(record, token, 1); } catch (e) {
            if (e.status === 402) return res.status(402).json({ error: e.message, code: e.code });
        }
        const out = { ...cachedHit.data, cached: true, cacheLevel: cachedHit.level, usage };
        if (usage.notice) out.notice = usage.notice;
        return res.status(200).json(out);
    }

    try {
        const breakdown = await withFailover(async ({ contract }) => {
            return contract.scoreBreakdown(address);
        });

        const data = {
            address,
            score: Number(breakdown.finalScore),
            tier: Number(breakdown.tier),
            tierName: TIER_NAMES[Number(breakdown.tier)],
            ceiling: Number(breakdown.ceiling),
            ceilingProvenance: PROV_NAMES[Number(breakdown.ceilingProvenance)] || "UNKNOWN",
            provenance: {
                baseAttestation: Number(breakdown.baseAttestation),
                trustlessState: Number(breakdown.trustlessState),
                reporterActivity: Number(breakdown.reporterActivity),
                consentedProofs: Number(breakdown.consentedProofs)
            },
            rawSum: Number(breakdown.rawSum),
            holdsLP: breakdown.holdsLP,
            holdsVault: breakdown.holdsVault,
            chain: CHAIN_ID,
            cachedAt: Date.now()
        };

        await setCached(cacheKey, data);

        let usage = { used: null, cap: record.cap, remaining: null };
        try { usage = await meter(record, token, 1); } catch (e) {
            if (e.status === 402) return res.status(402).json({ error: e.message, code: e.code });
        }

        const out = { ...data, cached: false, usage };
        if (usage.notice) out.notice = usage.notice;
        res.status(200).json(out);
    } catch (error) {
        console.error(error);
        if (error.code === "RPC_DOWN") {
            res.setHeader("Retry-After", "5");
            return res.status(503).json({ error: "upstream RPC unavailable", code: "RPC_DOWN" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
