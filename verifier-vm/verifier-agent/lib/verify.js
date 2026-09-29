import { verifyCredential, verifyPresentation } from 'did-jwt-vc';
import { getResolver } from 'ethr-did-resolver';
import { Resolver } from 'did-resolver';
import * as ethers from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURE YOUR BLOCKCHAIN CONNECTION ---
const RPC_URL = process.env.RPC_URL || 'http://192.168.245.65:8545';
const ETHR_DID_REGISTRY_ADDRESS = process.env.ETHR_DID_REGISTRY_ADDRESS || "0x0130110D59e0b9475642D5c12dd616B3c4ede79A";


// 1. Define BOTH contract addresses
const VC_REGISTRY_ADDRESS = process.env.VC_REGISTRY_ADDRESS || process.env.VC_REGISTRY_ADDR || "0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645"; // Your custom VC registry

// Only credentials signed by these issuers are accepted (comma-separated DIDs).
const TRUSTED_ISSUER_DIDS = (process.env.TRUSTED_ISSUER_DIDS || "did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f")
  .split(',')
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

const VC_REGISTRY_ABI = [
  "function isValidVC(bytes32 vcId) external view returns (bool)",
  "function getVC(bytes32 vcId) external view returns (tuple(address issuer, address subject, bool active, uint256 issuedAt))"
];

// --- Setup for DID and Blockchain resolution ---
const provider = new ethers.JsonRpcProvider(RPC_URL);
const ethrDidResolver = getResolver({ 
  networks: [
    { 
      name: "4321", 
      rpcUrl: RPC_URL,
      provider: provider,
      registry: ETHR_DID_REGISTRY_ADDRESS,
      chainId: 4321
    }
  ]
});
const didResolver = new Resolver(ethrDidResolver);

// Make sure this uses your VC_REGISTRY_ADDRESS
const registryContract = new ethers.Contract(VC_REGISTRY_ADDRESS, VC_REGISTRY_ABI, provider);


