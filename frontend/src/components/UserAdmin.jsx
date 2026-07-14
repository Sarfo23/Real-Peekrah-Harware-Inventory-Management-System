import React, { useState, useEffect } from 'react';

/**
 * UserAdmin Component
 * Admin user management page restricted to SUPER_ADMIN.
 * Handles adding, removing, changing user roles, assigning allowed sections,
 * and monitoring user footprint logs.
 */
const UserAdmin = () => {
  const [users, setUsers] = useState([]);
  const [footprints, setFootprints] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('accounts'); // 'accounts' or 'footprints'
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');
  const [allowedWarehouse, setAllowedWarehouse] = useState(true);
  const [allowedSales, setAllowedSales] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Search/Filters for Footprints
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchLogs, setSearchLogs] = useState('');

  // Get current logged in user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('hims_user') || '{}');

  // Profile management states
  const [profileName, setProfileName] = useState(() => {
    const cur = JSON.parse(localStorage.getItem('hims_user') || '{}');
    return cur.name || '';
  });
  const [profileUsername, setProfileUsername] = useState(() => {
    const cur = JSON.parse(localStorage.getItem('hims_user') || '{}');
    return cur.username || '';
  });
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFootprints = async () => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch('/api/footprints', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch footprints');
      setFootprints(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFootprints();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    const allowedSections = [];
    if (allowedWarehouse) allowedSections.push('WAREHOUSE');
    if (allowedSales) allowedSections.push('SALES');

    if (allowedSections.length === 0) {
      setError('Please assign at least one allowed section (Warehouse or Sales).');
      setCreating(false);
      return;
    }

    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name, 
          username, 
          password, 
          role,
          allowedSections
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      
      setSuccess(`User "${name}" registered successfully!`);
      setName('');
      setUsername('');
      setPassword('');
      setRole('USER');
      setAllowedWarehouse(true);
      setAllowedSales(false);
      fetchUsers();
      fetchFootprints(); // refresh footprint log
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePrivileges = async (userId, targetUserRole, targetWarehouseFlag, targetSalesFlag) => {
    setError('');
    setSuccess('');
    
    if (userId === currentUser.id) {
      setError('Super Admins cannot change their own privileges.');
      return;
    }

    const allowedSections = [];
    if (targetWarehouseFlag) allowedSections.push('WAREHOUSE');
    if (targetSalesFlag) allowedSections.push('SALES');

    if (allowedSections.length === 0) {
      setError('A user must have at least one allowed section.');
      return;
    }

    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          role: targetUserRole,
          allowedSections 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update privileges');

      setSuccess('User privileges and sections updated successfully.');
      fetchUsers();
      fetchFootprints(); // refresh logs
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId, userFullName) => {
    setError('');
    setSuccess('');

    if (userId === currentUser.id) {
      setError('Super Admins cannot delete their own accounts.');
      return;
    }

    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete user "${userFullName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      setSuccess(`User "${userFullName}" deleted successfully.`);
      fetchUsers();
      fetchFootprints(); // refresh logs
    } catch (err) {
      setError(err.message);
    }
  };

  // Filter footprints
  const filteredFootprints = footprints.filter(fp => {
    const matchesAction = filterAction === 'ALL' || fp.action_type === filterAction;
    const searchLower = searchLogs.toLowerCase();
    const matchesSearch = 
      fp.user_name.toLowerCase().includes(searchLower) ||
      fp.username.toLowerCase().includes(searchLower) ||
      fp.details.toLowerCase().includes(searchLower) ||
      fp.action_type.toLowerCase().includes(searchLower);

    return matchesAction && matchesSearch;
  });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!profileUsername.trim()) {
      setError('Username is required.');
      return;
    }

    if (profileUsername.trim().toLowerCase() === 'superadmin') {
      setError('Username cannot be the default "superadmin".');
      return;
    }

    if (profilePassword && profilePassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (profilePassword && profilePassword !== profileConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setProfileLoading(true);
    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName.trim(),
          newUsername: profileUsername.trim(),
          newPassword: profilePassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update credentials.');
      }

      alert('Your profile credentials have been updated successfully!');
      setSuccess('Profile updated successfully.');
      
      // Update local storage
      localStorage.setItem('hims_token', data.token);
      localStorage.setItem('hims_user', JSON.stringify(data.user));

      // Reset password fields
      setProfilePassword('');
      setProfileConfirmPassword('');

      // Reload window to sync welcome pill immediately
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="user-admin-wrapper">
      {error && <div className="status-banner error-banner">⚠️ {error}</div>}
      {success && <div className="status-banner success-banner">✅ {success}</div>}

      {/* Sub tabs header */}
      <div className="sub-tabs-header">
        <button
          className={`sub-tab-btn ${activeSubTab === 'accounts' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('accounts')}
        >
          👤 User Accounts & Permissions
        </button>
        <button
          className={`sub-tab-btn ${activeSubTab === 'footprints' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('footprints');
            fetchFootprints();
          }}
        >
          👣 User Footprints & Audit Trail
        </button>
        <button
          className={`sub-tab-btn ${activeSubTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('profile')}
        >
          ⚙️ Manage My Credentials
        </button>
      </div>

      {activeSubTab === 'accounts' && (
        <div className="user-admin-grid">
          
          {/* Left Column: Create User Form */}
          <div className="user-form-panel">
            <h4>Register New Operator</h4>
            <form onSubmit={handleCreateUser} className="admin-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="e.g. johndoe"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="password-input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
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
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    👁️
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>User Role Assignment</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="USER">User (Standard Operator)</option>
                  <option value="ADMIN">Admin (Inventory Manager)</option>
                  <option value="SUPER_ADMIN">Super Admin (System Owner)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Allowed Modules Access (For USER role)</label>
                <div className="checkbox-options">
                  <label className="checkbox-lbl">
                    <input
                      type="checkbox"
                      checked={allowedWarehouse}
                      onChange={e => setAllowedWarehouse(e.target.checked)}
                    />
                    Warehouse Section (Movements, Transfers, Catalog)
                  </label>
                  <label className="checkbox-lbl">
                    <input
                      type="checkbox"
                      checked={allowedSales}
                      onChange={e => setAllowedSales(e.target.checked)}
                    />
                    Sales Section (Dispatches & Profit Reports)
                  </label>
                </div>
              </div>

              <button type="submit" disabled={creating} className="submit-user-btn">
                {creating ? 'Saving User...' : 'Add User Account'}
              </button>
            </form>
          </div>

          {/* Right Column: User list */}
          <div className="users-list-panel">
            <h4>Registered Accounts</h4>
            {loading ? (
              <div className="loading-spinner">Fetching active users...</div>
            ) : (
              <div className="table-responsive">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Permissions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const sectionsList = u.allowed_sections ? u.allowed_sections.split(',') : [];
                      const hasWarehouse = sectionsList.includes('WAREHOUSE');
                      const hasSales = sectionsList.includes('SALES');

                      return (
                        <tr key={u.id} className={u.id === currentUser.id ? 'current-user-row' : ''}>
                          <td>
                            <strong>{u.name}</strong>
                            {u.id === currentUser.id && <span className="self-tag"> (You)</span>}
                          </td>
                          <td><code>{u.username}</code></td>
                          <td>
                            <select
                              value={u.role}
                              onChange={e => handleUpdatePrivileges(u.id, e.target.value, hasWarehouse, hasSales)}
                              disabled={u.id === currentUser.id}
                              className={`role-select ${u.role.toLowerCase()}`}
                            >
                              <option value="USER">USER</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                          </td>
                          <td>
                            {u.role === 'USER' ? (
                              <div className="row-permissions-checkboxes">
                                <label className="chk-mini">
                                  <input
                                    type="checkbox"
                                    checked={hasWarehouse}
                                    onChange={e => handleUpdatePrivileges(u.id, u.role, e.target.checked, hasSales)}
                                    disabled={u.id === currentUser.id}
                                  />
                                  Warehouse
                                </label>
                                <label className="chk-mini">
                                  <input
                                    type="checkbox"
                                    checked={hasSales}
                                    onChange={e => handleUpdatePrivileges(u.id, u.role, hasWarehouse, e.target.checked)}
                                    disabled={u.id === currentUser.id}
                                  />
                                  Sales
                                </label>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>FULL ACCESS</span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={u.id === currentUser.id}
                              className="delete-user-btn"
                              title={u.id === currentUser.id ? 'You cannot delete yourself' : 'Delete account'}
                            >
                              🗑️ Delete
                            </button>
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

      {activeSubTab === 'footprints' && (
        <div className="footprints-logs-panel">
          <div className="logs-toolbar">
            <div className="toolbar-left">
              <h4>System Audit Trail Logs</h4>
              <p>Footprints of login sessions and changes executed on the system catalog/ledger.</p>
            </div>
            <div className="toolbar-actions">
              <input
                type="text"
                placeholder="Search footprints details..."
                value={searchLogs}
                onChange={e => setSearchLogs(e.target.value)}
                className="logs-search"
              />
              <select 
                value={filterAction} 
                onChange={e => setFilterAction(e.target.value)}
                className="logs-filter"
              >
                <option value="ALL">All Actions</option>
                <option value="LOGIN">Logins</option>
                <option value="LOGOUT">Logouts</option>
                <option value="CREATE_PRODUCT">Product Creation</option>
                <option value="STOCK_MOVEMENT">Stock Movement</option>
                <option value="STOCK_TRANSFER">Stock Transfer</option>
                <option value="BULK_IMPORT_MOVEMENTS">Bulk Movement Upload</option>
                <option value="ROLE_CHANGE">Permission Updates</option>
                <option value="CREATE_USER">User Registrations</option>
                <option value="DELETE_USER">User Deletions</option>
              </select>
              <button onClick={fetchFootprints} className="refresh-logs-btn">
                🔄 Refresh Logs
              </button>
            </div>
          </div>

          {loadingLogs ? (
            <div className="loading-spinner">Querying footprints history...</div>
          ) : (
            <div className="table-responsive logs-table-container">
              <table className="user-table logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Operator</th>
                    <th>Action</th>
                    <th>Activity Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFootprints.map(fp => (
                    <tr key={fp.id}>
                      <td className="log-time-col">
                        <code>{new Date(fp.timestamp).toLocaleString()}</code>
                      </td>
                      <td>
                        <strong>{fp.user_name}</strong> <span className="subtle-user-text">({fp.username})</span>
                      </td>
                      <td>
                        <span className={`log-badge badge-${fp.action_type.toLowerCase()}`}>
                          {fp.action_type}
                        </span>
                      </td>
                      <td className="log-details-col">{fp.details}</td>
                    </tr>
                  ))}
                  {filteredFootprints.length === 0 && (
                    <tr>
                      <td colSpan="4" className="no-logs-row">
                        No user footprints found matching search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'profile' && (
        <div className="profile-manager-panel" style={{ maxWidth: '500px', margin: '20px auto 0 auto' }}>
          <div className="user-form-panel">
            <h4>Update My Credentials</h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Change your display name, system username, and password passcode. For security compliance, do not reuse default credentials.
            </p>
            <form onSubmit={handleUpdateProfile} className="admin-form">
              <div className="form-group">
                <label>Full Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Administrator Sarfo"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  required
                  disabled={profileLoading}
                />
              </div>

              <div className="form-group">
                <label>System Username</label>
                <input
                  type="text"
                  placeholder="e.g. sarfo_admin"
                  value={profileUsername}
                  onChange={e => setProfileUsername(e.target.value)}
                  required
                  disabled={profileLoading}
                />
              </div>

              <div className="form-group">
                <label>New Access Passcode (Optional)</label>
                <div className="password-input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type={showProfilePassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current passcode"
                    value={profilePassword}
                    onChange={e => setProfilePassword(e.target.value)}
                    disabled={profileLoading}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: showProfilePassword ? 'var(--hw-orange, #f97316)' : '#94a3b8',
                      opacity: showProfilePassword ? 1 : 0.6,
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'color 0.2s, opacity 0.2s'
                    }}
                    title={showProfilePassword ? 'Hide passcode' : 'Show passcode'}
                  >
                    👁️
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Access Passcode</label>
                <div className="password-input-wrapper" style={{ position: 'relative' }}>
                  <input
                    type={showProfilePassword ? 'text' : 'password'}
                    placeholder="Confirm new passcode"
                    value={profileConfirmPassword}
                    onChange={e => setProfileConfirmPassword(e.target.value)}
                    disabled={profileLoading}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: showProfilePassword ? 'var(--hw-orange, #f97316)' : '#94a3b8',
                      opacity: showProfilePassword ? 1 : 0.6,
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'color 0.2s, opacity 0.2s'
                    }}
                    title={showProfilePassword ? 'Hide passcode' : 'Show passcode'}
                  >
                    👁️
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={profileLoading} style={{ marginTop: '10px' }}>
                {profileLoading ? 'Saving Credentials...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-admin-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        .sub-tabs-header {
          display: flex;
          gap: 5px;
          border-bottom: 2px solid var(--hw-border);
          padding-bottom: 2px;
        }

        @media (max-width: 768px) {
          .sub-tabs-header {
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
            border-bottom: none;
            padding-bottom: 8px;
          }
          .sub-tab-btn {
            flex: 0 1 auto;
            border: 1px solid var(--hw-border) !important;
            border-radius: 4px !important;
            padding: 8px 12px !important;
            background-color: var(--hw-panel-bg) !important;
            white-space: nowrap;
          }
          .sub-tab-btn.active {
            background-color: var(--hw-orange) !important;
            color: white !important;
            border-color: var(--hw-orange) !important;
          }
        }

        .sub-tab-btn {
          background: transparent !important;
          border: none !important;
          border-radius: var(--hw-radius) var(--hw-radius) 0 0 !important;
          padding: 10px 16px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: var(--hw-steel) !important;
          cursor: pointer;
          transition: all 0.15s;
          border-bottom: 3px solid transparent !important;
        }

        .sub-tab-btn:hover {
          color: var(--hw-orange) !important;
          background-color: var(--hw-bg-light) !important;
        }

        .sub-tab-btn.active {
          color: var(--hw-orange) !important;
          border-bottom-color: var(--hw-orange) !important;
          background-color: var(--hw-bg-light) !important;
        }

        .user-admin-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 25px;
        }

        @media (max-width: 900px) {
          .user-admin-grid {
            grid-template-columns: 1fr;
          }
        }

        .status-banner {
          padding: 12px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 700;
        }

        .error-banner {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--hw-red, #ef4444);
          border: 1px solid var(--hw-red, #ef4444);
        }

        .success-banner {
          background-color: rgba(34, 197, 94, 0.1);
          color: var(--hw-green, #22c55e);
          border: 1px solid var(--hw-green, #22c55e);
        }

        h4 {
          margin: 0 0 15px 0;
          font-size: 14px;
          font-weight: 800;
          color: var(--hw-slate-dark);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 2px solid var(--hw-border);
          padding-bottom: 8px;
        }

        .user-form-panel, .users-list-panel, .footprints-logs-panel {
          background-color: var(--hw-bg-light);
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          padding: 20px;
        }

        .admin-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 11px;
          font-weight: 700;
          color: var(--hw-steel);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .form-group input, .form-group select {
          padding: 8px 10px !important;
          font-size: 13px !important;
          background-color: var(--hw-panel-bg) !important;
          border: 1px solid var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
          border-radius: 4px !important;
        }

        .checkbox-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background-color: var(--hw-panel-bg);
          padding: 10px;
          border-radius: 4px;
          border: 1px solid var(--hw-border);
        }

        .checkbox-lbl {
          font-size: 12px;
          font-weight: 600;
          color: var(--hw-slate-dark);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .submit-user-btn {
          background-color: var(--hw-orange) !important;
          color: white !important;
          font-weight: 700 !important;
          border: none !important;
          padding: 10px !important;
          font-size: 13px !important;
          border-radius: 4px !important;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          transition: background-color 0.2s;
        }

        .submit-user-btn:hover {
          background-color: #ea580c !important;
        }

        .submit-user-btn:disabled {
          background-color: var(--hw-border) !important;
          color: var(--hw-steel) !important;
          cursor: not-allowed;
        }

        /* User List table */
        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .user-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .user-table th {
          font-size: 11px;
          font-weight: 700;
          color: var(--hw-steel);
          text-transform: uppercase;
          padding: 10px;
          border-bottom: 2px solid var(--hw-border);
        }

        .user-table td {
          padding: 12px 10px;
          font-size: 13px;
          border-bottom: 1px solid var(--hw-border);
          color: var(--hw-slate-dark);
        }

        .current-user-row {
          background-color: rgba(249, 115, 22, 0.03);
        }

        .self-tag {
          font-size: 10px;
          color: var(--hw-orange);
          font-weight: 800;
        }

        .role-select {
          font-size: 11px !important;
          font-weight: 800 !important;
          padding: 4px 8px !important;
          border-radius: 4px !important;
          border: 1px solid var(--hw-border) !important;
          background-color: var(--hw-panel-bg) !important;
          color: var(--hw-slate-dark) !important;
          cursor: pointer;
        }

        .role-select.super_admin {
          border-color: var(--hw-orange) !important;
          color: var(--hw-orange) !important;
        }

        .role-select.admin {
          border-color: var(--hw-blue) !important;
          color: var(--hw-blue) !important;
        }

        .row-permissions-checkboxes {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .chk-mini {
          font-size: 11px;
          font-weight: 600;
          color: var(--hw-steel);
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .delete-user-btn {
          background: transparent !important;
          border: 1px solid var(--hw-red, #ef4444) !important;
          color: var(--hw-red, #ef4444) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 4px 8px !important;
          border-radius: 4px !important;
          cursor: pointer;
          transition: all 0.2s;
        }

        .delete-user-btn:hover:not(:disabled) {
          background-color: var(--hw-red, #ef4444) !important;
          color: white !important;
        }

        .delete-user-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          border-color: var(--hw-border) !important;
          color: var(--hw-steel) !important;
        }

        /* Footprints Audit Trail */
        .logs-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 15px;
          border-bottom: 2px solid var(--hw-border);
          padding-bottom: 12px;
          margin-bottom: 15px;
        }

        @media (max-width: 768px) {
          .logs-toolbar {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }
          .toolbar-actions {
            justify-content: center;
            width: 100%;
          }
          .logs-search {
            width: 100% !important;
          }
        }

        .toolbar-left h4 {
          border-bottom: none !important;
          margin-bottom: 2px !important;
          padding-bottom: 0 !important;
        }

        .toolbar-left p {
          font-size: 11px;
          color: var(--hw-steel);
          margin: 0;
        }

        .toolbar-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .logs-search, .logs-filter {
          padding: 6px 10px !important;
          font-size: 12px !important;
          background-color: var(--hw-panel-bg) !important;
          border: 1px solid var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
          border-radius: 4px !important;
        }

        .logs-search {
          width: 200px;
        }

        .refresh-logs-btn {
          background-color: var(--hw-steel) !important;
          color: white !important;
          font-weight: 700 !important;
          border: none !important;
          padding: 6px 12px !important;
          font-size: 12px !important;
          border-radius: 4px !important;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .refresh-logs-btn:hover {
          background-color: var(--hw-slate-dark) !important;
        }

        .logs-table-container {
          max-height: 480px;
          overflow-y: auto;
          overflow-x: auto;
          width: 100%;
          -webkit-overflow-scrolling: touch;
        }

        .logs-table th {
          position: sticky;
          top: 0;
          background-color: var(--hw-bg-light);
          z-index: 10;
        }

        .log-time-col {
          width: 170px;
        }

        .subtle-user-text {
          font-weight: normal;
          color: var(--hw-steel);
          font-size: 11px;
        }

        .log-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 6px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .badge-login { background-color: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid #22c55e; }
        .badge-logout { background-color: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid #94a3b8; }
        .badge-create_product { background-color: rgba(2, 132, 199, 0.1); color: #0284c7; border: 1px solid #0284c7; }
        .badge-update_product { background-color: rgba(249, 115, 22, 0.1); color: #f97316; border: 1px solid #f97316; }
        .badge-delete_product { background-color: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid #ef4444; }
        .badge-stock_movement { background-color: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid #a855f7; }
        .badge-stock_transfer { background-color: rgba(236, 72, 153, 0.1); color: #ec4899; border: 1px solid #ec4899; }
        .badge-bulk_import_movements { background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid #10b981; }
        .badge-role_change { background-color: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid #eab308; }
        .badge-create_user { background-color: rgba(6, 182, 212, 0.1); color: #06b6d4; border: 1px solid #06b6d4; }
        .badge-delete_user { background-color: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid #f43f5e; }

        .log-details-col {
          font-size: 12px !important;
          color: var(--hw-slate-dark);
        }

        .no-logs-row {
          padding: 30px;
          text-align: center;
          color: var(--hw-steel);
          font-style: italic;
        }

        .loading-spinner {
          padding: 20px;
          text-align: center;
          color: var(--hw-steel);
          font-style: italic;
          font-size: 13px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default UserAdmin;
