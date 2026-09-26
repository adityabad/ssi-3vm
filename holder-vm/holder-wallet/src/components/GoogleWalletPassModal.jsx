import React, { useState, useEffect } from 'react';
import {
  generateGoogleWalletPassObject,
  generateQrCodeSvg,
  generateBarcodeSvg,
  syncVcToGoogleWallet,
  getGoogleWalletConfig
} from '../services/googleWalletService.js';

export default function GoogleWalletPassModal({
  vcJwt,
  userProfile,
  onClose,
  onNotify
}) {
  const [activeTab, setActiveTab] = useState('pass'); // 'pass' | 'json' | 'raw_jwt'
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [passData, setPassData] = useState(null);
  const [qrSvg, setQrSvg] = useState('');
  const [barcodeSvg, setBarcodeSvg] = useState('');

  useEffect(() => {
    if (!vcJwt) return;
    try {
      const generated = generateGoogleWalletPassObject(vcJwt, userProfile);
      setPassData(generated);
      
      // Generate QR Code and Barcode SVG
      const qr = generateQrCodeSvg(generated.metadata.verificationUrl, 200);
      const barcode = generateBarcodeSvg(generated.metadata.studentId, 280, 44);
      setQrSvg(qr);
      setBarcodeSvg(barcode);

      // Check if already synced in Google Wallet
      const config = getGoogleWalletConfig(userProfile?.id || 'alex-rivera');
      const isAlreadySynced = (config.syncedPasses || []).some(p => p.passId === generated.passId);
      setSynced(isAlreadySynced);
    } catch (e) {
      console.error('Error preparing Google Wallet pass:', e);
    }
  }, [vcJwt, userProfile]);

  if (!passData) return null;

  const { metadata, genericObject, jwtClaims, jwtToken, saveUrl } = passData;

  const handlePushToGoogleWallet = async () => {
    setSyncing(true);
    try {
      const res = await syncVcToGoogleWallet(vcJwt, userProfile);
      setSynced(true);
      if (onNotify) onNotify(res.message);
    } catch (e) {
      if (onNotify) onNotify('❌ Failed to push pass to Google Wallet: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadPassJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(genericObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `google_wallet_pass_${metadata.studentId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (onNotify) onNotify('📥 Google Wallet Pass JSON payload downloaded!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Modal Top Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              🌐
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Google Wallet Digital Pass
                {synced && (
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                    🟢 Synced Live
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                W3C Verifiable Credential Pass Specification
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 700,
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* View Toggle Subnav */}
        <div style={{ display: 'flex', padding: '12px 28px 0 28px', gap: '16px', borderBottom: '1px solid #f1f5f9' }}>
          <button
            onClick={() => setActiveTab('pass')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 4px 12px 4px',
              fontSize: '13px',
              fontWeight: 700,
              color: activeTab === 'pass' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'pass' ? '3px solid #2563eb' : '3px solid transparent',
              cursor: 'pointer'
            }}
          >
            📱 Google Wallet Pass View
          </button>
          <button
            onClick={() => setActiveTab('json')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 4px 12px 4px',
              fontSize: '13px',
              fontWeight: 700,
              color: activeTab === 'json' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'json' ? '3px solid #2563eb' : '3px solid transparent',
              cursor: 'pointer'
            }}
          >
            ⚙️ Google Wallet API JSON
          </button>
          <button
            onClick={() => setActiveTab('raw_jwt')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 4px 12px 4px',
              fontSize: '13px',
              fontWeight: 700,
              color: activeTab === 'raw_jwt' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'raw_jwt' ? '3px solid #2563eb' : '3px solid transparent',
              cursor: 'pointer'
            }}
          >
            🔑 Signed Pass JWT
          </button>
        </div>

        {/* Modal Body Content */}
        <div style={{ padding: '24px 28px', flex: 1 }}>
          {activeTab === 'pass' && (
            <div>
              {/* GOOGLE WALLET PASS CONTAINER */}
              <div
                style={{
                  background: 'linear-gradient(145deg, #0b1329 0%, #1e293b 100%)',
                  borderRadius: '20px',
                  color: '#ffffff',
                  padding: '24px',
                  boxShadow: '0 20px 30px -10px rgba(15, 23, 42, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {/* Google Pay / Wallet 4-Color Accent Strip */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(to right, #4285F4 25%, #EA4335 25% 50%, #FBBC05 50% 75%, #34A853 75%)'
                  }}
                />

                {/* Card Top Branding */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Google G Logo */}
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '13px',
                        color: '#4285f4'
                      }}
                    >
                      G
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.2px', color: '#e2e8f0' }}>
                      Google Wallet
                    </span>
                  </div>

                  <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                    🎓 Academic Identity Pass
                  </span>
                </div>

                {/* Institution & Title Header */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                    {metadata.institution}
                  </div>
                  <h3 style={{ margin: '4px 0 2px 0', fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
                    {metadata.degreeName}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#38bdf8', fontWeight: 600 }}>
                    {metadata.studentName}
                  </div>
                </div>

                {/* Grid of Key Pass Claims */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>GPA Score</span>
                    <strong style={{ fontSize: '14px', color: '#4ade80' }}>{metadata.gpa}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Grad Year</span>
                    <strong style={{ fontSize: '14px', color: '#f8fafc' }}>{metadata.graduationYear}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Student ID</span>
                    <strong style={{ fontSize: '13px', color: '#38bdf8', fontFamily: 'monospace' }}>{metadata.studentId}</strong>
                  </div>
                </div>

                {/* Dynamic QR Code Box for NFC / Optical Readers */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  <img
                    src={qrSvg}
                    alt="Google Wallet Verification QR"
                    style={{ width: '160px', height: '160px', display: 'block' }}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginTop: '8px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Scan with Verifier Portal / Google Wallet Scanner
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <img
                      src={barcodeSvg}
                      alt="Student Barcode"
                      style={{ width: '220px', height: '36px', display: 'block' }}
                    />
                    <div style={{ fontSize: '11px', color: '#0f172a', fontFamily: 'monospace', fontWeight: 800, textAlign: 'center', marginTop: '2px' }}>
                      {metadata.studentId}
                    </div>
                  </div>
                </div>

                {/* Security Footer Details */}
                <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔒 EIP-1056 Smart Contract Provenance</span>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>● Active Status</span>
                </div>
              </div>

              {/* Action Buttons Section */}
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Save to Google Wallet Official Action Button */}
                <button
                  onClick={handlePushToGoogleWallet}
                  disabled={syncing}
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    padding: '14px 24px',
                    fontSize: '14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    cursor: syncing ? 'wait' : 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'transform 0.15s, background 0.15s'
                  }}
                >
                  {/* Google G Logo in Button */}
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '12px',
                      color: '#4285f4'
                    }}
                  >
                    G
                  </div>
                  {syncing
                    ? '⚡ Syncing in Real-Time to Google Wallet Cloud...'
                    : synced
                    ? '✅ Synced in Google Wallet (Click to Re-Sync)'
                    : 'Save to Google Wallet (Real-Time Push)'}
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={handleDownloadPassJson}
                    style={{
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    📥 Download Pass JSON
                  </button>

                  <a
                    href={saveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      textDecoration: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🌐 Open in Google Pay
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'json' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  Google Wallet API Generic Object Schema
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(genericObject, null, 2));
                    if (onNotify) onNotify('📋 Google Wallet JSON copied to clipboard!');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📋 Copy JSON
                </button>
              </div>

              <pre
                style={{
                  background: '#0f172a',
                  color: '#38bdf8',
                  padding: '16px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  lineHeight: '1.5'
                }}
              >
                {JSON.stringify(genericObject, null, 2)}
              </pre>
            </div>
          )}

          {activeTab === 'raw_jwt' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  Google Wallet Signed Pass JWT (ES256 / SaveToWallet)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jwtToken);
                    if (onNotify) onNotify('📋 JWT token copied to clipboard!');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  📋 Copy JWT
                </button>
              </div>

              <div
                style={{
                  background: '#0f172a',
                  color: '#4ade80',
                  padding: '16px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  wordBreak: 'break-all',
                  marginBottom: '16px'
                }}
              >
                {jwtToken}
              </div>

              <h4 style={{ fontSize: '13px', color: '#0f172a', margin: '0 0 8px 0' }}>Decoded JWT Claims</h4>
              <pre
                style={{
                  background: '#f8fafc',
                  color: '#334155',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0'
                }}
              >
                {JSON.stringify(jwtClaims, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
