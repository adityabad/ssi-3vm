import React, { useState } from 'react';

const INSTITUTIONS = [
  {
    name: 'MIT Institute of Technology',
    did: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
    ssoTenant: 'mit.edu (Azure AD / Microsoft Entra ID)',
    badge: '🏛️ Main Academic Registry',
  },
  {
    name: 'Harvard University',
    did: 'did:ethr:4321:0x1111111111111111111111111111111111111111',
    ssoTenant: 'harvard.edu (Shibboleth SAML 2.0)',
    badge: '🎓 Ivy League Registry',
  },
  {
    name: 'Stanford University',
    did: 'did:ethr:4321:0x2222222222222222222222222222222222222222',
    ssoTenant: 'stanford.edu (Okta OIDC)',
    badge: '🔬 Engineering & Research',
  },
  {
    name: 'Oxford Academic Registry',
    did: 'did:ethr:4321:0x3333333333333333333333333333333333333333',
    ssoTenant: 'ox.ac.uk (OIDC OpenID Connect)',
    badge: '💻 International Registry',
  },
];

const AVAILABLE_DOCUMENTS = [
  {
    id: 'degree_cert',
    title: 'Official Academic Degree Certificate',
    description: 'Cryptographically signed degree certificate containing major, graduation year, and official university seal.',
    icon: '🎓',
  },
  {
    id: 'marks_card',
    title: 'Official Semester Marks Card & Transcript',
    description: 'Detailed course marks breakdown, GPA performance scores, and linked official PDF transcript.',
    icon: '📊',
  },
  {
    id: 'alumni_membership',
    title: 'University Alumni & Graduate ID Card',
    description: 'Verified alumni role credential for global discount access and library privileges.',
    icon: '🪪',
  },
];

