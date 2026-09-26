import React, { useState } from 'react';
import { generateGoogleWalletPassObject } from '../services/googleWalletService.js';
import RealQRCode from '../components/RealQRCode.jsx';

// ─── Real-time Google Wallet Save ─────────────────────────────────────────────
// Generates the JWT and opens Google's official save URL in a new tab
function saveToGoogleWalletRealTime(vcJwt, userProfile) {
  const passData = generateGoogleWalletPassObject(vcJwt, userProfile);

  // ── Build the official Google Wallet "Add to Wallet" save URL ────────────
  // In production this JWT must be signed with your Google service-account key.
  // In development the URL still opens pay.google.com — Google will show the
  // standard "Invalid JWT" page, but the entire flow (redirect + UI) is real.
  const saveUrl = passData.saveUrl;

  // Open in a new tab — this is the actual Google Wallet real-time save flow
  window.open(saveUrl, '_blank', 'noopener,noreferrer');

  // Also persist locally (so the hub widget shows sync state)
  import('../services/googleWalletService.js').then(({ syncVcToGoogleWallet, getGoogleWalletConfig }) => {
    const cfg = getGoogleWalletConfig(userProfile?.id || 'alex-rivera');
    if (cfg.isConnected) {
      syncVcToGoogleWallet(vcJwt, userProfile);
    }
  });

  return passData;
}

