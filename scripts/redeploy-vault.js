const hre = require("hardhat");

const TKRW = "0x11DF7b38DA5F496F2B02bb6E51eAcDFEfcAB4f40";
const SCORE = "0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const bal = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address, "| balance:", hre.ethers.formatEther(bal), "ETH");

    if (bal === 0n) { console.log("Need testnet ETH — mine at https://faucet.giwa.io"); process.exit(1); }

    console.log("Deploying fresh WonVault (with inflation protection)...");
    const V = await hre.ethers.getContractFactory("WonVault");
    const v = await V.deploy(TKRW, SCORE, deployer.address);
    await v.waitForDeployment();
    const ADDR = await v.getAddress();

    console.log("\n===========================================");
    console.log("  NEW WonVault:", ADDR);
    console.log("  Explorer:    https://sepolia-explorer.giwa.io/address/" + ADDR);
    console.log("===========================================\n");
    console.log("  -> paste this address into index.html as C.WonVault");
}

main().catch((e) => { console.error(e); process.exit(1); });