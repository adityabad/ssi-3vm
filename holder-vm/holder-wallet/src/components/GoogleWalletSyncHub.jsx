import React, { useState, useEffect } from 'react';
import {
  getGoogleWalletConfig,
  syncAllVcsToGoogleWallet
} from '../services/googleWalletService.js';

export default function GoogleWalletSyncHub({
  userProfile,
  vcs = [],
  onOpenConnectModal,
  onNotify
}) {
  const userId = userProfile?.id || 'alex-rivera';
  const [config, setConfig] = useState(() => getGoogleWalletConfig(userId));
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleStateChange = (e) => {
      if (e?.detail) setConfig(e.detail);
      else setConfig(getGoogleWalletConfig(userId));
    };

    window.addEventListener('google-wallet-state-change', handleStateChange);
    const interval = setInterval(() => {
      setConfig(getGoogleWalletConfig(userId));
    }, 1500);

    return () => {
      window.removeEventListener('google-wallet-state-change', handleStateChange);
      clearInterval(interval);
    };
  }, [userId]);

  const handleQuickSync = async () => {
    if (vcs.length === 0) {
      if (onNotify) onNotify('⚠️ No credentials available to sync yet.');
      return;
    }
    setSyncing(true);
    try {
      const res = await syncAllVcsToGoogleWallet(vcs, userProfile);
      setConfig(res.config);
      if (onNotify) onNotify(res.message);
    } catch (e) {
      if (onNotify) onNotify('❌ Sync error: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '22px 24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 4-color Google accent border at top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(to right, #4285F4 25%, #EA4335 25% 50%, #FBBC05 50% 75%, #34A853 75%)'
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        {/* Left: Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '20px',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.2)'
            }}
          >
            <span style={{ color: '#4285f4' }}>G</span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Google Wallet Real-Time Cloud Sync
              </h3>
              {config.isConnected ? (
                <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                  🟢 Connected ({config.syncedPasses?.length || 0} passes)
                </span>
              ) : (
                <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                  ⚪ Not Connected
                </span>
              )}
            </div>

            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              {config.isConnected
                ? `Connected to ${config.googleEmail} • Real-time auto-sync is ${config.autoSync !== false ? 'Active' : 'Paused'}`
                : 'Connect your Google account to automatically mirror academic credentials to Google Wallet.'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {config.isConnected ? (
            <>
              <button
                onClick={handleQuickSync}
                disabled={syncing}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: syncing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {syncing ? '⚡ Syncing...' : '⚡ Sync All Now'}
              </button>

              <button
                onClick={onOpenConnectModal}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚙️ Manage
              </button>
            </>
          ) : (
            <button
              onClick={onOpenConnectModal}
              style={{
                background: '#000000',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <span style={{ color: '#4285f4', fontWeight: 900 }}>G</span> Connect Google Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
