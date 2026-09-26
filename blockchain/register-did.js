const hre = require("hardhat");
const { ethers } = hre;
require("dotenv").config();

async function main() {
  // Deployed DIDRegistry address
  const registryAddress = process.env.DEPLOYED_ADDR;

  // Attach to the deployed contract
  const Registry = await ethers.getContractFactory("EthereumDIDRegistry");
  const registry = Registry.attach(registryAddress);

  // Use the first local signer
  //const [owner] = await ethers.getSigners();
  //console.log("Using account:", owner.address);


// use this for general purpose...locked aacounts also
   const provider = new ethers.JsonRpcProvider("http://192.168.233.65:8545"); // your RPC
  //const holderWallet = new ethers.Wallet(process.env.HOLDER_PK, provider);
  const holderWallet = new ethers.Wallet(process.env.VERIFIER_PK, provider);
  //const holderWallet = new ethers.Wallet(process.env.ISSUER_PK, provider);
   console.log("Using account:", holderWallet.address);



  // DID attribute key (fits in 32 bytes, safe for UTF-8 decode)
   const key = ethers.encodeBytes32String("did/svc/HubService");

  // Value = service endpoint (utf8 string)
  const value = ethers.toUtf8Bytes("http://my-service.example2.com");

  // Attribute validity
  const validity = 86400; // 1 day in seconds

  const tx = await registry
    .connect(holderWallet)
    .setAttribute(holderWallet.address, key, value, validity);

    await tx.wait();

   console.log(
     "Service endpoint added for DID:",
     `did:ethr:4321:${holderWallet.address}`
   );

   
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
