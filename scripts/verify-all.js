const hre = require("hardhat");

async function main() {
  const contracts = [
    {
      name: "TKRW",
      address: "0x11DF7b38DA5F496F2B02bb6E51eAcDFEfcAB4f40",
      args: ["Test KRW", "TKRW", 18]
    },
    {
      name: "TUSD",
      address: "0x84D986ac1B5913253a417a1AB68F94CD77e59a80",
      args: ["Test USD", "TUSD", 6]
    },
    {
      name: "DojangScore",
      address: "0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f",
      args: ["0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9", "0x4200000000000000000000000000000000000021"]
    },
    {
      name: "WonVault",
      address: "0xEE4E6829EB6A7B79f826AD99E06d8Fb5629169F5",
      args: ["0x11DF7b38DA5F496F2B02bb6E51eAcDFEfcAB4f40", "0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f", "0xE5EFB15259292F5B60A1DB074B708712998dB147"]
    },
    {
      name: "Factory",
      address: "0x7c7825AEF6b8b590dcF48d8C5059F3594B84a99F",
      args: ["0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f"]
    },
    {
      name: "Pool",
      address: "0x8813361aA6FFdC1B5926FA95d756b7390C680059",
      args: ["0x11DF7b38DA5F496F2B02bb6E51eAcDFEfcAB4f40", "0x84D986ac1B5913253a417a1AB68F94CD77e59a80", "0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f"]
    }
  ];

  for (const contract of contracts) {
    console.log(`\nVerifying ${contract.name} at ${contract.address}...`);
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
      });
      console.log(`✓ ${contract.name} verified successfully (or already verified).`);
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
        console.log(`✓ ${contract.name} already verified.`);
      } else {
        console.log(`✗ Failed to verify ${contract.name}:`, e.message);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
