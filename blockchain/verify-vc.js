require("dotenv").config();
const { ethers } = require("ethers");
const { getResolver } = require("ethr-did-resolver");
const { Resolver } = require("did-resolver");
const { verifyCredential } = require("did-jwt-vc");
const fs = require("fs");

async function main() {
  const rpcUrl = process.env.RPC_URL || "http://192.168.245.65:8545";
   
  const chainId = 4321; // your private chain
  const registry = process.env.DEPLOYED_ADDR;

  // 1) Load the VC JWT from file
  const file = fs.readFileSync("vc3.json");
  const { vcJwt } = JSON.parse(file);
  console.log("Loaded VC JWT:\n", vcJwt);

  // 2) Setup DID Resolver for your chain
  const ethrDidResolver = getResolver({
    networks: [
      {
        name: String(chainId),
        chainId,
        rpcUrl,
        registry,
      },
    ],
  });
  const didResolver = new Resolver(ethrDidResolver);

  // 3) Verify the credential
  const verifiedVC = await verifyCredential(vcJwt, didResolver);

  console.log("\n✅ VC verified successfully!");
  console.log("Decoded VC payload:\n", JSON.stringify(verifiedVC, null, 2));
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
