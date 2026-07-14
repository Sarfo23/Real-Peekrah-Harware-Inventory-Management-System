import React, { useState, useEffect } from 'react';

/**
 * ProductSearch Component
 * Fetches and displays products with total quantity and warehouse-wise stock breakdown.
 */
const ProductSearch = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedProductId, setExpandedProductId] = useState(null);

  // Function to fetch products based on search query
  const fetchProducts = async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length >= 2) {
        fetchProducts(query);
      } else if (query.length === 0) {
        setProducts([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const toggleProductExpand = (id) => {
    setExpandedProductId(expandedProductId === id ? null : id);
  };

  // Parses location_distribution string returned by backend GROUP_CONCAT
  // Format: "id::name::type::location::qty;;id::name::type::location::qty"
  const parseWarehouseStock = (stockStr) => {
    if (!stockStr) return [];
    return stockStr
      .split(';;')
      .map((item) => {
        const parts = item.split('::');
        if (parts.length < 5) return null;
        const [id, name, type, location, qty] = parts;
        return {
          warehouse_id: parseInt(id) || null,
          warehouse_name: name || 'Unknown Location',
          warehouse_type: type || 'WAREHOUSE',
          warehouse_location: location || '',
          quantity: parseInt(qty) || 0,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => b.quantity - a.quantity || a.warehouse_name.localeCompare(b.warehouse_name));
  };

  return (
    <div className="product-search-container">
      <h2>Inventory Search Engine</h2>
      <p className="search-instruction">
        Search by product name or UMO / SKU. Click on a product to view its real-time stock levels in warehouses and shops.
      </p>

      <div className="search-box">
        <span className="search-icon-outside">🔍</span>
        <input
          type="text"
          placeholder="Type product name or UMO / SKU (min. 2 characters)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
          autoFocus
        />
      </div>

      {loading && <p className="loading-indicator">Searching real-time records...</p>}
      {error && <div className="error-message">{error}</div>}

      <div className="product-results">
        {products.length > 0 ? (
          <table className="product-table">
            <thead>
              <tr>
                <th>UMO / SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Total Quantity</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const stockDetails = parseWarehouseStock(product.location_distribution);
                const isExpanded = expandedProductId === product.id;

                return (
                  <React.Fragment key={product.id}>
                    <tr
                      onClick={() => toggleProductExpand(product.id)}
                      className={`product-row ${product.is_low_stock ? 'row-low-stock' : ''} ${
                        isExpanded ? 'active-row' : ''
                      }`}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="expand-chevron">{isExpanded ? '▼' : '▶'}</span> {product.sku}
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>
                        <span className="category-tag">{product.category_name || 'Uncategorized'}</span>
                      </td>
                      <td>
                        <span className="total-qty">{product.total_quantity || 0}</span>
                        {product.is_low_stock === 1 && (
                          <span className="low-stock-badge">Low Stock</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="detail-row">
                        <td colSpan={4}>
                          <div className="location-details-container">
                            <h4>📍 Stock Distribution Across Locations</h4>
                            {stockDetails.length > 0 ? (
                              <div className="location-grid">
                                {stockDetails.map((loc, idx) => (
                                  <div
                                    key={loc.warehouse_id || idx}
                                    className={`location-card ${loc.quantity === 0 ? 'empty-stock' : ''}`}
                                  >
                                    <div className="loc-info">
                                      <span className={`loc-type-badge ${loc.warehouse_type.toLowerCase()}`}>
                                        {loc.warehouse_type}
                                      </span>
                                      <strong className="loc-name">{loc.warehouse_name}</strong>
                                      {loc.warehouse_location && (
                                        <span className="loc-address">({loc.warehouse_location})</span>
                                      )}
                                    </div>
                                    <div className="loc-qty">
                                      <span className="qty-val">{loc.quantity}</span> units
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="no-stock-alert">
                                No physical inventory recorded in any warehouse or shop for this product.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          !loading && query.length >= 2 && (
            <div className="no-results-msg">No products matched "{query}".</div>
          )
        )}
      </div>

      <style jsx>{`
        .product-search-container {
          padding: 10px 5px;
          font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
          color: #334155;
        }
        .search-instruction {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 15px;
          margin-top: -5px;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .search-icon-outside {
          font-size: 20px;
          color: var(--hw-steel);
        }
        .search-input {
          flex: 1;
          padding: 12px 16px;
          font-size: 15px;
          border: 2px solid var(--hw-border);
          border-radius: 8px;
          background-color: var(--hw-bg-light);
          color: var(--hw-charcoal);
          transition: all 0.2s ease;
          outline: none;
        }
        .search-input:focus {
          border-color: var(--hw-blue);
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
        }
        .loading-indicator {
          font-size: 14px;
          color: var(--hw-steel);
          font-style: italic;
          margin-bottom: 15px;
        }
        .product-results {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-top: 10px;
        }
        .product-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid var(--hw-border);
          border-radius: 8px;
          overflow: hidden;
        }
        .product-table th {
          background-color: var(--hw-bg-light);
          color: var(--hw-steel);
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 16px;
          border-bottom: 2px solid var(--hw-border);
          text-align: left;
        }
        .product-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--hw-border);
          font-size: 14px;
          color: var(--hw-charcoal);
          vertical-align: middle;
        }
        .product-row {
          transition: background-color 0.2s ease;
        }
        .product-row:hover {
          background-color: #f8fafc;
        }
        .product-row.active-row {
          background-color: #f0f9ff;
        }
        .expand-chevron {
          display: inline-block;
          font-size: 10px;
          color: #94a3b8;
          width: 16px;
          transition: transform 0.2s ease;
        }
        .product-row.active-row .expand-chevron {
          color: var(--hw-blue);
          transform: rotate(90deg);
        }
        .category-tag {
          display: inline-block;
          background-color: #f1f5f9;
          color: var(--hw-steel);
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .total-qty {
          font-weight: 700;
          font-size: 15px;
        }
        .low-stock-badge {
          background-color: #fee2e2;
          color: #ef4444;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 4px;
          margin-left: 10px;
          border: 1px solid #fca5a5;
          text-transform: uppercase;
        }
        .row-low-stock td {
          border-left: 4px solid var(--hw-red);
        }
        .detail-row td {
          padding: 0;
          border-bottom: 1px solid var(--hw-border);
          background-color: #fafbfd;
        }
        .location-details-container {
          padding: 16px 20px 20px 20px;
          border-top: 1px dashed var(--hw-border);
          animation: slideDown 0.2s ease-out;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .location-details-container h4 {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: var(--hw-steel);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .location-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .location-card {
          background-color: #ffffff;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .location-card.empty-stock {
          opacity: 0.6;
          background-color: var(--hw-bg-light);
        }
        .loc-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .loc-name {
          font-size: 14px;
          color: var(--hw-charcoal);
        }
        .loc-type-badge {
          display: inline-block;
          align-self: flex-start;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .loc-type-badge.shop {
          background-color: #ffedd5;
          color: var(--hw-orange);
          border: 1px solid #fed7aa;
        }
        .loc-type-badge.warehouse {
          background-color: #e0f2fe;
          color: var(--hw-blue);
          border: 1px solid #bae6fd;
        }
        .loc-address {
          font-size: 11px;
          color: #64748b;
          font-style: italic;
        }
        .loc-qty {
          font-size: 12px;
          color: #64748b;
          text-align: right;
        }
        .qty-val {
          font-weight: 700;
          font-size: 16px;
          color: var(--hw-charcoal);
          margin-right: 2px;
        }
        .location-card.empty-stock .qty-val {
          color: #94a3b8;
        }
        .no-stock-alert {
          background-color: #f8fafc;
          border: 1px dashed var(--hw-border);
          border-radius: 6px;
          padding: 16px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
        }
        .error-message {
          color: #ef4444;
          background-color: #fee2e2;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 20px;
          border: 1px solid #fca5a5;
        }
        .no-results-msg {
          text-align: center;
          padding: 30px;
          color: #64748b;
          font-size: 14px;
          background-color: var(--hw-bg-light);
          border: 1px dashed var(--hw-border);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default ProductSearch;
