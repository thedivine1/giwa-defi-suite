"use strict";
const { withFailover, authKey, burst, meter, validateAddress, ONCHAIN_FEES, TIER_NAMES } = require('../utils');

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

    // Meter
    let usage = { used: null, cap: record.cap, remaining: null };
    try { usage = await meter(record, token, 1); } catch (e) {
        if (e.status === 402) return res.status(402).json({ error: e.message, code: e.code });
    }

    try {
        const tier = await withFailover(async ({ contract }) => {
            return Number(await contract.tierOfWallet(address));
        });
        const tierName = TIER_NAMES[tier];

        const out = {
            address,
            tier,
            tierName,
            fees: ONCHAIN_FEES[tier] || null,
            usage
        };
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
