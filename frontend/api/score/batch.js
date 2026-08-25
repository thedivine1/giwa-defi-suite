const { JsonRpcProvider, Contract } = require("ethers");
const RPC = process.env.GIWA_RPC || "https://sepolia-rpc.giwa.io";
const V2  = "0xDe9De6f3d4a50BF414927EF6D523aFa65355492a";
const ABI = [
  "function score(address) view returns (uint16)",
  "function tierOfWallet(address) view returns (uint8)",
  "function tierName(uint8) view returns (string)",
  "function scoreBreakdown(address) view returns (tuple(uint16 baseAttestation,uint16 trustlessState,uint16 reporterActivity,uint16 consentedProofs,uint16 rawSum,uint16 ceiling,uint8 ceilingProvenance,uint16 finalScore,uint8 tier,bool holdsLP,bool holdsVault))"
];
const PROV = ["NONE","BEHAVIORAL","CONSENTED","ATTESTER"];
const TTL = 45000, CONC = 8, MAX = 500;
const cache = new Map();
const provider = new JsonRpcProvider(RPC);
const c = new Contract(V2, ABI, provider);
const isAddr = a => typeof a==="string" && /^0x[0-9a-fA-F]{40}$/.test(a);
const keys = () => { try { return JSON.parse(process.env.PROVEN_KEYS||"[]"); } catch { return []; } };
async function readOne(a){
  const k=a.toLowerCase(); const hit=cache.get(k);
  if (hit && Date.now()-hit.at<TTL) return { ...hit.val, cached:true, cachedAt:new Date(hit.at).toISOString() };
  const bd = await c.scoreBreakdown(a);
  const tierName = await c.tierName(bd.tier);
  const val = { address:a, score:Number(bd.finalScore), tier:Number(bd.tier), tierName,
    ceiling:Number(bd.ceiling), ceilingProvenance:PROV[Number(bd.ceilingProvenance)],
    provenance:{ baseAttestation:Number(bd.baseAttestation), trustlessState:Number(bd.trustlessState),
      reporterActivity:Number(bd.reporterActivity), consentedProofs:Number(bd.consentedProofs) },
    rawSum:Number(bd.rawSum), holdsLP:bd.holdsLP, holdsVault:bd.holdsVault, cached:false, cachedAt:new Date().toISOString() };
  cache.set(k,{at:Date.now(),val}); return val;
}
async function mapLimit(items, fn){ const out=new Array(items.length); let i=0;
  async function w(){ for(;;){ const idx=i++; if(idx>=items.length) return;
    try { out[idx]=await fn(items[idx]); } catch(e){ out[idx]={address:items[idx],error:String((e&&e.shortMessage)||e.message||e)}; } } }
  await Promise.all(Array.from({length:Math.min(CONC,items.length)},w)); return out; }
module.exports = async function handler(req,res){
  if (req.method!=="POST") return res.status(405).json({error:"method not allowed"});
  const key = keys().find(x=>x.key===req.headers["x-proven-key"]); if(!key) return res.status(401).json({error:"missing or invalid x-proven-key"});
  let body; try { body = typeof req.body==="string"? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({error:"invalid JSON body"}); }
  const addrs = body && body.addresses;
  if(!Array.isArray(addrs)||addrs.length===0) return res.status(400).json({error:"addresses must be a non-empty array"});
  if(addrs.length>MAX) return res.status(400).json({error:"max 500 addresses per batch"});
  const results = await mapLimit(addrs, async a => isAddr(a) ? readOne(a) : {address:a,error:"invalid address"});
  const failed = results.filter(r=>r.error).length;
  res.setHeader("X-RateLimit-Limit", key.cap||1000);
  return res.status(200).json({ results, count: results.length, failed });
};
