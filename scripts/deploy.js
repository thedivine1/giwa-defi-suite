const hre = require("hardhat");
const fs = require("fs");

const DOJANG_SCROLL = "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9";
const EAS_PREDEPLOY = "0x4200000000000000000000000000000000000021";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);

    console.log("===========================================");
    console.log("  GIWA DeFi Suite - Deployment");
    console.log("  Network: GIWA Sepolia (chainId 91342)");
    console.log("  Deployer:", deployer.address);
    console.log("  Balance:", hre.ethers.formatEther(balance), "ETH");
    console.log("===========================================\n");

    if (balance === 0n) {
        console.log("ERROR: No testnet ETH. Mine some at https://faucet.giwa.io first.");
        process.exit(1);
    }

    console.log("1/7  Deploying Test KRW (TKRW)...");
    const Mock = await hre.ethers.getContractFactory("MockERC20");
    const tkrw = await Mock.deploy("Test KRW", "TKRW", 18);
    await tkrw.waitForDeployment();
    const TKRW = await tkrw.getAddress();
    console.log("     TKRW:", TKRW);

    console.log("2/7  Deploying Test USD (TUSD)...");
    const tusd = await Mock.deploy("Test USD", "TUSD", 6);
    await tusd.waitForDeployment();
    const TUSD = await tusd.getAddress();
    console.log("     TUSD:", TUSD);

    console.log("3/7  Deploying DojangScore...");
    const Score = await hre.ethers.getContractFactory("DojangScore");
    const score = await Score.deploy(DOJANG_SCROLL, EAS_PREDEPLOY);
    await score.waitForDeployment();
    const SCORE = await score.getAddress();
    console.log("     DojangScore:", SCORE);

    console.log("4/7  Deploying WonVault...");
    const Vault = await hre.ethers.getContractFactory("WonVault");
    const vault = await Vault.deploy(TKRW, SCORE, deployer.address);
    await vault.waitForDeployment();
    const VAULT = await vault.getAddress();
    console.log("     WonVault:", VAULT);

    console.log("5/7  Deploying GIWASwapFactory...");
    const Factory = await hre.ethers.getContractFactory("GIWASwapFactory");
    const factory = await Factory.deploy(SCORE);
    await factory.waitForDeployment();
    const FACTORY = await factory.getAddress();
    console.log("     Factory:", FACTORY);

    console.log("6/7  Creating TKRW/TUSD pool...");
    const tx = await factory.createPool(TKRW, TUSD);
    await tx.wait();
    const POOL = await factory.getPool(TKRW, TUSD);
    console.log("     Pool:", POOL);

    console.log("7/7  Seeding liquidity (10,000 TKRW + 10,000 TUSD)...");
    const amtTKRW = hre.ethers.parseEther("10000");
    const amtTUSD = 10000n * 10n ** 6n;

    await (await tkrw.mint(deployer.address, amtTKRW)).wait();
    await (await tusd.mint(deployer.address, amtTUSD)).wait();
    await (await tkrw.transfer(POOL, amtTKRW)).wait();
    await (await tusd.transfer(POOL, amtTUSD)).wait();

    const pool = await hre.ethers.getContractAt("GIWASwapPool", POOL);
    await (await pool.mint(deployer.address)).wait();
    console.log("     Liquidity seeded.");

    console.log("\n===========================================");
    console.log("  DEPLOYMENT COMPLETE");
    console.log("===========================================");
    console.log("  TKRW:           ", TKRW);
    console.log("  TUSD:           ", TUSD);
    console.log("  DojangScore:    ", SCORE);
    console.log("  WonVault:       ", VAULT);
    console.log("  GIWASwapFactory:", FACTORY);
    console.log("  Pool:           ", POOL);
    console.log("===========================================");
    console.log("  Explorer links:");
    console.log("  https://sepolia-explorer.giwa.io/address/" + SCORE);
    console.log("  https://sepolia-explorer.giwa.io/address/" + VAULT);
    console.log("  https://sepolia-explorer.giwa.io/address/" + POOL);
    console.log("===========================================\n");

    const addresses = { TKRW, TUSD, DojangScore: SCORE, WonVault: VAULT, GIWASwapFactory: FACTORY, Pool: POOL };
    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("  Saved to deployed-addresses.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });