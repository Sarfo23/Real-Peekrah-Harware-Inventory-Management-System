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

  // Form states
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locType, setLocType] = useState('SHOP'); // 'SHOP' or 'WAREHOUSE'
  const [formMessage, setFormMessage] = useState(null);

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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
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
