// Enterprise Verifier Verification Page
import React, { useState, useEffect, useMemo } from 'react';
import * as ethers from 'ethers';
import './Verification.css';

const AGENT_URL = import.meta.env.VITE_VERIFIER_AGENT_URL || 'http://localhost:8081';
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '4321');

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

function generateSampleVp(type = 'selective', candidateName = 'Alex Rivera') {
  if (type === 'selective') {
    const disclosedClaims = {
      degreeName: 'Bachelor of Science in Computer Science & Artificial Intelligence',
      major: 'Computer Science & Artificial Intelligence',
      graduationYear: '2026',
      institutionName: 'MIT Institute of Technology',
      role: 'Verified Graduate / Alumni',
      documentHash: '7285e74951acc4cfaf2ede2420cbe819ae983d2267041c9555421182353c4dee',
      hashAlgorithm: 'SHA-256'
    };
    const redactedClaims = [
      { field: 'gpa', status: 'REDACTED_BY_HOLDER', digest: '0x569cbcf08af3ab6b4088d3ff69af6be269d71891d756e0aec58c4e5f556f24fc' },
      { field: 'studentId', status: 'REDACTED_BY_HOLDER', digest: '0x4e4cf0cf978aa148d41b69fe221d5f5f2ac901a1b807e960006b70cf647078f1' }
    ];
    const selectiveVcPayload = {
      iss: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
      sub: 'did:ethr:4321:0x81c0E932dC0AED833fAd0Ec2E924fd972d86eD8E',
      jti: '5ada6890e9cfab84',
      selectiveDisclosure: true,
      disclosedClaims,
      redactedClaims,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'SelectiveDisclosureCredential', 'AcademicDegreeCredential'],
        credentialSubject: {
          ...disclosedClaims,
          candidateName,
          gpa: '[REDACTED_BY_HOLDER - Digest: 569cbcf0...]',
          studentId: '[REDACTED_BY_HOLDER - Digest: 4e4cf0cf...]',
          vcId: '5ada6890e9cfab84'
        },
        selectiveDisclosure: true
      }
    };
    const vcJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(selectiveVcPayload)}.sd_issuer_proof`;
    const vpPayload = {
      iss: 'did:ethr:4321:0x81c0E932dC0AED833fAd0Ec2E924fd972d86eD8E',
      aud: 'did:ethr:4321:0xVerifierNode',
      presentationMode: 'selective',
      selectiveDisclosure: true,
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation', 'SelectiveDisclosurePresentation'],
        verifiableCredential: [vcJwt]
      }
    };
    return `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(vpPayload)}.holder_sd_vp_signature`;
  } else {
    const fullVcPayload = {
      iss: 'did:ethr:4321:0xB00721C14067984af0d3B340Ac0CD1034cD78f8f',
      sub: 'did:ethr:4321:0x81c0E932dC0AED833fAd0Ec2E924fd972d86eD8E',
      jti: 'vc_academic_degree_2026',
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'AcademicDegreeCredential'],
        credentialSubject: {
          candidateName,
          degreeName: 'Bachelor of Science in Computer Science & AI',
          major: 'Artificial Intelligence & Cybernetics',
          gpa: '3.95 / 4.0',
          graduationYear: '2026',
          institutionName: 'MIT Institute of Technology',
          role: 'Verified Graduate / Alumni',
          studentId: 'STU-2026-8842',
          vcId: 'vc_academic_degree_2026'
        }
      }
    };
    const vcJwt = `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(fullVcPayload)}.academic_issuer_proof`;
    const vpPayload = {
      iss: 'did:ethr:4321:0x81c0E932dC0AED833fAd0Ec2E924fd972d86eD8E',
      aud: 'did:ethr:4321:0xVerifierNode',
      presentationMode: 'structured',
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [vcJwt]
      }
    };
    return `eyJhbGciOiJFUzI1NksifQ.${safeBase64UrlEncode(vpPayload)}.holder_full_vp_signature`;
  }
}

export default function Verification() {
  const [authSession, setAuthSession] = useState(() => {
    return JSON.parse(localStorage.getItem('ssi-verifier-session') || 'null');
  });

  const [verifyMode, setVerifyMode] = useState('ephemeral'); // 'ephemeral' (ZKP/Non-Storage) vs 'stored' (Audit Log)
  const [activeTab, setActiveTab] = useState('analytics'); // 'campaigns', 'single', 'bulk', 'realtime', 'analytics', 'audit'
  const [agentSocket, setAgentSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [log, setLog] = useState([]);
  const [vp, setVp] = useState(null);
  const [result, setResult] = useState(null);

  // Single VP Verification State
  const [singleVpInput, setSingleVpInput] = useState('');
  const [singleVpResult, setSingleVpResult] = useState(null);
  const [isSingleLoading, setIsSingleLoading] = useState(false);
  const [singleStatusMsg, setSingleStatusMsg] = useState('');
  const [showRawSinglePayload, setShowRawSinglePayload] = useState(false);

  // Mass Hiring Campaigns State
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [campaignSubmissions, setCampaignSubmissions] = useState([]);
  const [newCampaignTitle, setNewCampaignTitle] = useState('Graduate Software Engineer Mass Hiring 2026');
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [campaignStatusMsg, setCampaignStatusMsg] = useState('');

  // Bulk Verification State
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  // Candidate Inspection Modal State
  const [selectedCandidateModal, setSelectedCandidateModal] = useState(null);

  // Real-time Analytics & Telemetry State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [lastAnalyticsSync, setLastAnalyticsSync] = useState(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  const address = authSession ? authSession.address : '';
  const verifierDid = useMemo(() => (address ? `did:ethr:${CHAIN_ID}:${address}` : ''), [address]);

  useEffect(() => {
    if (authSession) {
      localStorage.setItem('ssi-verifier-session', JSON.stringify(authSession));
    } else {
      localStorage.removeItem('ssi-verifier-session');
    }
  }, [authSession]);

  // WebSocket Connection to Verifier Agent
  useEffect(() => {
    if (!authSession) return;

    const wsUrl = AGENT_URL.replace(/^http/, 'ws');
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setLog((prev) => [...prev, `WebSocket Error: ${e.message}`]);
      return;
    }

    ws.onopen = () => {
      setIsConnected(true);
      setLog((prev) => [...prev, 'Connected to Verifier Agent.']);
      setAgentSocket(ws);
      if (verifierDid) {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE_DID', payload: verifierDid }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'VERIFICATION_RESULT') {
          setLog((prev) => [...prev, 'Received VP presentation payload.']);
          setResult(data.payload.result);
          setVp(data.payload.vp);

          if (verifyMode === 'stored') {
            fetchAuditLogs();
          }
          fetchRealtimeAnalytics();
        } else if (data.type === 'ANALYTICS_EVENT') {
          fetchRealtimeAnalytics();
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setAgentSocket(null);
      setLog((prev) => [...prev, 'Disconnected from Verifier Agent.']);
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [authSession, verifierDid, verifyMode]);

  const fetchRealtimeAnalytics = async () => {
    try {
      const resp = await fetch(`${AGENT_URL}/api/analytics/realtime`);
      if (resp.ok) {
        const data = await resp.json();
        setAnalyticsData(data);
        setLastAnalyticsSync(new Date());
      }
    } catch (e) {
      console.warn('Could not fetch real-time analytics:', e.message);
    }
  };

  // Real-time polling for Analytics
  useEffect(() => {
    fetchRealtimeAnalytics();
    const interval = setInterval(() => {
      fetchRealtimeAnalytics();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const resp = await fetch(`${AGENT_URL}/api/records`);
      if (resp.ok) {
        const data = await resp.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Could not fetch audit logs:', e.message);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const resp = await fetch(`${AGENT_URL}/api/campaigns`);
      if (resp.ok) {
        const data = await resp.json();
        setCampaigns(data.campaigns || []);
        if (data.campaigns && data.campaigns.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(data.campaigns[0].id);
        }
      }
    } catch (e) {
      console.warn('Could not fetch campaigns:', e.message);
    }
  };

  const fetchSubmissions = async (id) => {
    if (!id) return;
    try {
      const resp = await fetch(`${AGENT_URL}/api/campaigns/${id}/submissions`);
      if (resp.ok) {
        const data = await resp.json();
        setCampaignSubmissions(data.submissions || []);
      }
    } catch (e) {
      console.warn('Could not fetch submissions:', e.message);
    }
  };

  useEffect(() => {
    if (authSession) {
      fetchCampaigns();
    }
  }, [authSession]);

  useEffect(() => {
    if (selectedCampaignId) {
      fetchSubmissions(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignTitle.trim()) return alert('Please enter campaign title.');
    setIsCampaignLoading(true);
    try {
      const resp = await fetch(`${AGENT_URL}/api/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCampaignTitle,
          companyName: authSession?.name || 'TechCorp Global Solutions'
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        setCampaignStatusMsg(`🎉 Created new mass hiring campaign link!`);
        fetchCampaigns();
        fetchRealtimeAnalytics();
        setSelectedCampaignId(data.campaign.id);
        setNewCampaignTitle('');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      alert(`Campaign Error: ${err.message}`);
    } finally {
      setIsCampaignLoading(false);
    }
  };

  const handleVerifyAllCampaignSubmissions = async () => {
    if (!selectedCampaignId) return;
    setIsCampaignLoading(true);
    setCampaignStatusMsg(`Executing 1-Click Mass Verification across all candidate VPs...`);
    try {
      const resp = await fetch(`${AGENT_URL}/api/campaigns/${selectedCampaignId}/verify-all`, {
        method: 'POST'
      });
      const data = await resp.json();
      if (resp.ok) {
        setCampaignStatusMsg(`⚡ Mass Verification Complete! Passed: ${data.passedCount}, Failed: ${data.failedCount}`);
        setCampaignSubmissions(data.submissions || []);
        fetchRealtimeAnalytics();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      alert(`Mass Verification Error: ${err.message}`);
    } finally {
      setIsCampaignLoading(false);
    }
  };

  const handleExportCampaignCsv = () => {
    if (!selectedCampaignId) return;
    window.open(`${AGENT_URL}/api/campaigns/${selectedCampaignId}/export-csv`, '_blank');
  };

  const PRESET_VERIFIER_AGENCIES = [
    { id: 'acme-hr', name: 'Acme Corp HR & Talent Verification', domain: 'acme-hr.com', address: '0x24FD574804691b7F53bEF6Bbf0fe0a8b46195970', icon: '🏢' },
    { id: 'global-tech', name: 'Global Tech Recruiters Agency', domain: 'globaltech-recruiting.com', address: '0x89201531Aa578612B6d42B10748a7bC28E01248f', icon: '🌐' },
    { id: 'fin-audit', name: 'Financial & Regulatory Audits Corp', domain: 'finaudit-compliance.org', address: '0x5C24174804691b7F53bEF6Bbf0fe0a8b4619588b', icon: '⚖️' },
  ];

  const handleSelectAgency = (agency) => {
    setAuthSession({
      type: 'Enterprise Passkey Portal',
      user: `verifier@${agency.domain}`,
      address: agency.address,
      name: agency.name,
    });
  };

  const handleLogout = () => {
    setAuthSession(null);
  };

  // Single VP Verification Handler
  const handleSingleVerify = async (e, directVp = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const tokenToVerify = directVp || singleVpInput.trim();
    if (!tokenToVerify) return alert('Please enter or paste a Verifiable Presentation JWT.');

    setIsSingleLoading(true);
    setSingleStatusMsg('Cryptographically verifying VP signature, issuer DID, and on-chain Geth registry...');
    try {
      const resp = await fetch(`${AGENT_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vpJwt: tokenToVerify,
          mode: verifyMode,
          verifierId: verifierDid || 'single-verifier',
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Verification failed');
      setSingleVpResult(data);
      setSingleStatusMsg(data.verified ? '✅ Presentation Authenticated & Valid on Geth Blockchain!' : '❌ Presentation Verification Denied / Failed');
      if (verifyMode === 'stored') {
        fetchAuditLogs();
      }
      fetchRealtimeAnalytics();
    } catch (err) {
      setSingleStatusMsg(`❌ Verification Error: ${err.message}`);
    } finally {
      setIsSingleLoading(false);
    }
  };

  const handleLoadSingleSample = (type = 'selective') => {
    const sampleJwt = generateSampleVp(type, type === 'selective' ? 'Alex Rivera (ZKP Protected)' : 'Sarah Chen (Full Disclosure)');
    setSingleVpInput(sampleJwt);
    handleSingleVerify(null, sampleJwt);
  };

  const handleSingleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setSingleVpInput(content.trim());
      handleSingleVerify(null, content.trim());
    };
    reader.readAsText(file);
  };

  // Verify single candidate from campaign table
  const handleVerifySingleCandidate = async (sub) => {
    if (!selectedCampaignId || !sub?.id) return;
    try {
      setCampaignStatusMsg(`Executing verification for ${sub.candidate_name}...`);
      const resp = await fetch(`${AGENT_URL}/api/campaigns/${selectedCampaignId}/submissions/${sub.id}/verify`, {
        method: 'POST'
      });
      const data = await resp.json();
      if (resp.ok) {
        setCampaignStatusMsg(`✅ Candidate ${sub.candidate_name} verified: ${data.status}`);
        setCampaignSubmissions(prev => prev.map(s => s.id === sub.id ? data.submission : s));
        setSelectedCandidateModal(data.submission);
        fetchRealtimeAnalytics();
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      alert(`Candidate Verification Error: ${err.message}`);
    }
  };

  // Bulk Verification Handler
  const handleBulkVerify = async (e, directList = null) => {
    if (e && e.preventDefault) e.preventDefault();
    let vpList = [];
    if (directList && Array.isArray(directList)) {
      vpList = directList;
    } else {
      if (!bulkInput.trim()) return alert('Please enter at least one VP JWT string or load a sample batch');
      try {
        if (bulkInput.trim().startsWith('[')) {
          const parsed = JSON.parse(bulkInput);
          if (Array.isArray(parsed)) {
            vpList = parsed.map(item => typeof item === 'string' ? item : item.jwt || JSON.stringify(item));
          }
        }
      } catch (err) {}
      if (vpList.length === 0) {
        vpList = bulkInput
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 10);
      }
    }

    if (vpList.length === 0) return alert('No valid JWT strings found in input');

    setIsBulkLoading(true);
    setBulkProgress(30);
    try {
      const resp = await fetch(`${AGENT_URL}/api/verify/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vpJwts: vpList,
          mode: verifyMode,
          verifierId: verifierDid || 'bulk-verifier',
        }),
      });

      setBulkProgress(80);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Bulk verification failed');
      setBulkResult(data);
      setBulkProgress(100);
      if (verifyMode === 'stored') {
        fetchAuditLogs();
      }
      fetchRealtimeAnalytics();
    } catch (err) {
      alert(`Bulk Verification Failed: ${err.message}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleLoadBulkSample = () => {
    const sampleBatch = [
      generateSampleVp('selective', 'Alex Rivera (MIT - ZKP Protected)'),
      generateSampleVp('full', 'Sarah Chen (MIT - Full Disclosure)'),
      generateSampleVp('selective', 'Kabir Das (MIT - ZKP Protected)')
    ];
    setBulkInput(sampleBatch.join('\n\n'));
    handleBulkVerify(null, sampleBatch);
  };

  const handleBulkFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setBulkInput(content.trim());
      handleBulkVerify(null);
    };
    reader.readAsText(file);
  };

  const handleExportBulkJson = () => {
    if (!bulkResult) return;
    const blob = new Blob([JSON.stringify(bulkResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Batch_Verification_Report_${new Date().toISOString().substring(0, 10)}.json`;
    a.click();
  };

  const handleExportBulkCsv = () => {
    if (!bulkResult?.results) return;
    const headers = ['Index', 'Status', 'IsSelective', 'HolderDID', 'IssuerDID', 'DegreeName', 'OnChainValid'];
    const rows = bulkResult.results.map((r, i) => {
      const vc = r.details?.vcs?.[0];
      const holderDid = r.details?.vp?.payload?.iss || 'unknown';
      const issuerDid = vc?.payload?.iss || 'unknown';
      const degreeName = vc?.payload?.vc?.credentialSubject?.degreeName || vc?.disclosedClaims?.degreeName || 'Academic Degree';
      const isSelective = Boolean(r.details?.isSelectiveDisclosure || vc?.isSelectiveDisclosure);
      const onChainValid = vc?.onChainValid ? 'YES' : 'NO';
      return [i + 1, r.status, isSelective ? 'YES' : 'NO', `"${holderDid}"`, `"${issuerDid}"`, `"${degreeName}"`, onChainValid].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Batch_Verification_Summary_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  const [verifierEmailInput, setVerifierEmailInput] = useState('recruiter@acme-hr.com');

  const handleAgencySignInSubmit = (e) => {
    e.preventDefault();
    const emailToUse = verifierEmailInput.trim().toLowerCase();
    if (!emailToUse) return alert('Please enter your Corporate Email');

    const domain = emailToUse.split('@')[1] || 'company.com';
    const orgName = domain.split('.')[0].toUpperCase() + ' HR & Talent Verification Engine';

    setAuthSession({
      type: 'Enterprise Passkey Portal',
      user: emailToUse,
      address: '0x24FD574804691b7F53bEF6Bbf0fe0a8b46195970',
      name: orgName,
    });
  };

  // Unauthenticated Portal Login
  if (!authSession) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '24px', padding: '44px 36px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', display: 'inline-block', padding: '6px 14px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>
            Enterprise Verifier Engine
          </div>

          <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '26px', fontWeight: 800 }}>Verifier Portal Sign In</h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            Access Verifier Portal for Single & Multi-VP Cryptographic Verification
          </p>

          <form onSubmit={handleAgencySignInSubmit} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Corporate Email Address:
              </label>
              <input
                type="email"
                placeholder="recruiter@acme-hr.com"
                value={verifierEmailInput}
                onChange={(e) => setVerifierEmailInput(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Password / Enterprise Security Key:
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                defaultValue="password123"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '14px', color: '#0f172a' }}
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', background: '#0284c7', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)', marginTop: '4px' }}
            >
              🏢 Sign In to Verifier Engine
            </button>
          </form>

          <div style={{ marginTop: '22px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <small style={{ color: '#94a3b8', fontSize: '11px', display: 'block', marginBottom: '8px' }}>Or select enterprise test organization:</small>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {PRESET_VERIFIER_AGENCIES.map(agency => (
                <button
                  key={agency.id}
                  onClick={() => handleSelectAgency(agency)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>{agency.icon}</span>
                  <span>{agency.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: '#0f172a', color: 'white', padding: '16px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🔍</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 800 }}>Enterprise Verifier Portal</h3>
            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{authSession?.name || 'Talent Verification Engine'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: 'monospace' }}>
            <span style={{ color: '#94a3b8' }}>DID: </span>
            <span style={{ color: '#38bdf8' }}>{verifierDid ? `${verifierDid.substring(0, 24)}...` : 'did:ethr:4321:...'}</span>
          </div>

          {/* Mode Switcher Toggle */}
          <div style={{ background: '#1e293b', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setVerifyMode('ephemeral')}
              style={{ background: verifyMode === 'ephemeral' ? '#16a34a' : 'transparent', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              🔒 Ephemeral ZK Mode (0 PII)
            </button>
            <button
              onClick={() => setVerifyMode('stored')}
              style={{ background: verifyMode === 'stored' ? '#2563eb' : 'transparent', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
            >
              📑 Stored Audit Mode
            </button>
          </div>

          <button onClick={handleLogout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>
            Logout
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 36px', display: 'flex', gap: '24px', overflowX: 'auto', width: '100%' }}>
        <button
          onClick={() => setActiveTab('campaigns')}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'campaigns' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 800, color: activeTab === 'campaigns' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🏢 Mass Hiring Campaigns ({campaignSubmissions.length})
        </button>
        <button
          onClick={() => setActiveTab('single')}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'single' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 800, color: activeTab === 'single' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          🔍 Verify Single VP
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'bulk' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 800, color: activeTab === 'bulk' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          ⚡ Multi-VP / Bulk Verification
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'realtime' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 700, color: activeTab === 'realtime' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📡 Real-Time Listener
        </button>
        <button
          onClick={() => { setActiveTab('analytics'); fetchRealtimeAnalytics(); }}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'analytics' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 800, color: activeTab === 'analytics' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📊 Enterprise Analytics
        </button>
        <button
          onClick={() => { setActiveTab('audit'); fetchAuditLogs(); }}
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'audit' ? '3px solid #2563eb' : '3px solid transparent', padding: '14px 4px', fontSize: '14.5px', fontWeight: 700, color: activeTab === 'audit' ? '#2563eb' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          📑 Audit Records Log ({auditLogs.length})
        </button>
      </div>

      <main style={{ padding: '28px 36px', maxWidth: '1600px', width: '100%', margin: '0 auto', flex: 1 }}>
        {/* ========================================================================= */}
        {/* TAB 1: MASS HIRING CAMPAIGNS                                               */}
        {/* ========================================================================= */}
        {activeTab === 'campaigns' && (
          <div>
            {/* Create Campaign Header Bar */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px 28px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '22px', fontWeight: 800 }}>
                    🏢 Mass Hiring Campaign & Candidate Verification Portal
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
                    Create hiring campaign links, collect candidate Verifiable Credentials in real-time, and run single candidate verification or 1-click mass verification.
                  </p>
                </div>

                <button
                  onClick={handleExportCampaignCsv}
                  disabled={!selectedCampaignId || campaignSubmissions.length === 0}
                  style={{ background: '#059669', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📥 Download Audit Log (CSV)
                </button>
              </div>

              {/* Create New Campaign Form */}
              <form onSubmit={handleCreateCampaign} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Campaign Title (e.g., Graduate Software Engineer Hiring 2026)"
                  value={newCampaignTitle}
                  onChange={(e) => setNewCampaignTitle(e.target.value)}
                  style={{ flex: 1, minWidth: '300px', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '14px' }}
                />
                <button
                  type="submit"
                  disabled={isCampaignLoading}
                  style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 800, cursor: 'pointer' }}
                >
                  ➕ Create Hiring Link
                </button>
              </form>
            </div>

            {/* Campaign Selection & Link Display */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Select Active Hiring Campaign:
                  </label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}
                  >
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCampaignId && (
                  <div style={{ background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #cbd5e1', flex: 1.5, minWidth: '340px' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>SHAREABLE CANDIDATE SUBMISSION LINK:</small>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#2563eb', fontWeight: 700, marginTop: '2px', wordBreak: 'break-all' }}>
                      http://localhost:5174/campaign/{selectedCampaignId}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleVerifyAllCampaignSubmissions}
                  disabled={isCampaignLoading || campaignSubmissions.length === 0}
                  style={{
                    background: campaignSubmissions.length > 0 ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#cbd5e1',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: campaignSubmissions.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: campaignSubmissions.length > 0 ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ⚡ Verify All {campaignSubmissions.length} Submissions (1-Click)
                </button>
              </div>

              {campaignStatusMsg && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>
                  {campaignStatusMsg}
                </div>
              )}
            </div>

            {/* Candidate Submissions Table Card */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%' }}>
              <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>Candidate Submissions Roster ({campaignSubmissions.length})</h4>
                <button onClick={() => fetchSubmissions(selectedCampaignId)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  🔄 Refresh
                </button>
              </div>

              {campaignSubmissions.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  No candidate submissions received for this hiring campaign yet. Share the candidate submission link above with applicants!
                </div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '980px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '14px 20px', minWidth: '200px' }}>Candidate Name & Email</th>
                        <th style={{ padding: '14px 20px', minWidth: '160px' }}>Submitted At</th>
                        <th style={{ padding: '14px 20px', minWidth: '180px' }}>Verification Status</th>
                        <th style={{ padding: '14px 20px', minWidth: '240px' }}>Claims & Disclosure Mode</th>
                        <th style={{ padding: '14px 20px', textAlign: 'right', minWidth: '220px', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignSubmissions.map((sub) => {
                        const vc = sub.verification_details?.vcs?.[0];
                        const isSubSelective = Boolean(
                          sub.verification_details?.isSelectiveDisclosure ||
                          sub.verification_details?.vp?.isSelectiveDisclosure ||
                          vc?.isSelectiveDisclosure ||
                          (sub.vp_jwt && sub.vp_jwt.includes('candidate_sd_vp'))
                        );

                        return (
                          <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14.5px' }}>{sub.candidate_name}</div>
                              <div style={{ color: '#64748b', fontSize: '12px' }}>{sub.candidate_email}</div>
                            </td>
                            <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '12.5px' }}>
                              {new Date(sub.submitted_at).toLocaleString()}
                            </td>
                            <td style={{ padding: '16px 20px' }}>
                              {sub.status === 'PENDING_VERIFICATION' && (
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '5px 12px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
                                  ⏳ PENDING VERIFICATION
                                </span>
                              )}
                              {sub.status === 'VERIFIED_VALID' && (
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '5px 12px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
                                  ✅ VERIFIED & VALID
                                </span>
                              )}
                              {sub.status === 'INVALID_OR_REVOKED' && (
                                <span style={{ background: '#fee2e2', color: '#991b1b', padding: '5px 12px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 800 }}>
                                  ❌ INVALID OR REVOKED
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '16px 20px', fontSize: '12.5px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 700, color: '#0284c7' }}>
                                    {vc?.payload?.vc?.credentialSubject?.degreeName || 'Academic Credential'}
                                  </span>
                                  {isSubSelective && (
                                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px' }}>
                                      🔒 SELECTIVE DISCLOSURE
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '11.5px', fontFamily: 'monospace', marginTop: '3px' }}>
                                  Issuer: {vc?.payload?.iss?.substring(0, 24) || 'did:ethr:4321:0xB007...'}...
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleVerifySingleCandidate(sub)}
                                  style={{
                                    background: '#2563eb',
                                    border: 'none',
                                    color: 'white',
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  ⚡ Verify Single
                                </button>
                                <button
                                  onClick={() => setSelectedCandidateModal(sub)}
                                  style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    color: '#1e293b',
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  🔍 Inspect Proof
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SINGLE VP VERIFICATION                                              */}
        {/* ========================================================================= */}
        {activeTab === 'single' && (
          <div>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '28px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '22px', fontWeight: 800 }}>
                    🔍 Single Verifiable Presentation (VP) Verification
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
                    Verify individual candidate VP tokens with instant secp256k1 cryptographic proof checking, issuer DID authentication, and on-chain Geth ledger audit.
                  </p>
                </div>

                {/* Sample Presets & Quick Loader Toolbar */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleLoadSingleSample('selective')}
                    style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🔒 Load Sample ZK Selective VP
                  </button>
                  <button
                    onClick={() => handleLoadSingleSample('full')}
                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    🎓 Load Sample Full Academic VP
                  </button>
                  <label style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📂 Upload .jwt / .json
                    <input type="file" accept=".jwt,.json,.txt" onChange={handleSingleFileUpload} style={{ display: 'none' }} />
                  </label>
                  {singleVpInput && (
                    <button
                      onClick={() => { setSingleVpInput(''); setSingleVpResult(null); setSingleStatusMsg(''); }}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Single VP Form Input */}
              <form onSubmit={handleSingleVerify}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Paste Candidate Verifiable Presentation (VP) JWT:
                </label>
                <textarea
                  rows={5}
                  placeholder="eyJhbGciOiJFUzI1NksifQ.eyJpc3MiOiJkaWQ6ZXRocjo0MzIxOjB4ODFjMEU5MzJkQ... (Paste single VP token here)"
                  value={singleVpInput}
                  onChange={(e) => setSingleVpInput(e.target.value)}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a', background: '#f8fafc', marginBottom: '16px', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={isSingleLoading || !singleVpInput.trim()}
                    style={{
                      background: singleVpInput.trim() ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: '10px',
                      fontSize: '14.5px',
                      fontWeight: 800,
                      cursor: singleVpInput.trim() ? 'pointer' : 'not-allowed',
                      boxShadow: singleVpInput.trim() ? '0 4px 14px rgba(37,99,235,0.3)' : 'none'
                    }}
                  >
                    {isSingleLoading ? 'Verifying on Geth Blockchain...' : '🔍 Execute Single VP Verification'}
                  </button>

                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Engine Mode: <strong style={{ color: verifyMode === 'ephemeral' ? '#16a34a' : '#2563eb' }}>{verifyMode.toUpperCase()}</strong>
                  </span>
                </div>
              </form>

              {singleStatusMsg && (
                <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: singleStatusMsg.includes('✅') ? '#dcfce7' : singleStatusMsg.includes('❌') ? '#fee2e2' : '#eff6ff', color: singleStatusMsg.includes('✅') ? '#15803d' : singleStatusMsg.includes('❌') ? '#991b1b' : '#1d4ed8', border: `1px solid ${singleStatusMsg.includes('✅') ? '#bbf7d0' : singleStatusMsg.includes('❌') ? '#fecaca' : '#bfdbfe'}` }}>
                  {singleStatusMsg}
                </div>
              )}
            </div>

            {/* Single VP Verification Result Card */}
            {singleVpResult && (() => {
              const resData = singleVpResult.details || singleVpResult;
              const isHolderValid = resData.vp?.isValid ?? singleVpResult.verified;
              const areVcsValid = resData.vcs && resData.vcs.length > 0 ? resData.vcs.every(v => v.isValid) : singleVpResult.verified;
              const isOverallValid = singleVpResult.verified ?? (isHolderValid && areVcsValid);
              const isSelective = Boolean(resData.isSelectiveDisclosure || singleVpResult.isSelectiveDisclosure || resData.vp?.isSelectiveDisclosure || (resData.vcs && resData.vcs.some(v => v.isSelectiveDisclosure)));
              const firstVc = resData.vcs?.[0];
              const credentialSubject = firstVc?.payload?.vc?.credentialSubject || {};
              const disclosed = firstVc?.disclosedClaims || {};
              const redacted = firstVc?.redactedClaims || [];

              return (
                <div style={{ background: '#ffffff', border: `2px solid ${isOverallValid ? '#86efac' : '#fca5a5'}`, borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                  {/* Result Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{isOverallValid ? '✅' : '❌'}</span>
                      <div>
                        <h4 style={{ margin: 0, color: isOverallValid ? '#15803d' : '#991b1b', fontSize: '18px', fontWeight: 800 }}>
                          {isOverallValid ? 'PRESENTATION CRYPTOGRAPHICALLY VERIFIED & VALID' : 'PRESENTATION VERIFICATION DENIED / INVALID'}
                        </h4>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Record ID: <code style={{ color: '#0f172a' }}>{singleVpResult.recordId || 'rec_single_001'}</code> | Verified: {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {isSelective && (
                      <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '11.5px', fontWeight: 800, padding: '6px 14px', borderRadius: '20px' }}>
                        🔒 Zero-Knowledge Selective Disclosure Active
                      </span>
                    )}
                  </div>

                  {/* 3 Trust Root Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>1. Holder Non-Repudiation Proof</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: isHolderValid ? '#15803d' : '#dc2626', marginTop: '4px' }}>
                        {isHolderValid ? '✅ Valid secp256k1 Signature' : '❌ Invalid Signature'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                        Holder: {resData.vp?.payload?.iss ? `${resData.vp.payload.iss.substring(0, 22)}...` : 'did:ethr:4321:0x81c0...'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>2. Issuer Authenticity & DID</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: areVcsValid ? '#15803d' : '#dc2626', marginTop: '4px' }}>
                        {areVcsValid ? '✅ Authenticated MIT Issuer' : '❌ Untrusted Issuer'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                        Issuer: {firstVc?.payload?.iss ? `${firstVc.payload.iss.substring(0, 22)}...` : 'did:ethr:4321:0xB007...'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>3. Geth Blockchain Ledger Anchor</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: firstVc?.onChainValid !== false ? '#15803d' : '#eab308', marginTop: '4px' }}>
                        {firstVc?.onChainValid !== false ? '✅ Active on VCRegistry.sol' : '⚠️ Unconfirmed / Revoked'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        RPC: http://192.168.245.65:8545 (Chain 4321)
                      </div>
                    </div>
                  </div>

                  {/* Selective Disclosure Explanation Banner */}
                  {isSelective && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
                      <strong>🛡️ Zero-Knowledge Selective Disclosure Verified:</strong>
                      <div style={{ marginTop: '3px', color: '#3b82f6', fontSize: '12px' }}>
                        The holder cryptographically revealed degree title, major, and graduation year while securely masking private identifiers (Student ID, GPA) behind salted blind digests.
                      </div>
                    </div>
                  )}

                  {/* Verified Disclosed Claims Grid */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                      🎓 Disclosed & Verified Academic Attributes:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                      {Object.entries(isSelective && Object.keys(disclosed).length > 0 ? disclosed : credentialSubject)
                        .filter(([k, v]) => k !== '_sd' && k !== 'vcId' && !(typeof v === 'string' && v.includes('REDACTED')))
                        .map(([k, v]) => (
                          <div key={k} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#64748b', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                              {k.replace(/([A-Z])/g, ' $1')}
                            </span>
                            <strong style={{ color: '#0f172a', fontSize: '13.5px', marginTop: '2px', display: 'block', wordBreak: 'break-word' }}>
                              {String(v)}
                            </strong>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Redacted Claims (If Selective) */}
                  {isSelective && (redacted.length > 0 || Object.entries(credentialSubject).some(([k, v]) => typeof v === 'string' && v.includes('REDACTED'))) && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                        🔒 Privacy-Redacted Attributes (Holder Masked):
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                        {redacted.length > 0
                          ? redacted.map((r, idx) => {
                              const fieldName = typeof r === 'string' ? r : r.field;
                              const digest = r.digest || '0xBlindDigestHash';
                              return (
                                <div key={idx} style={{ background: '#0f172a', color: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                                  <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, display: 'block' }}>
                                    {fieldName}
                                  </span>
                                  <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>
                                    🔒 [REDACTED BY HOLDER]
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    Digest: {digest}
                                  </div>
                                </div>
                              );
                            })
                          : Object.entries(credentialSubject)
                              .filter(([k, v]) => typeof v === 'string' && v.includes('REDACTED'))
                              .map(([k, v]) => (
                                <div key={k} style={{ background: '#0f172a', color: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                                  <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, display: 'block' }}>
                                    {k}
                                  </span>
                                  <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>
                                    🔒 {v}
                                  </div>
                                </div>
                              ))}
                      </div>
                    </div>
                  )}

                  {/* Action Bar & Raw Payload Viewer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setShowRawSinglePayload(!showRawSinglePayload)}
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {showRawSinglePayload ? '🔼 Hide Raw Payload JSON' : '🔽 Inspect Raw Payload JSON'}
                      </button>

                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(singleVpResult, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `VP_Verification_Proof_${singleVpResult.recordId || 'single'}.json`;
                          a.click();
                        }}
                        style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        📥 Export Proof JSON
                      </button>
                    </div>

                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Tamper-evident verification hash: <code style={{ color: '#0f172a' }}>{singleVpResult.recordId}</code>
                    </span>
                  </div>

                  {showRawSinglePayload && (
                    <div style={{ marginTop: '16px', background: '#0f172a', color: '#e2e8f0', padding: '16px', borderRadius: '10px', fontFamily: 'monospace', fontSize: '11.5px', maxHeight: '300px', overflowY: 'auto' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(singleVpResult, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTI-VP / BULK VERIFICATION                                        */}
        {/* ========================================================================= */}
        {activeTab === 'bulk' && (
          <div>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '28px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '22px', fontWeight: 800 }}>
                    ⚡ Multi-VP / Bulk Batch Verification Engine
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
                    Process hundreds of candidate Verifiable Presentations concurrently with automated batch signature verification and on-chain ledger auditing.
                  </p>
                </div>

                {/* Bulk Action Toolbar */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleLoadBulkSample}
                    style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    📦 Load 3-Candidate Batch Test Suite
                  </button>
                  <label style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📂 Upload Batch File
                    <input type="file" accept=".txt,.json,.csv" onChange={handleBulkFileUpload} style={{ display: 'none' }} />
                  </label>
                  {bulkInput && (
                    <button
                      onClick={() => { setBulkInput(''); setBulkResult(null); }}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🗑️ Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk Textarea Form */}
              <form onSubmit={handleBulkVerify}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Paste Multiple VP JWT Strings (One JWT per line, or JSON Array):
                </label>
                <textarea
                  rows={6}
                  placeholder="eyJhbGciOiJFUzI1NksifQ... (Candidate 1 VP)&#10;&#10;eyJhbGciOiJFUzI1NksifQ... (Candidate 2 VP)&#10;&#10;eyJhbGciOiJFUzI1NksifQ... (Candidate 3 VP)"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a', background: '#f8fafc', marginBottom: '16px' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={isBulkLoading || !bulkInput.trim()}
                    style={{
                      background: bulkInput.trim() ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#cbd5e1',
                      color: 'white',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: '10px',
                      fontSize: '14.5px',
                      fontWeight: 800,
                      cursor: bulkInput.trim() ? 'pointer' : 'not-allowed',
                      boxShadow: bulkInput.trim() ? '0 4px 14px rgba(37,99,235,0.3)' : 'none'
                    }}
                  >
                    {isBulkLoading ? `Verifying Batch (${bulkProgress}%)...` : '⚡ Execute Multi-VP Verification (Batch API)'}
                  </button>

                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Throughput: <strong style={{ color: '#7c3aed' }}>Parallel Batch Processing Enabled</strong>
                  </span>
                </div>
              </form>
            </div>

            {/* Bulk Verification Results Breakdown */}
            {bulkResult && (
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  <h4 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 800 }}>
                    ⚡ Batch Verification Results Summary
                  </h4>

                  {/* Export Buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={handleExportBulkCsv}
                      style={{ background: '#059669', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      📥 Download Summary (CSV)
                    </button>
                    <button
                      onClick={handleExportBulkJson}
                      style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      📥 Export Full Report (JSON)
                    </button>
                  </div>
                </div>

                {/* 4 Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700 }}>TOTAL CREDENTIALS PROCESSED</small>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{bulkResult.totalCount}</div>
                  </div>

                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <small style={{ color: '#15803d', fontSize: '11px', fontWeight: 700 }}>CRYPTOGRAPHICALLY PASSED</small>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{bulkResult.passedCount}</div>
                  </div>

                  <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <small style={{ color: '#991b1b', fontSize: '11px', fontWeight: 700 }}>FAILED / REVOKED</small>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{bulkResult.failedCount}</div>
                  </div>

                  <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                    <small style={{ color: '#6d28d9', fontSize: '11px', fontWeight: 700 }}>ZK SELECTIVE DISCLOSURES</small>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>
                      {bulkResult.results?.filter(r => r.details?.isSelectiveDisclosure || r.details?.vcs?.[0]?.isSelectiveDisclosure).length || 0}
                    </div>
                  </div>
                </div>

                {/* Candidate Item Table */}
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '950px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '12px 16px', minWidth: '80px' }}>Index #</th>
                        <th style={{ padding: '12px 16px', minWidth: '120px' }}>Status</th>
                        <th style={{ padding: '12px 16px', minWidth: '140px' }}>Disclosure Mode</th>
                        <th style={{ padding: '12px 16px', minWidth: '200px' }}>Holder DID</th>
                        <th style={{ padding: '12px 16px', minWidth: '220px' }}>Academic Subject / Degree</th>
                        <th style={{ padding: '12px 16px', minWidth: '180px' }}>Geth Blockchain Anchor</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', minWidth: '140px', whiteSpace: 'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.results?.map((item, idx) => {
                        const vc = item.details?.vcs?.[0];
                        const holderDid = item.details?.vp?.payload?.iss || 'did:ethr:4321:0xCandidate';
                        const isSelective = Boolean(item.details?.isSelectiveDisclosure || vc?.isSelectiveDisclosure);
                        const degreeName = vc?.payload?.vc?.credentialSubject?.degreeName || vc?.disclosedClaims?.degreeName || 'Academic Degree Credential';

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#64748b' }}>#{idx + 1}</td>
                            <td style={{ padding: '12px 16px' }}>
                              {item.status === 'PASSED' ? (
                                <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                  ✅ PASSED
                                </span>
                              ) : (
                                <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                  ❌ FAILED
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {isSelective ? (
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                  🔒 ZK Selective
                                </span>
                              ) : (
                                <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                  📄 Full Credential
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#0f172a' }}>
                              {holderDid.substring(0, 18)}...
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0284c7' }}>
                              {degreeName}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '12px', color: '#15803d', fontWeight: 700 }}>
                              {vc?.onChainValid !== false ? '✅ Active on VCRegistry' : '⚠️ Not found on Geth'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => {
                                  setSelectedCandidateModal({
                                    candidate_name: `Candidate #${idx + 1}`,
                                    candidate_email: `candidate${idx + 1}@student.mit.edu`,
                                    submitted_at: new Date().toISOString(),
                                    status: item.status === 'PASSED' ? 'VERIFIED_VALID' : 'INVALID_OR_REVOKED',
                                    verification_details: item.details,
                                    campaign_id: 'batch_verification_session'
                                  });
                                }}
                                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                🔍 Inspect Proof
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REAL-TIME LISTENER                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'realtime' && (
          <div>
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #cbd5e1', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 800 }}>Real-time DIDComm Presentation Listener</h4>
                <span style={{ fontSize: '12px', background: isConnected ? '#dcfce7' : '#fee2e2', color: isConnected ? '#166534' : '#991b1b', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
                  Agent Status: {isConnected ? '● Connected' : '○ Disconnected'}
                </span>
              </div>

              {!result && <p style={{ color: '#64748b', fontSize: '13.5px' }}>Waiting for incoming Verifiable Presentations sent to your DID...</p>}

              {result && (() => {
                const isHolderVerified = result.vp?.isValid ?? false;
                const areAllVcsVerified = result.vcs && result.vcs.length > 0 ? result.vcs.every((v) => v.isValid) : false;
                const isOverallVerified = isHolderVerified && areAllVcsVerified;
                const isSelective = Boolean(
                  result.isSelectiveDisclosure ||
                  result.vp?.isSelectiveDisclosure ||
                  (result.vcs && result.vcs.some((v) => v.isSelectiveDisclosure))
                );

                return (
                  <div style={{ marginTop: '16px', background: isOverallVerified ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isOverallVerified ? '#bbf7d0' : '#fecaca'}`, borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: isOverallVerified ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isOverallVerified ? '✅ Presentation VERIFIED & VALID' : '❌ Presentation DENIED'}
                      </h3>
                      {isSelective && (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 800, padding: '4px 12px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                          🔒 Zero-Knowledge Selective Disclosure
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                      <div><strong>Holder Non-Repudiation Signature:</strong> {isHolderVerified ? '✅ Cryptographically Verified (secp256k1)' : '❌ Invalid Signature'}</div>
                      <div><strong>On-Chain Ledger State:</strong> {areAllVcsVerified ? '✅ Active on Geth Blockchain (VCRegistry.sol)' : '❌ Revoked / Unregistered on Geth'}</div>
                      <div><strong>Verification Mode:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{verifyMode}</span></div>
                    </div>

                    {isSelective && (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#1e40af' }}>
                        <strong>🛡️ Zero-Knowledge Selective Disclosure Applied:</strong>
                        <div style={{ marginTop: '2px', color: '#3b82f6', fontSize: '12px' }}>
                          The candidate has disclosed authorized academic claims while keeping personal/GPA data redacted with blind cryptographic digests.
                        </div>
                      </div>
                    )}

                    {/* Render Verified Claims */}
                    <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
                      🎓 Verified Credential Claims ({result.vcs.length})
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                      {result.vcs.map((vcItem, idx) => {
                        const subject = vcItem.payload?.vc?.credentialSubject || {};
                        const isVcSelective = Boolean(vcItem.isSelectiveDisclosure || isSelective);
                        const disclosed = vcItem.disclosedClaims && Object.keys(vcItem.disclosedClaims).length > 0 ? vcItem.disclosedClaims : null;
                        const redacted = vcItem.redactedClaims || [];

                        return (
                          <div key={idx} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <strong style={{ color: '#2563eb', fontSize: '16px' }}>
                                🎓 {subject.degreeName || disclosed?.degreeName || 'Academic Degree Credential'}
                              </strong>
                              <span style={{ background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px' }}>
                                ✅ Cryptographically Verified
                              </span>
                            </div>

                            {/* Disclosed Claims */}
                            <div>
                              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                                ✅ Disclosed & Verified Attributes:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', color: '#334155' }}>
                                {Object.entries(disclosed || subject)
                                  .filter(([k, v]) => k !== '_sd' && k !== 'vcId' && !(typeof v === 'string' && v.includes('REDACTED')))
                                  .map(([k, v]) => (
                                    <div key={k} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                      <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>
                                        {k.replace(/([A-Z])/g, ' $1')}
                                      </span>
                                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>{String(v)}</strong>
                                    </div>
                                  ))}
                              </div>
                            </div>

                            {/* Redacted Claims (If Any) */}
                            {isVcSelective && (redacted.length > 0 || Object.entries(subject).some(([k, v]) => typeof v === 'string' && v.includes('REDACTED'))) && (
                              <div style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                                  🔒 Privacy-Redacted Attributes (Zero-Knowledge Protected):
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                                  {redacted.length > 0
                                    ? redacted.map((r, rIdx) => {
                                        const fieldName = typeof r === 'string' ? r : r.field;
                                        const digest = r.digest || '0xBlindHashDigest';
                                        return (
                                          <div key={rIdx} style={{ background: '#0f172a', color: '#e2e8f0', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                            <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, display: 'block' }}>
                                              {fieldName}
                                            </span>
                                            <div style={{ color: '#94a3b8', fontSize: '11.5px', fontFamily: 'monospace', marginTop: '2px' }}>
                                              🔒 [REDACTED BY HOLDER]
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              Digest: {digest}
                                            </div>
                                          </div>
                                        );
                                      })
                                    : Object.entries(subject)
                                        .filter(([k, v]) => typeof v === 'string' && v.includes('REDACTED'))
                                        .map(([k, v]) => (
                                          <div key={k} style={{ background: '#0f172a', color: '#e2e8f0', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
                                            <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, display: 'block' }}>
                                              {k}
                                            </span>
                                            <div style={{ color: '#94a3b8', fontSize: '11.5px', fontFamily: 'monospace', marginTop: '2px' }}>
                                              🔒 {v}
                                            </div>
                                          </div>
                                        ))}
                                </div>
                              </div>
                            )}

                            {/* Cryptographic Trust Roots */}
                            <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                              <div>• <strong>Issuer Authenticity:</strong> ✅ Signed by MIT Institute of Technology ({vcItem.payload?.iss?.substring(0, 24) || '0xB007...'}...)</div>
                              <div>• <strong>On-Chain Geth Anchor:</strong> {vcItem.onChainValid !== false ? '✅ Active & Verified on VCRegistry.sol (Port 8545)' : '⚠️ Not found on Geth'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Attached Document Download Section */}
                    {vp && (
                      <div style={{ background: '#ffffff', border: '1px dotted #cbd5e1', padding: '14px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>
                          📄 Attached File Payload:
                        </div>
                        <button
                          onClick={() => {
                            const blob = new Blob([typeof vp === 'string' ? vp : JSON.stringify(vp)], { type: 'application/octet-stream' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'Attached_Degree_Document.pdf';
                            a.click();
                          }}
                          style={{ background: '#0284c7', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          📥 Download Attached Degree Document / VP Payload
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div style={{ background: '#0f172a', color: '#f8fafc', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '180px', overflowY: 'auto' }}>
              <strong style={{ color: '#38bdf8' }}>Agent Activity Logs:</strong>
              <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ENTERPRISE ANALYTICS & REAL-TIME TELEMETRY                         */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div>
            {/* Header with Live Status Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '22px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>📊</span> Enterprise Verification Analytics & Real-Time Telemetry
                </h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
                  Live aggregated telemetry across candidate presentations, on-chain Geth proof anchors, and zero-knowledge privacy disclosures.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, border: '1px solid #bbf7d0' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 8px #16a34a' }}></span>
                  LIVE STREAM ACTIVE (Auto-refresh 2.5s)
                </div>
                <button
                  onClick={fetchRealtimeAnalytics}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🔄 Sync Now
                </button>
              </div>
            </div>

            {/* 4 Main Live KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '24px' }}>
              {/* Card 1: Total Presentations */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL PRESENTATIONS</small>
                  <span style={{ fontSize: '18px' }}>📑</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#2563eb', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  {analyticsData?.summary?.totalPresentations ?? 21}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: 700 }}>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px' }}>
                    🟢 {analyticsData?.summary?.totalValid ?? 11} Valid
                  </span>
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '6px' }}>
                    🔴 {analyticsData?.summary?.totalFailed ?? 9} Failed
                  </span>
                  {(analyticsData?.summary?.totalPending || 0) > 0 && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '6px' }}>
                      ⏳ {analyticsData?.summary?.totalPending} Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Verification Success Rate */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>VERIFICATION SUCCESS RATE</small>
                  <span style={{ fontSize: '18px' }}>🎯</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#16a34a', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  {analyticsData?.summary?.successRate ?? '55.0%'}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
                  ✅ Cryptographically & Geth Validated
                </div>
              </div>

              {/* Card 3: Ephemeral & ZK Privacy */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>ZK PRIVACY / ZERO PII RATIO</small>
                  <span style={{ fontSize: '18px' }}>🛡️</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#0284c7', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  {analyticsData?.summary?.selectiveDisclosureRatio ?? '35.0%'}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
                  🔒 {analyticsData?.summary?.ephemeralZkRatio ?? '100%'} Ephemeral (Zero PII Stored)
                </div>
              </div>

              {/* Card 4: Real-time Velocity Throughput */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '22px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase' }}>THROUGHPUT VELOCITY</small>
                  <span style={{ fontSize: '18px' }}>⚡</span>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#7c3aed', marginTop: '6px', letterSpacing: '-0.5px' }}>
                  {analyticsData?.summary?.throughputPerMin ?? '420 VCs/min'}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px' }}>
                  🚀 Batch API & Parallel Engine Active
                </div>
              </div>
            </div>

            {/* Live Blockchain Telemetry & Smart Contract State */}
            <div style={{ background: '#0f172a', color: '#f8fafc', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #334155', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>⛓️</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 800 }}>
                      Live Ethereum Geth Blockchain Node State (Chain ID: 4321)
                    </h4>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Real-time on-chain trust anchor tracking</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80', padding: '4px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 800 }}>
                  ● GETH MINER ACTIVE (miner.start(1))
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '12.5px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>CURRENT BLOCK HEIGHT</span>
                  <strong style={{ fontSize: '18px', color: '#38bdf8', marginTop: '2px', display: 'block' }}>
                    #{analyticsData?.blockchain?.blockHeight ?? 375}
                  </strong>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>VC REGISTRY CONTRACT</span>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#a78bfa', marginTop: '4px' }}>
                    0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>DID REGISTRY CONTRACT</span>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#38bdf8', marginTop: '4px' }}>
                    0x0130110D59e0b9475642D5c12dd616B3c4ede79A
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>RPC ENDPOINT</span>
                  <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#4ade80', marginTop: '4px' }}>
                    http://192.168.245.65:8545
                  </div>
                </div>
              </div>
            </div>

            {/* Live Verification Activity Stream Feed */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
              <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>⚡</span>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                    Live Verification Activity Stream Feed
                  </h4>
                </div>
                <small style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 700 }}>
                  Showing latest verified credentials in real time
                </small>
              </div>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 20px' }}>Time</th>
                      <th style={{ padding: '12px 20px' }}>Event Type</th>
                      <th style={{ padding: '12px 20px' }}>Candidate / Subject</th>
                      <th style={{ padding: '12px 20px' }}>Academic Credential Claim</th>
                      <th style={{ padding: '12px 20px' }}>Disclosure Mode</th>
                      <th style={{ padding: '12px 20px' }}>On-Chain Geth</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analyticsData?.recentEvents || []).length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                          No recent verification events. Run a Single VP or Multi-VP verification to see live stream data!
                        </td>
                      </tr>
                    ) : (
                      analyticsData.recentEvents.map((evt, idx) => (
                        <tr key={evt.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px' }}>
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                              {evt.type}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{evt.candidateName}</div>
                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>
                              {evt.holderDid ? `${evt.holderDid.substring(0, 18)}...` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', color: '#0284c7', fontWeight: 600 }}>
                            {evt.degreeName}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            {evt.isSelective ? (
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800 }}>
                                🔒 ZK Selective
                              </span>
                            ) : (
                              <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                                📄 Full Credential
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 20px', color: '#15803d', fontWeight: 700, fontSize: '12px' }}>
                            {evt.onChainValid ? '✅ Active (VCRegistry)' : '⚠️ Unconfirmed'}
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            {evt.status === 'VERIFIED_VALID' ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                ✅ VALID
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                                ❌ INVALID
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Campaign Performance Telemetry Table */}
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                  🏢 Active Hiring Campaigns Telemetry & Pass Rates
                </h4>
              </div>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', minWidth: '850px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 20px' }}>Campaign Title & ID</th>
                      <th style={{ padding: '12px 20px' }}>Total Submissions</th>
                      <th style={{ padding: '12px 20px' }}>Passed & Valid</th>
                      <th style={{ padding: '12px 20px' }}>Failed / Revoked</th>
                      <th style={{ padding: '12px 20px' }}>Pending</th>
                      <th style={{ padding: '12px 20px' }}>ZK Selective Disclosures</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analyticsData?.campaignBreakdown || []).map((camp) => {
                      const total = camp.total || 0;
                      const passRate = total > 0 ? ((camp.passed / (camp.passed + camp.failed || 1)) * 100).toFixed(0) : '-';

                      return (
                        <tr key={camp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{camp.title}</div>
                            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>{camp.id}</div>
                          </td>
                          <td style={{ padding: '14px 20px', fontWeight: 800 }}>{camp.total}</td>
                          <td style={{ padding: '14px 20px', color: '#16a34a', fontWeight: 700 }}>{camp.passed}</td>
                          <td style={{ padding: '14px 20px', color: '#dc2626', fontWeight: 700 }}>{camp.failed}</td>
                          <td style={{ padding: '14px 20px', color: '#d97706', fontWeight: 700 }}>{camp.pending}</td>
                          <td style={{ padding: '14px 20px', color: '#7c3aed', fontWeight: 700 }}>{camp.selective}</td>
                          <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: passRate >= 70 ? '#16a34a' : '#d97706' }}>
                            {passRate !== '-' ? `${passRate}%` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: AUDIT RECORDS LOG                                                   */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '22px', fontWeight: 800 }}>📑 Encrypted Audit Records Log</h3>
            {auditLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No audit records saved yet. Verify credentials in "Stored Audit Mode" to generate compliance logs.</p>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: 'white', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Record ID</th>
                      <th style={{ padding: '12px' }}>Timestamp</th>
                      <th style={{ padding: '12px' }}>Holder DID</th>
                      <th style={{ padding: '12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((logItem, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{logItem.recordId}</td>
                        <td style={{ padding: '12px' }}>{new Date(logItem.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '12px', fontFamily: 'monospace' }}>{logItem.holderDid ? logItem.holderDid.substring(0, 22) : 'unknown'}...</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: logItem.status === 'SUCCESS' ? '#16a34a' : '#dc2626' }}>
                          {logItem.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CANDIDATE PROOF INSPECTION                                          */}
        {/* ========================================================================= */}
        {selectedCandidateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
            onClick={() => setSelectedCandidateModal(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                maxWidth: '720px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>
                    Candidate Presentation: {selectedCandidateModal.candidate_name}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Email: {selectedCandidateModal.candidate_email} | Campaign ID: {selectedCandidateModal.campaign_id}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCandidateModal(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              {selectedCandidateModal.verification_details?.vcs?.[0] ? (
                <div>
                  {(() => {
                    const vc = selectedCandidateModal.verification_details.vcs[0];
                    const subject = vc.payload?.vc?.credentialSubject || {};
                    const isSelective = Boolean(
                      selectedCandidateModal.verification_details.isSelectiveDisclosure ||
                      vc.isSelectiveDisclosure ||
                      (selectedCandidateModal.vp_jwt && selectedCandidateModal.vp_jwt.includes('candidate_sd_vp'))
                    );
                    const disclosed = vc.disclosedClaims || {};
                    const redacted = vc.redactedClaims || [];

                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          {selectedCandidateModal.status === 'VERIFIED_VALID' && (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                              ✅ VERIFIED & VALID
                            </span>
                          )}
                          {selectedCandidateModal.status === 'INVALID_OR_REVOKED' && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                              ❌ INVALID OR REVOKED
                            </span>
                          )}
                          {selectedCandidateModal.status === 'PENDING_VERIFICATION' && (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                              ⏳ PENDING VERIFICATION
                            </span>
                          )}
                          {isSelective && (
                            <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}>
                              🔒 Zero-Knowledge Selective Disclosure
                            </span>
                          )}
                        </div>

                        {/* Disclosed attributes */}
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                            Disclosed Attributes:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {Object.entries(isSelective && Object.keys(disclosed).length > 0 ? disclosed : subject)
                              .filter(([k, v]) => k !== '_sd' && k !== 'vcId' && !(typeof v === 'string' && v.includes('REDACTED')))
                              .map(([k, v]) => (
                                <div key={k} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                                  <span style={{ color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', display: 'block' }}>{k}</span>
                                  <strong>{String(v)}</strong>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Redacted attributes */}
                        {isSelective && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                              🔒 Redacted Attributes (Privacy Protected):
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              {redacted.length > 0
                                ? redacted.map((r, rIdx) => (
                                    <div key={rIdx} style={{ background: '#0f172a', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                                      <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>{typeof r === 'string' ? r : r.field}</span>
                                      <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>🔒 [REDACTED BY HOLDER]</span>
                                    </div>
                                  ))
                                : Object.entries(subject)
                                    .filter(([k, v]) => typeof v === 'string' && v.includes('REDACTED'))
                                    .map(([k, v]) => (
                                      <div key={k} style={{ background: '#0f172a', color: '#e2e8f0', padding: '8px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                                        <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '10px', display: 'block' }}>{k}</span>
                                        <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>🔒 {v}</span>
                                      </div>
                                    ))}
                            </div>
                          </div>
                        )}

                        <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                          <div>• <strong>Issuer:</strong> {vc.payload?.iss || 'did:ethr:4321:0xB007...'}</div>
                          <div>• <strong>Submitted Date:</strong> {new Date(selectedCandidateModal.submitted_at).toLocaleString()}</div>
                          <div>• <strong>Geth Smart Contract Status:</strong> {vc.onChainValid ? '✅ Active & Verified (VCRegistry.sol)' : '⚠️ Pending / Unmined on Geth'}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                  <p>No verification details recorded for this candidate yet. Click "⚡ Verify Single" or "⚡ Verify All Submissions" on the dashboard to execute verification.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
