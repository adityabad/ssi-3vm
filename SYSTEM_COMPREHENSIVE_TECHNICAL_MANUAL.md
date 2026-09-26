# Self-Sovereign Identity (SSI) 3-VM Enterprise System
## Comprehensive Engineering & Technical Reference Manual

---

## 1. System Topology & Network Infrastructure

The system operates across three logical domains (simulated via dedicated microservice nodes) interconnected through a local Private Ethereum Blockchain (Geth) and an asynchronous DIDComm v2 messaging backbone.

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                              PRIVATE BLOCKCHAIN TRUST ROOT                                              |
|                                        Ubuntu 64-bit VM (VMware NAT - VMnet8)                                           |
|                                     IP: 192.168.245.65:8545 | Network/Chain ID: 4321                                    |
|                                                                                                                         |
|    +-------------------------------------------------------------+  +----------------------------------------------+    |
|    | EthereumDIDRegistry (EIP-1056)                              |  | VCRegistry (Multi-Tenant & ERC-2771 Gasless) |    |
|    | Contract Address:                                           |  | Contract Address:                            |    |
|    | 0x0130110D59e0b9475642D5c12dd616B3c4ede79A                  |  | 0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645   |    |
|    +-------------------------------------------------------------+  +----------------------------------------------+    |
+-------------------------------------------------------------+-----------------------------------------------------------+
                                                              |
                  +-------------------------------------------+-------------------------------------------+
                  | eth_call (Resolve DID Documents & Keys)                                               | eth_call (Check Revocation & Signatures)
                  v                                                                                       v
