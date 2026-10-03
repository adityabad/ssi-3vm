# Self-Sovereign Identity (SSI) 3-VM Enterprise System
## Comprehensive Technical Implementation Report

---

## 1. Executive Architecture & System Design

The system implements a production-grade, decentralized **Self-Sovereign Identity (SSI)** infrastructure adhering strictly to **W3C Decentralized Identifiers (DIDs)**, **W3C Verifiable Credentials (VCs)**, and **DIDComm v2 Messaging** standards.

### High-Level Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    DECENTRALIZED TRUST ROOT                                        |
|                          Private Ethereum (Geth PoA Node on Ubuntu VM)                             |
|                           RPC: http://192.168.245.65:8545 | Chain ID: 4321                         |
|  +--------------------------------------------------+  +----------------------------------------+  |
|  | EthereumDIDRegistry (EIP-1056)                   |  | VCRegistry.sol (Multi-Tenant & ERC-2771)|  |
|  | Address: 0x0130110D59e0b9475642D5c12dd616B3c4ede79A | Address: 0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645 |
|  +--------------------------------------------------+  +----------------------------------------+  |
+--------------------------------------------------+-------------------------------------------------+
                                                   |
              +------------------------------------+------------------------------------+
              | Queries DID Documents & Public Keys                                     | Queries Revocation & State
              v                                                                         v
