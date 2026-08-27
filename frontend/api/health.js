"use strict";
const { withFailover, authKey, kvConfigured, CHAIN_ID, CONTRACT_ADDRESS } = require('./utils');

module.exports = async function handler(req, res) {
    const record = await authKey(req);
    if (!record) return res.status(401).json({ error: "Missing or invalid x-proven-key" });

    try {
        let ms = 0;
        const block = await withFailover(async ({ provider }) => {
            const start = performance.now();
            const b = await provider.getBlockNumber();
            ms = Math.round(performance.now() - start);
            return b;
        });

        const l2 = kvConfigured();

        res.status(200).json({
            ok: true,
            chain: "giwa-sepolia",
            chainId: CHAIN_ID,
            block,
            contract: CONTRACT_ADDRESS,
            cache: { l1: true, l2 },
            rpc: { ok: true, ms }
        });
    } catch (error) {
        console.error("Health check error:", error);
        if (error.code === "RPC_DOWN") {
            res.setHeader("Retry-After", "5");
            return res.status(503).json({ error: "upstream RPC unavailable", code: "RPC_DOWN" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
