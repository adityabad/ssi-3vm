require("dotenv").config();
const { ethers } = require("ethers");
const { getResolver } = require("ethr-did-resolver");
const { Resolver } = require("did-resolver");
const { verifyCredential } = require("did-jwt-vc");
const fs = require("fs");

async function main() {
  const rpcUrl = "http://192.168.233.65:8545";
  const chainId = 4321;
  const registry = process.env.DEPLOYED_ADDR;

  // Load Holder wallet (for signing challenge)
  const holderWallet = new ethers.Wallet(process.env.HOLDER_PK);

  // Holder DID
  const holderDid = `did:ethr:${chainId}:${holderWallet.address}`;
  console.log("Holder DID:", holderDid);

  // ---- Step 1: Verifier sends a challenge ----
  const challenge = `login:${holderDid}:${Date.now()}:${ethers.hexlify(ethers.randomBytes(8))}`;
  console.log("\n[Verifier] Challenge:", challenge);

  // ---- Step 2: Holder signs the challenge ----
  const signature = await holderWallet.signMessage(challenge);
  console.log("[Holder] Signature:", signature);

  // ---- Step 3: Verifier verifies Holder DID control ----
  const recovered = ethers.verifyMessage(challenge, signature);
  if (recovered.toLowerCase() === holderWallet.address.toLowerCase()) {
    console.log("✅ DID ownership verified");
  } else {
    console.error("❌ DID ownership failed");
    process.exit(1);
  }

  // ---- Step 4: Holder presents VC ----
  const { vcJwt } = JSON.parse(fs.readFileSync("vc.json"));
  console.log("\n[Holder] Presents VC:", vcJwt);

  // ---- Step 5: Verifier verifies VC with resolver ----
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

  const verifiedVC = await verifyCredential(vcJwt, didResolver);
  console.log("✅ VC verified. Payload:");
  console.log(JSON.stringify(verifiedVC, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
