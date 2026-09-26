import React from 'react';
import { Link } from 'react-router-dom';
import GoogleWalletSyncHub from '../components/GoogleWalletSyncHub.jsx';

export default function Dashboard({
  address,
  did,
  vcsCount,
  vcs = [],
  proactiveCount,
  authSession,
  proactiveInbox = [],
  onClaimProactive,
  onOpenGoogleWalletModal,
  onNotify
}) {
  return (
    <div className="dashboard-container" style={{ padding: '24px' }}>
      <div className="welcome-banner" style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Welcome back, {authSession?.name || 'Student'}! 👋</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Your Self-Sovereign Identity is active. Your DID is managed seamlessly under the hood.
        </p>
      </div>

      {/* Google Wallet Real-Time Cloud Sync Hub */}
      <GoogleWalletSyncHub
        userProfile={authSession}
        vcs={vcs}
        onOpenConnectModal={onOpenGoogleWalletModal}
        onNotify={onNotify}
      />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Stored Credentials</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', marginTop: '6px' }}>{vcsCount}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Proactive Pushed Inbox</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: proactiveCount > 0 ? '#dc2626' : '#16a34a', marginTop: '6px' }}>{proactiveCount}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Auth Security</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#059669', marginTop: '12px' }}>⚡ {authSession?.type || 'Passkey Active'}</div>
        </div>
      </div>

      {/* Proactive Credential Inbox Section */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#0f172a' }}>⚡ Proactive Credentials Inbox</h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Credentials pushed directly by Universities / Issuers</span>
        </div>

        {proactiveInbox.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
            No pending proactive credentials. Credentials issued directly to your DID will appear here automatically.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {proactiveInbox.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#0369a1' }}>🎓 {item.title}</h4>
                  <small style={{ color: '#0284c7' }}>Pushed on {item.date} • Verified Issuer</small>
                </div>
                <button
                  onClick={() => onClaimProactive(item)}
                  style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Accept & Save to Wallet
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Action Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <Link to="/credentials" style={{ textDecoration: 'none', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '18px', borderRadius: '10px', color: '#0f172a' }}>
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>📁</div>
          <strong>My Credentials</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>View and export your Verifiable Credentials</p>
        </Link>
        <Link to="/request" style={{ textDecoration: 'none', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '18px', borderRadius: '10px', color: '#0f172a' }}>
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>📥</div>
          <strong>Request Credential</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Request degree VCs from Universities</p>
        </Link>
        <Link to="/present" style={{ textDecoration: 'none', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '18px', borderRadius: '10px', color: '#0f172a' }}>
          <div style={{ fontSize: '20px', marginBottom: '4px' }}>📤</div>
          <strong>Present VP</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Send zero-knowledge VP to employers</p>
        </Link>
      </div>
    </div>
  );
}