import React, { useState, useEffect } from 'react';

/**
 * ProductSearch Component
 * Fetches and displays products with total quantity across all warehouses.
 */
const ProductSearch = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch products based on search query
  const fetchProducts = async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      // Replace with your actual API endpoint
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

  // Debounced search or manual trigger
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

  return (
    <div className="product-search-container">
      <h2>Inventory Search</h2>
      <div className="search-box">
        <input
          type="text"
          placeholder="Search by product name or UMO..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {loading && <p>Loading products...</p>}
      {error && <p className="error-message">{error}</p>}

      <div className="product-results">
        {products.length > 0 ? (
          <table className="product-table">
            <thead>
              <tr>
                <th>UMO</th>
                <th>Name</th>
                <th>Category</th>
                <th>Total Quantity</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className={product.is_low_stock ? 'row-low-stock' : ''}>
                  <td>{product.sku}</td>
                  <td>{product.name}</td>
                  <td>{product.category_name || 'Uncategorized'}</td>
                  <td>
                    <span>{product.total_quantity || 0}</span>
                    {product.is_low_stock === 1 && (
                      <span className="low-stock-badge">Low Stock Alert</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !loading && query.length >= 2 && <p>No products found.</p>
        )}
      </div>

      <style jsx>{`
        .product-search-container { padding: 20px; font-family: sans-serif; }
        .search-input { width: 100%; padding: 10px; font-size: 16px; margin-bottom: 20px; }
        .product-table { width: 100%; border-collapse: collapse; }
        .product-table th, .product-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .product-table th { background-color: #f4f4f4; }
        .row-low-stock { background-color: #fff3cd; }
        .low-stock-badge { 
          background-color: #dc3545; 
          color: white; 
          padding: 2px 6px; 
          font-size: 12px; 
          border-radius: 4px; 
          margin-left: 10px;
          font-weight: bold;
        }
        .error-message { color: red; }
      `}</style>
    </div>
  );
};

export default ProductSearch;
