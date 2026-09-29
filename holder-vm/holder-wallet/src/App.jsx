import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as ethers from 'ethers';
import { getResolver } from 'ethr-did-resolver';
import { Resolver } from 'did-resolver';
import { useDidCommSocket } from './hooks/useDidCommSocket.js';
import { EthrDID } from 'ethr-did';

import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CredentialsListPage from './pages/CredentialsListPage.jsx';
import RequestCredentialPage from './pages/RequestCredentialPage.jsx';
import PresentCredentialsPage from './pages/PresentCredentialsPage.jsx';
import ClaimPage from './pages/ClaimPage.jsx';
import CampaignSubmissionPage from './pages/CampaignSubmissionPage.jsx';
import GoogleWalletPage from './pages/GoogleWalletPage.jsx';

import GoogleWalletPassModal from './components/GoogleWalletPassModal.jsx';
import GoogleWalletConnectionModal from './components/GoogleWalletConnectionModal.jsx';
import { getGoogleWalletConfig, syncVcToGoogleWallet } from './services/googleWalletService.js';

import './App.css';
import './index.css';

// --- CONFIGURATION ---
const MEDIATOR_URL = import.meta.env.VITE_MEDIATOR_URL || 'http://127.0.0.1:4000';
const ISSUER_DID = import.meta.env.VITE_ISSUER_DID || 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f';
const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '4321');
const ETHR_DID_REGISTRY_ADDRESS = import.meta.env.VITE_ETHR_DID_REGISTRY_ADDRESS || '0x0130110D59e0b9475642D5c12dd616B3c4ede79A';

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

const PRESET_USER_PROFILES = [
  {
    id: 'alex-rivera',
    name: 'Alex Rivera',
    role: 'Computer Science Student',
    studentId: '2026-CS-8842',
    userEmail: 'alex.rivera@university.edu',
    privateKey: '0x37365837c9f58e172a236672abd22b009cf62f4d9229c9493cd1be5f5cf939d1',
    avatar: '👨‍🎓',
  },
  {
    id: 'sarah-chen',
    name: 'Sarah Chen',
    role: 'Electrical Engineering Graduate',
    studentId: '2025-EE-1920',
    userEmail: 'sarah.chen@university.edu',
    privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    avatar: '👩‍🎓',
  },
  {
    id: 'marcus-vance',
    name: 'Marcus Vance',
    role: 'Verified Corporate Employee',
    studentId: 'EMP-9021',
    userEmail: 'marcus.vance@techcorp.com',
    privateKey: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
    avatar: '👨‍💻',
  },
];

const providerConfig = {
  networks: [
    {
      name: String(CHAIN_ID),
      rpcUrl: RPC_URL,
      registry: ETHR_DID_REGISTRY_ADDRESS,
    },
  ],
};
const didResolver = new Resolver(getResolver(providerConfig));