// Decodes a JWT payload WITHOUT checking its signature. Use for display only.
export function safeDecodeJwt(jwtStr) {
  if (!jwtStr || typeof jwtStr !== 'string') return null;
  const parts = jwtStr.split('.');
  if (parts.length < 2) return null;
  try {
    const raw = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    try {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (err) {
      return null;
    }
  }
}

export function formatVcIdToBytes32(vcId) {
  if (!vcId) return ethers.ZeroHash;
  const str = String(vcId);
  if (/^0x[0-9a-fA-F]{64}$/.test(str)) {
    return str;
  }
  return ethers.id(str);
}

export function isTrustedIssuer(did) {
  return typeof did === 'string' && TRUSTED_ISSUER_DIDS.includes(did.toLowerCase());
}

// did:ethr:<network>:<address> -> checksummed address, or null if the DID does not end in an address
export function didToAddress(did) {
  if (typeof did !== 'string') return null;
  const last = did.split(':').pop();
  return ethers.isAddress(last) ? ethers.getAddress(last) : null;
}

function sameDid(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}

function describeSelectiveDisclosure(payload) {
  return Boolean(
    payload?.vp?.selectiveDisclosure ||
    payload?.selectiveDisclosure ||
    payload?.presentationMode === 'selective'
  );
}

/**
 * Verifies a VP JWT, every VC inside it, and each VC's on-chain status.
 * Fails closed: a presentation is only valid when the holder's signature, each issuer's
 * signature, the issuer trust list, holder binding and the VCRegistry record all check out.
 * @param {string} vpJwt The Verifiable Presentation JWT
 * @returns {Promise<object>} A result object with verification details.
 */
export async function verifyFullPresentation(vpJwt) {
  const result = {
    vp: { isValid: false, payload: null, error: null, isSelectiveDisclosure: false },
    vcs: [],
    isSelectiveDisclosure: false,
  };

  if (typeof vpJwt !== 'string') {
    result.vp.error = 'Presentation must be a signed JWT string.';
    return result;
  }

  // Decoded only for display; nothing below trusts it.
  const unverifiedPayload = safeDecodeJwt(vpJwt);
  result.vp.payload = unverifiedPayload;
  if (describeSelectiveDisclosure(unverifiedPayload)) {
    result.vp.isSelectiveDisclosure = true;
    result.isSelectiveDisclosure = true;
  }

  let vpPayload;
  try {
    // TODO: bind presentations to this verifier (audience + challenge); wallets currently send placeholder audiences.
    const verifiedVp = await verifyPresentation(vpJwt, didResolver, { policies: { aud: false } });
    vpPayload = verifiedVp.payload;
  } catch (e) {
    result.vp.error = result.isSelectiveDisclosure
      ? `Selective disclosure presentations cannot be verified yet: ${e.message}`
      : `Presentation signature is invalid: ${e.message}`;
    return result;
  }

  const vcJwtsToVerify = vpPayload.vp?.verifiableCredential || [];
  if (vcJwtsToVerify.length === 0) {
    result.vp.error = 'Presentation contains no credentials.';
    return result;
  }

  result.vp.isValid = true;
  result.vp.payload = vpPayload;
  const holderDid = vpPayload.iss;

  for (const vcJwtItem of vcJwtsToVerify) {
    const vcJwtStr = typeof vcJwtItem === 'string' ? vcJwtItem : vcJwtItem?.proof?.jwt;
    const vcResult = {
      isValid: false,
      onChainValid: false,
      error: null,
      payload: null,
      jwt: vcJwtStr || null,
      isSelectiveDisclosure: false,
      disclosedClaims: {},
      redactedClaims: []
    };
    result.vcs.push(vcResult);

    if (!vcJwtStr) {
      vcResult.error = 'Credential must be a signed JWT.';
      continue;
    }

    let payload;
    try {
      payload = (await verifyCredential(vcJwtStr, didResolver)).payload;
    } catch (err) {
      vcResult.payload = safeDecodeJwt(vcJwtStr);
      vcResult.error = `Credential signature is invalid: ${err.message}`;
      continue;
    }
    vcResult.payload = payload;

    if (!isTrustedIssuer(payload.iss)) {
      vcResult.error = `Issuer ${payload.iss} is not a trusted issuer.`;
      continue;
    }
    if (!sameDid(payload.sub, holderDid)) {
      vcResult.error = `Credential subject ${payload.sub} does not match presenting holder ${holderDid}.`;
      continue;
    }

    const issuerAddress = didToAddress(payload.iss);
    const vcId = payload.jti || payload.vc?.credentialSubject?.vcId || payload.vc?.id;
    if (!issuerAddress || !vcId) {
      vcResult.error = 'Credential has no id or issuer address to check against VCRegistry.';
      continue;
    }

    const vcIdBytes32 = formatVcIdToBytes32(vcId);
    try {
      const [isActive, record] = await Promise.all([
        registryContract.isValidVC(vcIdBytes32),
        registryContract.getVC(vcIdBytes32),
      ]);
      const onChainIssuerMatches = ethers.getAddress(record.issuer) === issuerAddress;
      vcResult.onChainValid = Boolean(isActive && record.active && onChainIssuerMatches);

      if (vcResult.onChainValid) {
        vcResult.isValid = true;
        console.log(`[Verifier Agent] ✅ On-chain check passed for VC ${vcId} (${vcIdBytes32}) on VCRegistry ${VC_REGISTRY_ADDRESS}`);
      } else if (!onChainIssuerMatches && record.issuer !== ethers.ZeroAddress) {
        vcResult.error = `VC ID (${vcId}) is registered on-chain by ${record.issuer}, not by issuer ${issuerAddress}.`;
      } else {
        vcResult.error = `VC ID (${vcId}) is NOT registered or is revoked on VCRegistry contract.`;
        console.warn(`[Verifier Agent] ❌ On-chain check failed: VC ${vcId} (${vcIdBytes32}) not active on VCRegistry ${VC_REGISTRY_ADDRESS}`);
      }
    } catch (contractErr) {
      vcResult.error = `On-Chain VCRegistry RPC Error: ${contractErr.message}`;
      console.warn(`[Verifier Agent] RPC Query Error for VC ${vcId}:`, contractErr.message);
    }
  }

  return result;
}
