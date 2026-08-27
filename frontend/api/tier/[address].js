const { withFailover, authenticate, validateAddress, ONCHAIN_FEES, TIER_NAMES } = require('../utils');

export default async function handler(req, res) {
    const auth = authenticate(req, res);
    if (!auth) return;

    const { address } = req.query;
    if (!validateAddress(address)) {
        return res.status(400).json({ error: "Invalid address format" });
    }

    try {
        const tier = await withFailover(async ({ contract }) => {
            return Number(await contract.tierOfWallet(address));
        });
        const tierName = TIER_NAMES[tier];

        res.status(200).json({
            address,
            tier,
            tierName,
            fees: ONCHAIN_FEES[tier] || null,
            usage: auth.usage
        });
    } catch (error) {
        console.error(error);
        if (error.code === "RPC_DOWN") {
            res.setHeader("Retry-After", "5");
            return res.status(503).json({ error: "upstream RPC unavailable", code: "RPC_DOWN" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
}
