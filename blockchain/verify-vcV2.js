require("dotenv").config();
const fs = require("fs");
const { verifyCredential } = require("did-jwt-vc");
const { Resolver } = require("did-resolver");
const { getResolver } = require("ethr-did-resolver");
const { ethers } = require("ethers");

async function main() {
  // 1) Load VC JWT from file
  const { vcJwt } = JSON.parse(fs.readFileSync("vc.json", "utf-8"));

  // 2) Setup DID Resolver (for your private chain)
  const rpcUrl = process.env.RPC_URL || "http://192.168.245.65:8545"; // your Geth node
  const chainId = 4321;
  const registry = process.env.DEPLOYED_ADDR;

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

  // 3) Verify VC
  const verifiedVC = await verifyCredential(vcJwt, didResolver);
  console.log("✅ VC verified:", verifiedVC);

  // Extract claims
  const claims = verifiedVC.payload.vc.credentialSubject;
  console.log("Claims:", claims);

  // 4) Inline Policy Check (Stage 1 simulation of OPA)
  function evaluatePolicy(claims) {
    // Example policy: only students from MyUniversity are allowed
    if (claims.role === "student" && claims.university === "MyUniversity") {
      return { allow: true, reason: "Valid student from MyUniversity" };
    }
    return { allow: false, reason: "Policy not satisfied" };
  }

  const decision = evaluatePolicy(claims);

  // 5) Apply decision
  if (decision.allow) {
    console.log("✅ Access granted:", decision.reason);
  } else {
    console.log("❌ Access denied:", decision.reason);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
