import React, { useState, useEffect, useCallback } from 'react';
import {
  getGoogleWalletConfig,
  generateGoogleWalletPassObject
} from '../services/googleWalletService.js';
import RealQRCode from '../components/RealQRCode.jsx';

// ─── Google Wallet colour palette ──────────────────────────────────────────
const G_BLUE   = '#4285F4';
const G_RED    = '#EA4335';
const G_YELLOW = '#FBBC05';
const G_GREEN  = '#34A853';

function GoogleBar({ height = 4, style = {} }) {
  return (
    <div style={{
      height,
      background: `linear-gradient(to right, ${G_BLUE} 25%, ${G_RED} 25% 50%, ${G_YELLOW} 50% 75%, ${G_GREEN} 75%)`,
      ...style
    }} />
  );
}

function GIcon({ size = 20, bg = '#fff', color = G_BLUE }) {
  return (
    <div style={{
      width: size, height: size, background: bg, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.55, color, flexShrink: 0
    }}>G</div>
  );
}

// ─── Barcode strip (Code-128-style visual) ──────────────────────────────────
function BarcodeStrip({ text, width = 200, height = 48 }) {
  const bars = [];
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = ((seed << 5) - seed) + text.charCodeAt(i);

  let x = 0;
  const totalBars = 60;
  for (let i = 0; i < totalBars; i++) {
    const r = Math.abs(Math.sin(seed * (i + 1) * 0.37)) ;
    const w = Math.max(1, Math.floor(r * 5) + 1);
    const isFilled = (Math.sin(seed * i * 0.11 + i) + 1) / 2 > 0.4;
    bars.push({ x, w, filled: isFilled });
    x += w + 1;
  }

  const totalW = x || 200;

  return (
    <svg viewBox={`0 0 ${totalW} ${height}`} width={width} height={height} style={{ display: 'block' }}>
      {bars.map((b, i) =>
        b.filled && <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#0f172a" />
      )}
    </svg>
  );
}

