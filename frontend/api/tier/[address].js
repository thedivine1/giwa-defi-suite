const { getContract, authenticate, validateAddress, ONCHAIN_FEES } = require('../utils');

export default async function handler(req, res) {
    const auth = authenticate(req, res);
    if (!auth) return;

    const { address } = req.query;
    if (!validateAddress(address)) {
        return res.status(400).json({ error: "Invalid address format" });
    }

    try {
        const { contract } = getContract();
        const tier = Number(await contract.tierOfWallet(address));
        const tierName = await contract.tierName(tier);

        res.status(200).json({
            address,
            tier,
            tierName,
            fees: ONCHAIN_FEES[tier] || null,
            usage: auth.usage
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}
