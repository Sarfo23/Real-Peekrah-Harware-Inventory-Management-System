import React, { useState } from 'react';
import logo from '../assets/Logo.png';

/**
 * ResetDefaultAdminForm Component
 * Premium industrial-themed form forcing the superadmin to change default credentials.
 */
const ResetDefaultAdminForm = ({ onResetSuccess, onCancel }) => {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newUsername.trim()) {
      setError('Username is required.');
      return;
    }

    if (newUsername.trim().toLowerCase() === 'superadmin') {
      setError('New username cannot be the default "superadmin".');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword === 'admin1234') {
      setError('New password cannot be the default "admin1234".');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch('/api/auth/reset-default-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          newUsername: newUsername.trim(),
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update credentials.');
      }


      
      // Update local storage
      localStorage.setItem('hims_token', data.token);
      localStorage.setItem('hims_user', JSON.stringify(data.user));
      localStorage.setItem('hims_requires_reset', 'false');

      // Trigger success callback
      onResetSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-portal-wrapper">
      <div className="reset-panel-container">
        
        {/* Brand Banner */}
        <div className="reset-brand-header">
          <img src={logo} alt="HIMS Logo" className="reset-logo-img" />
          <div className="brand-titles">
            <h1>HIMS SECURITY OVERRIDE</h1>
            <p>SETUP CUSTOM SUPERADMIN CREDENTIALS</p>
          </div>
        </div>

        {/* Form Body */}
        <div className="reset-card-body">
          <div className="security-banner alert-warning">
            <span className="secure-badge">⚠️ MANDATORY RESET</span>
            <p>You are using default system credentials. For security audit compliance, you must establish a custom username and passcode before proceeding.</p>
          </div>

          {error && <div className="reset-error-banner">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="reset-form">
            <div className="reset-form-group">
              <label>New Custom Username</label>
              <input
                type="text"
                placeholder="e.g. administrator_sarfo"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="reset-form-group">
              <label>New Access Passcode</label>
              <div className="password-input-wrapper" style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: showPassword ? 'var(--hw-orange, #f97316)' : '#94a3b8',
                    opacity: showPassword ? 1 : 0.6,
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none',
                    transition: 'color 0.2s, opacity 0.2s'
                  }}
                >
                  👁️
                </button>
              </div>
            </div>

            <div className="reset-form-group">
              <label>Confirm Access Passcode</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat passcode"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginTop: '10px' }}>
              <button 
                type="button" 
                className="reset-cancel-btn" 
                onClick={onCancel}
                disabled={loading}
              >
                Cancel / Exit
              </button>
              <button type="submit" className="reset-submit-btn" disabled={loading}>
                {loading ? 'Saving Credentials...' : 'Save & Unlock HIMS'}
              </button>
            </div>
          </form>
        </div>

        {/* Console Footer */}
        <div className="reset-console-footer">
          <span>REAL PEEKRAH CO. LTD &bull; SECURITY GATEWAY</span>
        </div>

      </div>

      <style jsx>{`
        .reset-portal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #0b0f19;
          background-image: 
            radial-gradient(at 50% 0%, rgba(220, 38, 38, 0.12) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(15, 23, 42, 0.5) 0px, transparent 50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 99999;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .reset-panel-container {
          background-color: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 4px solid #ef4444; /* danger red */
          border-radius: 8px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: portalSlideUp 0.3s ease-out;
        }

        @keyframes portalSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .reset-brand-header {
          background-color: rgba(15, 23, 42, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .reset-logo-img {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }

        .brand-titles h1 {
          margin: 0;
          font-size: 14px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .brand-titles p {
          margin: 3px 0 0 0;
          font-size: 9px;
          color: #94a3b8;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .reset-card-body {
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .security-banner {
          background-color: rgba(239, 68, 68, 0.04);
          border: 1px dashed rgba(239, 68, 68, 0.25);
          padding: 10px 12px;
          border-radius: 4px;
        }

        .secure-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 900;
          color: #ef4444;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }

        .security-banner p {
          margin: 0;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .reset-error-banner {
          background-color: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
        }

        .reset-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .reset-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .reset-form-group label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .reset-form-group input {
          background-color: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #ffffff !important;
          padding: 10px 12px !important;
          font-size: 13px !important;
          border-radius: 4px !important;
          transition: all 0.2s !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        .reset-form-group input:focus {
          border-color: #ef4444 !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15) !important;
        }

        .reset-submit-btn {
          background-color: #ef4444 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 12px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-radius: 4px !important;
          cursor: pointer;
          transition: background-color 0.15s !important;
        }

        .reset-submit-btn:hover:not(:disabled) {
          background-color: #dc2626 !important;
        }

        .reset-submit-btn:disabled {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #64748b !important;
          cursor: not-allowed;
        }

        .reset-cancel-btn {
          background-color: transparent !important;
          color: #94a3b8 !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          padding: 12px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-radius: 4px !important;
          cursor: pointer;
          transition: all 0.15s !important;
        }

        .reset-cancel-btn:hover:not(:disabled) {
          background-color: rgba(255, 255, 255, 0.05) !important;
          color: #ffffff !important;
        }

        .reset-console-footer {
          background-color: rgba(15, 23, 42, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 24px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
        }
      `}</style>

    </div>
  );
};

export default ResetDefaultAdminForm;
