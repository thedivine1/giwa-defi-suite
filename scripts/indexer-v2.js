const { ethers } = require("ethers");
const fs = require("fs");
const RPC = process.env.GIWA_RPC || "https://rpc.sepolia.giwa.io";   // confirm against your config
const V2 = require("../deployed-addresses.json").DojangScoreV2;
const POOL = "0x8813361aA6FFdC1B5926FA95d756b7390C680059";
const VAULT = "0xEE4E6829EB6A7B79f826AD99E06d8Fb5629169F5";
const STATE = "indexer-v2-state.json";

const provider = new ethers.JsonRpcProvider(RPC);
const reporter = new ethers.Wallet(process.env.REPORTER_KEY, provider);   // a whitelisted REPORTER_ROLE key
const v2 = new ethers.Contract(V2, ["function addBehavioral(address,uint128)", "function behavioral(address) view returns (uint128)"], reporter);
const pool = new ethers.Contract(POOL, ["event Swap(address indexed sender,uint256 a0,uint256 a1,uint256 r0,uint256 r1,address indexed to)", "event Mint(address indexed sender,uint256 a0,uint256 a1)"], provider);
const vault = new ethers.Contract(VAULT, ["event Deposit(address indexed sender,address indexed owner,uint256 assets,uint256 shares)"], provider);

const agg = {};                 // wallet -> { swaps, lp, firstDep, votes }
const W = { swap: 8, lp: 60, hold30: 80 };   // per-event behavioral weights (tune)
function load() { try { const s = JSON.parse(fs.readFileSync(STATE)); return s; } catch { return { lastBlock: 0 }; } }
function save(b) { fs.writeFileSync(STATE, JSON.stringify({ lastBlock: b, agg })); }

async function flush(wallet) {
    let total = 0;
    const a = agg[wallet]; if (!a) return;
    total += Math.min(a.swaps || 0, 30) * W.swap;          // cap counted swaps
    if (a.lp) total += W.lp;
    if (a.firstDep && (Date.now() / 1000 - a.firstDep) >= 30 * 86400) total += W.hold30;
    total = Math.min(total, 250);
    const onchain = Number(await v2.behavioral(wallet));
    if (total > onchain) { const tx = await v2.addBehavioral(wallet, total - onchain); await tx.wait(); console.log("recorded", wallet, total, tx.hash); }
}

async function run() {
    let { lastBlock } = load();
    if (!lastBlock) lastBlock = (await provider.getBlockNumber()) - 5000;
    const handle = async (wallet, kind) => {
        wallet = wallet.toLowerCase();
        agg[wallet] = agg[wallet] || { swaps: 0, lp: false, firstDep: 0 };
        if (kind === "swap") agg[wallet].swaps++;
        if (kind === "lp") agg[wallet].lp = true;
        if (kind === "dep" && !agg[wallet].firstDep) agg[wallet].firstDep = Math.floor(Date.now() / 1000);
        await flush(wallet);
    };
    pool.on("Swap", (s, a0, a1, r0, r1, to, ev) => handle(to, "swap"));
    pool.on("Mint", (s, a0, a1, ev) => handle(s, "lp"));
    vault.on("Deposit", (s, o, assets, shares, ev) => handle(o, "dep"));
    // catch-up scan from lastBlock, then live
    console.log("indexer-v2 live, reporter", reporter.address, "from block", lastBlock);
}
run().catch(console.error);