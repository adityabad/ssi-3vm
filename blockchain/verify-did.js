require("dotenv").config();
const { ethers } = require("ethers");
const { getResolver } = require("ethr-did-resolver");
const { Resolver } = require("did-resolver");

async function main() {
  // 1) Setup provider + wallet (local signing)
  const rpcUrl = "http://192.168.233.65:8545";
  const chainId = parseInt(4321, 10);
  const registry = process.env.DEPLOYED_ADDR;
  //const pk = process.env.ISSUER_PK;
  //const pk = process.env.HOLDER_PK;
  const pk = process.env.VERIFIER_PK;


  if (!rpcUrl || !chainId || !registry || !pk) {
    throw new Error("Missing one of: RPC_URL, CHAIN_ID, DEPLOYED_ADDR, SIGNER_PRIVATE_KEY in .env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, { chainId,
    name:"geth"
   });
  const wallet = new ethers.Wallet(pk, provider);

  // 2) Build DID for this wallet
  const did = `did:ethr:${chainId}:${wallet.address}`;
  console.log("DID:", did);

  // 3) Build resolver for your private network
  const ethrDidResolver = getResolver({
    networks: [
      {
        name: String(chainId), // IMPORTANT: name must match the DID's network segment
        chainId,
        rpcUrl,
        registry,
      },
    ],
  });
  const didResolver = new Resolver(ethrDidResolver);

  // 4) Create a nonce challenge and sign it with the DID's key
  const challenge = `did-auth:${did}:${Date.now()}:${ethers.hexlify(ethers.randomBytes(8))}`;
  const signature = await wallet.signMessage(challenge);
  console.log("Challenge:", challenge);
  console.log("Signature:", signature);

  // 5) Resolve DID Document and verify signature -> address
  const result = await didResolver.resolve(did);
  if (result.didResolutionMetadata?.error) {
    console.error("Resolve error:", result.didResolutionMetadata);
    process.exit(1);
  }

  const recovered = ethers.verifyMessage(challenge, signature);
  const expected = wallet.address;

  const ok = recovered.toLowerCase() === expected.toLowerCase();
  console.log("Recovered address:", recovered);
  console.log("Expected  address:", expected);
  console.log(ok ? "✅ DID ownership verified" : "❌ Verification failed");

  // 6) Optional: show service entries (to confirm your registry attributes)
  const services = result.didDocument?.service || [];
  if (services.length) {
    console.log("\nService entries:");
    for (const s of services) {
      console.log(`- ${s.type}: ${s.serviceEndpoint}`);
    }
  } else {
    console.log("\nNo service entries found on DID Document.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