// ─── Individual pass card (Google Wallet dark card) ──────────────────────────
function PassCard({ pass, vcJwt, userProfile, onSelect, isSelected }) {
  const qrValue = `https://verify.ssi-3vm.local/pass/${pass.passId}`;

  return (
    <div
      onClick={() => onSelect(pass)}
      style={{
        background: 'linear-gradient(145deg, #0b1329 0%, #1e293b 100%)',
        borderRadius: '20px',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: isSelected
          ? `0 0 0 3px ${G_BLUE}, 0 20px 40px rgba(66,133,244,0.3)`
          : '0 8px 24px rgba(0,0,0,0.35)',
        transition: 'all 0.25s',
        transform: isSelected ? 'translateY(-4px) scale(1.01)' : 'none',
      }}
    >
      {/* 4-colour Google top accent */}
      <GoogleBar height={3} />

      {/* Card body */}
      <div style={{ padding: '20px 22px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <GIcon size={16} />
              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>Google Wallet</span>
              <span style={{ background: 'rgba(52,168,83,0.2)', color: '#4ade80', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', marginLeft: '4px' }}>
                ACTIVE
              </span>
            </div>
            <div style={{ color: '#f8fafc', fontSize: '16px', fontWeight: 800, lineHeight: 1.2 }}>
              {pass.title || 'Academic Credential'}
            </div>
            <div style={{ color: '#38bdf8', fontSize: '12px', marginTop: '2px' }}>
              {pass.institution || 'University'}
            </div>
          </div>
          {/* Real scannable mini QR */}
          <div style={{ background: '#fff', borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
            <RealQRCode value={qrValue} size={68} darkColor="#0f172a" lightColor="#ffffff" />
          </div>
        </div>

        {/* Data chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
          {[
            { label: 'HOLDER', value: pass.studentName || userProfile?.name || 'Student' },
            { label: 'SYNCED', value: new Date(pass.syncedAt).toLocaleDateString() },
            { label: 'STATUS', value: '✅ Valid' }
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 10px' }}>
              <div style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
              <div style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Barcode strip */}
        <div style={{ background: '#fff', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <BarcodeStrip text={pass.passId || 'SSI-PASS'} width="100%" height={36} />
          <div style={{ color: '#64748b', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px' }}>
            {(pass.passId || 'SSI-PASS').slice(-20).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expanded pass detail panel ───────────────────────────────────────────────
function PassDetailPanel({ pass, vcJwt, userProfile, onClose, onResync }) {
  const [tab, setTab] = useState('pass'); // pass | details | json
  const [resyncing, setResyncing] = useState(false);
  const [resynced, setResynced] = useState(false);

  const qrValue = `https://verify.ssi-3vm.local/pass/${pass.passId}`;

  const handleResync = async () => {
    setResyncing(true);
    await new Promise(r => setTimeout(r, 900));
    setResyncing(false);
    setResynced(true);
    if (onResync) onResync();
    setTimeout(() => setResynced(false), 3000);
  };

  const handleOpenGoogle = () => {
    if (pass.googleWalletObject) {
      const jwtHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const jwtClaims = btoa(JSON.stringify({
        iss: 'google-wallet-ssi-service@ssi-3vm.iam.gserviceaccount.com',
        aud: 'google',
        typ: 'savetowallet',
        origins: ['http://localhost:5174'],
        iat: Math.floor(Date.now() / 1000),
        payload: { genericObjects: [pass.googleWalletObject] }
      }));
      const saveUrl = `https://pay.google.com/gp/v/save/${jwtHeader}.${jwtClaims}.signature`;
      window.open(saveUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
      {/* Panel header */}
      <GoogleBar height={4} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <GIcon size={22} />
          <div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Google Wallet Pass</div>
            <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 800 }}>{pass.title}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {[['pass', '📱 Pass'], ['details', '📋 Details'], ['json', '🔧 JSON Object']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, background: 'none', border: 'none',
            borderBottom: tab === key ? `3px solid ${G_BLUE}` : '3px solid transparent',
            color: tab === key ? '#f8fafc' : '#64748b',
            padding: '12px 8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'color 0.2s'
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '520px' }}>

        {/* ── PASS TAB ── */}
        {tab === 'pass' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {/* Large Google Wallet-style card */}
            <div style={{
              width: '100%', maxWidth: '340px',
              background: 'linear-gradient(145deg, #162032 0%, #243348 100%)',
              borderRadius: '20px', overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
            }}>
              <GoogleBar height={4} />
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>Academic Pass</div>
                    <div style={{ color: '#fff', fontSize: '18px', fontWeight: 900 }}>{pass.studentName || userProfile?.name}</div>
                    <div style={{ color: G_BLUE, fontSize: '12px', marginTop: '2px' }}>{pass.institution}</div>
                  </div>
                  <GIcon size={32} />
                </div>

                {/* Real scannable QR Code */}
                <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                  <RealQRCode value={qrValue} size={160} darkColor="#0f172a" lightColor="#ffffff" errorCorrectionLevel="H" />
                </div>

                {/* Barcode */}
                <div style={{ background: '#fff', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <BarcodeStrip text={pass.passId} width="100%" height={40} />
                  <div style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {(pass.passId || '').toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>Pass ID</div>
                    <div style={{ color: '#e2e8f0', fontSize: '10px', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {(pass.passId || '').slice(-16)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(52,168,83,0.12)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>Status</div>
                    <div style={{ color: G_GREEN, fontSize: '12px', fontWeight: 800, marginTop: '2px' }}>✅ ACTIVE</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '340px' }}>
              <button
                onClick={handleOpenGoogle}
                style={{ flex: 2, background: '#000', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', overflow: 'hidden' }}
              >
                <GoogleBar height={2} style={{ marginBottom: '10px', borderRadius: '2px' }} />
                <GIcon size={16} style={{ display: 'inline-flex', marginRight: '6px' }} />
                Open in Google Wallet ↗
              </button>
              <button
                onClick={handleResync}
                disabled={resyncing}
                style={{ flex: 1, background: resynced ? '#166534' : '#1e40af', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
              >
                {resyncing ? '⏳ Syncing...' : resynced ? '✅ Synced!' : '🔄 Re-sync'}
              </button>
            </div>
          </div>
        )}

        {/* ── DETAILS TAB ── */}
        {tab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              ['Holder Name', pass.studentName || userProfile?.name || '–'],
              ['Institution', pass.institution || '–'],
              ['Degree / Title', pass.title || '–'],
              ['Pass ID', pass.passId || '–'],
              ['Synced At', pass.syncedAt ? new Date(pass.syncedAt).toLocaleString() : '–'],
              ['Status', pass.status || 'ACTIVE_IN_GOOGLE_WALLET'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <span style={{ color: '#e2e8f0', fontSize: '12px', fontFamily: label === 'Pass ID' ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── JSON OBJECT TAB ── */}
        {tab === 'json' && (
          <div>
            <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '8px' }}>
              This is the Google Wallet GenericObject payload that was pushed to Google's API:
            </div>
            <pre style={{
              background: '#020617', color: '#38bdf8',
              padding: '16px', borderRadius: '12px', fontSize: '10px',
              overflowX: 'auto', overflowY: 'auto', maxHeight: '380px',
              border: '1px solid rgba(56,189,248,0.15)',
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
            }}>
              {JSON.stringify(pass.googleWalletObject || pass, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyWallet({ onConnect }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ width: '80px', height: '80px', background: '#1e293b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
        <GIcon size={40} bg="transparent" color="#4285f4" />
      </div>
      <h3 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>No Passes in Google Wallet</h3>
      <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px auto' }}>
        Connect your Google account and add credentials to see them appear here as digital passes.
      </p>
      <button
        onClick={onConnect}
        style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px 28px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', overflow: 'hidden' }}
      >
        <GoogleBar height={3} style={{ marginBottom: '10px' }} />
        Connect Google Wallet
      </button>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function GoogleWalletPage({ vcs = [], userProfile, onOpenGoogleWalletModal }) {
  const userId = userProfile?.id || 'alex-rivera';

  const [config, setConfig] = useState(() => getGoogleWalletConfig(userId));
  const [selectedPass, setSelectedPass] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Listen for real-time sync events from googleWalletService
  useEffect(() => {
    const refresh = () => setConfig(getGoogleWalletConfig(userId));
    window.addEventListener('google-wallet-state-change', refresh);
    const timer = setInterval(refresh, 3000); // poll every 3s for updates
    return () => {
      window.removeEventListener('google-wallet-state-change', refresh);
      clearInterval(timer);
    };
  }, [userId]);

  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const { syncVcToGoogleWallet, connectGoogleWallet, getGoogleWalletConfig: getConfig } = await import('../services/googleWalletService.js');
      
      // Auto-connect if not yet connected
      let currentConfig = getConfig(userId);
      if (!currentConfig.isConnected) {
        const email = userProfile?.userEmail || `${userId}@gmail.com`;
        connectGoogleWallet(userId, email, userProfile?.name || 'Student');
        currentConfig = getConfig(userId);
      }
      
      // Sync all VCs
      for (const vcJwt of vcs) {
        await syncVcToGoogleWallet(vcJwt, userProfile);
      }
    } finally {
      setSyncing(false);
      setConfig(getGoogleWalletConfig(userId));
    }
  }, [vcs, userProfile, userId]);

  const passes = config.syncedPasses || [];

  return (
    <div style={{ padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Page Header ── */}
      <div style={{ background: '#0f172a', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <GoogleBar height={4} />
        <div style={{ padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', background: '#1e293b', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <GIcon size={30} />
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '22px', fontWeight: 900 }}>Google Wallet</h2>
              <div style={{ color: '#64748b', fontSize: '13px', marginTop: '3px' }}>
                {config.isConnected
                  ? `Connected as ${config.accountEmail || 'Google Account'}`
                  : 'Not connected — tap to link your Google account'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {config.isConnected && (
              <>
                <span style={{ background: 'rgba(52,168,83,0.15)', color: G_GREEN, fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: `1px solid ${G_GREEN}30` }}>
                  ✅ Connected
                </span>
                <button
                  onClick={syncAll}
                  disabled={syncing}
                  style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  {syncing ? '⏳ Syncing All...' : '🔄 Sync All Now'}
                </button>
              </>
            )}
            <button
              onClick={onOpenGoogleWalletModal}
              style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 16px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', overflow: 'hidden' }}
            >
              <GoogleBar height={2} style={{ marginBottom: '6px' }} />
              {config.isConnected ? '⚙️ Settings' : '🔗 Connect'}
            </button>
          </div>
        </div>

        {/* Connected stats bar */}
        {config.isConnected && (
          <div style={{ display: 'flex', gap: '0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { label: 'Passes', value: passes.length, color: G_BLUE },
              { label: 'Last Sync', value: config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleTimeString() : 'Never', color: G_GREEN },
              { label: 'Cloud State', value: config.cloudSyncState || 'IDLE', color: config.cloudSyncState === 'SYNCED' ? G_GREEN : G_YELLOW },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{ flex: 1, padding: '14px 20px', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', textAlign: 'center' }}>
                <div style={{ color, fontSize: '18px', fontWeight: 900 }}>{value}</div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main content grid ── */}
      {!config.isConnected ? (
        <div style={{ background: '#0f172a', borderRadius: '16px', overflow: 'hidden' }}>
          <GoogleBar height={3} />
          <EmptyWallet onConnect={onOpenGoogleWalletModal} />
        </div>
      ) : passes.length === 0 ? (
        <div style={{ background: '#0f172a', borderRadius: '16px', overflow: 'hidden' }}>
          <GoogleBar height={3} />
          <div style={{ textAlign: 'center', padding: '50px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
            <h3 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>Wallet is Empty</h3>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px auto' }}>
              Go to "My Credentials" and click the <strong>"G Google Wallet"</strong> button on any credential to add it here.
            </p>
            <button
              onClick={syncAll}
              style={{ background: '#1e40af', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              🔄 Auto-Sync All Credentials Now
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedPass ? '1fr 1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

          {/* Pass cards column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {passes.length} pass{passes.length !== 1 ? 'es' : ''} stored
            </div>
            {passes.map((pass, i) => (
              <PassCard
                key={pass.passId || i}
                pass={pass}
                vcJwt={vcs[i]}
                userProfile={userProfile}
                onSelect={(p) => setSelectedPass(prev => prev?.passId === p.passId ? null : p)}
                isSelected={selectedPass?.passId === pass.passId}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selectedPass && (
            <div style={{ position: 'sticky', top: '20px' }}>
              <PassDetailPanel
                pass={selectedPass}
                vcJwt={vcs.find((_, i) => passes[i]?.passId === selectedPass.passId)}
                userProfile={userProfile}
                onClose={() => setSelectedPass(null)}
                onResync={() => setConfig(getGoogleWalletConfig(userId))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
