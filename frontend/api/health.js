const { getContract, authenticate, CHAIN_ID } = require('./utils');

export default async function handler(req, res) {
    if (!authenticate(req, res)) return;

    try {
        const { provider } = getContract();
        const block = await provider.getBlockNumber();
        res.status(200).json({ ok: true, chain: CHAIN_ID, block });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
}
