import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ISSUER_API_URL = import.meta.env.VITE_ISSUER_API_URL || 'http://localhost:3000';

export default function ClaimPage({ userDid, onCredentialClaimed }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [claimData, setClaimData] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No claim token found in URL parameters.');
      setIsLoading(false);
      return;
    }

    fetch(`${ISSUER_API_URL}/api/issuer/claims/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setClaimData(data.claim);
        setStudentData(data.student);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleClaimCredential = async () => {
    if (!userDid) {
      return alert('Please log in or initialize your mobile wallet first.');
    }

    setIsLoading(true);
    try {
      const resp = await fetch(`${ISSUER_API_URL}/api/issuer/claims/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderDid: userDid })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Claim failed');

      setSuccessMsg('🎉 Credential successfully claimed and bound to your mobile wallet!');
      if (onCredentialClaimed) {
        onCredentialClaimed(data.vcJwt);
      }

      setTimeout(() => {
        navigate('/credentials');
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <h3>⌛ Loading Credential Claim Details...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '24px', borderRadius: '16px', border: '1px solid #fca5a5' }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Claim Error</h3>
          <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '24px', padding: '36px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ background: '#e0f2fe', color: '#0369a1', display: 'inline-block', padding: '6px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '16px' }}>
          🎓 Official Credential Offer
        </div>

        <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '24px', fontWeight: 800 }}>
          Academic Degree Credential Claim
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
          Issued by <strong>MIT Institute of Technology</strong> for student identity verification.
        </p>

        {studentData && (
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>STUDENT NAME</small>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{studentData.name}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>ROLL NUMBER</small>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>{studentData.roll_number}</div>
              </div>
              <div>
                <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>GPA</small>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534' }}>{studentData.gpa}</div>
              </div>
            </div>

            <div>
              <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>DEGREE & MAJOR</small>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>{studentData.degree} in {studentData.major}</div>
            </div>
          </div>
        )}

        {successMsg ? (
          <div style={{ background: '#dcfce7', color: '#15803d', padding: '16px', borderRadius: '12px', fontWeight: 700, textAlign: 'center' }}>
            {successMsg}
          </div>
        ) : (
          <button
            onClick={handleClaimCredential}
            disabled={isLoading}
            style={{ width: '100%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', padding: '16px', borderRadius: '14px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
          >
            📥 Claim & Bind Credential to Mobile Wallet
          </button>
        )}
      </div>
    </div>
  );
}