+---------------------------------------------------+  +------------------------------------+  +---------------------------------------------------+
|                  ROLE 1: ISSUER                   |  |          MESSAGING RELAY           |  |                 ROLE 3: VERIFIER                  |
| • Issuer Microservice (Node.js/Express) - Port 3000|  | • DIDComm v2 Mediator - Port 4000  |  | • Verifier Microservice (Express) - Port 8081     |
| • Issuer Admin Dashboard (React/Vite) - Port 5173 |  | • Protocol: WebSocket (ws://) &   |  | • Verifier Portal (React/Vite) - Port 5175        |
| • Key: SECP256K1 (did:ethr:4321:0xc17561...)      |  |   HTTP POST /send                  |  | • Dual Modes: Ephemeral ZK Mode & Stored Audit    |
+---------------------------------------------------+  +-----------------+------------------+  +---------------------------------------------------+
                          |                                              |                                                  ^
                          | 1. HTTP POST (Encrypted VC JWT)              | 2. Pushes VC JWT via WebSocket                   | 3. Submits VP JWT (REST / QR Scan)
                          +--------------------------------------------> |                                                  |
                                                                         v                                                  |
                                                       +---------------------------------------------------+----------------+
                                                       |                  ROLE 2: HOLDER                   |
                                                       | • Holder Agent Daemon - Port 3001                 |
                                                       | • Student Web/Mobile Wallet (React/Vite) - Port 5174
                                                       | • Non-Custodial Key Storage: IndexedDB / Local    |
                                                       | • Key: SECP256K1 (did:ethr:4321:0x2199F9...)      |
                                                       +---------------------------------------------------+
```

---

## 2. Blockchain & Smart Contract Engineering

### A. Private Geth Node Configuration
- **Network / Chain ID**: `4321`
- **Consensus**: Proof-of-Authority (PoA) / Proof-of-Work single-node miner.
- **RPC Interface**: JSON-RPC over HTTP at `http://192.168.245.65:8545`.
- **Enabled APIs**: `eth`, `net`, `web3`, `personal`, `miner`.
- **CORS & Binding**: `--http.addr 0.0.0.0 --http.corsdomain "*"`.

---

### B. Smart Contract 1: `EthereumDIDRegistry.sol` (EIP-1056)
- **Deployed Address**: `0x0130110D59e0b9475642D5c12dd616B3c4ede79A`
- **Architecture**: Implements the ERC-1056 standard for lightweight, zero-deployment decentralized identity.
- **Key State Variables**:
  - `mapping(address => address) owners`: Identity owners.
  - `mapping(address => mapping(bytes32 => mapping(address => uint))) delegates`: Time-bounded signing delegates.
  - `mapping(address => uint) changed`: Block number of the last identity update.
- **Core Functions**:
  1. `changeOwner(address identity, address newOwner)`: Transmits ownership of a DID without modifying the public identifier.
  2. `addDelegate(address identity, bytes32 delegateType, address delegate, uint validity)`: Authorizes temporary signing keys (e.g., automated issuance server keys).
  3. `setAttribute(address identity, bytes32 name, bytes value, uint validity)`: Emits on-chain attributes (e.g., public keys, service endpoints) tracked via event logs (`DIDAttributeChanged`).

---

### C. Smart Contract 2: `VCRegistry.sol` (Enterprise Multi-Tenant & Revocation)
- **Deployed Address**: `0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645`
- **Solidity Version**: `^0.8.0`
- **Key Features**:
  1. **ERC-2771 Gasless Forwarder (Yul Assembly Calldata Extraction)**:
     Allows institutional relayers/paymasters to pay gas on behalf of users:
     ```solidity
     function _msgSender() internal view returns (address sender) {
         if (isTrustedForwarder(msg.sender)) {
             assembly {
                 // Extracts the 20-byte sender address appended by the Trusted Forwarder
                 sender := shr(96, calldataload(sub(calldatasize(), 20)))
             }
         } else {
             return msg.sender;
         }
     }
     ```
  2. **Multi-Tenant Partitioned Storage**:
     ```solidity
     struct VC {
         address issuer;          // 20 bytes
         bytes issuerSignature;   // 65 bytes ECDSA (r, s, v)
         bool revoked;            // 1 byte boolean flag
         string tenantId;         // e.g., "mit-tech", "stanford-edu"
     }
     mapping(string => VC) private VCs;
     ```
  3. **Revocation Registry**:
     - `revokeVC(string memory vcId)`: Allows only the original issuer (`require(VCs[vcId].issuer == _msgSender())`) to flag a credential as revoked.
  4. **Batch Verification**:
     - `batchVerify(string[] memory vcIds)`: Returns arrays of existence flags and revocation statuses in a single RPC call, eliminating RPC roundtrip latency during bulk applicant checks.

---

## 3. Cryptographic Formulations & W3C Data Models

### A. Decentralized Identifiers (DIDs)
- **Method**: `did:ethr:4321:<EthereumAddress>`
- **Underlying Curve**: `secp256k1` Elliptic Curve ($y^2 = x^3 + 7 \pmod p$).
- **Key Representation**: Uncompressed 65-byte public keys ($0x04 \mathbin{\Vert} X \mathbin{\Vert} Y$) or compressed 33-byte public keys ($0x02/0x03 \mathbin{\Vert} X$).

---

### B. W3C Verifiable Credential (VC) JWT Specification
Credentials are created using `did-jwt-vc` with `ES256K` (ECDSA on `secp256k1` with SHA-256):

#### 1. Header (Base64URL encoded)
```json
{
  "alg": "ES256K",
  "typ": "JWT"
}
```

#### 2. Payload (Base64URL encoded)
```json
{
  "iss": "did:ethr:4321:0xc17561bfdf4ef0eb4dc749595b3367c246ac31efbdec11ea799874faf8a25843",
  "sub": "did:ethr:4321:0x2199F989d38c64C5632f0590a98D65b71948F894",
  "iat": 1773090000,
  "nbf": 1773090000,
  "vc": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "AcademicDegreeCredential"],
    "credentialSubject": {
      "studentId": "2026-CS-001",
      "studentName": "Aarav Sharma",
      "studentEmail": "aarav.sharma@mit.edu",
      "degreeName": "Bachelor of Science in Computer Science & AI",
      "major": "Computer Science & AI",
      "gpa": "3.95 / 4.0",
      "graduationYear": "2026",
      "institutionName": "MIT Institute of Technology",
      "documentHash": "a6c5f789d33b4998e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c",
      "hashAlgorithm": "SHA-256"
    }
  }
}
```

#### 3. Cryptographic Signature
```
Signature = ECDSA_Sign(SHA-256(Base64URL(Header) + "." + Base64URL(Payload)), Issuer_PrivateKey)
```

---

### C. W3C Verifiable Presentation (VP) JWT Specification
To prevent unauthorized transfer or replay, the Holder encapsulates the VC within a signed Presentation envelope:

```json
{
  "header": {
    "alg": "ES256K",
    "typ": "JWT"
  },
  "payload": {
    "iss": "did:ethr:4321:0x2199F989d38c64C5632f0590a98D65b71948F894",
    "aud": "did:ethr:4321:0xVerifierAddress",
    "nonce": "e9b7a421-5c8f-4d3b-9a1c-8e4d2f0a6b1c",
    "iat": 1773090050,
    "vp": {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "type": ["VerifiablePresentation"],
      "verifiableCredential": [
        "<Raw_Compact_VC_JWT_String>"
      ]
    }
  }
}
```

---

## 4. DIDComm v2 Asynchronous Messaging Protocol

- **Component**: `didcomm-mediator` (`app.js`, Port 4000)
- **Protocol Flow**:
  1. **Subscription**: Holder wallet establishes a WebSocket connection (`ws://localhost:4000/`) and registers:
     ```json
     { "type": "subscribe", "did": "did:ethr:4321:0x2199F989d38c64C5632f0590a98D65b71948F894" }
     ```
  2. **Delivery**: When the Issuer issues a VC, it executes an HTTP POST to `http://localhost:4000/send` with header `X-Recipient-DID: did:ethr:4321:0x2199...`.
  3. **Queue / Mailbox Management**:
     - If the recipient's WebSocket is active: Message is streamed directly.
     - If the recipient is offline: Message is queued in the in-memory mailbox `mailboxes.get(did)` and automatically flushed upon the client's next `subscribe` message.

---

## 5. Microservices Implementation Architecture

### 1. `issuer-service` (Port 3000) & `issuer-dashboard` (Port 5173)
- **Files**: `issuer-vm/issuer-service/app.js`, `lib/vc.js`, `lib/db.js`.
- **Functionality**:
  - Exposes `/didcomm` for receiving student credential proposals (`propose-credential`).
  - Stores pending proposals in `pendingProposals.json`.
  - Exposes `POST /proposals/:id/approve` to calculate SHA-256 hashes of academic degree certificates and sign the VC JWT.
  - Implements institutional bulk issuance across pre-loaded academic rosters (30 students).

---

### 2. `holder-agent` (Port 3001) & `holder-wallet` (Port 5174)
- **Files**: `holder-vm/holder-agent/index.js`, `holder-vm/holder-wallet/src/App.jsx`.
- **Functionality**:
  - Non-custodial key management: Maintains student Ethereum private keys in browser local storage / IndexedDB.
  - Connects to the DIDComm mediator to retrieve issued credentials.
  - Renders academic credential details (Degree, GPA, Major, Document Hash).
  - Encapsulates VCs into signed VP JWTs and renders QR codes for instant offline scanning.

---

### 3. `verifier-agent` (Port 8081) & `verifier-wallet` (Port 5175)
- **Files**: `verifier-vm/verifier-agent/index.js`, `lib/verify.js`.
- **Functionality**:
  - **Endpoint**: `POST /api/verify` (accepts `vpJwt`, `mode`).
  - **Mode 1: Ephemeral (Zero-Knowledge In-Memory) Mode**:
    1. Unpacks VP JWT and nested VC JWTs.
    2. Resolves Issuer and Holder DIDs against Geth blockchain via `@ethr-did-resolver`.
    3. Reconstructs public keys and validates ECDSA signatures.
    4. Evaluates revocation status from `VCRegistry.sol`.
    5. Returns `VERIFIED / INVALID` without retaining student PII in memory or disk (100% GDPR & DPDP Act 2023 compliant).
  - **Mode 2: Stored Audit Mode**:
    Computes `SHA-256(vpJwt)` and records compliance logs (Timestamp, Verifier ID, Status) in PostgreSQL without storing unencrypted student PII.

---

## 6. Mathematical Verification Proofs (Zero-Knowledge Principle)

The verifier confirms validity through three mathematical assertions without ever contacting the university's internal servers:

$$\begin{aligned}
\text{Proof 1 (Authenticity):} \quad & e_{\text{issuer}} = \text{SHA-256}(\text{VC}_{\text{Header}} \mathbin{\Vert} \text{VC}_{\text{Payload}}) \\
& Q_{\text{issuer}} = \text{ecrecover}(e_{\text{issuer}}, r_{\text{vc}}, s_{\text{vc}}, v_{\text{vc}}) \\
& \text{last20Bytes}(\text{Keccak256}(Q_{\text{issuer}})) \equiv \text{Address}(\text{VC.iss}) \\[1em]
\text{Proof 2 (Holder Binding):} \quad & e_{\text{holder}} = \text{SHA-256}(\text{VP}_{\text{Header}} \mathbin{\Vert} \text{VP}_{\text{Payload}}) \\
& Q_{\text{holder}} = \text{ecrecover}(e_{\text{holder}}, r_{\text{vp}}, s_{\text{vp}}, v_{\text{vp}}) \\
& \text{last20Bytes}(\text{Keccak256}(Q_{\text{holder}})) \equiv \text{Address}(\text{VP.iss}) \equiv \text{Address}(\text{VC.sub}) \\[1em]
\text{Proof 3 (Validity & Status):} \quad & \text{VCRegistry.getVC}(\text{VC.id}).\text{revoked} \equiv \text{FALSE}
\end{aligned}$$

---

## 7. Configuration Reference Table

| Variable | Configured Value | Location | Description |
| :--- | :--- | :--- | :--- |
| `RPC_URL` | `http://192.168.245.65:8545` | `.env` | Geth Node JSON-RPC Endpoint |
| `CHAIN_ID` | `4321` | `.env` | Private Blockchain Network Identifier |
| `ETHR_DID_REGISTRY_ADDRESS` | `0x0130110D59e0b9475642D5c12dd616B3c4ede79A` | `.env` | On-Chain DID Resolution Contract |
| `VC_REGISTRY_ADDRESS` | `0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645` | `.env` | On-Chain VC Commitment & Revocation Contract |
| `MEDIATOR_URL` | `http://127.0.0.1:4000` | `.env` | DIDComm v2 WebSocket & HTTP Relay Gateway |
| `ISSUER_URL` | `http://127.0.0.1:3000` | `.env` | Institutional VC Issuance Service |
| `VERIFIER_URL` | `http://127.0.0.1:8081` | `.env` | Verification Microservice Engine |
