const hre = require("hardhat");
const SCROLL = "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9";
const EAS = "0x4200000000000000000000000000000000000021";
const POOL = "0x8813361aA6FFdC1B5926FA95d756b7390C680059";
const VAULT = "0xEE4E6829EB6A7B79f826AD99E06d8Fb5629169F5";

async function main() {
    const [dep] = await hre.ethers.getSigners();
    const treasury = dep.address;                       // 0xE5EF…B147 on your key
    const V2 = await hre.ethers.getContractFactory("DojangScoreV2");
    const v2 = await V2.deploy(SCROLL, EAS, POOL, VAULT, treasury);
    await v2.waitForDeployment();
    const addr = await v2.getAddress();
    console.log("DojangScoreV2 deployed:", addr);
    console.log("REPORTER_ROLE holder (deployer):", await v2.hasRole(await v2.REPORTER_ROLE(), dep.address));
    // record for verify-all + frontend
    const fs = require("fs");
    const da = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf8"));
    da.DojangScoreV2 = addr; fs.writeFileSync("deployed-addresses.json", JSON.stringify(da, null, 2));
    console.log(">>> paste this into frontend doc-score-v2.html const V2 = \"...\"");
}
main().catch(e => { console.error(e); process.exit(1); });