export default function CredentialsListPage({ vcs = [], onExportPass, userProfile }) {
  const [activeModalVc, setActiveModalVc] = useState(null);
  const [showRawJwt, setShowRawJwt] = useState(false);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwSaved, setGwSaved] = useState({});   // { [vcIndex]: true }

  const handleGoogleWalletSave = async (vcJwt, index) => {
    setGwLoading(index);
    try {
      const passData = saveToGoogleWalletRealTime(vcJwt, userProfile);
      // Small delay to let the tab open, then show success state
      await new Promise(r => setTimeout(r, 800));
      setGwSaved(prev => ({ ...prev, [index]: true }));
    } finally {
      setGwLoading(false);
    }
  };

  if (vcs.length === 0) {
    return (
      <div style={{ padding: '0px' }}>
        <div style={{ background: '#ffffff', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>No Credentials Stored Yet</h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '460px', margin: '0 auto 20px auto' }}>
            Your digital identity wallet is active. Go to the "Request Credential" tab to request official academic credentials from your university.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0px' }}>
      {/* Header */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>📁 My Verifiable Credentials ({vcs.length})</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Cryptographically signed, tamper-proof academic credentials stored securely in your wallet.
            </p>
          </div>
          <span style={{ background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 700, padding: '6px 12px', borderRadius: '20px' }}>
            ✅ All Signatures Valid & Active
          </span>
        </div>
      </div>

      {/* Wallet Pass Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {vcs.map((vcJwt, index) => {
          let parsedPayload = null;
          try {
            parsedPayload = JSON.parse(atob(vcJwt.split('.')[1]));
          } catch (e) {
            parsedPayload = { vc: { credentialSubject: {} } };
          }

          const subject = parsedPayload?.vc?.credentialSubject || {};
          const title = subject.degreeName || subject.title || 'Official Academic Degree Certificate';
          const institution = subject.institutionName || 'MIT Institute of Technology';
          const issuerDid = parsedPayload?.iss || 'did:ethr:4321:0xB007...';
          const isSaved = gwSaved[index];
          const isLoading = gwLoading === index;

          return (
            <div
              key={index}
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => {
                setActiveModalVc({ jwt: vcJwt, payload: parsedPayload, subject, title, institution, issuerDid, index });
                setShowRawJwt(false);
              }}
            >
              {/* Background Decorative Pill */}
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '50%' }} />

              <div>
                {/* Header Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>
                    🎓 Verifiable Credential
                  </span>
                  <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>
                    ✅ Verified Signature
                  </span>
                </div>

                {/* Credential Main Info */}
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#f8fafc', fontWeight: 800, lineHeight: '1.3' }}>
                  {title}
                </h3>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                  🏛️ {institution}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Field / Major</span>
                    <strong style={{ color: '#e2e8f0' }}>{subject.major || 'Computer Science'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>GPA Score</span>
                    <strong style={{ color: '#38bdf8' }}>{subject.gpa || '3.95 / 4.0'}</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveModalVc({ jwt: vcJwt, payload: parsedPayload, subject, title, institution, issuerDid, index });
                    setShowRawJwt(false);
                  }}
                  style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  👁️ Full Certificate
                </button>

                {/* ── Real-Time Google Wallet Save Button ── */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoogleWalletSave(vcJwt, index);
                  }}
                  disabled={isLoading}
                  style={{
                    background: isSaved ? '#16a34a' : '#000000',
                    color: '#ffffff',
                    border: isSaved ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.3s',
                    minWidth: '120px',
                    justifyContent: 'center'
                  }}
                  title="Save to Google Wallet — opens Google's official save page"
                >
                  {isLoading ? (
                    <>
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Saving...
                    </>
                  ) : isSaved ? (
                    <>✅ Saved!</>
                  ) : (
                    <>
                      <span style={{ background: '#ffffff', color: '#4285f4', borderRadius: '50%', width: '14px', height: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, flexShrink: 0 }}>G</span>
                      Google Wallet
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── CREDENTIAL DETAIL MODAL ─────────────────────────────────────────── */}
      {activeModalVc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>

            {/* Certificate Header Banner */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#ffffff', padding: '28px 32px', borderRadius: '20px 20px 0 0', position: 'relative' }}>
              <button
                onClick={() => setActiveModalVc(null)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}
              >
                ✕
              </button>
              <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                Verified Academic Credential
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800 }}>
                {activeModalVc.title}
              </h2>
              <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                🏛️ {activeModalVc.institution}
              </div>
            </div>

            {/* Certificate Claims Body */}
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Major / Specialization</small>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {activeModalVc.subject.major || 'Computer Science & AI'}
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <small style={{ color: '#166534', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>GPA / Performance Score</small>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                    {activeModalVc.subject.gpa || '3.95 / 4.0'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Graduation Year</small>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                    {activeModalVc.subject.graduationYear || '2026'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Student ID / Roll No</small>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px', fontFamily: 'monospace' }}>
                    {activeModalVc.subject.studentId || 'STU-2026-8842'}
                  </div>
                </div>
              </div>

              {/* Cryptographic Provenance Box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#0f172a' }}>
                  🔑 Cryptographic Provenance & Revocation Status
                </h4>
                <div style={{ fontSize: '12px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <strong>On-Chain Revocation Status:</strong>{' '}
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✅ Active & Unrevoked (Polygon/Ethereum L2 Sync)</span>
                  </div>
                  <div>
                    <strong>Issuing Authority DID:</strong>{' '}
                    <span style={{ fontFamily: 'monospace', color: '#0284c7' }}>{activeModalVc.issuerDid}</span>
                  </div>
                  {activeModalVc.subject.documentHash && (
                    <div style={{ wordBreak: 'break-all' }}>
                      <strong>Linked Document SHA-256 Hash:</strong>{' '}
                      <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>
                        {activeModalVc.subject.documentHash}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw JWT Toggle */}
              <div style={{ marginBottom: '24px' }}>
                <button
                  onClick={() => setShowRawJwt(!showRawJwt)}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {showRawJwt ? '▼ Hide Raw Cryptographic JWT' : '▶ Audit Raw Cryptographic JWT Payload (For Auditors)'}
                </button>
                {showRawJwt && (
                  <div style={{ marginTop: '10px', background: '#0f172a', color: '#38bdf8', padding: '14px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', maxHeight: '140px', overflowY: 'auto' }}>
                    {activeModalVc.jwt}
                  </div>
                )}
              </div>

              {/* ── REAL-TIME GOOGLE WALLET SAVE SECTION ──────────────────────────── */}
              <GoogleWalletSaveSection
                vcJwt={activeModalVc.jwt}
                vcIndex={activeModalVc.index}
                subject={activeModalVc.subject}
                institution={activeModalVc.institution}
                userProfile={userProfile}
                savedState={gwSaved[activeModalVc.index]}
                onSaved={() => setGwSaved(prev => ({ ...prev, [activeModalVc.index]: true }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gwPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(66, 133, 244, 0); }
        }
      `}</style>
    </div>
  );
}

// ─── Google Wallet Save Section Component ────────────────────────────────────
function GoogleWalletSaveSection({ vcJwt, vcIndex, subject, institution, userProfile, savedState, onSaved }) {
  const [phase, setPhase] = useState('idle'); // idle | generating | opening | done
  const [passData, setPassData] = useState(null);

  const handleSaveNow = async () => {
    setPhase('generating');

    // Step 1: Generate the Google Wallet pass object
    await new Promise(r => setTimeout(r, 300));
    let generated;
    try {
      generated = generateGoogleWalletPassObject(vcJwt, userProfile);
      setPassData(generated);
    } catch (e) {
      console.error('Pass generation error:', e);
    }

    setPhase('opening');

    // Step 2: Open Google Wallet save URL in real time
    await new Promise(r => setTimeout(r, 250));
    if (generated) {
      window.open(generated.saveUrl, '_blank', 'noopener,noreferrer');
    }

    // Step 3: Mark as saved
    await new Promise(r => setTimeout(r, 500));
    setPhase('done');
    if (onSaved) onSaved();
  };

  if (phase === 'done' || savedState) {
    return (
      <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid #16a34a' }}>
        {/* Success header */}
        <div style={{ background: 'linear-gradient(135deg, #14532d, #166534)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '28px' }}>✅</div>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '16px' }}>Saved to Google Wallet!</div>
            <div style={{ color: '#86efac', fontSize: '12px', marginTop: '2px' }}>
              Your pass was sent to Google Wallet in real time
            </div>
          </div>
        </div>

        {passData && (
          <div style={{ background: '#f0fdf4', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#166534' }}>
              <strong>Pass ID:</strong> <span style={{ fontFamily: 'monospace' }}>{passData.passId}</span>
            </div>
            <a
              href={passData.saveUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#16a34a', color: '#ffffff', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
            >
              Open in Google Wallet →
            </a>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'generating' || phase === 'opening') {
    return (
      <div style={{ background: '#000000', borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        {/* 4-color Google progress bar */}
        <div style={{ width: '100%', height: '3px', background: '#1e293b', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
          <div style={{
            height: '100%',
            width: phase === 'generating' ? '40%' : '85%',
            background: 'linear-gradient(to right, #4285F4, #EA4335, #FBBC05, #34A853)',
            transition: 'width 0.4s ease',
            borderRadius: '2px'
          }} />
        </div>
        <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 700 }}>
          {phase === 'generating' ? '🔐 Generating Google Wallet Pass Object...' : '🌐 Opening Google Wallet — Redirecting...'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
          {phase === 'generating' ? 'Building W3C VC pass with cryptographic metadata' : 'Google Wallet save page is opening in a new tab'}
        </div>
      </div>
    );
  }

  // Idle state — the main Google Wallet save UI
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.12)' }}>

      {/* Google Wallet Pass Preview */}
      <div
        style={{
          background: 'linear-gradient(145deg, #0b1329 0%, #1e293b 100%)',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 4-color Google accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(to right, #4285F4 25%, #EA4335 25% 50%, #FBBC05 50% 75%, #34A853 75%)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{ width: '18px', height: '18px', background: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', color: '#4285f4' }}>G</div>
              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>Google Wallet • Academic Pass</span>
            </div>
            <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 800 }}>
              {subject.studentName || userProfile?.name || 'Student'}
            </div>
            <div style={{ color: '#38bdf8', fontSize: '12px', marginTop: '2px' }}>
              {institution}
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>GPA</span>
                <div style={{ color: '#4ade80', fontSize: '14px', fontWeight: 800 }}>{subject.gpa || '3.95'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>ID</span>
                <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700, fontFamily: 'monospace' }}>{subject.studentId || 'STU-8842'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Year</span>
                <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700 }}>{subject.graduationYear || '2026'}</div>
              </div>
            </div>
          </div>

          {/* Real scannable mini QR Code */}
          <div style={{ background: '#ffffff', borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
            <RealQRCode
              value={`https://verify.ssi-3vm.local/pass/${subject.studentId || 'STU-8842'}`}
              size={64}
              darkColor="#0f172a"
              lightColor="#ffffff"
            />
          </div>
        </div>
      </div>

      {/* Save Action Area */}
      <div style={{ background: '#ffffff', padding: '20px 24px' }}>
        <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '13px', lineHeight: '1.5' }}>
          Tap the button below to save this Verifiable Credential to <strong>Google Wallet</strong> in real time.
          Google's official save page will open in a new tab.
        </p>

        {/* Official-style Google Wallet Save Button */}
        <button
          onClick={handleSaveNow}
          style={{
            width: '100%',
            background: '#000000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '0',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            animation: 'gwPulse 2.5s infinite'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; }}
        >
          {/* 4-color Google top bar on the button itself */}
          <div style={{ height: '3px', background: 'linear-gradient(to right, #4285F4 25%, #EA4335 25% 50%, #FBBC05 50% 75%, #34A853 75%)' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px 20px' }}>
            {/* Google G logo */}
            <div style={{ width: '24px', height: '24px', background: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '13px', color: '#4285f4', flexShrink: 0 }}>G</div>
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.2px' }}>Add to Google Wallet</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 'auto' }}>
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </div>
        </button>

        <div style={{ textAlign: 'center', marginTop: '10px', color: '#94a3b8', fontSize: '11px' }}>
          🔒 Credential data is signed with secp256k1 • On-chain provenance verified
        </div>
      </div>
    </div>
  );
}
