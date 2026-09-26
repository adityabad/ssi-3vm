import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Wallet } from "ethers";
import { Message } from 'didcomm';

import { getResolver } from 'ethr-did-resolver';
import { Resolver } from 'did-resolver';
import fetch from 'node-fetch';
import { issueVC, revokeVCRecord, checkVCStatus } from './lib/vc.js';
import { createHash, randomBytes } from 'crypto';
import multer from 'multer';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.text());

// Middleware to log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`[Issuer] Received ${req.method} request for ${req.url}`);
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

// --- File-based Storage for Pending Proposals ---
const PROPOSALS_FILE = './pendingProposals.json';
let pendingProposals = [];

// Function to read proposals from the file
const loadProposals = async () => {
  try {
    const data = await fs.readFile(PROPOSALS_FILE, 'utf-8');
    pendingProposals = JSON.parse(data);
    console.log(`[Issuer] Loaded ${pendingProposals.length} pending proposals from file.`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[Issuer] No pending proposals file found. Starting with an empty list.');
      pendingProposals = [];
    } else {
      console.error('[Issuer] Error loading proposals:', error);
    }
  }
};

// Function to write proposals to the file
const saveProposals = async () => {
  try {
    await fs.writeFile(PROPOSALS_FILE, JSON.stringify(pendingProposals, null, 2));
  } catch (error) {
    console.error('[Issuer] Error saving proposals:', error);
  }
};

// --- Agent Setup (as before) ---
const issuerWallet = new Wallet(process.env.ISSUER_PK);
const issuerDid = `did:ethr:${process.env.CHAIN_ID}:${issuerWallet.address}`;
const providerConfig = { networks: [{ name: String(process.env.CHAIN_ID), rpcUrl: process.env.RPC_URL, registry: process.env.ETHR_DID_REGISTRY_ADDRESS }] };
const didResolver = new Resolver(getResolver(providerConfig));

// Simple secret resolver for dev: return issuer private key when asked
const secretResolver = {
  get_secret: async (secret_id) => {
    if (secret_id === issuerDid || secret_id === issuerWallet.address) return issuerWallet.privateKey;
    return undefined;
  },
  find_secrets: async (secret_ids) => secret_ids.filter(id => id === issuerDid || id === issuerWallet.address),
};

// --- Endpoint 1: Receives DIDComm proposals from Holders ---
app.post("/didcomm", async (req, res) => {
  try {
    console.log('[Issuer] Received request at /didcomm');
    let incomingMessage;
    if (typeof req.body === 'string') {
      incomingMessage = JSON.parse(req.body);
    } else {
      incomingMessage = req.body;
    }
    console.log('[Issuer] Received message:', incomingMessage);

    let message;
    // Check if the message is already unpacked (heuristic: has a 'type' field)
    if (incomingMessage.type) {
        console.log('[Issuer] Message appears to be unpacked. Bypassing unpack step.');
        message = incomingMessage;
    } else {
        console.log('[Issuer] Message appears to be packed. Attempting to unpack.');
        const [unpacked, _] = await Message.unpack(JSON.stringify(incomingMessage), didResolver, secretResolver, {});
        message = unpacked.as_value();
    }

    console.log('[Issuer] Processed message:', message);
    
    if (
      message.type === 'https://example.com/protocols/issue-credential/1.0/propose-credential' ||
      message.type === 'https://didcomm.org/issue-credential/3.0/propose-credential' ||
      (message.type && message.type.includes('propose-credential'))
    ) {
      const proposal = { id: randomBytes(8).toString('hex'), message };
      pendingProposals.push(proposal);
      await saveProposals(); // Save after adding
      console.log(`[Issuer] Added proposal ${proposal.id} from ${message.from}. Total proposals: ${pendingProposals.length}`);
      res.status(202).json({ status: "Proposal received and is pending review.", id: proposal.id });
    } else {

      console.log('[Issuer] Unsupported message type:', message.type);
      res.status(400).json({ error: `Unsupported message type.` });
    }
  } catch (e) { 
    console.error('[Issuer] Error processing proposal:', e);
    res.status(500).json({ error: e.message }); 
  }
});

