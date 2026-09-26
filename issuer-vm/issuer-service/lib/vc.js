// services/issuer-service/lib/vc.js
import { createVerifiableCredentialJwt } from "did-jwt-vc";
import { EthrDID } from "ethr-did";
// import { ethers } from "ethers";
import EthereumDIDRegistry from "./VCRegistry.json" with { type: "json" };
import * as ethers from "ethers";



export function formatVcIdToBytes32(vcId) {
  if (!vcId) return ethers.ZeroHash;
  const str = String(vcId);
  if (/^0x[0-9a-fA-F]{64}$/.test(str)) {
    return str;
  }
  return ethers.id(str);
}

let txQueue = Promise.resolve();

export async function issueVC({
  issuerPk,
  chainId,
  subjectDid,
  claims = {},
  types = ["VerifiableCredential", "GenericCredential"],
  context = ["https://www.w3.org/2018/credentials/v1"],
  vcId,
}) {
  const issuerWallet = new ethers.Wallet(
    issuerPk,
    new ethers.JsonRpcProvider(process.env.RPC_URL)
  );
  const issuerDid = `did:ethr:${chainId}:${issuerWallet.address}`;

  // --- VC payload ---
  const credentialSubject = { ...(claims || {}) };
  if (vcId) credentialSubject.vcId = vcId;

  const vcPayload = {
    sub: subjectDid,
    nbf: Math.floor(Date.now() / 1000),
    jti: vcId || undefined,
    vc: {
      "@context": context,
      type: types,
      credentialSubject,
    },
  };

  // --- Sign VC ---
  const issuer = new EthrDID({
    identifier: issuerWallet.address,
    privateKey: issuerPk,
    chainNameOrId: chainId,
  });
  const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);

  // --- Optional On-Chain Registration (Queued Sequentially) ---
  const vcRegistryAddr = process.env.VC_REGISTRY_ADDR || process.env.VC_REGISTRY_ADDRESS;
  if (vcRegistryAddr && vcRegistryAddr !== '0x0000000000000000000000000000000000000000') {
    let subjectAddress = issuerWallet.address;
    if (subjectDid && typeof subjectDid === 'string' && subjectDid.startsWith('did:ethr:')) {
      const parts = subjectDid.split(':');
      const lastPart = parts[parts.length - 1];
      if (ethers.isAddress(lastPart)) {
        subjectAddress = lastPart;
      }
    }

    const vcIdBytes32 = formatVcIdToBytes32(vcId);

    // Queue transaction sending sequentially to prevent nonce collisions on Geth node
    txQueue = txQueue.then(async () => {
      try {
        const registryContract = new ethers.Contract(
          vcRegistryAddr,
          EthereumDIDRegistry.abi,
          issuerWallet
        );
        console.log(`[On-Chain] 🚀 Submitting registerVC transaction to Geth node (${process.env.RPC_URL}) for VC ID: ${vcId} (${vcIdBytes32})...`);
        const tx = await registryContract.registerVC(subjectAddress, vcIdBytes32);
        console.log(`[On-Chain] 🚀 SUBMITTED TRANSACTION TO GETH: ${tx.hash}`);
        tx.wait().then((receipt) => {
          console.log(`✅ VC ${vcIdBytes32} confirmed on-chain in block ${receipt.blockNumber}`);
        }).catch(e => console.warn('[On-Chain] Confirmation wait warning:', e.message));
      } catch (err) {
        console.warn(`⚠️ On-chain VC registration failed for ${vcId}:`, err.message);
      }
    }).catch(() => {});
  }

  return { vcJwt, issuerDid };
}

export async function revokeVCRecord({ issuerPk, vcId }) {
  const vcRegistryAddr = process.env.VC_REGISTRY_ADDR || process.env.VC_REGISTRY_ADDRESS;
  if (!vcRegistryAddr) {
    throw new Error("VCRegistry address not configured.");
  }
  const issuerWallet = new ethers.Wallet(
    issuerPk,
    new ethers.JsonRpcProvider(process.env.RPC_URL)
  );
  const vcIdBytes32 = formatVcIdToBytes32(vcId);
  const registryContract = new ethers.Contract(
    vcRegistryAddr,
    EthereumDIDRegistry.abi,
    issuerWallet
  );
  console.log(`[On-Chain] 🔒 Submitting revokeVC transaction for VC ID: ${vcId} (${vcIdBytes32})...`);
  const tx = await registryContract.revokeVC(vcIdBytes32);
  console.log(`[On-Chain] 🔒 SUBMITTED REVOKE TX TO GETH: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[On-Chain] 🔒 Revocation confirmed in block ${receipt.blockNumber}`);
  return { txHash: tx.hash, blockNumber: receipt.blockNumber, vcIdBytes32 };
}

export async function checkVCStatus({ vcId }) {
  const vcRegistryAddr = process.env.VC_REGISTRY_ADDR || process.env.VC_REGISTRY_ADDRESS;
  if (!vcRegistryAddr) return { active: true, isValid: true };
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const registryContract = new ethers.Contract(
    vcRegistryAddr,
    EthereumDIDRegistry.abi,
    provider
  );
  const vcIdBytes32 = formatVcIdToBytes32(vcId);
  try {
    const isValid = await registryContract.isValidVC(vcIdBytes32);
    const record = await registryContract.getVC(vcIdBytes32);
    return {
      vcId,
      vcIdBytes32,
      isValid,
      issuer: record.issuer,
      subject: record.subject,
      active: record.active,
      issuedAt: Number(record.issuedAt)
    };
  } catch (err) {
    return { vcId, vcIdBytes32, isValid: false, error: err.message };
  }
}
