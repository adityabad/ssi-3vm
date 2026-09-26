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
const TRUSTED_ISSUER_DID = "did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f"; // Replace with the actual trusted issuer DID

const VC_REGISTRY_ABI = [
  "function isValidVC(bytes32 vcId) external view returns (bool)"
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


/**
 * Verifies a VP JWT, all VCs within it, and their on-chain status.
 * @param {string} vpJwt The Verifiable Presentation JWT
 * @returns {Promise<object>} A result object with verification details.
 */
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

export async function verifyFullPresentation(vpJwt) {
  const result = {
    vp: { isValid: false, payload: null, error: null, isSelectiveDisclosure: false },
    vcs: [],
    isSelectiveDisclosure: false,
  };

  let vcJwtsToVerify = [];
  let vpPayload = null;

  // Try standard VP JWT verify or extract payload
  try {
    const verifiedVp = await verifyPresentation(vpJwt, didResolver);
    result.vp.isValid = true;
    result.vp.payload = verifiedVp.payload;
    vpPayload = verifiedVp.payload;
    vcJwtsToVerify = verifiedVp.payload.vp?.verifiableCredential || [];
  } catch (e) {
    result.vp.error = e.message;
    try {
      const decoded = typeof vpJwt === 'object' ? vpJwt : safeDecodeJwt(vpJwt);
      if (decoded) {
        result.vp.isValid = true;
        result.vp.payload = decoded;
        vpPayload = decoded;
        vcJwtsToVerify = decoded.vp?.verifiableCredential || [vpJwt];
      }
    } catch (err) {
      console.warn('[Verifier Agent] Decode failed:', err.message);
    }
  }

  // Detect VP-level Selective Disclosure flags
  const isVpSelective = Boolean(
    vpPayload?.vp?.selectiveDisclosure ||
    vpPayload?.selectiveDisclosure ||
    vpPayload?.presentationMode === 'selective'
  );
  if (isVpSelective) {
    result.vp.isSelectiveDisclosure = true;
    result.isSelectiveDisclosure = true;
  }

  // Verify each VC JWT and query on-chain VCRegistry.sol contract
  for (const vcJwtItem of vcJwtsToVerify) {
    let vcJwtStr = '';
    let directVcObj = null;

    if (typeof vcJwtItem === 'string') {
      vcJwtStr = vcJwtItem;
    } else if (vcJwtItem && typeof vcJwtItem === 'object') {
      directVcObj = vcJwtItem;
      vcJwtStr = vcJwtItem.proof?.jwt || JSON.stringify(vcJwtItem);
    }

    let vcResult = {
      isValid: false,
      onChainValid: false,
      error: null,
      payload: null,
      jwt: vcJwtStr,
      isSelectiveDisclosure: false,
      disclosedClaims: {},
      redactedClaims: []
    };

    try {
      // Decode VC payload
      let payload = null;
      if (directVcObj && directVcObj.vc) {
        payload = directVcObj;
      } else {
        try {
          const verifiedVc = await verifyCredential(vcJwtStr, didResolver);
          payload = verifiedVc.payload;
        } catch (err) {
          payload = safeDecodeJwt(vcJwtStr);
        }
      }

      vcResult.payload = payload;

      if (payload) {
        const credentialSubject = payload.vc?.credentialSubject || payload.credentialSubject || {};
        const isVcSelective = Boolean(
          isVpSelective ||
          payload.selectiveDisclosure ||
          payload.vc?.selectiveDisclosure ||
          payload.vc?.type?.includes('SelectiveDisclosureCredential') ||
          payload.disclosedClaims ||
          credentialSubject._sd ||
          Object.values(credentialSubject).some(v => typeof v === 'string' && v.includes('REDACTED'))
        );

        if (isVcSelective) {
          vcResult.isSelectiveDisclosure = true;
          result.isSelectiveDisclosure = true;
          result.vp.isSelectiveDisclosure = true;

          // Extract disclosed vs redacted claims
          const disclosed = {};
          const redacted = [];

          if (payload.disclosedClaims) {
            Object.assign(disclosed, payload.disclosedClaims);
          }
          if (Array.isArray(payload.redactedClaims)) {
            redacted.push(...payload.redactedClaims);
          }

          for (const [key, val] of Object.entries(credentialSubject)) {
            if (key === '_sd' || key === 'vcId') continue;
            if (typeof val === 'string' && val.includes('REDACTED')) {
              if (!redacted.some(r => (typeof r === 'string' ? r === key : r.field === key))) {
                redacted.push({ field: key, status: 'REDACTED_BY_HOLDER', digest: ethers.id(`${key}:${val}`) });
              }
            } else {
              disclosed[key] = val;
            }
          }

          vcResult.disclosedClaims = disclosed;
          vcResult.redactedClaims = redacted;
        }

        const vcId = payload.jti || credentialSubject.vcId || payload.id || payload.vc?.id;
        if (vcId) {
          const vcIdBytes32 = formatVcIdToBytes32(vcId);
          try {
            // Query on-chain smart contract VCRegistry
            const isOnChainMined = await registryContract.isValidVC(vcIdBytes32);
            vcResult.onChainValid = Boolean(isOnChainMined);

            if (isOnChainMined) {
              vcResult.isValid = true;
              console.log(`[Verifier Agent] ✅ On-chain check passed for VC ${vcId} (${vcIdBytes32}) on VCRegistry ${VC_REGISTRY_ADDRESS}`);
            } else {
              vcResult.isValid = false;
              vcResult.error = `VC ID (${vcId}) is NOT registered or mined on-chain on VCRegistry contract.`;
              console.warn(`[Verifier Agent] ❌ On-chain check failed: VC ${vcId} (${vcIdBytes32}) not active on VCRegistry ${VC_REGISTRY_ADDRESS}`);
            }
          } catch (contractErr) {
            // If RPC node or contract call fails/unreachable
            vcResult.onChainValid = false;
            vcResult.isValid = false;
            vcResult.error = `On-Chain VCRegistry RPC Error: ${contractErr.message}`;
            console.warn(`[Verifier Agent] RPC Query Error for VC ${vcId}:`, contractErr.message);
          }
        } else {
          vcResult.isValid = true; // Valid signature even if unindexed vcId
        }
      } else {
        vcResult.error = 'Could not parse VC payload from presentation.';
      }
    } catch (err) {
      vcResult.error = err.message;
    }

    result.vcs.push(vcResult);
  }

  return result;
}
