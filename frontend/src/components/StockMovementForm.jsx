import React, { useState, useEffect, useRef } from 'react';

/**
 * StockMovementForm Component
 * Allows users to record IN/OUT transactions for hardware inventory.
 */
const StockMovementForm = ({ onTransactionComplete, preselectedProductId }) => {
  const [formData, setFormData] = useState({
    productId: '',
    warehouseId: '',
    type: 'IN',
    quantity: 1,
    userId: 1 // Placeholder for authenticated user
  });

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [currentStock, setCurrentStock] = useState(null);
  const [fetchingStock, setFetchingStock] = useState(false);

  // Unit input states
  const [inputUnit, setInputUnit] = useState('PCS'); // 'PCS' or 'BX'
  const [numBoxes, setNumBoxes] = useState(1);
  const [qtyPerBox, setQtyPerBox] = useState(10);

  // Searchable Product Dropdown States and Refs
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus the search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isDropdownOpen]);

  // Fetch initial data for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, wareRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/warehouses')
        ]);
        
        if (prodRes.ok && wareRes.ok) {
          const prods = await prodRes.json();
          const wares = await wareRes.json();
          setProducts(prods);
          setWarehouses(wares);
          
          // Set defaults if data exists
          if (prods.length > 0 && wares.length > 0) {
            const hasPreselected = preselectedProductId && prods.some(p => p.id === preselectedProductId);
            const initialId = hasPreselected ? preselectedProductId : prods[0].id;
            const initialWarehouseId = wares[0].id;

            setFormData(prev => ({
              ...prev,
              productId: initialId,
              warehouseId: initialWarehouseId
            }));

            // Sync initial unit type
            const initialProd = prods.find(p => p.id === initialId);
            if (initialProd && (initialProd.sku === 'BX' || initialProd.sku === 'PCS')) {
              setInputUnit(initialProd.sku);
            }
          }
        }
      } catch (err) {
        console.error('Error loading form data:', err);
      }
    };
    fetchData();
  }, [preselectedProductId]);

  // Sync unit type when selected product changes
  useEffect(() => {
    const selectedProd = products.find(p => p.id === formData.productId);
    if (selectedProd && (selectedProd.sku === 'BX' || selectedProd.sku === 'PCS')) {
      setInputUnit(selectedProd.sku);
    }
  }, [formData.productId, products]);

  // Fetch current stock when product or warehouse changes
  useEffect(() => {
    if (formData.productId && formData.warehouseId) {
      const fetchStock = async () => {
        setFetchingStock(true);
        try {
          const res = await fetch(`/api/products/${formData.productId}/inventory`);
          if (res.ok) {
            const data = await res.json();
            const entry = data.find(w => Number(w.warehouse_id) === Number(formData.warehouseId));
            setCurrentStock(entry ? entry.quantity : 0);
          } else {
            setCurrentStock(0);
          }
        } catch (err) {
          console.error('Error fetching stock:', err);
          setCurrentStock(0);
        } finally {
          setFetchingStock(false);
        }
      };
      fetchStock();
    } else {
      setCurrentStock(null);
    }
  }, [formData.productId, formData.warehouseId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'productId' || name === 'warehouseId' 
        ? parseInt(value) || '' 
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const finalQuantity = inputUnit === 'BX' ? (numBoxes * qtyPerBox) : formData.quantity;

    const payload = {
      ...formData,
      quantity: parseInt(finalQuantity) || 0
    };

    const selectedProduct = products.find(p => Number(p.id) === Number(formData.productId));
    const prodName = selectedProduct ? selectedProduct.name : `Product #${formData.productId}`;
    const clearForm = () => {
      setFormData(prev => ({ ...prev, quantity: 1 }));
      setNumBoxes(1);
    };

    // Hard offline check: skip fetch if browser is offline
    if (window.HIMS_isOnline && !window.HIMS_isOnline()) {
      const itemLabel = `Movement: ${formData.type} ${finalQuantity} units of ${prodName}`;
      
      if (window.HIMS_queueTransaction) {
        window.HIMS_queueTransaction('/api/inventory/move', payload, itemLabel);
        setMessage({ 
          text: `Offline Success: Transaction stored in browser cache. ${formData.type} of ${finalQuantity} units of ${prodName} queued. Will sync when online!`, 
          type: 'success' 
        });
        if (onTransactionComplete) onTransactionComplete();
        clearForm();
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        setMessage({ text: `Success: ${result.message}`, type: 'success' });
        if (onTransactionComplete) onTransactionComplete();
        clearForm();
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err) {
      // Soft offline check: if network request failed, queue it
      const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('NetworkError');
      if (isNetworkError && window.HIMS_queueTransaction) {
        const itemLabel = `Movement: ${formData.type} ${finalQuantity} units of ${prodName}`;
        window.HIMS_queueTransaction('/api/inventory/move', payload, itemLabel);
        setMessage({ 
          text: `Offline Success: Connection failed. Stored ${formData.type} movement of ${finalQuantity} units of ${prodName} in browser memory. Will auto-sync when online!`, 
          type: 'success' 
        });
        if (onTransactionComplete) onTransactionComplete();
        clearForm();
      } else {
        setMessage({ text: `Error: ${err.message}`, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => Number(p.id) === Number(formData.productId));

  return (
    <div className="stock-movement-form">
      <h3>Record Stock Movement</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group" ref={dropdownRef}>
          <label>Product</label>
          <div className="custom-select-container">
            <div 
              className={`custom-select-trigger ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="trigger-text">
                {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : 'Select Product...'}
              </span>
              <span className="trigger-arrow">{isDropdownOpen ? '▲' : '▼'}</span>
            </div>

            {isDropdownOpen && (
              <div className="custom-select-dropdown">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="dropdown-search-input"
                    placeholder="Search by product name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {productSearch && (
                    <button 
                      type="button" 
                      className="clear-search-btn"
                      onClick={(e) => { e.stopPropagation(); setProductSearch(''); }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="dropdown-options-list">
                  {products.filter(p => 
                    (p.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
                    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                  ).length > 0 ? (
                    products.filter(p => 
                      (p.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
                      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                    ).map(p => (
                      <div
                        key={p.id}
                        className={`dropdown-option ${Number(p.id) === Number(formData.productId) ? 'selected' : ''}`}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, productId: p.id }));
                          setIsDropdownOpen(false);
                          setProductSearch('');
                        }}
                      >
                        <span className="option-name">{p.name}</span>
                        <span className="option-sku">{p.sku}</span>
                      </div>
                    ))
                  ) : (
                    <div className="no-options-found">No products matched "{productSearch}"</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Warehouse</label>
          <select name="warehouseId" value={formData.warehouseId} onChange={handleChange} required>
            <option value="">Select Warehouse...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {formData.productId && formData.warehouseId && (
          <div className="stock-info-banner">
            <span className="stock-label">Current Stock at Target:</span>
            {fetchingStock ? (
              <span className="stock-value loading">Checking...</span>
            ) : (
              <span className={`stock-value ${currentStock === 0 ? 'empty' : currentStock < 10 ? 'low' : 'good'}`}>
                {currentStock} units
              </span>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Input Unit</label>
            <select value={inputUnit} onChange={e => setInputUnit(e.target.value)}>
              <option value="PCS">PCS (Pieces)</option>
              <option value="BX">BX (Boxes)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Type</label>
            <select name="type" value={formData.type} onChange={handleChange}>
              <option value="IN">IN (Restock)</option>
              <option value="OUT">OUT (Dispatch)</option>
            </select>
          </div>
        </div>

        {inputUnit === 'BX' ? (
          <div className="form-row card-inside-row">
            <div className="form-group">
              <label>Number of Boxes</label>
              <input
                type="number"
                min="1"
                value={numBoxes}
                onChange={e => setNumBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
            <div className="form-group">
              <label>Quantity per Box</label>
              <input
                type="number"
                min="1"
                value={qtyPerBox}
                onChange={e => setQtyPerBox(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label>Quantity (Pieces)</label>
            <input
              type="number"
              name="quantity"
              min="1"
              value={formData.quantity}
              onChange={handleChange}
              required
            />
          </div>
        )}

        {inputUnit === 'BX' && (
          <div className="computed-total-label">
            Total quantity to record: <strong>{numBoxes * qtyPerBox}</strong> Pieces
          </div>
        )}

        <button type="submit" disabled={loading || !formData.productId || !formData.warehouseId}>
          {loading ? 'Processing...' : 'Submit Transaction'}
        </button>

        {message.text && (
          <div className={`form-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </form>

      <style jsx>{`
        .stock-movement-form { padding: 5px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 700; font-size: 13px; color: #475569; }
        .form-group select, .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        /* Custom Searchable Dropdown styles */
        .custom-select-container {
          position: relative;
          width: 100%;
        }
        .custom-select-trigger {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: 8px 12px;
          background-color: var(--hw-panel-bg, #ffffff);
          border: 1px solid var(--hw-border, #cbd5e1);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          color: var(--hw-charcoal, #1e293b);
          transition: border-color 0.2s, box-shadow 0.2s;
          user-select: none;
        }
        .custom-select-trigger:hover {
          border-color: var(--hw-orange, #f97316);
        }
        .custom-select-trigger.active {
          border-color: var(--hw-orange, #f97316);
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
        }
        .trigger-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-right: 8px;
          font-weight: 500;
        }
        .trigger-arrow {
          font-size: 10px;
          color: var(--hw-steel, #94a3b8);
          transition: transform 0.2s;
        }
        .custom-select-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background-color: var(--hw-panel-bg, #ffffff);
          border: 1px solid var(--hw-border, #cbd5e1);
          border-radius: 6px;
          box-shadow: var(--hw-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05));
          z-index: 1000;
          overflow: hidden;
          animation: slideDown 0.15s ease-out;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .search-input-wrapper {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid var(--hw-border, #e2e8f0);
          background-color: var(--hw-bg-light, #f8fafc);
          position: relative;
        }
        .search-icon {
          font-size: 14px;
          color: var(--hw-steel, #94a3b8);
          margin-right: 8px;
        }
        .dropdown-search-input {
          flex: 1;
          border: none !important;
          outline: none !important;
          background: transparent !important;
          padding: 4px 0 !important;
          font-size: 13px !important;
          color: var(--hw-charcoal, #1e293b) !important;
          box-shadow: none !important;
        }
        .clear-search-btn {
          background: none !important;
          border: none !important;
          color: var(--hw-steel, #94a3b8) !important;
          cursor: pointer;
          font-size: 16px !important;
          padding: 0 4px !important;
          width: auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .clear-search-btn:hover {
          color: var(--hw-red, #ef4444) !important;
        }
        .dropdown-options-list {
          max-height: 220px;
          overflow-y: auto;
        }
        .dropdown-option {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 13px;
          color: var(--hw-charcoal, #1e293b);
          transition: background-color 0.15s;
        }
        .dropdown-option:hover {
          background-color: var(--hw-bg-light, #f1f5f9);
        }
        .dropdown-option.selected {
          background-color: rgba(249, 115, 22, 0.15);
          color: var(--hw-orange, #f97316);
          font-weight: 600;
        }
        .dropdown-option.selected:hover {
          background-color: rgba(249, 115, 22, 0.2);
        }
        .option-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-right: 12px;
        }
        .option-sku {
          font-size: 11px;
          font-weight: 600;
          color: var(--hw-steel, #64748b);
          background-color: var(--hw-bg-light, #f1f5f9);
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .dropdown-option.selected .option-sku {
          color: var(--hw-orange, #f97316);
          background-color: rgba(249, 115, 22, 0.15);
        }
        .no-options-found {
          padding: 16px;
          text-align: center;
          color: var(--hw-steel, #64748b);
          font-size: 13px;
          font-style: italic;
        }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        @media (max-width: 480px) {
          .form-row { grid-template-columns: 1fr; gap: 10px; }
        }
        .card-inside-row {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
        }
        .computed-total-label {
          font-size: 12px;
          color: #475569;
          margin-bottom: 15px;
          text-align: right;
        }
        .computed-total-label strong {
          color: var(--hw-orange);
        }
        .stock-info-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-left: 4px solid var(--hw-steel);
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 15px;
          font-size: 12px;
        }
        .stock-label {
          color: #475569;
          font-weight: 600;
        }
        .stock-value {
          font-weight: 700;
          color: #1e293b;
        }
        .stock-value.empty {
          color: #ef4444;
        }
        .stock-value.low {
          color: #f97316;
        }
        .stock-value.good {
          color: #10b981;
        }
        button {
          width: 100%;
          padding: 10px;
          background-color: var(--hw-orange) !important;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        button:disabled { background-color: #ccc !important; cursor: not-allowed; }
        .form-message { margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 13px; font-weight: 600; }
        .form-message.success { background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; }
        .form-message.error { background-color: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
      `}</style>
    </div>
  );
};

export default StockMovementForm;