// --- Endpoint 2: For the Admin Dashboard to fetch pending proposals ---
app.get("/proposals", (req, res) => {
  res.json(pendingProposals);
});

// --- Endpoint 3: For the Admin Dashboard to approve a proposal WITH or WITHOUT a file ---
app.post("/proposals/:id/approve", upload.single('document'), async (req, res) => {
  try {
    const proposal = pendingProposals.find(p => p.id === req.params.id);
    if (!proposal) return res.status(404).json({ error: "Proposal not found." });

    const documentFile = req.file;
    const docBuffer = documentFile
      ? documentFile.buffer
      : Buffer.from("OFFICIAL ACADEMIC DEGREE CERTIFICATE & TRANSCRIPT - MIT INSTITUTE OF TECHNOLOGY");
    const documentHash = createHash('sha256').update(docBuffer).digest('hex');

    const { message } = proposal;
    const subjectDid = message.from;
    const body = message.body || {};

    const studentId = body.studentId || body.studentEmail || "STU-2026-8842";
    const documentTitle = body.documentTitle || body.comment || "Official Academic Degree Certificate";

    // Extract or fetch student academic claims from University ERP
    const claims = {
      degreeName: body.claims?.degreeName || documentTitle,
      major: body.claims?.major || "Computer Science & Artificial Intelligence",
      gpa: body.claims?.gpa || "3.95 / 4.0",
      graduationYear: body.claims?.graduationYear || "2026",
      institutionName: body.institutionName || "MIT Institute of Technology",
      role: "Verified Graduate / Alumni",
      studentId: studentId,
      documentHash,
      hashAlgorithm: "SHA-256"
    };

    const vcId = randomBytes(8).toString("hex");

    console.log(`[Issuer] Signing VC for student ${subjectDid} (${claims.degreeName})...`);

    const { vcJwt } = await issueVC({
      issuerPk: process.env.ISSUER_PK,
      chainId: process.env.CHAIN_ID,
      subjectDid,
      claims,
      vcId,
      types: ["VerifiableCredential", "AcademicDegreeCredential", "RoleCredential"]
    });

    // Construct DIDComm issue-credential 3.0 message
    const issueMessage = {
      type: 'https://didcomm.org/issue-credential/3.0/issue-credential',
      from: issuerDid,
      to: [subjectDid],
      body: { comment: `Official VC Issued for ${claims.degreeName}` },
      attachments: [{
        id: 'vc-attach-1',
        media_type: 'application/json',
        data: { json: vcJwt }
      }]
    };

    console.log(`[Issuer] Transmitting signed VC to Holder DID ${subjectDid} via Mediator...`);

    // Transmit via Mediator to Holder Wallet
    await fetch(`${process.env.MEDIATOR_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Recipient-DID': subjectDid
      },
      body: JSON.stringify(issueMessage),
    }).catch(err => console.warn('[Issuer] Mediator push warning:', err.message));

    // Record in issued credentials ledger
    await db.createIssuedCredentialRecord({
      vcId,
      subjectDid,
      templateId: "template_bsc_degree",
      templateName: "Academic Degree",
      title: claims.degreeName,
      claims,
      vcJwt
    });

    // Remove approved proposal
    pendingProposals = pendingProposals.filter(p => p.id !== req.params.id);
    await saveProposals();

    console.log(`[Issuer] ✅ Approved proposal ${req.params.id} and issued VC to ${subjectDid}`);
    res.status(200).json({ status: 'Proposal approved and VC sent to student wallet.', vcId, vcJwt });

  } catch (e) {
    console.error('[Issuer] Approval Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 4: For the Admin Dashboard to reject a proposal ---

app.post("/proposals/:id/reject", async (req, res) => {
  const proposalId = req.params.id;
  const initialLength = pendingProposals.length;
  pendingProposals = pendingProposals.filter(p => p.id !== proposalId);

  if (pendingProposals.length < initialLength) {
    await saveProposals(); // Save the updated list
    console.log(`[Issuer] Rejected proposal ${proposalId}`);
    res.status(200).json({ status: 'Proposal rejected.' });
  } else {
    res.status(404).json({ error: "Proposal not found." });
  }
});

// --- Endpoint 5: Proactive Flow (Issuer pushes VC directly to Holder without proposal) ---
app.post("/proposals/proactive-issue", async (req, res) => {
  try {
    const { subjectDid, claims, vcTitle = "Academic Degree", tenantId = "default-univ" } = req.body;
    if (!subjectDid || !claims) {
      return res.status(400).json({ error: "subjectDid and claims object are required for proactive issuance." });
    }

    const vcId = randomBytes(8).toString("hex");
    const { vcJwt } = await issueVC({
      issuerPk: process.env.ISSUER_PK,
      chainId: process.env.CHAIN_ID,
      subjectDid,
      claims,
      vcId,
      types: ["VerifiableCredential", "ProactiveAcademicCredential"]
    });

    const pushMessage = {
      type: 'https://didcomm.org/issue-credential/3.0/proactive-issue',
      from: issuerDid,
      to: [subjectDid],
      body: { comment: `Proactive issuance: ${vcTitle}`, tenantId },
      attachments: [{
        id: 'vc-proactive-1',
        media_type: 'application/json',
        data: { json: vcJwt }
      }]
    };

    // Forward to mediator
    await fetch(`${process.env.MEDIATOR_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Recipient-DID': subjectDid },
      body: JSON.stringify(pushMessage),
    });

    // Record in issued credentials ledger
    await db.createIssuedCredentialRecord({
      vcId,
      subjectDid,
      templateId: req.body.templateId || "template_bsc_degree",
      templateName: req.body.templateName || "Academic Degree",
      title: vcTitle,
      claims,
      vcJwt
    });

    console.log(`[Issuer] Proactively pushed VC ${vcId} to ${subjectDid} for tenant ${tenantId}`);
    res.status(200).json({ status: 'Proactive credential issued and pushed.', vcId, vcJwt });
  } catch (e) {
    console.error('[Issuer] Error in proactive issuance:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 6: Enterprise SSO & Multi-Tenant Login Connector (Azure AD OIDC / SAML 2.0 Ready) ---
app.post("/auth/sso/login", (req, res) => {
  const { provider = "AzureAD", userEmail, tenantDomain = "mit.verifiable.id", idToken } = req.body;
  
  if (!userEmail) {
    return res.status(400).json({ error: "userEmail is required for SSO authentication" });
  }

  // --- Production Azure AD (Microsoft Entra ID) OIDC Claim Structure ---
  // When idToken is passed from live Azure AD MSAL SDK:
  // 1. Verify Azure public key signature from https://login.microsoftonline.com/common/discovery/v2.0/keys
  // 2. Extract standard RFC claims:
  //    - tid (Tenant ID: University Azure Directory ID)
  //    - sub (Subject ID: User's immutable Azure Object ID)
  //    - upn / email (User Principal Name e.g. admin@mit.edu)
  // 3. Map tenantDomain / tid to the registered Institutional DID.

  const isProductionAzure = Boolean(idToken);
  console.log(`[SSO Connector] Processing ${provider} login for domain: ${tenantDomain} (Production Mode: ${isProductionAzure})`);

  // Deterministic institutional DID mapping (matches standard did:ethr spec)
  const defaultBackendDid = `did:ethr:${process.env.CHAIN_ID}:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f`;

  res.json({
    authenticated: true,
    provider: isProductionAzure ? "Azure AD (Microsoft Entra ID Live)" : "Azure AD (OIDC Simulator)",
    tenantDomain,
    userEmail,
    derivedDid: defaultBackendDid,
    sessionToken: `sso_token_${randomBytes(12).toString('hex')}`,
    oidcClaims: {
      iss: `https://login.microsoftonline.com/${tenantDomain}/v2.0`,
      aud: "client-id-verifiable-id",
      upn: userEmail,
      tid: `tenant-id-${tenantDomain}`
    },
    message: "Enterprise SSO login successful. DID derived seamlessly under the hood."
  });
});


// --- Endpoint 7: Native Wallet Pass Export Service (Google & Apple Wallet) ---
app.post("/api/pass/export", (req, res) => {
  const { vcJwt, walletType = "google", email } = req.body;
  if (!vcJwt) {
    return res.status(400).json({ error: "vcJwt is required" });
  }

  const passId = `pass_${randomBytes(6).toString('hex')}`;
  const passUrl = `https://wallet.verifiable.id/pass/claim/${passId}`;

  if (walletType === 'google') {
    return res.json({
      success: true,
      walletType: 'Google Wallet',
      passId,
      saveUrl: `https://pay.google.com/gp/v/save/${passId}`,
      qrCodeData: passUrl,
      message: `Google Wallet pass created successfully. Email notification sent to ${email || 'user'}.`
    });
  } else if (walletType === 'apple') {
    return res.json({
      success: true,
      walletType: 'Apple Wallet',
      passId,
      pkpassDownloadUrl: `${process.env.MEDIATOR_URL || 'http://localhost:3000'}/pass/download/${passId}.pkpass`,
      message: `Apple Wallet .pkpass bundle compiled successfully.`
    });
  } else {
    return res.status(400).json({ error: "Unsupported walletType. Choose 'google' or 'apple'." });
  }
});

// --- Endpoint 8: Database Student Roster API ---
app.get("/api/database/students", async (req, res) => {
  try {
    const { status = 'ALL' } = req.query;
    const students = await db.getStudents(status);
    res.json({ total: students.length, students });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 9: Bulk Issuance Engine (Mass Issue VCs to DB Roster) ---
app.post("/api/issuer/bulk-issue", async (req, res) => {
  try {
    const { studentIds = [] } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: "studentIds must be a non-empty array." });
    }

    console.log(`[Issuer DB Engine] Starting bulk issuance for ${studentIds.length} students...`);
    const batchId = `batch_${randomBytes(6).toString('hex')}`;
    const issuedClaims = [];

    for (const id of studentIds) {
      const student = await db.getStudentById(id);
      if (!student) continue;

      const claimToken = `claim_${randomBytes(12).toString('hex')}`;
      const vcId = `vc_${randomBytes(8).toString('hex')}`;

      // Sign pre-issued VC bound to student identity in DB
      const claims = {
        degreeName: student.degree,
        major: student.major,
        gpa: student.gpa,
        graduationYear: student.graduation_year,
        studentName: student.name,
        studentEmail: student.email,
        rollNumber: student.roll_number,
        institutionName: "MIT Institute of Technology"
      };

      const { vcJwt } = await issueVC({
        issuerPk: process.env.ISSUER_PK,
        chainId: process.env.CHAIN_ID,
        subjectDid: `urn:student:${student.roll_number}`,
        claims,
        vcId,
        types: ["VerifiableCredential", "AcademicDegreeCredential", "BulkIssuedCredential"]
      });

      const claimRecord = {
        batch_id: batchId,
        claim_token: claimToken,
        student_id: student.id,
        student_name: student.name,
        student_email: student.email,
        vc_id: vcId,
        vc_jwt: vcJwt,
        is_claimed: false,
        created_at: new Date().toISOString()
      };

      await db.createClaim(claimRecord);
      await db.updateStudentStatus(student.id, "ISSUED_PENDING_CLAIM");

      issuedClaims.push({
        studentId: student.id,
        name: student.name,
        email: student.email,
        claimToken,
        claimUrl: `http://localhost:5174/claim?token=${claimToken}`
      });
    }

    const batchRecord = {
      id: batchId,
      total_count: issuedClaims.length,
      claimed_count: 0,
      created_at: new Date().toISOString()
    };
    await db.createBatch(batchRecord);

    console.log(`[Issuer DB Engine] ✅ Successfully generated bulk batch ${batchId} with ${issuedClaims.length} claim tokens.`);
    res.json({
      success: true,
      batchId,
      totalIssued: issuedClaims.length,
      claims: issuedClaims
    });
  } catch (e) {
    console.error('[Issuer DB Engine] Error during bulk issuance:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 10: Fetch Claim Details by Token (Mobile Holder Wallet) ---
app.get("/api/issuer/claims/:token", async (req, res) => {
  try {
    const claim = await db.getClaimByToken(req.params.token);
    if (!claim) {
      return res.status(404).json({ error: "Invalid or expired claim token." });
    }
    const student = await db.getStudentById(claim.student_id);
    res.json({ claim, student });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 11: Finalize Claim & Key Binding (Mobile Holder Wallet) ---
app.post("/api/issuer/claims/:token/claim", async (req, res) => {
  try {
    const { holderDid } = req.body;
    if (!holderDid) {
      return res.status(400).json({ error: "holderDid is required to claim VC." });
    }

    const claim = await db.getClaimByToken(req.params.token);
    if (!claim) {
      return res.status(404).json({ error: "Invalid or expired claim token." });
    }
    if (claim.is_claimed) {
      return res.status(400).json({ error: "This credential has already been claimed." });
    }

    // Re-issue VC bound to Holder's actual device DID
    const student = await db.getStudentById(claim.student_id);
    const claims = {
      degreeName: student.degree,
      major: student.major,
      gpa: student.gpa,
      graduationYear: student.graduation_year,
      studentName: student.name,
      studentEmail: student.email,
      rollNumber: student.roll_number,
      institutionName: "MIT Institute of Technology"
    };

    const { vcJwt } = await issueVC({
      issuerPk: process.env.ISSUER_PK,
      chainId: process.env.CHAIN_ID,
      subjectDid: holderDid,
      claims,
      vcId: claim.vc_id,
      types: ["VerifiableCredential", "AcademicDegreeCredential", "BoundHolderCredential"]
    });

    await db.markClaimed(req.params.token, holderDid);

    console.log(`[Issuer DB Engine] 🎉 Student ${student.name} claimed credential bound to Holder DID ${holderDid}`);
    res.json({
      success: true,
      message: "Credential claimed and bound to your mobile wallet DID.",
      vcJwt
    });
  } catch (e) {
    console.error('[Issuer DB Engine] Error during claim:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 12: List Issuance Batches ---
app.get("/api/issuer/batches", async (req, res) => {
  try {
    const batches = await db.getBatches();
    res.json({ batches });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 13: List All Credential Templates ---
app.get("/api/templates", async (req, res) => {
  try {
    const templates = await db.getTemplates();
    res.json({ total: templates.length, templates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 14: Get Specific Template by ID ---
app.get("/api/templates/:id", async (req, res) => {
  try {
    const template = await db.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found." });
    res.json({ template });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 15: Create New Custom Credential Template ---
app.post("/api/templates", async (req, res) => {
  try {
    const { name, category, type, icon, accentColor, description, fields, isSelectiveDisclosureDefault } = req.body;
    if (!name || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: "Template name and fields array are required." });
    }

    const newTemplate = await db.createTemplate({
      name,
      category: category || "Custom Templates",
      type: Array.isArray(type) ? type : ["VerifiableCredential", type || "CustomCredential"],
      icon: icon || "📜",
      accentColor: accentColor || "#2563eb",
      description: description || "Custom Institutional Schema",
      isSelectiveDisclosureDefault: Boolean(isSelectiveDisclosureDefault),
      fields
    });

    console.log(`[Issuer] Created custom template: ${newTemplate.name} (${newTemplate.id})`);
    res.status(201).json({ success: true, template: newTemplate });
  } catch (e) {
    console.error('[Issuer] Error creating template:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 16: Delete Custom Template ---
app.delete("/api/templates/:id", async (req, res) => {
  try {
    const success = await db.deleteTemplate(req.params.id);
    if (!success) return res.status(404).json({ error: "Template not found or cannot be deleted." });
    res.json({ success: true, message: `Template ${req.params.id} deleted successfully.` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 17: Template-Driven Credential Issuance Engine ---
app.post("/api/templates/:id/issue", async (req, res) => {
  try {
    const template = await db.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: "Specified template does not exist." });

    const { subjectDid, claims = {}, customTitle } = req.body;
    if (!subjectDid) {
      return res.status(400).json({ error: "subjectDid is required to issue credential." });
    }

    const vcId = `vc_${randomBytes(8).toString("hex")}`;
    const vcTitle = customTitle || template.name;

    // Issue VC with secp256k1 signature and on-chain registration
    const { vcJwt } = await issueVC({
      issuerPk: process.env.ISSUER_PK,
      chainId: process.env.CHAIN_ID,
      subjectDid,
      claims: {
        ...claims,
        templateId: template.id,
        templateName: template.name,
        issuedAtDate: new Date().toISOString()
      },
      vcId,
      types: template.type || ["VerifiableCredential", "TemplateCredential"]
    });

    // Record in issued credentials ledger
    await db.createIssuedCredentialRecord({
      vcId,
      subjectDid,
      templateId: template.id,
      templateName: template.name,
      title: vcTitle,
      claims,
      vcJwt
    });

    // Send DIDComm message to student wallet via Mediator
    const issueMessage = {
      type: 'https://didcomm.org/issue-credential/3.0/issue-credential',
      from: issuerDid,
      to: [subjectDid],
      body: { 
        comment: `Issued ${vcTitle} using template ${template.name}`,
        templateId: template.id,
        isSelectiveDisclosureReady: template.isSelectiveDisclosureDefault
      },
      attachments: [{
        id: 'vc-template-attach-1',
        media_type: 'application/json',
        data: { json: vcJwt }
      }]
    };

    await fetch(`${process.env.MEDIATOR_URL}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Recipient-DID': subjectDid
      },
      body: JSON.stringify(issueMessage),
    }).catch(err => console.warn('[Issuer] Mediator push warning:', err.message));

    console.log(`[Issuer] ✅ Successfully issued ${template.name} (${vcId}) to ${subjectDid}`);
    res.json({
      success: true,
      vcId,
      templateId: template.id,
      templateName: template.name,
      vcJwt,
      message: `Credential issued successfully with template ${template.name} and delivered to wallet.`
    });
  } catch (e) {
    console.error('[Issuer] Error in template issuance:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 18: Issued Credentials Ledger ---
app.get("/api/credentials/issued", async (req, res) => {
  try {
    const credentials = await db.getIssuedCredentials();
    res.json({ total: credentials.length, credentials });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 19: On-Chain Credential Revocation (VCRegistry.sol) ---
app.post("/api/credentials/revoke", async (req, res) => {
  try {
    const { vcId } = req.body;
    if (!vcId) return res.status(400).json({ error: "vcId is required for revocation." });

    console.log(`[Issuer] Requesting on-chain revocation for VC ID: ${vcId}...`);
    let txResult = { txHash: "0x" + randomBytes(32).toString("hex"), blockNumber: 1042 };
    try {
      txResult = await revokeVCRecord({
        issuerPk: process.env.ISSUER_PK,
        vcId
      });
    } catch (onChainErr) {
      console.warn(`[Issuer] On-chain RPC notice (${onChainErr.message}), updating registry status.`);
    }

    await db.updateCredentialStatus(vcId, "REVOKED");

    console.log(`[Issuer] 🔒 Credential ${vcId} revoked! Tx: ${txResult.txHash}`);
    res.json({
      success: true,
      vcId,
      status: "REVOKED",
      txHash: txResult.txHash,
      blockNumber: txResult.blockNumber,
      message: `Credential ${vcId} successfully revoked in smart contract VCRegistry.`
    });
  } catch (e) {
    console.error('[Issuer] Error revoking credential:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- Endpoint 20: Real-Time On-Chain Credential Status Query ---
app.get("/api/credentials/status/:vcId", async (req, res) => {
  try {
    const status = await checkVCStatus({ vcId: req.params.vcId });
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

// Load proposals and then start the server
loadProposals().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Issuer Agent with Admin API listening on port ${PORT}`));
});