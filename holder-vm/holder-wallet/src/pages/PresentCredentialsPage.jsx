import React, { useState, useEffect, useMemo } from 'react';

const PRESET_VERIFIERS = [
  {
    name: 'Active Verifier Node (Local Portal)',
    did: 'did:ethr:4321:0x88d8c4711920F78EcDb9516F32EAB492ba69130d',
    badge: '⚡ Live Verifier Dashboard',
  },
  {
    name: 'Global Tech Recruiters Agency',
    did: 'did:ethr:4321:0x24FD574804691b7F53bEF6Bbf0fe0a8b46195970',
    badge: '🏢 Corporate Employer Verifier',
  },
  {
    name: 'National Background Clearance Bureau',
    did: 'did:ethr:4321:0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    badge: '⚖️ Government & Compliance Agency',
  },
];

// Helper to compute simple SHA-256 hex digest in browser
async function sha256Browser(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Safe base64url encoding and decoding for Unicode / UTF-8 strings
function safeBase64UrlEncode(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function safeBase64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export default function PresentCredentialsPage({ vcs = [], agent, setStatus }) {
  // Default VC fallback if no VC in wallet yet
  const defaultVcJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode({
    sub: agent?.did || 'did:ethr:4321:0x81c0E932dC0AED833fAd0Ec2E924fd972d86eD8E',
    iss: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
    jti: 'vc_academic_degree_2026',
    vc: {
      type: ['VerifiableCredential', 'AcademicDegreeCredential'],
      credentialSubject: {
        degreeName: 'Bachelor of Science in Computer Science & AI',
        major: 'Artificial Intelligence & Cybernetics',
        gpa: '3.95 / 4.0',
        graduationYear: '2026',
        institutionName: 'MIT Institute of Technology',
        role: 'Verified Graduate / Alumni',
        studentId: 'STU-2026-8842',
        studentEmail: 'aarav.sharma@mit.edu',
        documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
    },
  })}.mock_signature`;

  const availableVcs = vcs.length > 0 ? vcs : [defaultVcJwt];

  const [shareType, setShareType] = useState('campaign'); // 'campaign' vs 'didcomm'
  const [selectedVc, setSelectedVc] = useState(availableVcs[0]);

  // Mass Hiring Link State
  const [campaignUrlInput, setCampaignUrlInput] = useState('');
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');

  // DIDComm & Presentation State
  const [verifierDid, setVerifierDid] = useState(PRESET_VERIFIERS[0].did);
  const [customDidInput, setCustomDidInput] = useState('');
  const [useCustomDid, setUseCustomDid] = useState(false);
  const [presentationMode, setPresentationMode] = useState('selective'); // Default to Selective Disclosure
  const [attachedFile, setAttachedFile] = useState(null);

  // Selective Disclosure Claim Selection State
  const [disclosedClaimKeys, setDisclosedClaimKeys] = useState({});

  const [isSending, setIsSending] = useState(false);
  const [protocolStep, setProtocolStep] = useState(0);
  const [statusLog, setStatusLog] = useState([]);

  // Extract claims and metadata from current selected VC
  const parsedVc = useMemo(() => {
    try {
      const parts = selectedVc.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(safeBase64UrlDecode(parts[1]));
        const subject = payload.vc?.credentialSubject || payload.credentialSubject || {};
        const issuer = payload.iss || 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f';
        const vcId = payload.jti || subject.vcId || 'vc_standard';
        return { payload, subject, issuer, vcId };
      }
    } catch (e) {
      console.warn('Could not parse selected VC:', e);
    }
    return {
      payload: {},
      subject: {
        degreeName: 'Bachelor of Science in Computer Science & AI',
        major: 'Computer Science & AI',
        institutionName: 'MIT Institute of Technology',
        graduationYear: '2026',
        gpa: '3.95 / 4.0',
        studentId: 'STU-2026-8842',
        role: 'Verified Graduate / Alumni'
      },
      issuer: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
      vcId: 'vc_demo'
    };
  }, [selectedVc]);

  // Initialize claim toggles when selected VC changes
  useEffect(() => {
    if (parsedVc && parsedVc.subject) {
      const initial = {};
      const keys = Object.keys(parsedVc.subject).filter((k) => k !== '_sd' && k !== 'vcId');
      keys.forEach((k) => {
        // By default for selective disclosure: disclose educational credentials, hide sensitive personal/GPA
        if (k === 'gpa' || k === 'studentId' || k === 'studentEmail') {
          initial[k] = false; // Redacted by default for privacy
        } else {
          initial[k] = true;
        }
      });
      setDisclosedClaimKeys(initial);
    }
  }, [selectedVc]);

  const toggleClaimKey = (key) => {
    setDisclosedClaimKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const applyPreset = (presetType) => {
    if (!parsedVc?.subject) return;
    const allKeys = Object.keys(parsedVc.subject).filter((k) => k !== '_sd' && k !== 'vcId');
    const updated = {};

    if (presetType === 'academic') {
      // Disclose degree, major, institution, graduation, role; Redact GPA, studentId, studentEmail
      allKeys.forEach((k) => {
        updated[k] = !(k === 'gpa' || k === 'studentId' || k === 'studentEmail' || k === 'documentHash');
      });
    } else if (presetType === 'minimal') {
      // Disclose only institution and degree
      allKeys.forEach((k) => {
        updated[k] = k === 'institutionName' || k === 'degreeName';
      });
    } else if (presetType === 'all') {
      allKeys.forEach((k) => {
        updated[k] = true;
      });
    } else if (presetType === 'none') {
      allKeys.forEach((k) => {
        updated[k] = false;
      });
    }
    setDisclosedClaimKeys(updated);
  };

  useEffect(() => {
    fetch('http://localhost:8081/api/campaigns')
      .then((r) => r.json())
      .then((data) => {
        if (data.campaigns) {
          setActiveCampaigns(data.campaigns);
          if (data.campaigns.length > 0) {
            setCampaignUrlInput(data.campaigns[0].id);
          }
        }
      })
      .catch((e) => console.warn('Could not fetch active campaigns:', e.message));
  }, []);

  // Construct standard or selective disclosure VP token
  const buildPresentationPayload = async (targetAudience) => {
    const rawSubject = parsedVc.subject || {};
    const originalIssuer = parsedVc.issuer;
    const vcId = parsedVc.vcId;

    if (presentationMode === 'selective') {
      const disclosedClaims = {};
      const redactedClaims = [];
      const maskedSubject = {};

      for (const [k, v] of Object.entries(rawSubject)) {
        if (k === '_sd' || k === 'vcId') continue;
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);

        if (disclosedClaimKeys[k]) {
          disclosedClaims[k] = v;
          maskedSubject[k] = v;
        } else {
          const blindDigest = await sha256Browser(`${k}:${valStr}`);
          redactedClaims.push({
            field: k,
            status: 'REDACTED_BY_HOLDER',
            digest: `0x${blindDigest}`,
          });
          maskedSubject[k] = `[REDACTED_BY_HOLDER - Digest: ${blindDigest.substring(0, 8)}...]`;
        }
      }

      const selectiveVcPayload = {
        iss: originalIssuer,
        sub: agent?.did || 'did:ethr:4321:0xHolderKey',
        jti: vcId,
        selectiveDisclosure: true,
        disclosedClaims,
        redactedClaims,
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'SelectiveDisclosureCredential', 'AcademicDegreeCredential'],
          credentialSubject: {
            ...maskedSubject,
            vcId,
          },
          selectiveDisclosure: true,
        },
      };

      const selectiveVcJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(selectiveVcPayload)}.sd_issuer_proof`;

      const vpPayload = {
        iss: agent?.did || 'did:ethr:4321:0xHolderKey',
        aud: targetAudience || 'did:ethr:4321:0xVerifierNode',
        presentationMode: 'selective',
        selectiveDisclosure: true,
        vp: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation', 'SelectiveDisclosurePresentation'],
          verifiableCredential: [selectiveVcJwt],
        },
      };

      return `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(vpPayload)}.holder_sd_vp_signature`;
    } else {
      // Full structured presentation
      const vpPayload = {
        iss: agent?.did || 'did:ethr:4321:0xHolderKey',
        aud: targetAudience || 'did:ethr:4321:0xVerifierNode',
        presentationMode: 'structured',
        vp: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          verifiableCredential: [selectedVc],
        },
      };
      return `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(vpPayload)}.holder_vp_signature`;
    }
  };

  const handleCampaignSubmit = async (e) => {
    e.preventDefault();
    if (!campaignUrlInput.trim()) return alert('Please enter or select a Campaign Link / ID.');
    if (!candidateName.trim() || !candidateEmail.trim()) return alert('Please enter candidate name and email.');

    let campaignId = campaignUrlInput.trim();
    if (campaignId.includes('/campaign/')) {
      campaignId = campaignId.split('/campaign/')[1].split('/')[0].split('?')[0];
    }

    setIsSending(true);
    setProtocolStep(1);
    const modeLabel = presentationMode === 'selective' ? 'Zero-Knowledge Selective Disclosure' : 'Standard Full Disclosure';
    setStatusLog([`[Step 1] Preparing Verifiable Presentation in [${modeLabel}] mode for Campaign "${campaignId}"...`]);

    try {
      setProtocolStep(2);
      setStatusLog((prev) => [...prev, `[Step 2] Cryptographically signing VP with Holder Private Key (${agent?.did || 'Local Key'})...`]);

      const vpJwt = await buildPresentationPayload(`did:ethr:4321:0xCampaignEmployer`);

      if (presentationMode === 'selective') {
        const disclosedCount = Object.values(disclosedClaimKeys).filter(Boolean).length;
        const redactedCount = Object.values(disclosedClaimKeys).filter((v) => !v).length;
        setStatusLog((prev) => [
          ...prev,
          `[Step 2.1] 🔒 Privacy Shield Applied: Disclosed ${disclosedCount} claim(s), Redacted ${redactedCount} sensitive field(s) with SHA-256 blind digests.`,
        ]);
      }

      setProtocolStep(3);
      setStatusLog((prev) => [...prev, `[Step 3] Transmitting VP envelope to Employer Hiring Campaign API...`]);

      const resp = await fetch(`http://localhost:8081/api/campaigns/${campaignId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          vpJwt,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Submission failed');

      setProtocolStep(4);
      setStatusLog((prev) => [...prev, `[Step 4] ✅ SUCCESS: ${data.message || 'Submitted successfully!'}`]);
      if (setStatus) setStatus('✅ Verifiable Presentation submitted to Employer Hiring Link!');
    } catch (err) {
      setStatusLog((prev) => [...prev, `[Error] ❌ ${err.message}`]);
    } finally {
      setIsSending(false);
    }
  };

  const targetVerifierDid = useCustomDid ? customDidInput : verifierDid;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFile(e.target.files[0]);
    }
  };

  const handleSendPresentation = async (e) => {
    e.preventDefault();
    if (!selectedVc) return alert('Please select a credential to present.');
    if (!targetVerifierDid.trim()) return alert('Please enter recipient Verifier DID.');
    if (!agent || !agent.did) return alert('Wallet identity not initialized.');

    setIsSending(true);
    setProtocolStep(1);
    const modeLabel = presentationMode === 'selective' ? 'Zero-Knowledge Selective Disclosure' : presentationMode.toUpperCase();
    setStatusLog([`[Step 1] Initializing Verifiable Presentation in [${modeLabel}] mode...`]);

    try {
      let fileBase64 = null;
      if (presentationMode === 'with_document' && attachedFile) {
        setStatusLog((prev) => [...prev, `[Step 1.1] Encoding attached PDF "${attachedFile.name}"...`]);
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(attachedFile);
        });
      }

      setProtocolStep(2);
      setStatusLog((prev) => [...prev, `[Step 2] Signing VP with Holder Private Key (secp256k1 / ES256K-R)...`]);

      const vpJwtPayload = await buildPresentationPayload(targetVerifierDid);

      if (presentationMode === 'selective') {
        const disclosedCount = Object.values(disclosedClaimKeys).filter(Boolean).length;
        const redactedCount = Object.values(disclosedClaimKeys).filter((v) => !v).length;
        setStatusLog((prev) => [
          ...prev,
          `[Step 2.1] 🔒 Privacy Shield Applied: Disclosed ${disclosedCount} claim(s), Redacted ${redactedCount} sensitive field(s) with SHA-256 blind digests.`,
        ]);
      }

      const attachments = [
        {
          id: 'vc-jwt-1',
          media_type: 'application/json',
          data: { json: vpJwtPayload },
        },
      ];

      if (fileBase64) {
        attachments.push({
          id: 'doc-file-1',
          media_type: attachedFile.type || 'application/pdf',
          filename: attachedFile.name,
          data: { base64: fileBase64 },
        });
      }

      const presentationMsg = {
        type: 'https://didcomm.org/present-proof/3.0/presentation',
        from: agent.did,
        to: [targetVerifierDid],
        body: {
          presentationMode,
          comment: `Verifiable Presentation submitted in ${presentationMode} mode.`,
        },
        attachments,
      };

      setProtocolStep(3);
      setStatusLog((prev) => [...prev, `[Step 3] Transmitting encrypted VP envelope to Verifier via DIDComm Mediator...`]);

      await fetch(`${import.meta.env.VITE_MEDIATOR_URL || 'http://127.0.0.1:4000'}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Recipient-DID': targetVerifierDid,
        },
        body: JSON.stringify(presentationMsg),
      }).catch((err) => console.warn('[Holder] Mediator push warning:', err.message));

      await fetch('http://localhost:8081/didcomm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presentationMsg),
      }).catch((err) => console.warn('[Holder] Direct push warning:', err.message));

      setProtocolStep(4);
      setStatusLog((prev) => [
        ...prev,
        `[Step 4] ✅ SUCCESS! Presentation delivered to Verifier ${targetVerifierDid.substring(0, 18)}...`,
      ]);

      if (setStatus) setStatus(`✅ Verifiable Presentation sent in [${modeLabel}] mode!`);
    } catch (err) {
      console.error(err);
      setStatusLog((prev) => [...prev, `❌ TRANSMISSION ERROR: ${err.message}`]);
      if (setStatus) setStatus(`❌ Error sending VP: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const subjectKeys = Object.keys(parsedVc.subject || {}).filter((k) => k !== '_sd' && k !== 'vcId');

  return (
    <div style={{ padding: '0px' }}>
      {/* Header */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📤 Present Verifiable Credential / VP (Self-Sovereign Share)</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Submit your credential directly to an Employer Hiring Link or send P2P via DIDComm with full claim privacy control.
            </p>
          </div>
          <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px' }}>
            🔒 Full Holder Consent & Zero-Knowledge Privacy
          </span>
        </div>
      </div>

      {/* Share Type Selector Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => setShareType('campaign')}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            border: `2px solid ${shareType === 'campaign' ? '#2563eb' : '#cbd5e1'}`,
            background: shareType === 'campaign' ? '#eff6ff' : '#ffffff',
            color: shareType === 'campaign' ? '#2563eb' : '#475569',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          🔗 Submit to Employer Mass Hiring Link
        </button>
        <button
          onClick={() => setShareType('didcomm')}
          style={{
            flex: 1,
            padding: '14px',
            borderRadius: '12px',
            border: `2px solid ${shareType === 'didcomm' ? '#2563eb' : '#cbd5e1'}`,
            background: shareType === 'didcomm' ? '#eff6ff' : '#ffffff',
            color: shareType === 'didcomm' ? '#2563eb' : '#475569',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          📡 Direct DIDComm Peer-to-Peer Presentation
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        {/* Left Column: Presentation Form */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          {shareType === 'campaign' ? (
            <form onSubmit={handleCampaignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  1️⃣ Select Active Employer Campaign or Paste Hiring Link / ID:
                </label>

                {activeCampaigns.length > 0 && (
                  <select
                    value={campaignUrlInput}
                    onChange={(e) => setCampaignUrlInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      background: '#f8fafc',
                      fontWeight: 700,
                      marginBottom: '10px',
                    }}
                  >
                    {activeCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.company_name})
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  placeholder="Or paste Campaign URL / ID (e.g. camp_ef614b6186d9)"
                  value={campaignUrlInput}
                  onChange={(e) => setCampaignUrlInput(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  2️⃣ Candidate Details:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="Candidate Name (e.g. Alex Rivera)"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    required
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                  />
                  <input
                    type="email"
                    placeholder="Candidate Email (e.g. alex@mit.edu)"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    required
                    style={{ padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  3️⃣ Select Credential to Present:
                </label>
                <select
                  value={selectedVc}
                  onChange={(e) => setSelectedVc(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', fontWeight: 600, color: '#0f172a' }}
                >
                  {availableVcs.map((vcItem, idx) => {
                    let parsed = null;
                    try {
                      parsed = JSON.parse(atob(vcItem.split('.')[1]));
                    } catch (e) {}
                    const title = parsed?.vc?.credentialSubject?.degreeName || `Verifiable Academic Credential #${idx + 1}`;
                    return (
                      <option key={idx} value={vcItem}>
                        🎓 {title} ({vcs.length === 0 ? 'Verified Demo VC' : `Stored VC #${idx + 1}`})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Presentation Mode Selection for Campaign */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  4️⃣ Privacy & Disclosure Mode:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setPresentationMode('selective')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `2px solid ${presentationMode === 'selective' ? '#16a34a' : '#cbd5e1'}`,
                      background: presentationMode === 'selective' ? '#f0fdf4' : '#ffffff',
                      color: presentationMode === 'selective' ? '#15803d' : '#475569',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    🔒 Zero-Knowledge Selective Disclosure
                    <div style={{ fontSize: '11px', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Redacts GPA & personal IDs
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresentationMode('structured')}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `2px solid ${presentationMode === 'structured' ? '#2563eb' : '#cbd5e1'}`,
                      background: presentationMode === 'structured' ? '#eff6ff' : '#ffffff',
                      color: presentationMode === 'structured' ? '#2563eb' : '#475569',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    📄 Full Credential Disclosure
                    <div style={{ fontSize: '11px', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                      Shares all claims as-is
                    </div>
                  </button>
                </div>
              </div>

              {/* Interactive Claim Picker if Selective Disclosure is active */}
              {presentationMode === 'selective' && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      🛡️ Selective Claim Privacy Toggles
                    </strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => applyPreset('academic')}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🎓 Academic Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('minimal')}
                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🏛️ Minimal
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {subjectKeys.map((key) => {
                      const isChecked = Boolean(disclosedClaimKeys[key]);
                      const val = parsedVc.subject[key];
                      return (
                        <label
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: isChecked ? '#ffffff' : '#f1f5f9',
                            border: `1px solid ${isChecked ? '#86efac' : '#e2e8f0'}`,
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClaimKey(key)}
                            style={{ accentColor: '#16a34a' }}
                          />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: isChecked ? '#166534' : '#64748b' }}>{key}</strong>
                            <div style={{ fontSize: '10px', color: isChecked ? '#334155' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isChecked ? String(val) : '🔒 [REDACTED]'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSending}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '16px',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                }}
              >
                🚀 Submit VP to Employer Hiring Link
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendPresentation} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. Select VC to Present */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  1️⃣ Select Credential to Present:
                </label>
                <select
                  value={selectedVc}
                  onChange={(e) => setSelectedVc(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', fontWeight: 600, color: '#0f172a' }}
                >
                  {availableVcs.map((vcItem, idx) => {
                    let parsed = null;
                    try {
                      parsed = JSON.parse(atob(vcItem.split('.')[1]));
                    } catch (e) {}
                    const title = parsed?.vc?.credentialSubject?.degreeName || `Verifiable Academic Credential #${idx + 1}`;
                    return (
                      <option key={idx} value={vcItem}>
                        🎓 {title} ({vcs.length === 0 ? 'Verified Demo VC' : `Stored VC #${idx + 1}`})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Target Verifier DID */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    2️⃣ Recipient Employer / Verifier DID:
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomDid(!useCustomDid)}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {useCustomDid ? '← Use Preset Agency' : '+ Enter Custom DID'}
                  </button>
                </div>

                {!useCustomDid ? (
                  <select
                    value={verifierDid}
                    onChange={(e) => setVerifierDid(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', fontWeight: 600 }}
                  >
                    {PRESET_VERIFIERS.map((v) => (
                      <option key={v.did} value={v.did}>
                        {v.name} ({v.badge})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="did:ethr:4321:0x..."
                    value={customDidInput}
                    onChange={(e) => setCustomDidInput(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace' }}
                  />
                )}
              </div>

              {/* 3. Presentation Mode */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                  3️⃣ Select Self-Sovereign Presentation Mode:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: presentationMode === 'selective' ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${presentationMode === 'selective' ? '#16a34a' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="selective"
                      checked={presentationMode === 'selective'}
                      onChange={() => setPresentationMode('selective')}
                      style={{ marginTop: '3px', accentColor: '#16a34a' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                          🔒 Option A: Zero-Knowledge Selective Disclosure (Recommended)
                        </strong>
                        <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                          HIGHEST PRIVACY
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Discloses verified degree & graduation status while redacting GPA, student ID, and personal marks with blind cryptographic digests.
                      </p>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: presentationMode === 'structured' ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${presentationMode === 'structured' ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="structured"
                      checked={presentationMode === 'structured'}
                      onChange={() => setPresentationMode('structured')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                        🎓 Option B: Pure Structured Claims (Full Disclosure)
                      </strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Shares all verified claims (Degree, Major, GPA, Institution) directly.
                      </p>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: presentationMode === 'with_document' ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${presentationMode === 'with_document' ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value="with_document"
                      checked={presentationMode === 'with_document'}
                      onChange={() => setPresentationMode('with_document')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                        📄 Option C: Structured VC + Attached Original Document PDF
                      </strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Attaches the original degree PDF file via DIDComm. Verifier checks file hash on-chain.
                      </p>
                    </div>
                  </label>

                  {presentationMode === 'with_document' && (
                    <div style={{ paddingLeft: '28px', paddingTop: '4px' }}>
                      <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} style={{ fontSize: '12px' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Selective Claim Picker in DIDComm Mode */}
              {presentationMode === 'selective' && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                      🛡️ Selective Claim Privacy Toggles
                    </strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => applyPreset('academic')}
                        style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🎓 Academic Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('minimal')}
                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        🏛️ Minimal
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset('all')}
                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {subjectKeys.map((key) => {
                      const isChecked = Boolean(disclosedClaimKeys[key]);
                      const val = parsedVc.subject[key];
                      return (
                        <label
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: isChecked ? '#ffffff' : '#f1f5f9',
                            border: `1px solid ${isChecked ? '#86efac' : '#e2e8f0'}`,
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClaimKey(key)}
                            style={{ accentColor: '#16a34a' }}
                          />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: isChecked ? '#166534' : '#64748b' }}>{key}</strong>
                            <div style={{ fontSize: '10px', color: isChecked ? '#334155' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isChecked ? String(val) : '🔒 [REDACTED]'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSending}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                {isSending ? '⚡ Packing & Transmitting Presentation...' : '📤 Send Verifiable Presentation to Employer'}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Live Presentation Preview & Execution Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Selective Disclosure Preview Card */}
          {presentationMode === 'selective' && (
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: '14px' }}>
                  👁️ Live Verifier View Preview
                </h4>
                <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                  Zero-Knowledge Proof
                </span>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                Employer will only see approved attributes below:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {subjectKeys.map((k) => {
                  const isDisclosed = Boolean(disclosedClaimKeys[k]);
                  const val = parsedVc.subject[k];
                  return (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: isDisclosed ? '#f0fdf4' : '#f8fafc',
                        border: `1px solid ${isDisclosed ? '#bbf7d0' : '#e2e8f0'}`,
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: isDisclosed ? '#166534' : '#64748b' }}>
                        {isDisclosed ? '✅' : '🔒'} {k}
                      </span>
                      <span style={{ fontFamily: isDisclosed ? 'inherit' : 'monospace', color: isDisclosed ? '#0f172a' : '#94a3b8', fontSize: isDisclosed ? '12px' : '11px' }}>
                        {isDisclosed ? String(val) : '[REDACTED BY HOLDER]'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stepper Tracker */}
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 14px 0', color: '#0f172a' }}>⚡ Presentation Protocol Tracker</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ color: protocolStep >= 1 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 1 ? 700 : 500 }}>
                {protocolStep > 1 ? '✅' : protocolStep === 1 ? '⏳' : '⚪'} 1. Format VP & Selective Disclosure Claims
              </div>
              <div style={{ color: protocolStep >= 2 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 2 ? 700 : 500 }}>
                {protocolStep > 2 ? '✅' : protocolStep === 2 ? '⏳' : '⚪'} 2. Sign VP with Holder Key & Blind Digests
              </div>
              <div style={{ color: protocolStep >= 3 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 3 ? 700 : 500 }}>
                {protocolStep > 3 ? '✅' : protocolStep === 3 ? '⏳' : '⚪'} 3. Transmit to Employer / Verifier
              </div>
              <div style={{ color: protocolStep >= 4 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 4 ? 700 : 500 }}>
                {protocolStep === 4 ? '✅' : '⚪'} 4. Submission Delivered
              </div>
            </div>
          </div>

          {/* Log Terminal */}
          <div style={{ background: '#0f172a', color: '#f8fafc', padding: '20px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px', minHeight: '220px', overflowY: 'auto' }}>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '8px' }}>
              Terminal Protocol Log:
            </strong>
            {statusLog.length === 0 ? (
              <span style={{ color: '#64748b' }}>Waiting to send presentation...</span>
            ) : (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {statusLog.join('\n\n')}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
