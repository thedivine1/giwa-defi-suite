const hre = require("hardhat");

const SCROLL = "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9";
const EAS = "0x4200000000000000000000000000000000000021";
const TKRW = "0x11DF7b38DA5F496F2B02bb6E51eAcDFEfcAB4f40";
const TUSD = "0x84D986ac1B5913253a417a1AB68F94CD77e59a80";
const SCORE1 = "0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f";
const VAULT = "0xEE4E6829EB6A7B79f826AD99E06d8Fb5629169F5";
const FACT = "0x7c7825AEF6b8b590dcF48d8C5059F3594B84a99F";
const POOL = "0x8813361aA6FFdC1B5926FA95d756b7390C680059";
const SCORE2 = "0xDe9De6f3d4a50BF414927EF6D523aFa65355492a";
const DEPLOYER = "0xE5EFB15259292F5B60A1DB074B708712998dB147";

const CONTRACTS = [
  { name: "TKRW", address: TKRW, args: ["Test KRW", "TKRW", 18] },
  { name: "TUSD", address: TUSD, args: ["Test USD", "TUSD", 6] },
  { name: "DojangScore", address: SCORE1, args: [SCROLL, EAS] },
  { name: "WonVault", address: VAULT, args: [TKRW, SCORE1, DEPLOYER] },
  { name: "GIWASwapFactory", address: FACT, args: [SCORE1] },
  { name: "GIWASwapPool", address: POOL, args: [TKRW, TUSD, SCORE1] },
  { name: "DojangScoreV2", address: SCORE2, args: [SCROLL, EAS, POOL, VAULT, DEPLOYER] },
];

async function main() {
  let ok = 0, already = 0, fail = 0;
  for (const c of CONTRACTS) {
    process.stdout.write(`\n[${c.name}] ${c.address} ... `);
    try {
      await hre.run("verify:verify", { address: c.address, constructorArguments: c.args });
      console.log("✓ verified"); ok++;
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/already verified|contract source code already verified/i.test(msg)) {
        console.log("✓ already verified"); already++;
      } else {
        console.log("✗ FAILED\n     " + msg.split("\n")[0]); fail++;
      }
    }
  }
  console.log("\n===========================================");
  console.log(`  Verified now: ${ok}   Already: ${already}   Failed: ${fail}`);
  console.log("===========================================");
  if (fail > 0) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exit(1); });