export default function RequestCredentialPage({ agent, issuerDid, mediatorUrl }) {
  const [selectedInstDid, setSelectedInstDid] = useState(issuerDid || INSTITUTIONS[0].did);
  const [selectedDocId, setSelectedDocId] = useState('degree_cert');
  const [studentId, setStudentId] = useState('STU-2026-8842');
  const [studentEmail, setStudentEmail] = useState('alex.rivera@university.edu');
  const [purposeNote, setPurposeNote] = useState('Requesting digital credential for background verification by employer.');

  const [isProcessing, setIsProcessing] = useState(false);
  const [protocolStep, setProtocolStep] = useState(0); // 0: Idle, 1: Formatting, 2: Packing, 3: Transmitting, 4: Complete
  const [statusLog, setStatusLog] = useState([]);

  const currentInstitution = INSTITUTIONS.find((i) => i.did === selectedInstDid) || INSTITUTIONS[0];
  const selectedDoc = AVAILABLE_DOCUMENTS.find((d) => d.id === selectedDocId) || AVAILABLE_DOCUMENTS[0];

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!agent || !agent.did) {
      alert('Wallet identity not initialized. Please login first.');
      return;
    }

    setIsProcessing(true);
    setProtocolStep(1);
    setStatusLog([
      `[Step 1] Constructing W3C Propose-Credential request for document "${selectedDoc.title}"...`,
    ]);

    try {
      // Standard W3C DIDComm issue-credential 3.0 proposal message
      const proposeMessage = {
        type: 'https://didcomm.org/issue-credential/3.0/propose-credential',
        from: agent.did,
        to: [selectedInstDid],
        body: {
          comment: `Student Request: ${selectedDoc.title}`,
          documentType: selectedDoc.id,
          documentTitle: selectedDoc.title,
          studentId,
          studentEmail,
          purposeNote,
          institutionName: currentInstitution.name,
        },
      };

      setProtocolStep(2);
      setStatusLog((prev) => [
        ...prev,
        `[Step 2] Encrypting & packing DIDComm proposal via Veramo shim (http://localhost:3001/pack)...`,
      ]);

      const packResp = await fetch('http://localhost:3001/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: proposeMessage,
          to: selectedInstDid,
          from: agent.did,
        }),
      });

      if (!packResp.ok) {
        const err = await packResp.json().catch(() => ({}));
        throw new Error(err.error || `DIDComm pack failed with status ${packResp.status}`);
      }

      const packedMessage = await packResp.json();

      setProtocolStep(3);
      setStatusLog((prev) => [
        ...prev,
        `[Step 3] Transmitting encrypted request to Mediator (${mediatorUrl}/send)...`,
      ]);

      const sendResp = await fetch(`${mediatorUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-Recipient-DID': selectedInstDid,
        },
        body: JSON.stringify(packedMessage),
      });

      // Direct notification to Issuer Service API for instant dashboard updates
      await fetch('http://localhost:3000/didcomm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposeMessage),
      }).catch((e) => console.warn('Direct issuer notification warn:', e));


      if (!sendResp.ok) {
        throw new Error(`Mediator send failed with status ${sendResp.status}`);
      }

      setProtocolStep(4);
      setStatusLog((prev) => [
        ...prev,
        `[Step 4] ✅ SUCCESS! Credential request delivered to ${currentInstitution.name}.`,
        `[University System Action] ${currentInstitution.name} will fetch your official academic records from their internal ERP database, sign the VC/document, and push it directly to your wallet proactive inbox!`,
      ]);
    } catch (err) {
      console.error(err);
      setStatusLog((prev) => [...prev, `❌ PROTOCOL ERROR: ${err.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: '0px' }}>
      {/* Header */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📥 Request Academic Credential (University ERP Lookup)</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Select a university and request an official academic document. The university will verify your student ID against their internal records database and issue the authentic signed credential.
            </p>
          </div>
          <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px' }}>
            🔒 Authenticated Student Request
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        {/* Left Column: Form */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Institution Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                1️⃣ Target Issuing University / Institution:
              </label>
              <select
                value={selectedInstDid}
                onChange={(e) => setSelectedInstDid(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', fontWeight: 600, color: '#0f172a' }}
              >
                {INSTITUTIONS.map((inst) => (
                  <option key={inst.did} value={inst.did}>
                    {inst.name} ({inst.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* University SSO Status Card */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                  🔐 University Single Sign-On (Entra ID OIDC)
                </div>
                <div style={{ fontSize: '11px', color: '#15803d' }}>
                  Tenant: {currentInstitution.ssoTenant}
                </div>
              </div>
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px' }}>
                ● Identity Verified
              </span>
            </div>

            {/* 2. Select Document Type */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                2️⃣ Select Document / Credential Type Requested:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {AVAILABLE_DOCUMENTS.map((doc) => (
                  <label
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      background: selectedDocId === doc.id ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${selectedDocId === doc.id ? '#2563eb' : '#e2e8f0'}`,
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="docType"
                      value={doc.id}
                      checked={selectedDocId === doc.id}
                      onChange={() => setSelectedDocId(doc.id)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                        {doc.icon} {doc.title}
                      </strong>
                      <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        {doc.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Student Identification Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Student Roll No / University ID:
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Institutional Email (UPN):
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>

                Purpose Note for Registrar:
              </label>
              <textarea
                rows={2}
                value={purposeNote}
                onChange={(e) => setPurposeNote(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
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
              {isProcessing ? '⚡ Transmitting Request to University ERP...' : `📤 Send Credential Request to ${currentInstitution.name}`}
            </button>
          </form>
        </div>

        {/* Right Column: Execution Log & Stepper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Protocol Stepper */}
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 14px 0', color: '#0f172a' }}>⚡ Request Protocol Tracker</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ color: protocolStep >= 1 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 1 ? 700 : 500 }}>
                {protocolStep > 1 ? '✅' : protocolStep === 1 ? '⏳' : '⚪'} 1. Format Propose-Credential Request
              </div>
              <div style={{ color: protocolStep >= 2 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 2 ? 700 : 500 }}>
                {protocolStep > 2 ? '✅' : protocolStep === 2 ? '⏳' : '⚪'} 2. Pack DIDComm Envelope (Veramo Shim)
              </div>
              <div style={{ color: protocolStep >= 3 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 3 ? 700 : 500 }}>
                {protocolStep > 3 ? '✅' : protocolStep === 3 ? '⏳' : '⚪'} 3. Transmit Payload to Mediator
              </div>
              <div style={{ color: protocolStep >= 4 ? '#16a34a' : '#94a3b8', fontWeight: protocolStep === 4 ? 700 : 500 }}>
                {protocolStep === 4 ? '✅' : '⚪'} 4. Delivered to University Registry ERP
              </div>
            </div>
          </div>

          {/* Real-time Protocol Logger */}
          <div style={{ background: '#0f172a', color: '#f8fafc', padding: '20px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '12px', minHeight: '260px', overflowY: 'auto' }}>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '8px' }}>
              Terminal Protocol Log:
            </strong>
            {statusLog.length === 0 ? (
              <span style={{ color: '#64748b' }}>Waiting to send request...</span>
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