const { withFailover, authenticate, CHAIN_ID } = require('./utils');

export default async function handler(req, res) {
    if (!authenticate(req, res)) return;

    try {
        let ms = 0;
        const block = await withFailover(async ({ provider }) => {
            const start = performance.now();
            const b = await provider.getBlockNumber();
            ms = Math.round(performance.now() - start);
            return b;
        });

        const l2 = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

        res.status(200).json({ 
            ok: true, 
            chain: "giwa-sepolia", 
            chainId: CHAIN_ID, 
            block,
            contract: "0xDe9De6f3d4a50BF414927EF6D523aFa65355492a",
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
}
