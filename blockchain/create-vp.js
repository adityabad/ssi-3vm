const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const fs = require("fs");
const { createVerifiablePresentationJwt } = require("did-jwt-vc");
const { ES256KSigner } = require("did-jwt");
const { ethers } = require("ethers");

async function main() {
  const chainId = 4321;
  const holderPk = process.env.HOLDER_PK.replace(/^0x/, ""); // raw hex
  const holderWallet = new ethers.Wallet(process.env.HOLDER_PK);
  const holderDid = `did:ethr:${chainId}:${holderWallet.address}`;

  // --- Load VCs you want to present ---
  const vc1 = JSON.parse(fs.readFileSync("../vc1.json")).vcJwt;
  const vc3 = JSON.parse(fs.readFileSync("../vc3.json")).vcJwt;
  const selectedVCs = [vc1, vc3]; // pick selectively

  // --- Build VP payload ---
  const vpPayload = {
    vp: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation"],
      verifiableCredential: selectedVCs,
    },
    nbf: Math.floor(Date.now() / 1000),
  };

  // --- Use ES256KSigner (correct compact signature) ---
  const vpJwt = await createVerifiablePresentationJwt(vpPayload, {
    did: holderDid,
    signer: ES256KSigner(Buffer.from(holderPk, "hex")),
  });

  fs.writeFileSync("../vp2.json", JSON.stringify({ vpJwt }, null, 2));
  console.log("✅ VP JWT created and saved to vp2.json");
}

main();
