import React, { useState, useEffect } from 'react';

/**
 * ProductCreatorForm Component
 * Adds a new product, assigns its segregated category/type, 
 * and specifies an initial warehouse distribution channel.
 */
const ProductCreatorForm = ({ onProductCreated }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [threshold, setThreshold] = useState('10');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('0');

  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Load metadata options
  const loadMetadata = async () => {
    try {
      const [catRes, wareRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/warehouses')
      ]);
      setCategories(await catRes.json());
      setWarehouses(await wareRes.json());
    } catch (err) {
      console.error('Failed to load form options metadata', err);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !sku || !categoryId) return;

    setLoading(true);
    setMessage(null);

    const payload = {
      name,
      sku: sku.trim().toUpperCase(),
      categoryId: parseInt(categoryId),
      lowStockThreshold: parseInt(threshold),
      initialWarehouseId: warehouseId ? parseInt(warehouseId) : null,
      initialQuantity: parseInt(quantity) || 0,
      cost_price: parseFloat(costPrice) || 0,
      selling_price: parseFloat(sellingPrice) || 0
    };

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Product registered and warehouse allocated successfully!');
        setMessage({ type: 'success', text: 'Product created and warehouse allocated successfully!' });
        setName('');
        setSku('');
        setCategoryId('');
        setThreshold('10');
        setWarehouseId('');

        setQuantity('0');
        setCostPrice('');
        setSellingPrice('');
        loadMetadata();
        if (onProductCreated) onProductCreated();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to register product');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-creator-container">
      <form onSubmit={handleSubmit} className="creator-form">
        {/* Primary Details */}
        <div className="form-section">
          <div className="input-group">
            <label>Hardware Item Name</label>
            <input
              type="text"
              placeholder="e.g., Allen Keys 8mm Heavy Duty"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Unit Type (SKU)</label>
            <select value={sku} onChange={e => setSku(e.target.value)} required>
              <option value="">-- Choose Unit Type --</option>
              <option value="PCS">PCS (Pieces)</option>
              <option value="BX">BX (Boxes)</option>
            </select>
          </div>
        </div>

        {/* Pricing */}
        <div className="form-section pricing-section">
          <div className="input-group">
            <label>Cost Price (GH₵)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 12.50"
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Selling Price (GH₵)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 25.00"
              value={sellingPrice}
              onChange={e => setSellingPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Category & Stock Alert */}
        <div className="form-section">
          <div className="input-group">
            <label>Segregated Type / Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
              <option value="">-- Choose Type --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.parent_name ? `${c.parent_name} > ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Low Stock Alert Limit</label>
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
          </div>
        </div>

        {/* Initial Warehouse Allocation */}
        <div className="allocation-box">
          <h4>Initial Warehouse Storage Allocation (Optional)</h4>
          <div className="form-section">
            <div className="input-group">
              <label>Target Warehouse Location</label>
              <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
                <option value="">-- No Initial Allocation --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.location})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Initial Batch Quantity</label>
              <input
                type="number"
                min="0"
                disabled={!warehouseId}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-create-submit" disabled={loading}>
          {loading ? 'Registering Item...' : 'Register Hardware Product'}
        </button>
      </form>

      {message && <div className={`alert-banner ${message.type}`}>{message.text}</div>}

      {/* Scoped Styles */}
      <style jsx>{`
        .product-creator-container { font-family: 'Inter', sans-serif; background: transparent; padding: 0; max-width: 900px; margin: auto; }
        .creator-form { display: flex; flex-direction: column; gap: 20px; }
        .form-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .pricing-section { margin-top: 12px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 13px; font-weight: 600; color: #475569; }
        .input-group input, .input-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; color: #1e293b; background-color: #fff; }
        .input-group input:focus, .input-group select:focus { border-color: #4f46e5; outline: none; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1); }
        .allocation-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 5px; }
        .allocation-box h4 { margin: 0 0 12px 0; font-size: 13px; color: #334155; font-weight: 700; }
        .btn-create-submit { background-color: #4f46e5; color: white; border: none; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: background 0.15s ease; }
        .btn-create-submit:hover { background-color: #4338ca; }
        .btn-create-submit:disabled { background-color: #94a3b8; cursor: not-allowed; }
        .alert-banner { padding: 10px 14px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 12px; }
        .success { background-color: #d1fae5; color: #065f46; border: 1px solid #10b981; }
        .error { background-color: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default ProductCreatorForm;
