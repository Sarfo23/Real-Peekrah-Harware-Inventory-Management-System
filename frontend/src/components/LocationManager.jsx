import React, { useState, useEffect } from 'react';

/**
 * LocationManager Component
 * Allows creating and viewing Shops and Warehouses separately.
 */
const LocationManager = ({ onLocationAdded }) => {
  const [warehouses, setWarehouses] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Retrieve user session info to check for SUPER_ADMIN role
  const currentUser = JSON.parse(localStorage.getItem('hims_user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  // Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locType, setLocType] = useState('SHOP'); // 'SHOP' or 'WAREHOUSE'
  const [formMessage, setFormMessage] = useState(null);

  // Edit states
  const [editingFacility, setEditingFacility] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editType, setEditType] = useState('SHOP');
  const [editMessage, setEditMessage] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const refreshSearchResults = async (query, currentWarehouses, currentShops) => {
    const q = query.toLowerCase();
    const allFacs = [
      ...currentWarehouses.map(w => ({ ...w, type: 'WAREHOUSE' })),
      ...currentShops.map(s => ({ ...s, type: 'SHOP' }))
    ];
    const matches = allFacs.filter(fac => fac.name.toLowerCase().includes(q));

    try {
      const updatedMatches = await Promise.all(
        matches.map(async (fac) => {
          const res = await fetch(`/api/warehouses/${fac.id}/inventory`);
          if (res.ok) {
            const inventory = await res.json();
            return { ...fac, inventory };
          }
          return { ...fac, inventory: [] };
        })
      );
      setSearchResults(updatedMatches);
    } catch (err) {
      console.error('Error refreshing search results:', err);
    }
  };

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    await refreshSearchResults(searchQuery, warehouses, shops);
    setSearchLoading(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleEditClick = (fac, defaultType) => {
    setEditingFacility(fac);
    setEditName(fac.name);
    setEditLocation(fac.location || '');
    setEditType(fac.type || defaultType);
    setEditMessage(null);
  };

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const [whRes, shopRes] = await Promise.all([
        fetch('/api/warehouses'),
        fetch('/api/shops')
      ]);
      if (!whRes.ok || !shopRes.ok) throw new Error('Failed to load locations');
      const whData = await whRes.json();
      const shopData = await shopRes.json();
      setWarehouses(whData);
      setShops(shopData);

      if (searchQuery.trim() !== '') {
        refreshSearchResults(searchQuery, whData, shopData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setFormMessage(null);
    const endpoint = locType === 'SHOP' ? '/api/shops' : '/api/warehouses';
    const payload = {
      name: name.trim(),
      location: location.trim()
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setFormMessage({ type: 'success', text: `${locType === 'SHOP' ? 'Shop' : 'Warehouse'} registered successfully!` });
        setName('');
        setLocation('');
        fetchLocations();
        if (onLocationAdded) onLocationAdded();
      } else {
        throw new Error(data.error || 'Failed to create location');
      }
    } catch (err) {
      setFormMessage({ type: 'error', text: err.message });
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setEditLoading(true);
    setEditMessage(null);

    try {
      const token = localStorage.getItem('hims_token');
      const res = await fetch(`/api/warehouses/${editingFacility.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          location: editLocation.trim(),
          type: editType
        })
      });

      const data = await res.json();
      if (res.ok) {
        setEditMessage({ type: 'success', text: 'Facility updated successfully!' });
        fetchLocations();
        if (onLocationAdded) onLocationAdded();
        setTimeout(() => {
          setEditingFacility(null);
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to update facility');
      }
    } catch (err) {
      setEditMessage({ type: 'error', text: err.message });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteFacility = async (forcePurge = false) => {
    const confirmMessage = forcePurge 
      ? `🚨 WARNING: You are about to permanently delete "${editingFacility.name}" AND all of its transaction history (audit trails). This action CANNOT be undone. Are you absolutely sure?`
      : `Are you sure you want to permanently delete "${editingFacility.name}"? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setEditLoading(true);
    setEditMessage(null);

    try {
      const token = localStorage.getItem('hims_token');
      const url = `/api/warehouses/${editingFacility.id}${forcePurge ? '?purgeHistory=true' : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        setEditMessage({ type: 'success', text: 'Facility deleted successfully!' });
        fetchLocations();
        if (onLocationAdded) onLocationAdded();
        setTimeout(() => {
          setEditingFacility(null);
        }, 1000);
      } else {
        if (data.code === 'HAS_TRANSACTIONS' || (data.error && data.error.includes('transaction history'))) {
          setEditLoading(false);
          const purgeConfirm = window.confirm(
            `This facility has associated transaction history (audit trails).\n\n` +
            `Do you want to PERMANENTLY DELETE all associated transaction history/audit trails and delete the facility?\n\n` +
            `• Click OK to delete everything (facility & all transaction logs).\n` +
            `• Click Cancel to keep the facility and its audit trails intact.`
          );
          if (purgeConfirm) {
            handleDeleteFacility(true);
          }
          return;
        }
        throw new Error(data.error || 'Failed to delete facility');
      }
    } catch (err) {
      setEditMessage({ type: 'error', text: err.message });
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="location-manager-container">
      {/* Facility Search Section */}
      <div className="facility-search-section">
        <h3>🔍 Real-Time Facility Inventory Search</h3>
        <div className="search-bar-container">
          <input
            type="text"
            className="facility-search-input"
            placeholder="Type shop or warehouse name (e.g. Tema, Mall...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit();
            }}
          />
          <button className="btn-search" onClick={handleSearchSubmit} disabled={searchLoading}>
            {searchLoading ? 'Scanning...' : 'Search Inventory'}
          </button>
          {searchResults.length > 0 && (
            <button className="btn-clear-search" onClick={handleClearSearch}>
              Clear
            </button>
          )}
        </div>

        {searchLoading && <p className="search-loading-text">🔄 Fetching warehouse inventory levels from Railway Cloud...</p>}

        {!searchLoading && searchResults.length > 0 && (
          <div className="search-results-container">
            <h4>Search Results ({searchResults.length} matches found)</h4>
            <div className="search-results-grid">
              {searchResults.map((fac) => (
                <div key={fac.id} className={`search-result-card ${fac.type === 'SHOP' ? 'shop-card' : 'wh-card'}`}>
                  <div className="card-header">
                    <span className="card-icon">{fac.type === 'SHOP' ? '🛒' : '🏭'}</span>
                    <div className="card-header-details">
                      <strong>{fac.name}</strong>
                      <span>📍 {fac.location || 'No geographic location specified'}</span>
                    </div>
                    <span className="badge-type">{fac.type === 'SHOP' ? 'Retail Shop' : 'Warehouse'}</span>
                  </div>
                  <div className="card-body">
                    {fac.inventory && fac.inventory.length > 0 ? (
                      <table className="inventory-preview-table">
                        <thead>
                          <tr>
                            <th>Product Name</th>
                            <th>SKU</th>
                            <th style={{ textAlign: 'right' }}>Stock Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fac.inventory.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td><code className="sku-code">{item.sku}</code></td>
                              <td style={{ textAlign: 'right' }}>
                                <span className={`badge-qty ${item.quantity < 10 ? 'low-stock-badge' : 'normal-stock-badge'}`}>
                                  {item.quantity} units
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="no-inventory-text">⚠️ No active stock recorded in this facility.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!searchLoading && searchQuery.trim() !== '' && searchResults.length === 0 && (
          <p className="no-results-text">❌ No facilities found matching "{searchQuery}"</p>
        )}
      </div>

      <div className="manager-grid">
        {/* Creation Column */}
        <div className="creation-section">
          <h3>Register New Facility</h3>
          <form onSubmit={handleSubmit} className="location-form">
            {formMessage && (
              <div className={`form-msg ${formMessage.type}`}>
                {formMessage.type === 'error' ? '⚠️' : '✅'} {formMessage.text}
              </div>
            )}

            <div className="form-group">
              <label>Facility Type</label>
              <div className="radio-group">
                <label className={`radio-label ${locType === 'SHOP' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="locType"
                    value="SHOP"
                    checked={locType === 'SHOP'}
                    onChange={() => setLocType('SHOP')}
                  />
                  <span>🛒 Retail Shop</span>
                </label>
                <label className={`radio-label ${locType === 'WAREHOUSE' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="locType"
                    value="WAREHOUSE"
                    checked={locType === 'WAREHOUSE'}
                    onChange={() => setLocType('WAREHOUSE')}
                  />
                  <span>🏭 Storage Warehouse</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>{locType === 'SHOP' ? 'Shop' : 'Warehouse'} Name</label>
              <input
                type="text"
                placeholder={locType === 'SHOP' ? "e.g., Accra Mall Outlet" : "e.g., Tema Port Depot"}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Geographic Location / Address</label>
              <input
                type="text"
                placeholder="e.g., Accra, Ghana"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-submit">
              Register {locType === 'SHOP' ? 'Shop' : 'Warehouse'}
            </button>
          </form>
        </div>

        {/* Directory Column */}
        <div className="directory-section">
          <div className="directory-block">
            <h3>Registered Retail Shops</h3>
            {loading && shops.length === 0 ? (
              <p className="loading-text">Scanning Shops...</p>
            ) : shops.length === 0 ? (
              <p className="empty-text">No active retail shops registered.</p>
            ) : (
              <ul className="location-list">
                {shops.map(s => (
                  <li key={s.id} className="location-item shop-item">
                    <div className="loc-icon">🛒</div>
                    <div className="loc-details">
                      <strong>{s.name}</strong>
                      <span>{s.location || 'No Location specified'}</span>
                    </div>
                    {isSuperAdmin && (
                      <button className="btn-manage" onClick={() => handleEditClick(s, 'SHOP')}>Manage</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="directory-block" style={{ marginTop: '20px' }}>
            <h3>Registered Storage Warehouses</h3>
            {loading && warehouses.length === 0 ? (
              <p className="loading-text">Scanning Depots...</p>
            ) : warehouses.length === 0 ? (
              <p className="empty-text">No active depots registered.</p>
            ) : (
              <ul className="location-list">
                {warehouses.map(w => (
                  <li key={w.id} className="location-item wh-item">
                    <div className="loc-icon">🏭</div>
                    <div className="loc-details">
                      <strong>{w.name}</strong>
                      <span>{w.location || 'No Location specified'}</span>
                    </div>
                    {isSuperAdmin && (
                      <button className="btn-manage" onClick={() => handleEditClick(w, 'WAREHOUSE')}>Manage</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Facility Edit Modal Overlay */}
      {editingFacility && (
        <div className="modal-backdrop">
          <div className="modal-container" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Manage Facility</h3>
              <button className="modal-close-btn" onClick={() => setEditingFacility(null)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="location-form" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
              {editMessage && (
                <div className={`form-msg ${editMessage.type}`}>
                  {editMessage.type === 'error' ? '⚠️' : '✅'} {editMessage.text}
                </div>
              )}

              <div className="form-group">
                <label>Facility Type</label>
                <select 
                  value={editType} 
                  onChange={e => setEditType(e.target.value)}
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--hw-border)', fontSize: '14px' }}
                >
                  <option value="SHOP">🛒 Retail Shop</option>
                  <option value="WAREHOUSE">🏭 Storage Warehouse</option>
                </select>
              </div>

              <div className="form-group">
                <label>Facility Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Geographic Location / Address</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={e => setEditLocation(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                {isSuperAdmin && (
                  <button 
                    type="button" 
                    className="btn-submit btn-delete-facility" 
                    onClick={handleDeleteFacility}
                    disabled={editLoading}
                  >
                    Delete Facility
                  </button>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button" 
                    className="btn-submit" 
                    style={{ backgroundColor: '#94a3b8', color: 'white' }} 
                    onClick={() => setEditingFacility(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit" disabled={editLoading}>
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        /* Modal Styling */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .modal-container {
          background: #ffffff;
          border-radius: 6px;
          width: 95%;
          border-top: 4px solid var(--hw-orange);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        .modal-header {
          background-color: var(--hw-charcoal);
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-header h3 {
          margin: 0;
          color: #ffffff;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .modal-close-btn {
          background: transparent !important;
          border: none !important;
          color: #94a3b8 !important;
          font-size: 24px !important;
          cursor: pointer;
          padding: 0 !important;
          line-height: 1;
        }
        .modal-close-btn:hover {
          color: #ffffff !important;
        }
        .btn-manage {
          margin-left: auto;
          background-color: var(--hw-steel) !important;
          color: white !important;
          padding: 4px 8px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          border-radius: 4px !important;
          cursor: pointer;
          border: none !important;
          text-transform: uppercase;
          transition: background 0.15s ease;
        }
        .btn-manage:hover {
          background-color: var(--hw-charcoal) !important;
        }
        .location-manager-container {
          font-family: 'Inter', sans-serif;
        }
        .manager-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 30px;
        }
        @media (max-width: 768px) {
          .manager-grid {
            grid-template-columns: 1fr;
          }
        }
        h3 {
          margin: 0 0 15px 0;
          font-size: 13px;
          text-transform: uppercase;
          color: var(--hw-charcoal);
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--hw-bg);
          padding-bottom: 8px;
        }
        .location-form {
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
        }
        .form-group input {
          padding: 10px;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          font-size: 14px;
          color: #1e293b;
        }
        .radio-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .radio-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          background: #ffffff;
          transition: all 0.15s ease;
        }
        .radio-label input {
          display: none;
        }
        .radio-label.active {
          border-color: var(--hw-orange);
          background-color: #fff7ed;
          color: var(--hw-orange-hover);
          box-shadow: 0 0 0 1px var(--hw-orange);
        }
        .btn-submit {
          background-color: var(--hw-orange) !important;
          color: white;
          border: none;
          padding: 12px;
          font-size: 14px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-transform: uppercase;
        }
        .btn-submit:hover {
          background-color: var(--hw-orange-hover) !important;
        }
        .btn-delete-facility {
          background-color: #ef4444 !important;
        }
        .btn-delete-facility:hover {
          background-color: #dc2626 !important;
        }
        
        .form-msg {
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
        }
        .form-msg.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }
        .form-msg.error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }

        .location-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 250px;
          overflow-y: auto;
        }
        .location-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          background: #ffffff;
        }
        .location-item.shop-item {
          border-left: 4px solid var(--hw-orange);
        }
        .location-item.wh-item {
          border-left: 4px solid var(--hw-steel);
        }
        .loc-icon {
          font-size: 18px;
        }
        .loc-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .loc-details strong {
          font-size: 13px;
          color: var(--hw-charcoal);
        }
        .loc-details span {
          font-size: 11px;
          color: #64748b;
        }
        .loading-text, .empty-text {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
        }

        /* Search Section Styling */
        .facility-search-section {
          background: var(--hw-panel-bg, #ffffff);
          border: 1px solid var(--hw-border);
          border-left: 4px solid var(--hw-orange);
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }
        .facility-search-section h3 {
          margin-top: 0;
          border-bottom: 2px solid var(--hw-bg);
          padding-bottom: 8px;
          font-size: 14px;
        }
        .search-bar-container {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }
        .facility-search-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          font-size: 14px;
          color: var(--hw-slate-dark, #1e293b);
          background-color: var(--hw-bg, #ffffff);
          font-family: inherit;
        }
        .facility-search-input:focus {
          outline: none;
          border-color: var(--hw-orange);
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
        }
        .btn-search {
          background-color: var(--hw-charcoal) !important;
          color: white !important;
          border: none;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          text-transform: uppercase;
        }
        .btn-search:hover {
          background-color: var(--hw-steel) !important;
        }
        .btn-clear-search {
          background-color: #94a3b8 !important;
          color: white !important;
          border: none;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          text-transform: uppercase;
        }
        .btn-clear-search:hover {
          background-color: #64748b !important;
        }
        .search-loading-text {
          font-size: 12px;
          color: var(--hw-steel);
          font-style: italic;
          margin: 10px 0;
        }
        .no-results-text, .no-inventory-text {
          font-size: 13px;
          color: #ef4444;
          font-style: italic;
          margin: 10px 0;
        }
        .no-inventory-text {
          color: #64748b;
        }
        
        .search-results-container {
          margin-top: 20px;
          border-top: 1px dashed var(--hw-border);
          padding-top: 15px;
        }
        .search-results-container h4 {
          margin: 0 0 15px 0;
          font-size: 12px;
          text-transform: uppercase;
          color: var(--hw-steel);
          letter-spacing: 0.05em;
        }
        .search-results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .search-result-card {
          background: var(--hw-bg);
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .search-result-card.shop-card {
          border-top: 3px solid var(--hw-orange);
        }
        .search-result-card.wh-card {
          border-top: 3px solid var(--hw-steel);
        }
        .search-result-card .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--hw-panel-bg, #ffffff);
          border-bottom: 1px solid var(--hw-border);
        }
        .card-icon {
          font-size: 20px;
        }
        .card-header-details {
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .card-header-details strong {
          font-size: 14px;
          color: var(--hw-charcoal);
        }
        .card-header-details span {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .badge-type {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 3px 6px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #475569;
        }
        .search-result-card.shop-card .badge-type {
          background: #fff7ed;
          color: var(--hw-orange-hover);
        }
        .search-result-card.wh-card .badge-type {
          background: #f1f5f9;
          color: var(--hw-steel);
        }
        .search-result-card .card-body {
          padding: 12px;
        }
        .inventory-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .inventory-preview-table th {
          text-align: left;
          color: var(--hw-steel);
          font-weight: 700;
          text-transform: uppercase;
          font-size: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--hw-border);
        }
        .inventory-preview-table td {
          padding: 6px 0;
          border-bottom: 1px dashed rgba(226, 232, 240, 0.8);
          color: var(--hw-slate-dark, #334155);
        }
        .inventory-preview-table tr:last-child td {
          border-bottom: none;
        }
        .sku-code {
          background: var(--hw-bg, #f1f5f9);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          color: var(--hw-slate-dark, #0f172a);
          border: 1px solid var(--hw-border);
        }
        .badge-qty {
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
        }
        .low-stock-badge {
          background: #fee2e2;
          color: #b91c1c;
        }
        .normal-stock-badge {
          background: #d1fae5;
          color: #065f46;
        }
      `}</style>
    </div>
  );
};

export default LocationManager;
