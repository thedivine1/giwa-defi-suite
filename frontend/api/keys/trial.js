"use strict";
const crypto = require("crypto");
const { kvGet, kvSet, kvIncr, kvConfigured } = require("../utils");

module.exports = async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

    if (!kvConfigured()) {
        return res.status(503).json({
            code: "KV_NOT_CONFIGURED",
            error: "Key storage not configured; set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
        });
    }

    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "invalid JSON body" }); }

    const project = body && body.project;
    const contact = (body && body.contact) || null;

    if (!project || typeof project !== "string" || project.trim().length < 3 || project.trim().length > 60) {
        return res.status(400).json({ error: "project is required (3–60 characters)" });
    }

    // Abuse guard: max 3 trial keys per IP per day
    const clientIP = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const ipKey = `issue:${clientIP}:${day}`;
    const issueCount = await kvIncr(ipKey, 86400);
    if (issueCount !== null && issueCount > 3) {
        return res.status(429).json({
            code: "TOO_MANY_TRIALS",
            error: "Max 3 trial keys per day per IP"
        });
    }

    const token = "pv_trial_" + crypto.randomBytes(16).toString("hex");
    const record = {
        name: project.trim(),
        tier: "trial",
        cap: 1000,
        burst: 60,
        contact: contact || null,
        createdAt: new Date().toISOString()
    };

    await kvSet("key:" + token, record, 2592000); // 30 days

    return res.status(200).json({
        key: token,
        tier: "trial",
        cap: 1000,
        burstPerMin: 60,
        expiresIn: "30 days",
        docs: "https://giwa-defi-suite.vercel.app/api-quickstart.html",
        note: "Free testnet trial — 1,000 calls included. Keep the key server-side."
    });
};
