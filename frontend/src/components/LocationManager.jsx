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
      setWarehouses(await whRes.json());
      setShops(await shopRes.json());
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
        alert(`${locType === 'SHOP' ? 'Shop' : 'Warehouse'} registered successfully!`);
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
        alert('Facility updated successfully!');
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

  return (
    <div className="location-manager-container">
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

              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
      `}</style>
    </div>
  );
};

export default LocationManager;
