const { ethers } = require("ethers");
//require("dotenv").config();
const { Resolver } = require("did-resolver");
const { getResolver } = require("ethr-did-resolver");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const registryAddress = process.env.DEPLOYED_ADDR;
  const rpcUrl = "http://192.168.233.65:8545";

  // Local chainId = 4321 (your private geth chain)
  const chainId = 4321;

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Configure DID resolver
  const ethrDidResolver = getResolver({
    networks: [
      {
        name: String(chainId),
        rpcUrl: rpcUrl,
        registry: registryAddress,
        chainId: chainId,
      },
    ],
  });

  const didResolver = new Resolver(ethrDidResolver);

  // DID we registered
  const ownerAddress = process.env.CURR_SIGNER;
  const did = `did:ethr:${chainId}:${ownerAddress}`;
  console.log("Resolving:", did);

  // Resolve DID Document
  const doc = await didResolver.resolve(did);
  console.log("DID Document:", JSON.stringify(doc, null, 2));

  // Debug: fetch logs directly from registry
  // const Registry = new ethers.Contract(
  //   registryAddress,
  //   (await import("../artifacts/contracts/EthereumDIDRegistry.sol/EthereumDIDRegistry.json")).abi,
  //   provider
  // );

  const registryArtifact = require("../artifacts/contracts/EthereumDIDRegistry.sol/EthereumDIDRegistry.json");

const Registry = new ethers.Contract(
  registryAddress,
  registryArtifact.abi,
  provider
);


  const logs = await Registry.queryFilter("DIDAttributeChanged", 0, "latest");
  logs.forEach((log) => {
    const [identity, key, value, validity, previousChange] = log.args;
    console.log("----- Attribute Event -----");
    console.log("Identity:", identity);
    console.log("Key:", ethers.decodeBytes32String(key));
    console.log("Value:", ethers.toUtf8String(value));
    console.log("Validity (sec):", validity.toString());
    console.log("PreviousChange:", previousChange.toString());
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
