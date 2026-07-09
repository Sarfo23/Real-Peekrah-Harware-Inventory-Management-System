import React, { useState, useEffect } from 'react';

/**
 * SalesForm Component
 * Allows recording sales of hardware products from warehouse inventory.
 */
const SalesForm = ({ onTransactionComplete }) => {
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    warehouseId: '',
    quantity: 1,
    userId: 1 // Default user
  });

  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [currentStock, setCurrentStock] = useState(null);
  const [fetchingStock, setFetchingStock] = useState(false);

  // Unit input states
  const [inputUnit, setInputUnit] = useState('PCS'); // 'PCS' or 'BX'
  const [numBoxes, setNumBoxes] = useState(1);
  const [qtyPerBox, setQtyPerBox] = useState(10);

  // Competitor-sourced states
  const [isCompetitorSourced, setIsCompetitorSourced] = useState(false);
  const [competitorCostPrice, setCompetitorCostPrice] = useState('');
  const [competitorSellingPrice, setCompetitorSellingPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');

  // Fetch initial shops
  useEffect(() => {
    const fetchInitialShops = async () => {
      try {
        const res = await fetch('/api/shops');
        if (res.ok) {
          const shopData = await res.json();
          setShops(shopData);
          if (shopData.length > 0) {
            setFormData(prev => ({ ...prev, warehouseId: shopData[0].id }));
          }
        }
      } catch (err) {
        console.error('Error loading shops:', err);
      }
    };
    fetchInitialShops();
  }, []);

  // Fetch products (in stock for selected Shop, only if NOT competitor-sourced)
  useEffect(() => {
    if (formData.warehouseId && !isCompetitorSourced) {
      const fetchProductsData = async () => {
        setFetchingStock(true);
        try {
          const res = await fetch(`/api/warehouses/${formData.warehouseId}/inventory`);
          if (res.ok) {
            const data = await res.json();
            setProducts(data);
            if (data.length > 0) {
              setFormData(prev => ({ ...prev, productId: data[0].id }));
              setCurrentStock(data[0].quantity);
            } else {
              setFormData(prev => ({ ...prev, productId: '' }));
              setCurrentStock(0);
            }
          } else {
            setProducts([]);
            setFormData(prev => ({ ...prev, productId: '' }));
            setCurrentStock(0);
          }
        } catch (err) {
          console.error('Error fetching shop inventory:', err);
          setProducts([]);
          setFormData(prev => ({ ...prev, productId: '' }));
          setCurrentStock(0);
        } finally {
          setFetchingStock(false);
        }
      };
      fetchProductsData();
    } else {
      setProducts([]);
      setFormData(prev => ({ ...prev, productId: '' }));
      setCurrentStock(null);
    }
  }, [formData.warehouseId, isCompetitorSourced]);

  // Sync unit type and default prices when selected product changes (only in standard mode)
  useEffect(() => {
    if (!isCompetitorSourced) {
      const selectedProd = products.find(p => p.id === formData.productId);
      if (selectedProd) {
        setCurrentStock(selectedProd.quantity);
        if (selectedProd.sku === 'BX' || selectedProd.sku === 'PCS') {
          setInputUnit(selectedProd.sku);
        }
      } else {
        setCurrentStock(null);
      }
    }
  }, [formData.productId, products, isCompetitorSourced]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'productId' || name === 'warehouseId'
        ? parseInt(value) || ''
        : value
    }));
  };

  const selectedProduct = products.find(p => p.id === formData.productId);
  const finalQuantity = inputUnit === 'BX' ? (numBoxes * qtyPerBox) : (formData.quantity || 0);

  const activeSellingPrice = isCompetitorSourced 
    ? (parseFloat(competitorSellingPrice) || 0)
    : (selectedProduct ? parseFloat(selectedProduct.selling_price || 0) : 0);

  const activeCostPrice = isCompetitorSourced
    ? (parseFloat(competitorCostPrice) || 0)
    : (selectedProduct ? parseFloat(selectedProduct.cost_price || 0) : 0);

  const subtotal = finalQuantity * activeSellingPrice;
  const discount = parseFloat(discountAmount) || 0;
  const totalCost = Math.max(0, subtotal - discount);
  const expectedProfit = totalCost - (finalQuantity * activeCostPrice);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    if (!isCompetitorSourced && (currentStock === null || currentStock < finalQuantity)) {
      setMessage({ text: `Error: Insufficient stock. Only ${currentStock || 0} units available at target shop.`, type: 'error' });
      setLoading(false);
      return;
    }

    const payload = {
      productId: isCompetitorSourced ? null : formData.productId,
      productName: isCompetitorSourced ? formData.productName : null,
      warehouseId: formData.warehouseId,
      type: 'OUT',
      quantity: finalQuantity,
      isSale: true,
      userId: formData.userId,
      isCompetitorSourced: isCompetitorSourced ? 1 : 0,
      competitorCostPrice: isCompetitorSourced ? parseFloat(competitorCostPrice) : null,
      competitorSellingPrice: isCompetitorSourced ? parseFloat(competitorSellingPrice) : null,
      discountAmount: discount
    };

    const clearForm = () => {
      setFormData(prev => ({ ...prev, quantity: 1, productName: '' }));
      setNumBoxes(1);
      setCompetitorCostPrice('');
      setCompetitorSellingPrice('');
      setDiscountAmount('0');
    };

    // Hard offline check: skip fetch if browser is offline
    if (window.HIMS_isOnline && !window.HIMS_isOnline()) {
      const itemLabel = isCompetitorSourced 
        ? `Sale: ${formData.productName} (${finalQuantity} units) - Competitor Sourced`
        : `Sale: ${selectedProduct.name} (${finalQuantity} units)`;
      
      if (window.HIMS_queueTransaction) {
        window.HIMS_queueTransaction('/api/inventory/move', payload, itemLabel);
        const recordedName = isCompetitorSourced ? formData.productName : selectedProduct.name;
        setMessage({ 
          text: `Offline Success: Sale queued in browser storage. Sold ${finalQuantity} units of ${recordedName} (GH₵ ${totalCost.toFixed(2)}). Will sync when online!`, 
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
        const sourceMsg = isCompetitorSourced ? "Competitor Sourced" : "Standard Shop Stock";
        const recordedName = isCompetitorSourced ? formData.productName : selectedProduct.name;
        setMessage({ text: `Success: Sale recorded successfully (${sourceMsg})! Sold ${finalQuantity} units of ${recordedName} for GH₵ ${totalCost.toFixed(2)}.`, type: 'success' });
        if (onTransactionComplete) onTransactionComplete();
        clearForm();
      } else {
        throw new Error(result.error || 'Sale transaction failed');
      }
    } catch (err) {
      // Soft offline check: if network request failed, queue it
      const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('NetworkError');
      if (isNetworkError && window.HIMS_queueTransaction) {
        const itemLabel = isCompetitorSourced 
          ? `Sale: ${formData.productName} (${finalQuantity} units) - Competitor Sourced`
          : `Sale: ${selectedProduct.name} (${finalQuantity} units)`;
          
        window.HIMS_queueTransaction('/api/inventory/move', payload, itemLabel);
        const recordedName = isCompetitorSourced ? formData.productName : selectedProduct.name;
        setMessage({ 
          text: `Offline Success: Connection failed. Stored sale of ${finalQuantity} units of ${recordedName} in browser memory. Will auto-sync when online!`, 
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

  const isSubmitDisabled = loading || 
    !formData.warehouseId || 
    finalQuantity <= 0 || 
    (!isCompetitorSourced && (!formData.productId || (currentStock !== null && currentStock < finalQuantity))) ||
    (isCompetitorSourced && (!formData.productName || competitorCostPrice === '' || competitorSellingPrice === ''));

  return (
    <div className="sales-form">
      <h3>Record Customer Sale</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Select Shop (Source of Sale)</label>
          <select name="warehouseId" value={formData.warehouseId} onChange={handleChange} required>
            <option value="">Select Shop...</option>
            {shops.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={isCompetitorSourced} 
              onChange={(e) => {
                setIsCompetitorSourced(e.target.checked);
                setFormData(prev => ({ ...prev, productId: '', productName: '' }));
                setCompetitorCostPrice('');
                setCompetitorSellingPrice('');
              }} 
            />
            <span className="checkbox-text">Sourced from Competitor (Ignore local stock limits)</span>
          </label>
        </div>

        {isCompetitorSourced ? (
          <div className="form-group">
            <label>Product Name (Competitor Item)</label>
            <input
              type="text"
              name="productName"
              placeholder="Type product name (e.g. Cisco Catalyst 9300)..."
              value={formData.productName}
              onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
              required
            />
          </div>
        ) : (
          <div className="form-group">
            <label>Select Product</label>
            <select 
              name="productId" 
              value={formData.productId} 
              onChange={handleChange} 
              required
              disabled={!formData.warehouseId || fetchingStock}
            >
              <option value="">
                {fetchingStock ? "Loading shop inventory..." : products.length === 0 ? "No active stock available at this shop" : "Select Product..."}
              </option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (In Stock: {p.quantity} | SKU: {p.sku}) | Base Price: GH₵ {parseFloat(p.selling_price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        )}

        {formData.productId && formData.warehouseId && !isCompetitorSourced && (
          <div className="stock-info-banner">
            <span className="stock-label">Available Shop Stock:</span>
            {fetchingStock ? (
              <span className="stock-value loading">Checking...</span>
            ) : (
              <span className={`stock-value ${currentStock === 0 ? 'empty' : currentStock < finalQuantity ? 'low' : 'good'}`}>
                {currentStock} units
              </span>
            )}
          </div>
        )}

        {isCompetitorSourced && formData.productName && (
          <div className="form-row competitor-price-inputs">
            <div className="form-group">
              <label>Competitor Cost Price (per unit)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={competitorCostPrice}
                onChange={e => setCompetitorCostPrice(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Customer Selling Price (per unit)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={competitorSellingPrice}
                onChange={e => setCompetitorSellingPrice(e.target.value)}
                required
              />
            </div>
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
            <label>Unit Selling Price</label>
            <input 
              type="text" 
              value={`GH₵ ${activeSellingPrice.toFixed(2)}`} 
              disabled 
              className="price-preview-input"
            />
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
            <label>Sale Quantity (Pieces)</label>
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

        <div className="form-group">
          <label>Apply Discount (GH₵)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={discountAmount === '0' ? '' : discountAmount}
            onChange={e => setDiscountAmount(e.target.value)}
          />
        </div>

        {(isCompetitorSourced ? formData.productName : selectedProduct) && (
          <div className="invoice-summary-box">
            <div className="invoice-row">
              <span>Product:</span>
              <strong>{isCompetitorSourced ? formData.productName : selectedProduct?.name}</strong>
            </div>
            <div className="invoice-row">
              <span>Total Units to record:</span>
              <strong>{finalQuantity} Pieces</strong>
            </div>
            {isCompetitorSourced && (
              <>
                <div className="invoice-row">
                  <span>Unit Cost Price (Paid to Competitor):</span>
                  <strong>GH₵ {activeCostPrice.toFixed(2)}</strong>
                </div>
                <div className="invoice-row">
                  <span>Unit Sale Price (Charged to Client):</span>
                  <strong>GH₵ {activeSellingPrice.toFixed(2)}</strong>
                </div>
              </>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
            <div className="invoice-row">
              <span>Subtotal:</span>
              <strong>GH₵ {subtotal.toFixed(2)}</strong>
            </div>
            {discount > 0 && (
              <div className="invoice-row" style={{ color: '#dc2626' }}>
                <span>Discount Applied:</span>
                <strong>- GH₵ {discount.toFixed(2)}</strong>
              </div>
            )}
            <div className="invoice-row grand-total">
              <span>Grand Total:</span>
              <strong>GH₵ {totalCost.toFixed(2)}</strong>
            </div>
            <div className="invoice-row expected-profit-row">
              <span>Expected Profit:</span>
              <strong className="profit-value">GH₵ {expectedProfit.toFixed(2)}</strong>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitDisabled}
          className="btn-submit-sale"
        >
          {loading ? 'Recording Sale...' : 'Finalize Sale'}
        </button>

        {message.text && (
          <div className={`form-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </form>

      <style jsx>{`
        .sales-form { padding: 5px; }
        .form-group { margin-bottom: 15px; display: flex; flex-direction: column; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 700; font-size: 13px; color: #475569; }
        .form-group select, .form-group input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .checkbox-group {
          margin-bottom: 15px;
          display: flex;
          align-items: center;
        }
        .checkbox-label {
          display: flex !important;
          align-items: center !important;
          gap: 8px;
          cursor: pointer;
          user-select: none;
          font-weight: 700;
          font-size: 13px;
          color: #475569;
        }
        .checkbox-label input {
          width: auto !important;
          margin: 0;
          cursor: pointer;
        }
        .competitor-price-inputs {
          background-color: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
        }
        .price-preview-input {
          background-color: #e2e8f0 !important;
          color: #475569 !important;
          font-weight: 600;
          border-color: #cbd5e1 !important;
        }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .card-inside-row {
          background-color: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
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
        .invoice-summary-box {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 15px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .invoice-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #475569;
        }
        .invoice-row.grand-total {
          border-top: 1px solid #cbd5e1;
          padding-top: 6px;
          font-size: 14px;
          color: #1e293b;
          font-weight: 800;
        }
        .invoice-row.grand-total strong {
          color: var(--hw-orange);
        }
        .expected-profit-row {
          border-top: 1px dashed #cbd5e1;
          padding-top: 6px;
          margin-top: 4px;
          font-size: 12px;
        }
        .profit-value {
          color: #10b981;
          font-weight: 700;
        }
        .btn-submit-sale {
          width: 100%;
          padding: 10px;
          background-color: var(--hw-orange) !important;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          text-transform: uppercase;
        }
        .btn-submit-sale:disabled { background-color: #cbd5e1 !important; cursor: not-allowed; }
        .form-message { margin-top: 15px; padding: 10px; border-radius: 4px; font-size: 13px; font-weight: 600; }
        .form-message.success { background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; }
        .form-message.error { background-color: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
      `}</style>
    </div>
  );
};

export default SalesForm;
