import React, { useState } from 'react';
import logo from '../assets/Logo.png';

/**
 * Login Component
 * Premium industrial-hardware aesthetic login portal.
 * Features glassmorphic cards, safety amber accents, and clean status messages.
 */
const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Store in localStorage
      localStorage.setItem('hims_token', data.token);
      localStorage.setItem('hims_user', JSON.stringify(data.user));

      // Trigger success hook
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      console.error('Authentication error:', err.message);
      setError(err.message || 'Server error. Please verify database connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-portal-wrapper">
      <div className="login-panel-container">
        
        {/* Brand Banner */}
        <div className="login-brand-header">
          <img src={logo} alt="HIMS Logo" className="login-logo-img" />
          <div className="brand-titles">
            <h1>HIMS CONTROL ROOM</h1>
            <p>ASSET LIFECYCLE & LEDGER GATEWAY</p>
          </div>
        </div>

        {/* Input Card */}
        <div className="login-card-body">
          <div className="security-banner">
            <span className="secure-badge">🔒 SECURED PORTAL</span>
            <p>Access is restricted to authorized personnel only. Activities are audited.</p>
          </div>

          {error && <div className="login-error-banner">⚠️ {error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label htmlFor="login-username">System Username</label>
              <input
                id="login-username"
                type="text"
                placeholder="e.g. superadmin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="login-form-group">
              <label htmlFor="login-password">Access Passcode</label>
              <div className="password-input-wrapper" style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                  title={showPassword ? 'Hide passcode' : 'Show passcode'}
                >
                  👁️
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? 'Authenticating Gateway...' : 'Unlock Control Room'}
            </button>
          </form>
        </div>

        {/* Console Footer */}
        <div className="login-console-footer">
          <div className="footer-status-pill">
            <span className="pulse-indicator"></span>
            <span>SYSTEM AUDIT ON</span>
          </div>
          <span>REAL PEEKRAH CO. LTD &bull; v2.0.0</span>
        </div>

      </div>

      <style jsx>{`
        .login-portal-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #0b0f19;
          background-image: 
            radial-gradient(at 50% 0%, rgba(249, 115, 22, 0.15) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(2, 132, 199, 0.1) 0px, transparent 50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 99999;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .login-panel-container {
          background-color: rgba(30, 41, 59, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 4px solid #f97316; /* safety orange */
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

        /* Header section */
        .login-brand-header {
          background-color: rgba(15, 23, 42, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .login-logo-img {
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

        /* Body card */
        .login-card-body {
          padding: 28px 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .security-banner {
          background-color: rgba(2, 132, 199, 0.06);
          border: 1px dashed rgba(2, 132, 199, 0.25);
          padding: 10px 12px;
          border-radius: 4px;
        }

        .secure-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 900;
          color: #38bdf8;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }

        .security-banner p {
          margin: 0;
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .login-error-banner {
          background-color: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 700;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-form-group label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .login-form-group input {
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

        .login-form-group input:focus {
          border-color: #f97316 !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15) !important;
        }

        .login-submit-btn {
          margin-top: 8px;
          background-color: #f97316 !important;
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

        .login-submit-btn:hover:not(:disabled) {
          background-color: #ea580c !important;
        }

        .login-submit-btn:disabled {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #64748b !important;
          cursor: not-allowed;
        }

        /* Console Footer */
        .login-console-footer {
          background-color: rgba(15, 23, 42, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
        }

        .footer-status-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #10b981; /* active green */
        }

        .pulse-indicator {
          width: 6px;
          height: 6px;
          background-color: #10b981;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 8px #10b981;
          animation: pulse 1.8s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 10px #10b981; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>

    </div>
  );
};

export default Login;