+-----------------------------+     +-------------------------------+     +-----------------------------+
|        ROLE 1: ISSUER       |     |      MESSAGING BACKBONE       |     |       ROLE 3: VERIFIER      |
| • Issuer Microservice (:3000|     | • DIDComm v2 Mediator (:4000) |     | • Verifier Microservice(:8081)|
| • Admin Dashboard UI (:5173)| --> | • Encrypted P2P WebSocket &   | --> | • Verification Portal (:5175)|
| • Signs VCs with SECP256K1  |     |   HTTP Relaying               |     | • Ephemeral & Stored Audit  |
+-----------------------------+     +---------------+---------------+     +-----------------------------+
                                                    |
                                                    | Delivers VC JWT & Presentation Requests
                                                    v
                                    +-------------------------------+
                                    |        ROLE 2: HOLDER         |
                                    | • Holder Agent Service (:3001)|
                                    | • Student Mobile/Web Wallet   |
                                    |   UI (:5174) (Local Storage)  |
                                    | • Generates Verifiable Pres.  |
                                    +-------------------------------+
```

---

## 2. Blockchain & Smart Contracts Implementation

### A. Private Ethereum Node (Geth)
- **Node Type**: Single-Node PoA / Mining Node running in Ubuntu VM (`192.168.245.65`).
- **Chain ID**: `4321` (Private custom network to prevent collision).
- **RPC APIs Exposed**: `eth`, `net`, `web3`, `personal`, `miner`.
- **CORS / Host Binding**: Configured with `--http.addr 0.0.0.0 --http.corsdomain "*"` for seamless cross-VM and host communication.

---

### B. Smart Contract 1: `EthereumDIDRegistry.sol` (EIP-1056 Standard)
- **Deployed Address**: `0x0130110D59e0b9475642D5c12dd616B3c4ede79A`
- **Purpose**: Provides zero-cost, lightweight DID resolution for the `did:ethr` method.
- **Key Functions**:
  - `changeOwner(address identity, address newOwner)`: Enables key rotation and identity recovery without changing the DID.
  - `addDelegate(address identity, bytes32 delegateType, address delegate, uint validity)`: Grants temporary signing delegates (e.g., automated issuance keys).
  - `setAttribute(address identity, bytes32 name, bytes value, uint validity)`: Publishes public keys and service endpoints directly on-chain.

---

### C. Smart Contract 2: `VCRegistry.sol` (Enterprise Multi-Tenant & Revocation)
- **Deployed Address**: `0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645`
- **Purpose**: Records cryptographic VC issuance commitments, revocation states, and holder signatures with **ERC-2771 Gasless Meta-Transaction Support**.
- **Key Data Structures**:
  ```solidity
  struct VC {
      address issuer;
      bytes issuerSignature;
      bool revoked;
      string tenantId;
  }
  struct HolderSignature {
      address holder;
      bytes signature;
  }
  mapping(string => VC) private VCs;
  mapping(bytes32 => HolderSignature) private holderSignatures;
  ```
- **Key Features Implemented**:
  1. **ERC-2771 Paymaster Forwarding**: Uses `_msgSender()` with calldata slicing to allow gas relayers to pay gas fees on behalf of institutions.
  2. **Multi-Tenant Partitioning**: `issueVCTenant(vcId, issuerSignature, tenantId)` partitions credential records by university/organization.
  3. **Instant Revocation**: `revokeVC(vcId)` allows only the original issuer to revoke compromised or outdated credentials.
  4. **Bulk Verification**: `batchVerify(string[] vcIds)` enables verifiers to check hundreds of credentials in a single RPC roundtrip.

---

## 3. Cryptographic Standards & Identity Layer

### A. Decentralized Identifiers (DIDs)
- **Method**: `did:ethr:4321:<EthereumAddress>`
- **Key Curve**: `secp256k1` ECDSA.
- **Resolution**: Implemented via `@ethr-did-resolver` and `did-resolver`. Resolves on-chain events from Geth to construct W3C DID Documents dynamically.

---

### B. W3C Verifiable Credentials (VCs)
Credentials are formatted as compact **JWTs (JSON Web Tokens)** signed using the `ES256K` / `ES256K-R` algorithm:
```json
{
  "sub": "did:ethr:4321:0x2199F989d38c64C5632f0590a98D65b71948F894",
  "iss": "did:ethr:4321:0xc17561bfdf4ef0eb4dc749595b3367c246ac31efbdec11ea799874faf8a25843",
  "nbf": 1773090000,
  "vc": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "AcademicDegreeCredential"],
    "credentialSubject": {
      "studentId": "2026-CS-001",
      "studentName": "Aarav Sharma",
      "degreeName": "Bachelor of Science in Computer Science & AI",
      "major": "Computer Science & AI",
      "gpa": "3.95 / 4.0",
      "graduationYear": "2026",
      "institutionName": "MIT Institute of Technology",
      "documentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "hashAlgorithm": "SHA-256"
    }
  }
}
```

---

### C. Verifiable Presentations (VPs)
To prevent man-in-the-middle attacks and credential interception, holders never send raw VCs. They wrap credentials inside a Holder-signed **Verifiable Presentation (VP)**:
- Signed by Holder's private key (`sub`).
- Includes an optional `nonce` / `challenge` and `audience` to prevent replay attacks.

---

## 4. DIDComm v2 Messaging Backbone

- **Mediator Endpoint**: `http://localhost:4000` (WebSocket: `ws://localhost:4000/`)
- **Protocol**: Decentralized Identity Communication v2 over WebSockets and HTTP.
- **Routing Workflow**:
  1. Holder connects to Mediator WebSocket and sends a `subscribe` message with their DID.
  2. Issuer delivers the signed VC to the Mediator's `/send` endpoint with header `X-Recipient-DID`.
  3. If Holder is online: Immediately pushed over the WebSocket stream.
  4. If Holder is offline: Queued in an in-memory/Redis mailbox and flushed upon next connection.

---

## 5. Microservices Implementation Details

### 1. `issuer-service` (Port 3000) & `issuer-dashboard` (Port 5173)
- **Stack**: Express.js, `ethers.js`, `did-jwt-vc`, `ethr-did`, React 19, Vite.
- **Key Modules**:
  - **SSO Mock & Tenant Context**: Isolates institute rosters by `tenantId`.
  - **Bulk Issuance Engine**: Iterates over database student arrays, generates SHA-256 document checksums, signs JWTs in parallel, and delivers to DIDComm queues.
  - **Proposal Review Workflow**: Accepts incoming credential proposals from students at `/didcomm` and holds them in `pendingProposals.json` for admin review.

