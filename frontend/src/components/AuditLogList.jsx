import React, { useState, useEffect } from 'react';

/**
 * AuditLogList Component
 * Displays full historical view of stock transactions (IN/OUT)
 * and daily aggregated sales reports by shop.
 */
const AuditLogList = () => {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'sales'
  const [logs, setLogs] = useState([]);
  const [salesSummary, setSalesSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/transactions/history');
      if (!response.ok) {
        throw new Error('Failed to fetch transaction logs');
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sales/daily-summary');
      if (!response.ok) {
        throw new Error('Failed to fetch daily sales summary');
      }
      const data = await response.json();
      setSalesSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLogs();
    } else {
      fetchSalesSummary();
    }
  }, [activeTab]);

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Product Name', 'UMO', 'Warehouse', 'Type', 'Quantity', 'Competitor Sourced', 'Competitor Cost', 'Competitor Selling Price', 'Discount (GH₵)'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.product_name,
      log.sku,
      log.warehouse_name,
      log.type,
      log.quantity,
      log.is_competitor_sourced ? 'YES' : 'NO',
      log.is_competitor_sourced && log.competitor_cost_price !== null ? parseFloat(log.competitor_cost_price).toFixed(2) : '',
      log.is_competitor_sourced && log.competitor_selling_price !== null ? parseFloat(log.competitor_selling_price).toFixed(2) : '',
      parseFloat(log.discount_amount || 0).toFixed(2)
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HIMS_Transaction_Ledger_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSalesToCSV = () => {
    const headers = ['Date', 'Shop Name', 'Location', 'Transactions Count', 'Total Units Sold', 'Total Revenue (GH₵)', 'Total Profit (GH₵)'];
    const rows = salesSummary.map(row => [
      new Date(row.sale_date).toLocaleDateString(),
      row.shop_name,
      row.shop_location || 'N/A',
      row.transactions_count,
      row.total_units_sold,
      parseFloat(row.total_revenue).toFixed(2),
      parseFloat(row.total_profit).toFixed(2)
    ]);

    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `HIMS_Daily_Shop_Sales_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="audit-log-container card mt-20">
      <div className="card-tabs">
        <button 
          className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          📜 Transaction Ledger Audit
        </button>
        <button 
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          🛒 Daily Shop Sales Ledger
        </button>
      </div>

      {loading && <p className="loading-text">Scanning logs and ledger records...</p>}
      {error && <p className="error">⚠️ {error}</p>}

      {!loading && !error && activeTab === 'ledger' && logs.length === 0 && (
        <p className="no-logs">No transaction history found in database.</p>
      )}

      {!loading && !error && activeTab === 'sales' && salesSummary.length === 0 && (
        <p className="no-logs">No sales transactions found in database.</p>
      )}

      {/* Ledger Tab Content */}
      {!loading && !error && activeTab === 'ledger' && logs.length > 0 && (
        <>
          <div className="audit-actions" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={exportToCSV} className="btn-export-csv" title="Export Ledger to CSV">
              📥 Export Ledger
            </button>
          </div>
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product Name</th>
                  <th>UMO</th>
                  <th>Warehouse</th>
                  <th>Type</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="timestamp-cell">{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <strong>{log.product_name}</strong>
                      {log.is_competitor_sourced === 1 && (
                        <span className="badge badge-competitor" style={{ marginLeft: '8px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '10px' }}>
                          Competitor Sourced
                        </span>
                      )}
                    </td>
                    <td><code className="sku-code">{log.sku}</code></td>
                    <td>{log.warehouse_name}</td>
                    <td>
                      <span className={`badge ${log.type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="quantity-cell">
                      {log.quantity}
                      {log.is_competitor_sourced === 1 && log.competitor_selling_price !== null && (
                        <div style={{ fontSize: '11px', color: '#666', fontWeight: 'normal', marginTop: '2px' }}>
                          Cost: GH₵{parseFloat(log.competitor_cost_price).toFixed(2)}<br/>
                          Sale: GH₵{parseFloat(log.competitor_selling_price).toFixed(2)}
                        </div>
                      )}
                      {parseFloat(log.discount_amount) > 0 && (
                        <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold', marginTop: '2px' }}>
                          Discount: GH₵ {parseFloat(log.discount_amount).toFixed(2)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Sales Summary Tab Content */}
      {!loading && !error && activeTab === 'sales' && salesSummary.length > 0 && (
        <>
          <div className="audit-actions" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={exportSalesToCSV} className="btn-export-csv sales-btn" title="Export Daily Sales to CSV">
              📥 Export Daily Sales
            </button>
          </div>
          <div className="table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shop Name</th>
                  <th>Location</th>
                  <th>Transactions</th>
                  <th>Total Sold</th>
                  <th>Revenue</th>
                  <th>Gross Profit</th>
                </tr>
              </thead>
              <tbody>
                {salesSummary.map((row, idx) => (
                  <tr key={idx}>
                    <td className="timestamp-cell">{new Date(row.sale_date).toLocaleDateString()}</td>
                    <td><strong>{row.shop_name}</strong></td>
                    <td><span>{row.shop_location || 'N/A'}</span></td>
                    <td>{row.transactions_count} sales</td>
                    <td className="quantity-cell">{row.total_units_sold}</td>
                    <td className="revenue-cell">GH₵ {parseFloat(row.total_revenue).toFixed(2)}</td>
                    <td className="profit-cell">GH₵ {parseFloat(row.total_profit).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style jsx>{`
        .audit-log-container { padding: 20px; }
        .card-tabs {
          display: flex;
          gap: 10px;
          border-bottom: 2px solid var(--hw-bg);
          margin-bottom: 15px;
          padding-bottom: 5px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          color: var(--hw-steel);
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .tab-btn:hover {
          background-color: var(--hw-bg-light);
          color: var(--hw-charcoal);
        }
        .tab-btn.active {
          color: var(--hw-orange);
          border-bottom: 3px solid var(--hw-orange);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }
        .table-wrapper { max-height: 400px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; }
        .audit-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .audit-table th, .audit-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
        .audit-table th { background-color: #f8f9fa; position: sticky; top: 0; z-index: 1; }
        .timestamp-cell { color: #666; font-size: 13px; }
        .sku-code { background: #f1f3f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        .quantity-cell { font-weight: bold; }
        .revenue-cell { color: var(--hw-charcoal); font-weight: 600; }
        .profit-cell { color: var(--hw-green); font-weight: 700; }
        .badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; text-align: center; }
        .badge-in { background-color: #d4edda; color: #155724; }
        .badge-out { background-color: #f8d7da; color: #721c24; }
        .error { color: red; font-weight: 600; }
        .no-logs, .loading-text { color: #6c757d; font-style: italic; font-size: 13px; }
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
        .btn-export-csv.sales-btn {
          background-color: var(--hw-orange) !important;
        }
        .btn-export-csv.sales-btn:hover {
          background-color: var(--hw-orange-hover) !important;
        }
      `}</style>
    </div>
  );
};

export default AuditLogList;
