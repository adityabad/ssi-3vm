// import React from 'react';
// import { NavLink, Outlet } from 'react-router-dom';
// import './Layout.css';

// export default function Layout({ address }) {
//   return (
//     <div className="app-layout">
//       <nav className="app-nav">
//         <h2 className="app-title">Holder Wallet</h2>
//         {address && (
//           <div className="wallet-info">
//             Connected: {address.substring(0, 6)}...{address.substring(address.length - 4)}
//           </div>
//         )}
//         <ul>
//           <li><NavLink to="/">Dashboard</NavLink></li>
//           <li><NavLink to="/credentials">My Credentials</NavLink></li>
//           <li><NavLink to="/request">Request Credential</NavLink></li>
//         </ul>
//       </nav>
//       <main className="app-content">
//         <Outlet />
//       </main>
//     </div>
//   );
// }  


import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export default function Layout({
  address,
  did,
  authSession,
  onLogout,
  proactiveCount = 0,
  googleWalletConnected = false,
  googleWalletPassCount = 0,
  onOpenGoogleWalletModal
}) {
  const shortDid = did ? `${did.substring(0, 16)}...${did.substring(did.length - 6)}` : '';

  return (
    <div className="app-layout">
      <header className="modern-header">
        <div className="header-left">
          <div className="brand-logo">⚡ Verifiable.id</div>
          <span className="brand-tag">Holder PWA Wallet</span>
        </div>

        {authSession && (
          <div className="header-center">
            <div className="did-under-hood">
              <span className="did-label">DID (Under the Hood):</span>
              <span className="did-value">{shortDid}</span>
              <button
                className="btn-copy-did"
                onClick={() => {
                  navigator.clipboard.writeText(did);
                  alert('DID copied to clipboard!');
                }}
                title="Copy Full DID"
              >
                📋
              </button>
            </div>
          </div>
        )}

        <div className="header-right">
          {/* Google Wallet Header Status Pill */}
          {authSession && (
            <button
              onClick={onOpenGoogleWalletModal}
              style={{
                background: googleWalletConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                border: googleWalletConnected ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.2)',
                color: googleWalletConnected ? '#4ade80' : '#ffffff',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              title="Google Wallet Real-Time Cloud Sync"
            >
              <span
                style={{
                  background: '#ffffff',
                  color: '#4285f4',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 900
                }}
              >
                G
              </span>
              {googleWalletConnected ? `Google Wallet (${googleWalletPassCount})` : 'Connect Google Wallet'}
            </button>
          )}

          {authSession ? (
            <div className="user-profile-badge">
              <span className="user-type">{authSession.type || 'Passkey Account'}</span>
              <span className="user-name">{authSession.name || 'Alex Rivera'}</span>
              <button onClick={onLogout} className="btn-logout">
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <nav className="modern-nav">
        <ul>
          <li>
            <NavLink to="/" end>
              📊 Overview & Inbox {proactiveCount > 0 && <span className="nav-badge">{proactiveCount}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to="/credentials">📁 My Credentials</NavLink>
          </li>
          <li>
            <NavLink to="/request">📥 Request Credential</NavLink>
          </li>
          <li>
            <NavLink to="/present">🔗 Submit to Hiring Link / Present VC</NavLink>
          </li>
          <li>
            <NavLink to="/google-wallet" style={({ isActive }) => ({
              background: isActive ? 'rgba(66,133,244,0.15)' : undefined,
              borderLeft: isActive ? '3px solid #4285F4' : undefined,
            })}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ background: '#4285F4', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, flexShrink: 0 }}>G</span>
                Google Wallet
                {googleWalletPassCount > 0 && (
                  <span style={{ background: '#34A853', color: '#fff', borderRadius: '20px', padding: '1px 7px', fontSize: '10px', fontWeight: 800 }}>
                    {googleWalletPassCount}
                  </span>
                )}
              </span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
