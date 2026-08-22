const { getContract, authenticate, getCached, setCached, validateAddress, PROV_NAMES, CHAIN_ID } = require('../utils');

export default async function handler(req, res) {
    const auth = authenticate(req, res);
    if (!auth) return;

    const { address } = req.query;
    if (!validateAddress(address)) {
        return res.status(400).json({ error: "Invalid address format" });
    }

    const cacheKey = `score-${address}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
        return res.status(200).json({ ...cachedData, cached: true, usage: auth.usage });
    }

    try {
        const { contract } = getContract();
        const [score, tier, tierName, breakdown] = await Promise.all([
            contract.score(address),
            contract.tierOfWallet(address),
            contract.tierName(await contract.tierOfWallet(address)),
            contract.scoreBreakdown(address)
        ]);

        const data = {
            address,
            score: Number(score),
            tier: Number(tier),
            tierName,
            ceiling: Number(breakdown.ceiling),
            ceilingProvenance: PROV_NAMES[Number(breakdown.ceilingProvenance)] || "UNKNOWN",
            provenance: {
                baseAttestation: Number(breakdown.baseAttestation),
                trustlessState: Number(breakdown.trustlessState),
                reporterActivity: Number(breakdown.reporterActivity),
                consentedProofs: Number(breakdown.consentedProofs)
            },
            holdsLP: breakdown.holdsLP,
            holdsVault: breakdown.holdsVault,
            chain: CHAIN_ID,
            cachedAt: Date.now()
        };

        setCached(cacheKey, data);
        res.status(200).json({ ...data, cached: false, usage: auth.usage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}