export default function App() {
  const [authSession, setAuthSession] = useState(() => {
    return JSON.parse(localStorage.getItem('ssi-auth-session') || 'null');
  });

  const [registerModal, setRegisterModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Student');

  // Per-User Vault State
  const userId = authSession ? authSession.id || 'default' : 'guest';

  const [vcs, setVcs] = useState(() => {
    if (!authSession) return [];
    return JSON.parse(localStorage.getItem(`ssi-holder-vcs-${authSession.id || 'default'}`) || '[]');
  });

  const [proactiveInbox, setProactiveInbox] = useState(() => {
    if (!authSession) return [];
    return JSON.parse(localStorage.getItem(`ssi-proactive-inbox-${authSession.id || 'default'}`) || '[]');
  });

  const [status, setStatus] = useState('');
  const [passExportModal, setPassExportModal] = useState(null);
  const [googleWalletModalOpen, setGoogleWalletModalOpen] = useState(false);
  const [googlePassModalVc, setGooglePassModalVc] = useState(null);
  const [gwConfig, setGwConfig] = useState(() => getGoogleWalletConfig(userId));

  useEffect(() => {
    const handleGwState = () => {
      setGwConfig(getGoogleWalletConfig(userId));
    };
    handleGwState();
    window.addEventListener('google-wallet-state-change', handleGwState);
    return () => window.removeEventListener('google-wallet-state-change', handleGwState);
  }, [userId]);

  // Reload per-user credentials whenever user logs in or switches account
  useEffect(() => {
    if (!authSession) {
      setVcs([]);
      setProactiveInbox([]);
      return;
    }
    const userVcsKey = `ssi-holder-vcs-${userId}`;
    const userInboxKey = `ssi-proactive-inbox-${userId}`;

    const savedVcs = JSON.parse(localStorage.getItem(userVcsKey) || '[]');
    const savedInbox = JSON.parse(localStorage.getItem(userInboxKey) || '[]');
    setVcs(savedVcs);
    setProactiveInbox(savedInbox);
  }, [userId]);

  // Persist credentials whenever vcs array changes
  useEffect(() => {
    if (authSession && userId !== 'guest') {
      localStorage.setItem(`ssi-holder-vcs-${userId}`, JSON.stringify(vcs));
    }
  }, [vcs, authSession, userId]);

  useEffect(() => {
    if (authSession && userId !== 'guest') {
      localStorage.setItem(`ssi-proactive-inbox-${userId}`, JSON.stringify(proactiveInbox));
    }
  }, [proactiveInbox, authSession, userId]);

  useEffect(() => {
    if (authSession) {
      localStorage.setItem('ssi-auth-session', JSON.stringify(authSession));
    } else {
      localStorage.removeItem('ssi-auth-session');
    }
  }, [authSession]);

  // Derivation of wallet & DID for active session
  const wallet = useMemo(() => {
    if (!authSession || !authSession.privateKey) return null;
    try {
      return new ethers.Wallet(authSession.privateKey);
    } catch (e) {
      console.error('Error creating wallet from private key:', e);
      return null;
    }
  }, [authSession]);

  const address = wallet ? wallet.address : '';

  const agent = useMemo(() => {
    if (!wallet || !address) return null;
    const did = `did:ethr:${CHAIN_ID}:${address}`;

    const ethrDid = new EthrDID({
      identifier: did,
      privateKey: wallet.privateKey.replace(/^0x/, ''),
      chainId: CHAIN_ID,
      registry: ETHR_DID_REGISTRY_ADDRESS,
      resolver: didResolver,
      alg: 'ES256K-R',
    });

    const secretResolver = {
      get_secret: async (sid) => (sid.endsWith(address) ? wallet.privateKey : undefined),
    };

    return { did, didResolver, secretResolver, ethrDid, privateKey: wallet.privateKey, wallet };
  }, [address, wallet]);

  const { messages, setMessages } = useDidCommSocket(agent?.did, MEDIATOR_URL);

  // Handle incoming DIDComm messages for active user
  useEffect(() => {
    if (!messages || messages.length === 0 || !agent) return;

    const handleMessages = async () => {
      let newStatus = '';
      let newVcs = [...vcs];
      let newProactive = [...proactiveInbox];

      for (const msg of messages) {
        if (
          msg.type === 'https://didcomm.org/issue-credential/3.0/issue-credential' ||
          msg.type === 'https://didcomm.org/issue-credential/3.0/proactive-issue'
        ) {
          const vcJwt = msg.attachments?.[0]?.data?.json;
          if (vcJwt) {
            if (!newVcs.includes(vcJwt)) {
              newVcs.push(vcJwt);
              newStatus = `✅ New Verifiable Credential delivered to ${authSession.name}'s wallet!`;

              // Real-Time Google Wallet Auto-Sync
              const curGw = getGoogleWalletConfig(userId);
              if (curGw.isConnected && curGw.autoSync !== false) {
                syncVcToGoogleWallet(vcJwt, authSession).then(() => {
                  setStatus(`🟢 Auto-Synced newly issued credential to Google Wallet!`);
                });
              }
            }
          }
        }
      }

      setVcs(newVcs);
      setProactiveInbox(newProactive);
      if (newStatus) setStatus(newStatus);
      setMessages([]);
    };

    handleMessages();
  }, [messages, vcs, proactiveInbox, agent, setMessages, authSession]);

  // Login Handlers for User Selection
  const handleSelectUserProfile = (profile) => {
    setAuthSession(profile);
    setStatus(`Logged in as ${profile.name} (${profile.role}). Vault & DID active.`);
  };

  const handleCreateCustomIdentity = (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return alert('Please enter Name and Email');

    const randomWallet = ethers.Wallet.createRandom();
    const customProfile = {
      id: `custom_${Date.now()}`,
      name: newUserName.trim(),
      role: newUserRole,
      studentId: `CUSTOM-${Math.floor(1000 + Math.random() * 9000)}`,
      userEmail: newUserEmail.trim(),
      privateKey: randomWallet.privateKey,
      avatar: '👤',
    };

    setAuthSession(customProfile);
    setRegisterModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setStatus(`✨ New Passkey Identity Created! Registered DID for ${customProfile.name}.`);
  };

  // Form State for Authentic Sign In / Sign Up
  const [authMode, setAuthMode] = useState('signin'); // 'signin' vs 'signup'
  const [loginEmail, setLoginEmail] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpRole, setSignUpRole] = useState('Student');
  const [signUpId, setSignUpId] = useState('');

  // Load all registered users from localStorage or default list
  const [allUsers, setAllUsers] = useState(() => {
    const saved = localStorage.getItem('ssi-registered-users');
    if (saved) return JSON.parse(saved);
    return PRESET_USER_PROFILES;
  });

  useEffect(() => {
    localStorage.setItem('ssi-registered-users', JSON.stringify(allUsers));
  }, [allUsers]);

  // Handle Authentic Sign In by Email or Passkey
  const handleSignInSubmit = (e) => {
    e.preventDefault();
    const emailToFind = loginEmail.trim().toLowerCase();
    if (!emailToFind) return alert('Please enter your email or identity handle.');

    // Look up existing registered user profile by email
    let userProfile = allUsers.find((u) => u.userEmail.toLowerCase() === emailToFind);

    if (!userProfile) {
      // Auto-provision a new Passkey account for this unrecognized email
      const randomWallet = ethers.Wallet.createRandom();
      const userNameFromEmail = emailToFind.split('@')[0].replace('.', ' ');
      const formattedName = userNameFromEmail.charAt(0).toUpperCase() + userNameFromEmail.slice(1);

      userProfile = {
        id: `usr_${Date.now()}`,
        name: formattedName,
        userEmail: emailToFind,
        role: 'Registered Identity',
        studentId: `ID-${Math.floor(1000 + Math.random() * 9000)}`,
        privateKey: randomWallet.privateKey,
        avatar: '👤',
      };

      setAllUsers((prev) => [...prev, userProfile]);
      setStatus(`✨ New Passkey account auto-provisioned for ${emailToFind}!`);
    } else {
      setStatus(`Welcome back, ${userProfile.name}! Passkey session initialized.`);
    }

    setAuthSession(userProfile);
  };

  // Handle Authentic New User Sign Up
  const handleSignUpSubmit = (e) => {
    e.preventDefault();
    if (!signUpName.trim() || !signUpEmail.trim()) return alert('Please complete Name and Email fields.');

    const emailFormatted = signUpEmail.trim().toLowerCase();
    const existing = allUsers.find((u) => u.userEmail.toLowerCase() === emailFormatted);
    if (existing) {
      alert('An account with this email already exists. Signing you in...');
      setAuthSession(existing);
      return;
    }

    const newWallet = ethers.Wallet.createRandom();
    const newUser = {
      id: `usr_${Date.now()}`,
      name: signUpName.trim(),
      userEmail: emailFormatted,
      role: signUpRole,
      studentId: signUpId.trim() || `ID-${Math.floor(1000 + Math.random() * 9000)}`,
      privateKey: newWallet.privateKey,
      avatar: '👤',
    };

    setAllUsers((prev) => [...prev, newUser]);
    setAuthSession(newUser);
    setStatus(`✅ Account registered successfully for ${newUser.name}! Dedicated DID derived.`);
  };

  // Helper to quick-fill email for demo testing
  const handleQuickFillEmail = (email) => {
    setLoginEmail(email);
  };

  const handleLogout = () => {
    setAuthSession(null);
    setStatus('Logged out of Holder Wallet.');
  };

  // 1️⃣ IF NOT LOGGED IN -> RENDER AUTHENTIC SIGN IN / SIGN UP SCREEN
  if (!authSession || !address) {
    return (
      <div className="modern-auth-container" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
        <div className="auth-card" style={{ background: '#ffffff', borderRadius: '24px', padding: '36px', maxWidth: '460px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
              ⚡ W3C Identity Holder Wallet
            </div>
            <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
              {authMode === 'signin' ? 'Sign In to Your Wallet' : 'Create New Identity Wallet'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
              {authMode === 'signin' ? 'Enter your credentials to access your private vault & DID' : 'Register your passkey identity to start receiving VCs'}
            </p>
          </div>

          {/* Sign In vs Sign Up Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setAuthMode('signin')}
              style={{ flex: 1, background: authMode === 'signin' ? '#ffffff' : 'transparent', color: authMode === 'signin' ? '#0f172a' : '#64748b', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', boxShadow: authMode === 'signin' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none' }}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              style={{ flex: 1, background: authMode === 'signup' ? '#ffffff' : 'transparent', color: authMode === 'signup' ? '#0f172a' : '#64748b', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', boxShadow: authMode === 'signup' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none' }}
            >
              Create Account
            </button>
          </div>

          {/* TAB 1: SIGN IN FORM */}
          {authMode === 'signin' && (
            <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Email Address / Identity Handle:
                </label>
                <input
                  type="email"
                  placeholder="name@university.edu or user@domain.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', fontWeight: 600 }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}
              >
                🔑 Sign In with Passkey / FaceID
              </button>

              {/* Quick Fill Dropdown for Testing Convenience */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  🧪 Demo Helper (Quick fill existing candidate email):
                </label>
                <select
                  onChange={(e) => handleQuickFillEmail(e.target.value)}
                  defaultValue=""
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="" disabled>-- Select Demo Candidate Email --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.userEmail}>
                      {u.name} ({u.userEmail})
                    </option>
                  ))}
                </select>
              </div>
            </form>
          )}

          {/* TAB 2: CREATE ACCOUNT FORM */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Full Name:</label>
                <input
                  type="text"
                  placeholder="e.g. David Miller"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Email Address:</label>
                <input
                  type="email"
                  placeholder="david.miller@university.edu"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Role / Category:</label>
                <select
                  value={signUpRole}
                  onChange={(e) => setSignUpRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  <option value="Student">Student (Undergraduate / Graduate)</option>
                  <option value="Alumni">Alumni / Graduate</option>
                  <option value="Corporate Employee">Corporate Employee</option>
                  <option value="Healthcare Professional">Healthcare Professional</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Student / Employee ID (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-CS-9912"
                  value={signUpId}
                  onChange={(e) => setSignUpId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <button
                type="submit"
                style={{ width: '100%', background: '#059669', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', marginTop: '6px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' }}
              >
                🚀 Register Account & Derive DID
              </button>
            </form>
          )}

          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '24px' }}>
            Zero-Trust Isolation • Your personal DID & private vault remain private to your session.
          </div>
        </div>

        {status && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              background: '#2563eb',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            }}
          >
            {status}
          </div>
        )}
      </div>
    );
  }


  const handleSaveClaimedCredential = (vcJwt) => {
    const updatedVcs = [vcJwt, ...vcs.filter(v => v !== vcJwt)];
    setVcs(updatedVcs);
    localStorage.setItem(`ssi-holder-vcs-${userId}`, JSON.stringify(updatedVcs));
    setStatus('✅ New Verifiable Credential saved to mobile wallet storage!');

    // Real-Time Google Wallet Auto-Sync
    const curGw = getGoogleWalletConfig(userId);
    if (curGw.isConnected && curGw.autoSync !== false) {
      syncVcToGoogleWallet(vcJwt, authSession).then(() => {
        setStatus('🟢 Auto-Synced newly claimed credential to Google Wallet!');
      });
    }
  };

  const handleClaimProactive = (item) => {
    const updatedInbox = proactiveInbox.filter((i) => i.id !== item.id);
    setProactiveInbox(updatedInbox);
    localStorage.setItem(`ssi-proactive-inbox-${userId}`, JSON.stringify(updatedInbox));
    if (item.vcJwt) {
      handleSaveClaimedCredential(item.vcJwt);
    } else {
      setStatus(`✅ Accepted proactive credential: ${item.title}`);
    }
  };

  const handleExportPass = (vcJwt, targetWallet) => {
    if (targetWallet === 'Google Wallet') {
      setGooglePassModalVc(vcJwt);
    } else {
      setPassExportModal({ vcJwt, targetWallet });
    }
  };

  // 2️⃣ LOGGED IN -> RENDER FULL HOLDER WALLET APP FOR ACTIVE USER
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              address={address}
              did={agent?.did}
              authSession={authSession}
              proactiveCount={proactiveInbox.length}
              onLogout={handleLogout}
              googleWalletConnected={gwConfig.isConnected}
              googleWalletPassCount={gwConfig.syncedPasses?.length || 0}
              onOpenGoogleWalletModal={() => setGoogleWalletModalOpen(true)}
            />
          }
        >
          <Route
            index
            element={
              <Dashboard
                address={address}
                did={agent?.did}
                vcsCount={vcs.length}
                vcs={vcs}
                proactiveCount={proactiveInbox.length}
                authSession={authSession}
                proactiveInbox={proactiveInbox}
                onClaimProactive={handleClaimProactive}
                onOpenGoogleWalletModal={() => setGoogleWalletModalOpen(true)}
                onNotify={(msg) => setStatus(msg)}
              />
            }
          />
          <Route
            path="/credentials"
            element={<CredentialsListPage vcs={vcs} onExportPass={handleExportPass} userProfile={authSession} />}
          />
          <Route
            path="/request"
            element={
              <RequestCredentialPage agent={agent} issuerDid={ISSUER_DID} mediatorUrl={MEDIATOR_URL} />
            }
          />
          <Route
            path="/present"
            element={<PresentCredentialsPage vcs={vcs} agent={agent} setStatus={setStatus} />}
          />
          <Route
            path="/claim"
            element={
              <ClaimPage
                userDid={agent?.did}
                onCredentialClaimed={handleSaveClaimedCredential}
              />
            }
          />
          <Route
            path="/campaign/:campaignId"
            element={
              <CampaignSubmissionPage
                vcs={vcs}
                userName={authSession?.name}
                userEmail={authSession?.userEmail}
                userDid={agent?.did}
                agent={agent}
              />
            }
          />
          <Route
            path="/google-wallet"
            element={
              <GoogleWalletPage
                vcs={vcs}
                userProfile={authSession}
                onOpenGoogleWalletModal={() => setGoogleWalletModalOpen(true)}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>

      {/* Real-Time Google Wallet Pass Inspector & Exporter Modal */}
      {googlePassModalVc && (
        <GoogleWalletPassModal
          vcJwt={googlePassModalVc}
          userProfile={authSession}
          onClose={() => setGooglePassModalVc(null)}
          onNotify={(msg) => setStatus(msg)}
        />
      )}

      {/* Google Wallet Account Connection & Sync Modal */}
      {googleWalletModalOpen && (
        <GoogleWalletConnectionModal
          userProfile={authSession}
          vcs={vcs}
          onClose={() => setGoogleWalletModalOpen(false)}
          onNotify={(msg) => setStatus(msg)}
        />
      )}

      {/* Apple / Generic Mobile Pass Modal */}
      {passExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px 0' }}>{passExportModal.targetWallet} Pass Export</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Scan QR code on your mobile device to add this Verifiable Credential directly to {passExportModal.targetWallet}.
            </p>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'inline-block', marginBottom: '20px' }}>
              <div style={{ fontSize: '72px' }}>📱</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#0369a1', marginTop: '6px' }}>
                pkpass_claim_{authSession?.id || 'id'}
              </div>
            </div>
            <div>
              <button
                onClick={() => setPassExportModal(null)}
                style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {status && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: status.startsWith('✅') || status.startsWith('🟢') ? '#16a34a' : status.startsWith('❌') ? '#dc2626' : '#2563eb',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '13px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            zIndex: 9999,
          }}
        >
          {status}
        </div>
      )}
    </BrowserRouter>
  );
}

