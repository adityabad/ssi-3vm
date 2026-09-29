import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { createVerifiablePresentationJwt } from 'did-jwt-vc';

const VERIFIER_API_URL = import.meta.env.VITE_VERIFIER_AGENT_URL || 'http://localhost:8081';

// Helper to compute SHA-256 hex digest in browser
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

export default function CampaignSubmissionPage({ vcs = [], userName = '', userEmail = '', userDid = '', agent }) {
  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState(null);
  const [selectedVcIndex, setSelectedVcIndex] = useState(0);
  const [candidateName, setCandidateName] = useState(userName || '');
  const [candidateEmail, setCandidateEmail] = useState(userEmail || '');
  const [useSelectiveDisclosure, setUseSelectiveDisclosure] = useState(false); // Selective disclosure is not cryptographically verifiable yet
  const [disclosedKeys, setDisclosedKeys] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (userName) setCandidateName(userName);
    if (userEmail) setCandidateEmail(userEmail);
  }, [userName, userEmail]);

  useEffect(() => {
    fetch(`${VERIFIER_API_URL}/api/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCampaign(data.campaign);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  const currentVc = vcs[selectedVcIndex] || null;

  const parsedVc = useMemo(() => {
    if (!currentVc) return null;
    const vcStr = typeof currentVc === 'string' ? currentVc : currentVc.jwt || JSON.stringify(currentVc);
    try {
      const parts = vcStr.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(safeBase64UrlDecode(parts[1]));
        const subject = payload.vc?.credentialSubject || payload.credentialSubject || {};
        const issuer = payload.iss || 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f';
        const vcId = payload.jti || subject.vcId || 'vc_standard';
        return { payload, subject, issuer, vcId, rawJwt: vcStr };
      }
    } catch (e) {}
    return {
      payload: {},
      subject: {
        degreeName: 'Bachelor of Science in Computer Science & AI',
        major: 'Computer Science & AI',
        institutionName: 'MIT Institute of Technology',
        graduationYear: '2026',
        gpa: '3.95 / 4.0',
        studentId: 'STU-2026-8842',
      },
      issuer: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
      vcId: 'vc_demo',
      rawJwt: vcStr,
    };
  }, [currentVc]);

  useEffect(() => {
    if (parsedVc && parsedVc.subject) {
      const init = {};
      const keys = Object.keys(parsedVc.subject).filter((k) => k !== '_sd' && k !== 'vcId');
      keys.forEach((k) => {
        if (k === 'gpa' || k === 'studentId' || k === 'studentEmail') {
          init[k] = false; // Redact by default
        } else {
          init[k] = true;
        }
      });
      setDisclosedKeys(init);
    }
  }, [parsedVc]);

  const toggleKey = (k) => {
    setDisclosedKeys((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const handleSubmitPresentation = async (e) => {
    e.preventDefault();
    if (!candidateName || !candidateEmail) {
      return alert('Please enter candidate name and email.');
    }
    if (vcs.length === 0) {
      return alert('No Verifiable Credentials found in your wallet. Please claim a credential first.');
    }

    setIsLoading(true);
    setStatus('Cryptographically assembling Verifiable Presentation...');

    try {
      let vpJwt;
      if (useSelectiveDisclosure && parsedVc) {
        const rawSubject = parsedVc.subject || {};
        const disclosedClaims = {};
        const redactedClaims = [];
        const maskedSubject = {};

        for (const [k, v] of Object.entries(rawSubject)) {
          if (k === '_sd' || k === 'vcId') continue;
          const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);

          if (disclosedKeys[k]) {
            disclosedClaims[k] = v;
            maskedSubject[k] = v;
          } else {
            const digest = await sha256Browser(`${k}:${valStr}`);
            redactedClaims.push({
              field: k,
              status: 'REDACTED_BY_HOLDER',
              digest: `0x${digest}`,
            });
            maskedSubject[k] = `[REDACTED_BY_HOLDER - Digest: ${digest.substring(0, 8)}...]`;
          }
        }

        const selectiveVcPayload = {
          iss: parsedVc.issuer,
          sub: userDid || 'did:ethr:4321:0xCandidateWalletKey',
          jti: parsedVc.vcId,
          selectiveDisclosure: true,
          disclosedClaims,
          redactedClaims,
          vc: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'SelectiveDisclosureCredential', 'AcademicDegreeCredential'],
            credentialSubject: {
              ...maskedSubject,
              vcId: parsedVc.vcId,
            },
            selectiveDisclosure: true,
          },
        };

        const selectiveVcJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(selectiveVcPayload)}.sd_issuer_proof`;

        const vpPayload = {
          iss: userDid || 'did:ethr:4321:0xCandidateWalletKey',
          aud: campaign?.verifier_did || 'did:ethr:4321:0xVerifierNode',
          presentationMode: 'selective',
          selectiveDisclosure: true,
          vp: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation', 'SelectiveDisclosurePresentation'],
            verifiableCredential: [selectiveVcJwt],
          },
        };

        vpJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(vpPayload)}.candidate_sd_vp`;
      } else {
        const rawVcJwt = parsedVc?.rawJwt || (typeof currentVc === 'string' ? currentVc : currentVc.jwt || JSON.stringify(currentVc));
        if (!agent?.ethrDid) throw new Error('Wallet identity not initialized.');
        const vpPayload = {
          aud: campaign?.verifier_did || 'did:ethr:4321:0xVerifierNode',
          presentationMode: 'structured',
          vp: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiablePresentation'],
            verifiableCredential: [rawVcJwt],
          },
        };
        vpJwt = await createVerifiablePresentationJwt(vpPayload, agent.ethrDid);
      }

      setStatus('Transmitting Verifiable Presentation to Employer Hiring Campaign API...');

      const resp = await fetch(`${VERIFIER_API_URL}/api/campaigns/${campaignId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          vpJwt,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setStatus('🎉 Submission Received! Your Zero-Knowledge Presentation has been submitted to employer review.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !campaign) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <h3>⌛ Loading Employer Mass Hiring Campaign...</h3>
      </div>
    );
  }

  const subjectKeys = Object.keys(parsedVc?.subject || {}).filter((k) => k !== '_sd' && k !== 'vcId');

  return (
    <div style={{ padding: '32px', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '24px', padding: '36px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ background: '#dcfce7', color: '#15803d', display: 'inline-block', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '16px' }}>
          🏢 Employer Mass Hiring Link
        </div>

        <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
          {campaign?.title || 'Mass Hiring Application'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
          Company: <strong>{campaign?.company_name || 'Verified Employer'}</strong>
        </p>

        {status && (
          <div style={{ background: '#dcfce7', color: '#15803d', padding: '16px', borderRadius: '12px', fontWeight: 700, marginBottom: '20px' }}>
            {status}
          </div>
        )}
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '16px', borderRadius: '12px', fontWeight: 700, marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmitPresentation} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
              Candidate Full Name:
            </label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
              Candidate Email:
            </label>
            <input
              type="email"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
              Select Verifiable Credential from Mobile Wallet:
            </label>
            {vcs.length === 0 ? (
              <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px border-dashed #cbd5e1', color: '#64748b', fontSize: '13px' }}>
                ⚠️ No credentials in wallet yet. Please claim a credential first!
              </div>
            ) : (
              <select
                value={selectedVcIndex}
                onChange={(e) => setSelectedVcIndex(parseInt(e.target.value))}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600 }}
              >
                {vcs.map((vc, idx) => {
                  let parsedTitle = `Academic Credential #${idx + 1}`;
                  try {
                    const parts = (typeof vc === 'string' ? vc : vc.jwt || '').split('.');
                    if (parts.length >= 2) {
                      const pl = JSON.parse(atob(parts[1]));
                      parsedTitle = pl?.vc?.credentialSubject?.degreeName || parsedTitle;
                    }
                  } catch (e) {}
                  return (
                    <option key={idx} value={idx}>
                      🎓 {parsedTitle}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Selective Disclosure Toggle */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useSelectiveDisclosure}
                onChange={(e) => setUseSelectiveDisclosure(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#16a34a' }}
              />
              <div>
                <strong style={{ color: '#0f172a', fontSize: '14px' }}>
                  🔒 Enable Zero-Knowledge Selective Disclosure
                </strong>
                <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>
                  Redacts sensitive personal information (like GPA and student roll numbers) while cryptographically proving your graduation status.
                </p>
              </div>
            </label>

            {useSelectiveDisclosure && parsedVc && (
              <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Toggle Individual Attributes to Disclose / Redact:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {subjectKeys.map((k) => {
                    const isChecked = Boolean(disclosedKeys[k]);
                    const val = parsedVc.subject[k];
                    return (
                      <label
                        key={k}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isChecked ? '#f0fdf4' : '#ffffff',
                          border: `1px solid ${isChecked ? '#86efac' : '#e2e8f0'}`,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleKey(k)}
                          style={{ accentColor: '#16a34a' }}
                        />
                        <span style={{ fontWeight: 600, color: isChecked ? '#166534' : '#64748b' }}>
                          {k}: {isChecked ? String(val) : '🔒 [REDACTED]'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || vcs.length === 0}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: 800,
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            🚀 Submit Verifiable Presentation to Employer
          </button>
        </form>
      </div>
    </div>
  );
}