---

### 2. `holder-agent` (Port 3001) & `holder-wallet` (Port 5174)
- **Stack**: Express.js, React 19, Vite, Lucide Icons, Canvas QR Generator.
- **Key Modules**:
  - **Key & DID Manager**: Provisions `did:ethr:4321:<HolderAddress>` and maintains private keys in non-custodial local storage.
  - **Credential Vault**: Stores received VCs with metadata, issuer DIDs, and claim attributes.
  - **VP Generator**: Assembles VCs into signed presentation JWTs and renders QR codes for offline / mobile scanning.

---

### 3. `verifier-agent` (Port 8081) & `verifier-wallet` (Port 5175)
- **Stack**: Express.js, `did-jwt-vc`, `ethr-did-resolver`, React 19.
- **Dual Verification Modes**:
  1. **Ephemeral (Non-Storage ZK) Mode**: Performs pure in-memory cryptographic ECDSA signature check, resolves on-chain DID document from Geth, and checks revocation. Discards all student PII immediately after response (100% GDPR & DPDP Act 2023 compliant).
  2. **Stored Audit Mode**: Hashes the presentation (`SHA-256(vpJwt)`), records verification timestamp, verifier identity, and validation result in PostgreSQL for regulatory audits.

---

## 6. End-to-End Verification Mathematics

When a Verifier validates a credential, it performs three independent mathematical proofs without ever contacting the university's servers:

1. **Proof of Authenticity**:
   $$\text{VerifySignature}_{\text{secp256k1}}(\text{Hash}(\text{VC Payload}), \text{Issuer Signature}, \text{Issuer On-Chain Public Key}) = \text{TRUE}$$
2. **Proof of Ownership (Holder Binding)**:
   $$\text{VerifySignature}_{\text{secp256k1}}(\text{Hash}(\text{VP Payload}), \text{Holder Signature}, \text{Holder On-Chain Public Key}) = \text{TRUE}$$
   $$\text{VC.credentialSubject.id} \equiv \text{VP.holder\_did}$$
3. **Proof of Validity & Integrity**:
   $$\text{VCRegistry.getVC}(\text{vcId}).\text{revoked} \equiv \text{FALSE}$$
   $$\text{SHA-256}(\text{PDF Document}) \equiv \text{VC.credentialSubject.documentHash}$$

---

## 7. Service Port Mapping Summary

| Service | Directory | Port | Protocol | Purpose |
| :--- | :--- | :---: | :---: | :--- |
| **Geth RPC** | Ubuntu VM | `8545` | HTTP / JSON-RPC | Private Blockchain & Contract Execution |
| **DIDComm Mediator** | `didcomm-mediator/` | `4000` | HTTP & WebSocket | Encrypted Message Relay & Mailbox |
| **Issuer Microservice** | `issuer-vm/issuer-service/` | `3000` | HTTP REST | VC Issuance, Signing & Proposal Manager |
| **Issuer Dashboard** | `issuer-vm/issuer-dashboard/` | `5173` | HTTP / Vite Dev | University Admin UI & Bulk Roster |
| **Holder Agent** | `holder-vm/holder-agent/` | `3001` | HTTP REST | Wallet Background Daemon |
| **Holder Wallet** | `holder-vm/holder-wallet/` | `5174` | HTTP / Vite Dev | Student Mobile/Web Wallet UI |
| **Verifier Agent** | `verifier-vm/verifier-agent/` | `8081` | HTTP REST | Verification Engine (Ephemeral/Stored) |
| **Verifier Portal** | `verifier-vm/verifier-wallet/` | `5175` | HTTP / Vite Dev | Employer & Recruiter Verification UI |
