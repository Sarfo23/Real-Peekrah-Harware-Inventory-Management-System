import React, { useState, useEffect } from 'react';

/**
 * ProductInventoryList Component
 * Displays a quick reference of all registered products
 * and allows editing, deleting, and logging stock transactions directly.
 */
const ProductInventoryList = ({ preselectedProductId, onClearPreselected }) => {
  const currentUser = JSON.parse(localStorage.getItem('hims_user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    sku: '',
    categoryId: '',
    lowStockThreshold: 10,
    cost_price: 0,
    selling_price: 0
  });
  const [editMessage, setEditMessage] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Warehouse-wise inventory levels for the editing product
  const [productInventory, setProductInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Quick Stock Movement State
  const [quickMovement, setQuickMovement] = useState({
    warehouseId: '',
    type: 'IN',
    quantity: 1
  });
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementMessage, setMovementMessage] = useState(null);

  // Unit input states for quick movement
  const [quickInputUnit, setQuickInputUnit] = useState('PCS'); // 'PCS' or 'BX'
  const [quickNumBoxes, setQuickNumBoxes] = useState(1);
  const [quickQtyPerBox, setQuickQtyPerBox] = useState(10);

  // Fetch products, categories, and warehouses
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, wareRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/warehouses')
      ]);

      if (!prodRes.ok || !catRes.ok || !wareRes.ok) {
        throw new Error('Failed to fetch registry data');
      }

      setProducts(await prodRes.json());
      setCategories(await catRes.json());
      setWarehouses(await wareRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isSuperAdmin && preselectedProductId && products.length > 0) {
      const prod = products.find(p => p.id === preselectedProductId);
      if (prod) {
        handleEditClick(prod);
        if (onClearPreselected) {
          onClearPreselected();
        }
      }
    }
  }, [preselectedProductId, products, onClearPreselected, isSuperAdmin]);

  const fetchProductInventory = async (productId) => {
    setInventoryLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/inventory`);
      if (!res.ok) throw new Error('Failed to load warehouse stock levels');
      const data = await res.json();
      setProductInventory(data);
    } catch (err) {
      console.error(err);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently decommission this hardware asset? This will delete the product record.')) {
      return;
    }
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Decommissioning failed');
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      alert(`Decommissioning error: ${err.message}`);
    }
  };

  const exportToCSV = () => {
    const headers = ['UMO', 'Name', 'Category', 'Stock Status', 'Closing Stock', 'Unit Cost (GH₵)', 'Unit Price (GH₵)', 'Total Valuation (GH₵)'];
    const rows = filteredProducts.map(p => {
      const stockStatus = p.quantity === 0 ? 'OUT' : (p.quantity < p.low_stock_threshold ? 'LOW' : 'OK');
      const val = p.quantity * p.cost_price;
      return [
        p.sku,
        p.name,
        p.category_name || 'Unassigned',
        stockStatus,
        p.quantity,
        p.cost_price,
        p.selling_price,
        val
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HIMS_Active_Hardware_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      sku: product.sku,
      categoryId: product.category_id || '',
      lowStockThreshold: product.low_stock_threshold || 10,
      cost_price: product.cost_price || 0,
      selling_price: product.selling_price || 0
    });
    setEditMessage(null);
    setMovementMessage(null);
    setQuickMovement({
      warehouseId: '',
      type: 'IN',
      quantity: 1
    });
    setQuickInputUnit(product.sku === 'BX' || product.sku === 'PCS' ? product.sku : 'PCS');
    setQuickNumBoxes(1);
    setQuickQtyPerBox(10);
    fetchProductInventory(product.id);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: name === 'categoryId' || name === 'lowStockThreshold'
        ? parseInt(value) || ''
        : name === 'cost_price' || name === 'selling_price'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.name || !editFormData.sku || !editFormData.categoryId) {
      setEditMessage({ type: 'error', text: 'Name, UMO, and Category are required.' });
      return;
    }

    setEditLoading(true);
    setEditMessage(null);

    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          sku: editFormData.sku.trim().toUpperCase(),
          categoryId: editFormData.categoryId,
          lowStockThreshold: editFormData.lowStockThreshold,
          cost_price: editFormData.cost_price,
          selling_price: editFormData.selling_price
        })
      });

      if (response.ok) {
        setEditMessage({ type: 'success', text: 'Hardware asset updated successfully!' });
        await fetchData();
        // Keep modal open, but clear messages after a short delay
        setTimeout(() => {
          setEditMessage(null);
        }, 1500);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update asset');
      }
    } catch (err) {
      setEditMessage({ type: 'error', text: err.message });
    } finally {
      setEditLoading(false);
    }
  };

  const handleQuickMovementSubmit = async (e) => {
    e.preventDefault();
    if (!quickMovement.warehouseId) {
      setMovementMessage({ type: 'error', text: 'Select warehouse.' });
      return;
    }

    setMovementLoading(true);
    setMovementMessage(null);

    const finalQuantity = quickInputUnit === 'BX' ? (quickNumBoxes * quickQtyPerBox) : quickMovement.quantity;

    const payload = {
      productId: editingProduct.id,
      warehouseId: parseInt(quickMovement.warehouseId),
      type: quickMovement.type,
      quantity: parseInt(finalQuantity) || 0,
      userId: 1 // Default system user
    };

    try {
      const response = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        setMovementMessage({ type: 'success', text: `Logged: ${result.message}` });
        setQuickMovement(prev => ({ ...prev, quantity: 1 }));
        setQuickNumBoxes(1);
        // Re-fetch current warehouse distribution levels and general products list
        await Promise.all([
          fetchProductInventory(editingProduct.id),
          fetchData()
        ]);
        setTimeout(() => {
          setMovementMessage(null);
        }, 3000);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (err) {
      setMovementMessage({ type: 'error', text: err.message });
    } finally {
      setMovementLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = 
      !selectedCategory || p.category_id === parseInt(selectedCategory);
      
    const isLowStock = p.quantity < p.low_stock_threshold && p.quantity > 0;
    const isOutOfStock = p.quantity <= 0;
    
    let matchesStatus = true;
    if (stockStatusFilter === 'low') {
      matchesStatus = isLowStock;
    } else if (stockStatusFilter === 'out') {
      matchesStatus = isOutOfStock;
    } else if (stockStatusFilter === 'normal') {
      matchesStatus = !isLowStock && !isOutOfStock;
    }
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStockStatusMarkup = (qty, threshold) => {
    if (qty <= 0) {
      return (
        <span className="status-pill status-out" title="Out of Stock">
          <span className="dot"></span> OUT (0)
        </span>
      );
    }
    if (qty < threshold) {
      return (
        <span className="status-pill status-low" title="Low Stock Alert">
          <span className="dot"></span> LOW ({qty})
        </span>
      );
    }
    return (
      <span className="status-pill status-ok" title="Stock Level OK">
        <span className="dot"></span> OK ({qty})
      </span>
    );
  };

  return (
    <div className="inventory-ref-panel">
      <h3>Active Hardware Registry</h3>
      
      {!loading && !error && products.length > 0 && (
        <div className="registry-filters">
          <div className="filter-group search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by UMO or item name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group category-select">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parent_name ? `${c.parent_name} > ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group status-select">
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Levels</option>
              <option value="normal">Good Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <button onClick={exportToCSV} className="btn-export-csv" title="Export Registry to Excel CSV">
            📥 Export CSV
          </button>
        </div>
      )}

      {loading && <p className="loading-text">Scanning Hardware Assets...</p>}
      {error && <p className="error-text">Error: {error}</p>}

      {!loading && !error && products.length === 0 && (
        <p className="empty-text">No registered assets found.</p>
      )}

      {!loading && !error && products.length > 0 && filteredProducts.length === 0 && (
        <p className="empty-text">No assets match the active filters.</p>
      )}

      {!loading && filteredProducts.length > 0 && (
        <div className="ref-table-wrapper">
          <table className="ref-table">
            <thead>
              <tr>
                <th>UMO</th>
                <th>Name</th>
                <th>Stock Status</th>
                <th>CumQty</th>
                <th>Cost (GH₵)</th>
                <th>Price (GH₵)</th>
                {isSuperAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td><code className="sku-code">{p.sku}</code></td>
                  <td className="product-name-cell"><strong>{p.name}</strong></td>
                  <td>{getStockStatusMarkup(p.quantity, p.low_stock_threshold)}</td>
                  <td>{p.cumulative_quantity}</td>
                  <td>{parseFloat(p.cost_price).toFixed(2)}</td>
                  <td>{parseFloat(p.selling_price).toFixed(2)}</td>
                  {isSuperAdmin && (
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-edit" onClick={() => handleEditClick(p)}>Manage</button>
                      <button className="btn-delete" onClick={() => handleDelete(p.id)}>Decom</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Split Edit & Stock Movement Modal Overlay */}
      {editingProduct && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h3>Manage Hardware Asset: {editingProduct.sku}</h3>
              <button className="modal-close-btn" onClick={() => setEditingProduct(null)}>&times;</button>
            </div>
            
            <div className="modal-body-split">
              {/* Left Column: Product Details Form */}
              <div className="modal-col-details">
                <h4>Asset Metadata</h4>
                <form onSubmit={handleEditSubmit} className="modal-form">
                  <div className="form-group">
                    <label>Asset Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit Type (SKU)</label>
                    <select
                      name="sku"
                      value={editFormData.sku}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="BX">BX (Boxes)</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Cost Price (GH₵)</label>
                      <input
                        type="number"
                        name="cost_price"
                        min="0"
                        step="0.01"
                        value={editFormData.cost_price}
                        onChange={handleEditChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Selling Price (GH₵)</label>
                      <input
                        type="number"
                        name="selling_price"
                        min="0"
                        step="0.01"
                        value={editFormData.selling_price}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        name="categoryId"
                        value={editFormData.categoryId}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.parent_name ? `${c.parent_name} > ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Low Stock Limit</label>
                      <input
                        type="number"
                        name="lowStockThreshold"
                        min="0"
                        value={editFormData.lowStockThreshold}
                        onChange={handleEditChange}
                      />
                    </div>
                  </div>

                  {editMessage && (
                    <div className={`modal-message ${editMessage.type}`}>
                      {editMessage.text}
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="submit" className="btn-save" disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save Metadata'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Warehouse Stock Distribution & Quick Stock Movement */}
              <div className="modal-col-stock">
                <h4>Warehouse Distribution</h4>
                {inventoryLoading ? (
                  <p className="loading-sub-text">Scanning Stockrooms...</p>
                ) : (
                  <div className="stock-breakdown-list">
                    {productInventory.length === 0 ? (
                      <p className="empty-sub-text">No active storage records found.</p>
                    ) : (
                      <table className="breakdown-table">
                        <thead>
                          <tr>
                            <th>Warehouse</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productInventory.map(w => (
                            <tr key={w.warehouse_id} className={w.quantity === 0 ? 'inactive-row' : ''}>
                              <td>{w.warehouse_name} <span className="location-lbl">({w.warehouse_location || 'No Location'})</span></td>
                              <td><strong>{w.quantity}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <div className="modal-quick-movement">
                  <h4>Quick Stock Movement</h4>
                  <form onSubmit={handleQuickMovementSubmit} className="quick-move-form">
                    <div className="form-group">
                      <label>Warehouse</label>
                      <select
                        value={quickMovement.warehouseId}
                        onChange={e => setQuickMovement(prev => ({ ...prev, warehouseId: e.target.value }))}
                        required
                      >
                        <option value="">-- Target Warehouse --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Input Unit</label>
                        <select
                          value={quickInputUnit}
                          onChange={e => setQuickInputUnit(e.target.value)}
                        >
                          <option value="PCS">PCS (Pieces)</option>
                          <option value="BX">BX (Boxes)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Type</label>
                        <select
                          value={quickMovement.type}
                          onChange={e => setQuickMovement(prev => ({ ...prev, type: e.target.value }))}
                        >
                          <option value="IN">IN (Replenish)</option>
                          <option value="OUT">OUT (Dispatch)</option>
                        </select>
                      </div>
                    </div>

                    {quickInputUnit === 'BX' ? (
                      <div className="form-row" style={{ backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
                        <div className="form-group">
                          <label>Boxes</label>
                          <input
                            type="number"
                            min="1"
                            value={quickNumBoxes}
                            onChange={e => setQuickNumBoxes(Math.max(1, parseInt(e.target.value) || 1))}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Qty / Box</label>
                          <input
                            type="number"
                            min="1"
                            value={quickQtyPerBox}
                            onChange={e => setQuickQtyPerBox(Math.max(1, parseInt(e.target.value) || 1))}
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Qty (Pieces)</label>
                        <input
                          type="number"
                          min="1"
                          value={quickMovement.quantity}
                          onChange={e => setQuickMovement(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                          required
                        />
                      </div>
                    )}

                    {quickInputUnit === 'BX' && (
                      <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'right', marginTop: '-4px' }}>
                        Total quantity to record: <strong>{quickNumBoxes * quickQtyPerBox}</strong> Pieces
                      </div>
                    )}

                    <button type="submit" className="btn-log-movement" disabled={movementLoading || !quickMovement.warehouseId}>
                      {movementLoading ? 'Logging...' : 'Log Movement'}
                    </button>
                  </form>
                  
                  {movementMessage && (
                    <div className={`modal-message ${movementMessage.type}`} style={{ marginTop: '10px' }}>
                      {movementMessage.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer-close">
              <button type="button" className="btn-cancel" onClick={() => setEditingProduct(null)}>
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inventory-ref-panel {
          background: #ffffff;
          border-radius: var(--hw-radius);
          font-family: 'Inter', sans-serif;
        }
        .inventory-ref-panel h3 {
          margin: 0 0 15px 0;
          font-size: 13px;
          text-transform: uppercase;
          color: var(--hw-charcoal);
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--hw-bg);
          padding-bottom: 8px;
        }
        .registry-filters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 15px;
        }
        @media (max-width: 768px) {
          .registry-filters {
            grid-template-columns: 1fr;
          }
        }
        .filter-group {
          display: flex;
          align-items: center;
          position: relative;
        }
        .filter-input {
          width: 100%;
          padding: 8px 12px 8px 30px !important;
          font-size: 13px !important;
          border: 1px solid var(--hw-border) !important;
          border-radius: 4px !important;
        }
        .filter-select {
          width: 100%;
          padding: 8px 12px !important;
          font-size: 13px !important;
          border: 1px solid var(--hw-border) !important;
          border-radius: 4px !important;
          cursor: pointer;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          color: #94a3b8;
          font-size: 13px;
          pointer-events: none;
        }
        
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .status-pill.status-ok {
          background-color: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }
        .status-pill.status-ok .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #10b981;
        }
        .status-pill.status-low {
          background-color: #fff7ed;
          color: #c2410c;
          border: 1px solid #ffedd5;
        }
        .status-pill.status-low .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #f97316;
        }
        .status-pill.status-out {
          background-color: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
        }
        .status-pill.status-out .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #ef4444;
        }
        
        .loading-text, .empty-text {
          font-size: 13px;
          color: #64748b;
          font-style: italic;
          padding: 10px 0;
        }
        .error-text {
          font-size: 13px;
          color: #ef4444;
          padding: 10px 0;
        }
        .ref-table-wrapper {
          max-height: 580px;
          overflow-y: auto;
          border: 1px solid var(--hw-border);
          border-radius: 4px;
        }
        .ref-table {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
          text-align: left;
        }
        .ref-table th {
          position: sticky;
          top: 0;
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          padding: 10px 12px;
          border-bottom: 2px solid var(--hw-border);
          z-index: 2;
        }
        .ref-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .ref-table tr:hover {
          background-color: #f8fafc;
        }
        .sku-code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: var(--hw-steel);
          font-weight: 600;
        }
        .product-name-cell {
          font-size: 12px;
          color: var(--hw-slate-dark);
        }
        .warning-text {
          color: #ea580c;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .warning-dot {
          background-color: #f97316;
          color: white;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 900;
        }
        .btn-edit {
          background-color: #475569 !important;
          margin-right: 6px;
          padding: 4px 8px !important;
          font-size: 11px !important;
        }
        .btn-edit:hover {
          background-color: #334155 !important;
        }
        .btn-delete {
          background-color: #ef4444 !important;
          padding: 4px 8px !important;
          font-size: 11px !important;
        }
        .btn-delete:hover {
          background-color: #dc2626 !important;
        }

        /* Modal styling consistent with Industrial aesthetic */
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
          animation: fadeIn 0.2s ease-out;
        }
        .modal-container {
          background: #ffffff;
          border-radius: 6px;
          width: 95%;
          max-width: 900px; /* Wider split layout */
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
          border-bottom: none;
          padding-bottom: 0;
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
        
        .modal-body-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 20px;
          background-color: #ffffff;
        }
        @media (max-width: 768px) {
          .modal-body-split {
            grid-template-columns: 1fr;
            max-height: 70vh;
            overflow-y: auto;
          }
        }
        
        .modal-col-details {
          border-right: 1px solid #e2e8f0;
          padding-right: 12px;
        }
        @media (max-width: 768px) {
          .modal-col-details {
            border-right: none;
            padding-right: 0;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 20px;
          }
        }
        
        .modal-col-details h4, .modal-col-stock h4 {
          margin: 0 0 14px 0;
          font-size: 12px;
          text-transform: uppercase;
          color: #475569;
          letter-spacing: 0.04em;
          font-weight: 700;
          border-left: 3px solid var(--hw-orange);
          padding-left: 8px;
        }
        
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .modal-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .modal-form .form-group label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .stock-breakdown-list {
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          max-height: 150px;
          overflow-y: auto;
          margin-bottom: 18px;
        }
        .breakdown-table {
          width: 100%;
          font-size: 11px;
          border-collapse: collapse;
        }
        .breakdown-table th {
          background-color: #f8fafc;
          padding: 6px 10px;
          font-weight: 700;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }
        .breakdown-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .breakdown-table tr.inactive-row {
          color: #94a3b8;
        }
        .location-lbl {
          font-size: 10px;
          color: #94a3b8;
          font-style: italic;
        }
        
        .modal-quick-movement {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          padding: 12px;
        }
        .modal-quick-movement h4 {
          margin: 0 0 10px 0;
          font-size: 11px;
          border-left: 3px solid var(--hw-steel);
        }
        .quick-move-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .quick-move-form label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .quick-move-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .btn-log-movement {
          width: 100%;
          background-color: var(--hw-steel) !important;
          color: white !important;
          padding: 8px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }
        .btn-log-movement:hover {
          background-color: var(--hw-charcoal) !important;
        }
        .btn-log-movement:disabled {
          background-color: #cbd5e1 !important;
          cursor: not-allowed;
        }

        .modal-actions {
          margin-top: 10px;
          display: flex;
          justify-content: flex-end;
        }
        
        .modal-footer-close {
          background-color: #f8fafc;
          padding: 12px 20px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #e2e8f0;
        }
        .btn-export-csv {
          background-color: var(--hw-blue) !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 8px 12px !important;
          border-radius: 4px !important;
          cursor: pointer;
          border: none !important;
          text-transform: uppercase;
          transition: background 0.2s ease !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-export-csv:hover {
          background-color: #025a87 !important;
        }
        .btn-cancel {
          background-color: #e2e8f0 !important;
          color: #475569 !important;
          padding: 6px 12px !important;
        }
        .btn-cancel:hover {
          background-color: #cbd5e1 !important;
        }
        .btn-save {
          background-color: var(--hw-orange) !important;
          width: 100%;
        }
        .modal-message {
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .modal-message.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #10b981;
        }
        .modal-message.error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #ef4444;
        }
        .loading-sub-text, .empty-sub-text {
          font-size: 11px;
          color: #94a3b8;
          font-style: italic;
          padding: 6px 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ProductInventoryList;
