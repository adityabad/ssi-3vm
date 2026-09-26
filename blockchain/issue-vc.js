const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { createVerifiableCredentialJwt } = require("did-jwt-vc");
const { EthrDID } = require("ethr-did");
const { ethers } = require("ethers");
const fs = require("fs");

async function main() {
  // 1) Setup Issuer DID
  const chainId = 4321; // your private chain
  const issuerWallet = new ethers.Wallet(process.env.ISSUER_PK);

  // create EthrDID for issuer
  const issuer = new EthrDID({
    identifier: issuerWallet.address,
    privateKey: process.env.ISSUER_PK,
    chainNameOrId: chainId,
  });

  console.log("Issuer DID:", issuer.did);

  // 2) Holder DID (subject of the credential)
  const holderAddress = process.env.HOLDER;
  const holderDid = `did:ethr:${chainId}:${holderAddress}`;
  console.log("Holder DID:", holderDid);

  // 3) Define credential payload
  const vcPayload = {
    sub: holderDid,
    nbf: Math.floor(Date.now() / 1000),
    vc: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "RoleCredential"],
      credentialSubject: {
        role: "motorsportsclub",       // example claim
        university: "MyUniversity",
      },
    },
  };

  // 4) Create VC as JWT
  const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
  console.log("Issued VC JWT:\n", vcJwt);

  // 5) Save to file
  fs.writeFileSync("../vc4.json", JSON.stringify({ vcJwt }, null, 2));
  console.log("✅ VC saved to vc4.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
