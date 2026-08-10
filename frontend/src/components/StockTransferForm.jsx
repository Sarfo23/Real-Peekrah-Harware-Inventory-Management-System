import React, { useState, useEffect, useRef } from 'react';

function StockTransferForm({ onTransferComplete }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [formData, setFormData] = useState({
    productId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: ''
  });
  const [sourceStock, setSourceStock] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Unit input states for transfer
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, whRes, shopRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/warehouses'),
          fetch('/api/shops')
        ]);
        if (prodRes.ok && whRes.ok && shopRes.ok) {
          const prodData = await prodRes.json();
          const whData = (await whRes.json()).map(w => ({ ...w, type: 'WAREHOUSE' }));
          const shopData = (await shopRes.json()).map(s => ({ ...s, type: 'SHOP' }));
          setProducts(prodData);
          setWarehouses([...whData, ...shopData]);
        }
      } catch (err) {
        console.error('Error fetching data for transfers:', err);
      }
    };
    fetchData();
  }, []);

  // Sync unit type when selected product changes
  useEffect(() => {
    const selectedProd = products.find(p => p.id === parseInt(formData.productId));
    if (selectedProd && (selectedProd.sku === 'BX' || selectedProd.sku === 'PCS')) {
      setInputUnit(selectedProd.sku);
    }
  }, [formData.productId, products]);

  // Fetch stock levels of selected product at selected source warehouse
  useEffect(() => {
    const fetchSourceStock = async () => {
      if (!formData.productId || !formData.fromWarehouseId) {
        setSourceStock(null);
        return;
      }
      try {
        const res = await fetch(`/api/products/${formData.productId}/inventory`);
        if (res.ok) {
          const data = await res.json();
          const sourceWhInv = data.find(
            item => parseInt(item.warehouse_id) === parseInt(formData.fromWarehouseId)
          );
          setSourceStock(sourceWhInv ? sourceWhInv.quantity : 0);
        }
      } catch (err) {
        console.error('Error querying source stock:', err);
      }
    };
    fetchSourceStock();
  }, [formData.productId, formData.fromWarehouseId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    const { productId, fromWarehouseId, toWarehouseId } = formData;
    const finalQuantity = inputUnit === 'BX' ? (numBoxes * qtyPerBox) : parseInt(formData.quantity);

    if (!productId || !fromWarehouseId || !toWarehouseId || !finalQuantity) {
      setMessage({ type: 'error', text: 'All fields are required.' });
      return;
    }

    if (parseInt(fromWarehouseId) === parseInt(toWarehouseId)) {
      setMessage({ type: 'error', text: 'Source and destination warehouses must be different.' });
      return;
    }

    if (parseInt(finalQuantity) <= 0) {
      setMessage({ type: 'error', text: 'Transfer quantity must be greater than 0.' });
      return;
    }

    if (sourceStock === null || sourceStock < parseInt(finalQuantity)) {
      setMessage({ type: 'error', text: `Insufficient stock. Only ${sourceStock || 0} units available.` });
      return;
    }

    const payload = {
      productId: parseInt(productId),
      fromWarehouseId: parseInt(fromWarehouseId),
      toWarehouseId: parseInt(toWarehouseId),
      quantity: parseInt(finalQuantity),
      userId: 1 // Placeholder user id
    };

    const selectedProduct = products.find(p => Number(p.id) === Number(productId));
    const prodName = selectedProduct ? selectedProduct.name : `Product #${productId}`;

    const clearForm = () => {
      setFormData({
        productId: '',
        fromWarehouseId: '',
        toWarehouseId: '',
        quantity: ''
      });
      setNumBoxes(1);
      setSourceStock(null);
    };

    // Hard offline check: skip fetch if browser is offline
    if (window.HIMS_isOnline && !window.HIMS_isOnline()) {
      const itemLabel = `Transfer: ${finalQuantity} units of ${prodName}`;
      
      if (window.HIMS_queueTransaction) {
        window.HIMS_queueTransaction('/api/inventory/transfer', payload, itemLabel);
        setMessage({ 
          type: 'success', 
          text: `Offline Success: Transfer queued locally. ${finalQuantity} units of ${prodName} stored. Will sync when online!` 
        });
        if (onTransferComplete) onTransferComplete();
        clearForm();
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Stock transfer logged successfully.' });
        clearForm();
        if (onTransferComplete) onTransferComplete();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to complete transfer.' });
      }
    } catch (err) {
      // Soft offline check: if network request failed, queue it
      const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('NetworkError');
      if (isNetworkError && window.HIMS_queueTransaction) {
        const itemLabel = `Transfer: ${finalQuantity} units of ${prodName}`;
        window.HIMS_queueTransaction('/api/inventory/transfer', payload, itemLabel);
        setMessage({ 
          type: 'success', 
          text: `Offline Success: Connection failed. Queued transfer of ${finalQuantity} units of ${prodName} in browser memory. Will auto-sync when online!` 
        });
        if (onTransferComplete) onTransferComplete();
        clearForm();
      } else {
        setMessage({ type: 'error', text: 'Network error. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => Number(p.id) === Number(formData.productId));

  return (
    <div className="transfer-form-container">
      <form onSubmit={handleSubmit} className="transfer-form">
        {message && (
          <div className={`form-message ${message.type}`}>
            {message.type === 'error' ? '⚠️' : '✅'} {message.text}
          </div>
        )}

        <div className="form-group" ref={dropdownRef}>
          <label>Select Product (UMO)</label>
          <div className="custom-select-container">
            <div 
              className={`custom-select-trigger ${isDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="trigger-text">
                {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : '-- Choose Hardware Item --'}
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

        <div className="form-grid">
          <div className="form-group">
            <label>Source Warehouse</label>
            <select 
              name="fromWarehouseId" 
              value={formData.fromWarehouseId} 
              onChange={handleChange}
              required
            >
              <option value="">-- Select Source --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type === 'SHOP' ? 'Shop' : 'Warehouse'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Destination Warehouse / Shop</label>
            <select 
              name="toWarehouseId" 
              value={formData.toWarehouseId} 
              onChange={handleChange}
              required
            >
              <option value="">-- Select Destination --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type === 'SHOP' ? 'Shop' : 'Warehouse'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {sourceStock !== null && (
          <div className={`stock-level-indicator ${sourceStock > 0 ? 'in-stock' : 'out-of-stock'}`}>
            <span>Current Available Stock at Source:</span>
            <strong>{sourceStock} Units</strong>
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
          {inputUnit === 'BX' ? (
            <div className="box-input-row">
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
                <label>Qty per Box</label>
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
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Transfer Quantity (Pieces)</label>
              <input
                type="number"
                name="quantity"
                min="1"
                placeholder="Specify pieces to move..."
                value={formData.quantity}
                onChange={handleChange}
                required
              />
            </div>
          )}
        </div>

        {inputUnit === 'BX' && (
          <div style={{ fontSize: '11px', color: 'var(--hw-steel)', textAlign: 'right', marginTop: '-5px', marginBottom: '5px' }}>
            Total quantity to transfer: <strong>{numBoxes * qtyPerBox}</strong> Pieces
          </div>
        )}

        <button 
          type="submit" 
          className="btn-transfer-submit" 
          disabled={loading}
          style={{ width: '100%', marginTop: '10px' }}
        >
          {loading ? 'Executing Transfer...' : 'Initiate Internal Transfer'}
        </button>
      </form>

      <style jsx>{`
        .transfer-form-container {
          width: 100%;
          padding: 0;
          box-sizing: border-box;
        }
        .transfer-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        @media (max-width: 480px) {
          .form-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        @media (max-width: 480px) {
          .form-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        .box-input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background-color: var(--hw-bg-light);
          padding: 10px;
          border-radius: 4px;
          border: 1px dashed var(--hw-border);
          grid-column: span 2;
        }
        @media (max-width: 480px) {
          .box-input-row {
            grid-template-columns: 1fr;
          }
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
        }
        .form-group label {
          font-size: 11px;
          font-weight: 700;
          color: var(--hw-steel);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-message {
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-align: left;
        }
        .form-message.error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        .form-message.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .stock-level-indicator {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          border: 1px solid var(--hw-border);
        }
        .stock-level-indicator.in-stock {
          background-color: var(--hw-bg-light);
          border-left: 4px solid var(--hw-green);
        }
        .stock-level-indicator.out-of-stock {
          background-color: #fee2e2;
          border-left: 4px solid var(--hw-red);
          color: #991b1b;
        }
        .btn-transfer-submit {
          background-color: var(--hw-orange) !important;
          color: white !important;
          padding: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          border-radius: 4px !important;
          border: none !important;
          cursor: pointer;
          font-size: 13px !important;
        }
        .btn-transfer-submit:hover:not(:disabled) {
          background-color: var(--hw-orange-hover) !important;
        }
        .btn-transfer-submit:disabled {
          background-color: #cbd5e1 !important;
          cursor: not-allowed;
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
      `}</style>
    </div>
  );
}

export default StockTransferForm;
