require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const rpcUrl = "http://192.168.233.65:8545";
  const chainId = 4321; // private chain ID
  const registryAddress = process.env.DEPLOYED_ADDR;
  const issuerPk = process.env.ISSUER_PK;

  if (!registryAddress || !issuerPk) {
    throw new Error("Missing DEPLOYED_ADDR or ISSUER_PK in .env");
  }

  // Connect issuer wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId, name: "geth" });
  const wallet = new ethers.Wallet(issuerPk, provider);

  // Attach to registry
  const Registry = new ethers.Contract(
    registryAddress,
    [
      "function setAttribute(address identity, bytes32 name, bytes value, uint validity) external"
    ],
    wallet
  );

  // Example: VC revocation entry
  const credentialId = "vc:123";  // in real case, hash of VC/JWT ID
  const key = ethers.encodeBytes32String("vc/revoked");
  const value = ethers.toUtf8Bytes(credentialId);
  const validity = 31536000; // 1 year validity for attribute

  console.log(`Revoking credential: ${credentialId} for DID: ${wallet.address}`);

  const tx = await Registry.setAttribute(wallet.address, key, value, validity);
  await tx.wait();

  console.log("✅ Credential revoked on-chain");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
