import React, { useState, useEffect } from 'react';

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
        alert(`Stock movement recorded successfully!\n\n${result.message}`);
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

  return (
    <div className="stock-movement-form">
      <h3>Record Stock Movement</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Product</label>
          <select name="productId" value={formData.productId} onChange={handleChange} required>
            <option value="">Select Product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
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
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
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
