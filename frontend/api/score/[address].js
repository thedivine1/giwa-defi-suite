const { withFailover, authenticate, getCached, setCached, validateAddress, PROV_NAMES, TIER_NAMES, CHAIN_ID } = require('../utils');

export default async function handler(req, res) {
    const auth = authenticate(req, res);
    if (!auth) return;

    const { address } = req.query;
    if (!validateAddress(address)) {
        return res.status(400).json({ error: "Invalid address format" });
    }

    const cacheKey = `score:${address.toLowerCase()}`;
    const cachedHit = await getCached(cacheKey);
    if (cachedHit) {
        return res.status(200).json({ ...cachedHit.data, cached: true, cacheLevel: cachedHit.level, usage: auth.usage });
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
        res.status(200).json({ ...data, cached: false, usage: auth.usage });
    } catch (error) {
        console.error(error);
        if (error.code === "RPC_DOWN") {
            res.setHeader("Retry-After", "5");
            return res.status(503).json({ error: "upstream RPC unavailable", code: "RPC_DOWN" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
}
