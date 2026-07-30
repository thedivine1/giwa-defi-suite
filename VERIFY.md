# Manual Verification Fallback

The `scripts/verify-all.js` script successfully verified the majority of contracts via the hardhat-verify plugin. However, the `GIWASwapFactory` failed with a bytecode mismatch error from the explorer API.

To manually verify the `GIWASwapFactory` (or any other contract that fails automated verification) on Blockscout:

1. Go to the GIWA Sepolia explorer for the unverified contract address (e.g. `https://sepolia-explorer.giwa.io/address/0x7c7825AEF6b8b590dcF48d8C5059F3594B84a99F`).
2. Navigate to the **Contract** tab and click **Verify & publish**.
3. Select **Solidity (Standard JSON input)** or **Solidity (Single file)** depending on how you wish to upload the source. 
   - Compiler Version: `v0.8.28+commit.7893614a` (or your local solc version).
   - Optimization: `Yes`, Runs: `200`.
   - EVM Version: `paris`.
4. Upload the flattened source code (or standard JSON input from `artifacts/build-info`).
5. Enter the ABI-encoded constructor arguments (if applicable, ensuring they match what was provided during deployment).
6. Click **Verify and Publish**. 
