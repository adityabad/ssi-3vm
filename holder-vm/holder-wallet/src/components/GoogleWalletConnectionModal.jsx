import React, { useState, useEffect } from 'react';
import {
  getGoogleWalletConfig,
  saveGoogleWalletConfig,
  connectGoogleWallet,
  disconnectGoogleWallet,
  syncAllVcsToGoogleWallet
} from '../services/googleWalletService.js';

export default function GoogleWalletConnectionModal({
  userProfile,
  vcs = [],
  onClose,
  onNotify
}) {
  const userId = userProfile?.id || 'alex-rivera';
  const [config, setConfig] = useState(() => getGoogleWalletConfig(userId));
  const [emailInput, setEmailInput] = useState(config.googleEmail || userProfile?.userEmail || `${userId}@gmail.com`);
  const [autoSync, setAutoSync] = useState(config.autoSync !== false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    const current = getGoogleWalletConfig(userId);
    setConfig(current);
    setAutoSync(current.autoSync !== false);
    if (!current.googleEmail) {
      setEmailInput(userProfile?.userEmail || `${userId}@gmail.com`);
    }
  }, [userId, userProfile]);

  const handleConnect = (e) => {
    e.preventDefault();
    const updated = connectGoogleWallet(userId, emailInput.trim(), userProfile?.name);
    updated.autoSync = autoSync;
    saveGoogleWalletConfig(userId, updated);
    setConfig(updated);
    if (onNotify) onNotify(`🟢 Real-Time Google Wallet connected to ${updated.googleEmail}!`);
  };

  const handleDisconnect = () => {
    const updated = disconnectGoogleWallet(userId);
    setConfig(updated);
    if (onNotify) onNotify('⚪ Google Wallet disconnected.');
  };

  const handleToggleAutoSync = (val) => {
    setAutoSync(val);
    const updated = { ...config, autoSync: val };
    saveGoogleWalletConfig(userId, updated);
    setConfig(updated);
    if (onNotify) onNotify(val ? '⚡ Real-time Auto-Sync enabled for incoming credentials!' : 'Auto-Sync disabled.');
  };

  const handleBatchSyncAll = async () => {
    if (vcs.length === 0) {
      if (onNotify) onNotify('⚠️ No credentials available to sync yet.');
      return;
    }
    setIsSyncingAll(true);
    try {
      const res = await syncAllVcsToGoogleWallet(vcs, userProfile);
      setConfig(res.config);
      if (onNotify) onNotify(res.message);
    } catch (e) {
      if (onNotify) onNotify('❌ Batch sync failed: ' + e.message);
    } finally {
      setIsSyncingAll(false);
    }
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
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          position: 'relative'
        }}
      >
        {/* Top Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '24px 28px',
            borderRadius: '24px 24px 0 0',
            position: 'relative'
          }}
        >
          {/* 4-color Google strip */}
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

          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 700
            }}
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '20px',
                color: '#4285f4',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}
            >
              G
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
                Google Wallet Integration
              </h3>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Real-Time Cloud Synchronization for SSI Credentials
              </div>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '28px' }}>
          {config.isConnected ? (
            /* --- CONNECTED STATE --- */
            <div>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '14px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', background: '#16a34a', color: 'white', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                      🟢 ACTIVE & CONNECTED
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                    {config.googleEmail}
                  </div>
                  <small style={{ color: '#64748b' }}>
                    Google ID: {config.googleId}
                  </small>
                </div>

                <button
                  onClick={handleDisconnect}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Disconnect
                </button>
              </div>

              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                    Synced Passes
                  </span>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
                    {config.syncedPasses ? config.syncedPasses.length : 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                    Last Cloud Sync
                  </span>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
                    {config.lastSyncTime ? new Date(config.lastSyncTime).toLocaleTimeString() : 'Just now'}
                  </div>
                </div>
              </div>

              {/* Real-time Auto-Sync Toggle */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                    ⚡ Real-Time Auto Sync
                  </strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Automatically convert and push new VCs to Google Wallet when issued.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#2563eb' }}
                />
              </div>

              {/* Batch Sync Button */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={handleBatchSyncAll}
                  disabled={isSyncingAll}
                  style={{
                    width: '100%',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isSyncingAll ? 'wait' : 'pointer'
                  }}
                >
                  {isSyncingAll
                    ? '⚡ Synchronizing All VCs to Google Wallet Cloud...'
                    : `⚡ Sync All Active Credentials (${vcs.length}) to Google Wallet`}
                </button>
              </div>

              {/* List of Synced Passes */}
              {config.syncedPasses && config.syncedPasses.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', color: '#0f172a', margin: '0 0 10px 0' }}>
                    📱 Live Passes in Google Wallet ({config.syncedPasses.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                    {config.syncedPasses.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '12px', color: '#0f172a' }}>{p.title}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{p.institution} • {p.studentName}</div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                          🟢 Active
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* --- DISCONNECTED / CONNECT FORM --- */
            <div>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px 0' }}>
                Connect your Google Account to automatically mirror and store your academic degrees and verifiable credentials inside Google Wallet in real-time.
              </p>

              <form onSubmit={handleConnect}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Google Account Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="e.g., student.holder@gmail.com"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <input
                    type="checkbox"
                    id="autoSyncCheck"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                  />
                  <label htmlFor="autoSyncCheck" style={{ fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <strong>Enable Real-Time Auto Sync:</strong> Push newly issued academic VCs straight to Google Wallet automatically.
                  </label>
                </div>

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    background: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    fontSize: '14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
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
                  Connect & Authenticate Google Wallet
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
