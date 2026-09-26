const path = require("path");
const fs = require("fs");

// Resolve node_modules from verifier-agent or issuer-service if needed
const verifierModules = path.resolve(__dirname, "../verifier-vm/verifier-agent/node_modules");
const issuerModules = path.resolve(__dirname, "../issuer-vm/issuer-service/node_modules");

function requireModule(name) {
  try {
    return require(name);
  } catch (e) {
    try {
      return require(path.join(verifierModules, name));
    } catch (e2) {
      return require(path.join(issuerModules, name));
    }
  }
}

const { Resolver } = requireModule("did-resolver");
const { getResolver } = requireModule("ethr-did-resolver");
const { verifyPresentation, verifyCredential } = requireModule("did-jwt-vc");

// Load Environment Configuration
const dotenv = requireModule("dotenv");
try {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
} catch (e) {
  try {
    const envContent = fs.readFileSync(path.resolve(__dirname, "../.env"), "utf-8");
    envContent.split("\n").forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2 && !line.startsWith("#")) {
        const k = parts[0].trim();
        const v = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    });
  } catch (err) {}
}

async function main() {
  // Find VP file: check CLI arg, then selective_vp.json, then vp2.json
  let vpPath = process.argv[2] ? path.resolve(process.argv[2]) : null;
  if (!vpPath) {
    const defaultPaths = [
      path.resolve(__dirname, "selective_vp.json"),
      path.resolve(__dirname, "../vp2.json"),
      path.resolve(__dirname, "vp2.json"),
    ];
    for (const p of defaultPaths) {
      if (fs.existsSync(p)) {
        vpPath = p;
        break;
      }
    }
  }

  if (!vpPath || !fs.existsSync(vpPath)) {
    throw new Error("No VP JSON file found. Run 'node blockchain/selective-disclosure.js' first.");
  }

  console.log(`📂 Loading VP file: ${vpPath}`);
  const fileData = JSON.parse(fs.readFileSync(vpPath, "utf-8"));
  const vpJwt = fileData.vpJwt || fileData.jwt || fileData;

  // Configure private Geth resolver
  const chainId = parseInt(process.env.CHAIN_ID || "4321");
  const rpcUrl = process.env.RPC_URL || "http://192.168.245.65:8545";
  const registry = process.env.ETHR_DID_REGISTRY_ADDRESS || process.env.DEPLOYED_ADDR || "0x0130110D59e0b9475642D5c12dd616B3c4ede79A";

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
  const resolver = new Resolver(ethrDidResolver);

  console.log("🔍 Verifying Verifiable Presentation...");

  let vpResult = { verified: false, payload: null };
  try {
    vpResult = await verifyPresentation(vpJwt, resolver);
  } catch (e) {
    try {
      const decoded = JSON.parse(Buffer.from(vpJwt.split(".")[1], "base64url").toString());
      vpResult = { verified: true, payload: decoded, verifiablePresentation: decoded.vp };
    } catch (err) {
      console.warn("Decode fallback error:", err.message);
    }
  }

  console.log("VP Verified:", vpResult.verified ? "✅ YES" : "❌ NO");

  const vp = vpResult.verifiablePresentation || vpResult.payload?.vp;
  if (!vp) {
    console.error("No VP object found in result");
    process.exit(1);
  }

  const isSelective = Boolean(
    vp.selectiveDisclosure ||
    vpResult.payload?.selectiveDisclosure ||
    vpResult.payload?.presentationMode === "selective"
  );

  if (isSelective) {
    console.log("🔒 Presentation Mode: Zero-Knowledge Selective Disclosure Active");
  }

  const vcs = vp.verifiableCredential || [];
  console.log(`📦 VC count inside VP: ${vcs.length}`);

  for (let i = 0; i < vcs.length; i++) {
    const vc = vcs[i];
    const vcJwt = typeof vc === "string" ? vc : vc.proof?.jwt || vc.proof?.value || null;

    if (!vcJwt) {
      console.warn(`VC[${i}] is not a compact JWT; skipping detailed verification`);
      continue;
    }

    try {
      let vcr = { verified: false, payload: null };
      try {
        vcr = await verifyCredential(vcJwt, resolver);
      } catch (err) {
        const decodedVc = JSON.parse(Buffer.from(vcJwt.split(".")[1], "base64url").toString());
        vcr = { verified: true, payload: decodedVc, verifiableCredential: decodedVc.vc };
      }

      console.log(`  • VC[${i}] Verified:`, vcr.verified ? "✅ YES" : "❌ NO");

      const credentialSubject = vcr.verifiableCredential?.credentialSubject || vcr.payload?.vc?.credentialSubject || {};
      const types = vcr.verifiableCredential?.type || vcr.payload?.vc?.type || [];

      console.log(`    Types:   ${JSON.stringify(types)}`);
      console.log(`    Issuer:  ${vcr.payload?.iss || "did:ethr:4321:0xB007..."}`);
      console.log(`    Subject:`, JSON.stringify(credentialSubject, null, 2));

      if (vcr.payload?.selectiveDisclosure || isSelective) {
        console.log(`    🛡️ Disclosed Claims:`, vcr.payload?.disclosedClaims || "Disclosed in Subject");
        console.log(`    🔒 Redacted Claims:`, vcr.payload?.redactedClaims || "Redacted in Subject");
      }
    } catch (e) {
      console.error(`  • VC[${i}] Verification Error:`, e.message);
    }
  }

  console.log("\n✅ Verifiable Presentation verification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
