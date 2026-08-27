"use strict";
const { authKey, kvGet, kvConfigured } = require("../utils");

module.exports = async function handler(req, res) {
    if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

    if (!kvConfigured()) {
        return res.status(503).json({
            code: "KV_NOT_CONFIGURED",
            error: "Key storage not configured; set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
        });
    }

    const token = req.headers["x-proven-key"] || "";
    const record = await authKey(req);
    if (!record) return res.status(401).json({ error: "Missing or invalid x-proven-key" });

    // For env-based pilot keys, we don't track usage in KV
    if (record._env) {
        return res.status(200).json({
            tier: record.tier,
            cap: record.cap,
            used: null,
            remaining: null,
            burstPerMin: record.burst,
            note: "Pilot key — usage is not metered via KV"
        });
    }

    const usedRaw = await kvGet("used:" + token);
    const used = usedRaw ? Number(usedRaw) : 0;
    const remaining = Math.max(0, record.cap - used);

    const out = {
        tier: record.tier,
        cap: record.cap,
        used,
        remaining,
        burstPerMin: record.burst
    };

    if (used >= 900) {
        out.notice = `You've used ${used} of ${record.cap} trial calls — hope you're finding this useful! Kindly subscribe for more than 1,000 calls/mo: proven.defi@gmail.com`;
    }

    return res.status(200).json(out);
};
