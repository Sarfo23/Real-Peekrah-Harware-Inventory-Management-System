import React, { useState, useEffect } from 'react';

/**
 * AnalyticsDashboard Component
 * Displays the flexible sales report with summary, warehouse breakdown, 
 * recent timeline, and monthly output leader. Supports search/querying by day, month, or year.
 */
const AnalyticsDashboard = () => {
  const [report, setReport] = useState(null);
  const [bestProduct, setBestProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Query States
  const [queryType, setQueryType] = useState('day');
  const [queryDate, setQueryDate] = useState('');
  const [queryMonth, setQueryMonth] = useState('');
  const [queryYear, setQueryYear] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintReport = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Helper to format date display
  const formatPeriodDisplay = (type, val) => {
    if (!val) return '';
    try {
      if (type === 'day') {
        const parts = val.split('-');
        if (parts.length === 3) {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
      }
      if (type === 'month') {
        const parts = val.split('-');
        if (parts.length === 2) {
          const d = new Date(parts[0], parts[1] - 1, 1);
          return d.toLocaleDateString([], { year: 'numeric', month: 'long' });
        }
      }
      if (type === 'year') {
        return `Year ${val}`;
      }
    } catch (e) {
      console.error(e);
    }
    return val;
  };

  const fetchSalesReport = async (type, val) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/analytics/sales-report';
      if (type && val) {
        url += `?queryType=${type}&queryValue=${val}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load sales report');
      const data = await response.json();
      setReport(data);

      // Pre-fill query fields based on what the server returned
      setQueryType(data.queryType);
      if (data.queryType === 'day') {
        setQueryDate(data.queryValue);
      } else if (data.queryType === 'month') {
        setQueryMonth(data.queryValue);
      } else if (data.queryType === 'year') {
        setQueryYear(data.queryValue);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBestProduct = async () => {
    try {
      const bestRes = await fetch('/api/analytics/best-product');
      if (bestRes.ok) {
        const data = await bestRes.json();
        setBestProduct(data);
      } else if (bestRes.status === 404) {
        setBestProduct(null);
      }
    } catch (err) {
      console.error('Error fetching best product:', err);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      await Promise.all([
        fetchSalesReport(),
        fetchBestProduct()
      ]);
    };
    loadInitial();
  }, []);

  const handleQuerySubmit = (e) => {
    e.preventDefault();
    let val = '';
    if (queryType === 'day') {
      val = queryDate;
    } else if (queryType === 'month') {
      val = queryMonth;
    } else if (queryType === 'year') {
      val = queryYear;
    }
    if (!val) {
      setError('Please select a valid query value.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    fetchSalesReport(queryType, val);
  };

  // Set default query dates if empty
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    if (!queryDate) setQueryDate(`${yyyy}-${mm}-${dd}`);
    if (!queryMonth) setQueryMonth(`${yyyy}-${mm}`);
    if (!queryYear) setQueryYear(String(yyyy));
  }, [queryType]);

  if (loading && !report) return <div className="analytics-loading">Scanning Sales & Profit Ledgers...</div>;

  const summary = report ? report.summary : { revenue: 0, cost: 0, profit: 0, units_sold: 0 };
  const revenueVal = parseFloat(summary.revenue || 0);
  const costVal = parseFloat(summary.cost || 0);
  const profitVal = parseFloat(summary.profit || 0);
  const unitsSold = parseInt(summary.units_sold || 0);

  const costPercent = revenueVal > 0 ? Math.min(100, (costVal / revenueVal) * 100) : (costVal > 0 ? 100 : 0);
  const profitPercent = revenueVal > 0 ? Math.max(0, 100 - costPercent) : 0;

  return (
    <div className="analytics-container">
      {/* Query Control Section */}
      <div className="sales-query-card">
        <form onSubmit={handleQuerySubmit} className="query-form-row">
          <div className="query-group">
            <label>Query Scope</label>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
              <option value="day">Day / Date</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>

          <div className="query-group">
            <label>Select Period</label>
            {queryType === 'day' && (
              <input 
                type="date" 
                value={queryDate} 
                onChange={(e) => setQueryDate(e.target.value)} 
                required 
              />
            )}
            {queryType === 'month' && (
              <input 
                type="month" 
                value={queryMonth} 
                onChange={(e) => setQueryMonth(e.target.value)} 
                required 
              />
            )}
            {queryType === 'year' && (
              <input 
                type="number" 
                min="2020" 
                max="2100"
                value={queryYear} 
                onChange={(e) => setQueryYear(e.target.value)} 
                required 
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn-query-submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search Sales'}
            </button>
            <button type="button" onClick={handlePrintReport} className="btn-query-submit btn-pdf-report" disabled={loading || !report}>
              🖨️ PDF Report
            </button>
          </div>
        </form>
        
        {report && (
          <div className="active-period-label">
            Active Period: <strong>{formatPeriodDisplay(report.queryType, report.queryValue)}</strong>
          </div>
        )}
      </div>

      {error && <div className="analytics-error">Error: {error}</div>}

      {isPrinting && (
        <div className="printable-executive-report">
          <div className="print-control-bar no-print">
            <button onClick={() => window.print()} className="btn-print-confirm">🖨️ Print / Save PDF</button>
            <button onClick={() => setIsPrinting(false)} className="btn-print-close">Close Preview</button>
          </div>

          <div className="report-paper">
            <div className="report-header">
              <div className="report-title-block">
                <h1>REAL PEEKRAH COMPANY LIMITED</h1>
                <h3>EXECUTIVE INVENTORY & SALES PERFORMANCE SUMMARY</h3>
                <p className="report-meta">HIMS Systems Report Room &bull; Confidential Boardroom Briefing</p>
              </div>
            </div>

            <div className="report-metadata-grid">
              <div className="meta-item">
                <strong>Reporting Period:</strong> {formatPeriodDisplay(report.queryType, report.queryValue)}
              </div>
              <div className="meta-item">
                <strong>Date Generated:</strong> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </div>
              <div className="meta-item">
                <strong>Generated By:</strong> HIMS Ledger Administrator
              </div>
              <div className="meta-item">
                <strong>Security Status:</strong> Internal Use Only
              </div>
            </div>

            <hr className="report-divider" />

            <div className="report-section">
              <h4>1. Financial Profitability Metrics</h4>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Metric Description</th>
                    <th>Value (GHS / Units)</th>
                    <th>% Proportion / Margin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Gross Sales Revenue</td>
                    <td><strong>GH₵{revenueVal.toFixed(2)}</strong></td>
                    <td>100.00% of Gross Yield</td>
                  </tr>
                  <tr>
                    <td>Asset Acquisition Cost</td>
                    <td>GH₵{costVal.toFixed(2)}</td>
                    <td>{costPercent.toFixed(2)}% of Gross Revenue</td>
                  </tr>
                  <tr className="highlight-row">
                    <td>Net Profit Margin</td>
                    <td><strong>GH₵{profitVal.toFixed(2)}</strong></td>
                    <td>{profitPercent.toFixed(2)}% Net Operational Profit</td>
                  </tr>
                  <tr>
                    <td>Outbound Inventory Volume</td>
                    <td>{unitsSold} Units</td>
                    <td>Cumulative Dispatches</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="report-section">
              <h4>2. Outlet & Shop Performance Breakdown</h4>
              {report.shopsBreakdown.length === 0 ? (
                <p className="report-no-data">No outlet transactions recorded for this period.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Warehouse / Shop Outlet</th>
                      <th>Location Details</th>
                      <th>Quantity Dispatched</th>
                      <th>Gross Revenue</th>
                      <th>Net Profit Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.shopsBreakdown.map(s => (
                      <tr key={s.warehouse_id}>
                        <td><strong>{s.warehouse_name}</strong></td>
                        <td>{s.warehouse_location || 'Not Specified'}</td>
                        <td>{s.units_sold} units</td>
                        <td>GH₵{parseFloat(s.revenue).toFixed(2)}</td>
                        <td>GH₵{parseFloat(s.profit).toFixed(2)}</td>
                      </tr>
                   ))}
                  </tbody>
                </table>
              )}
            </div>

            {bestProduct && (
              <div className="report-section">
                <h4>3. Monthly Output Asset Leader</h4>
                <div className="report-callout-box">
                  <p>
                    The highest performing stock asset for this reporting cycle is <strong>{bestProduct.name}</strong> (UMO: <strong>{bestProduct.sku}</strong>) with a cumulative monthly volume of <strong>{bestProduct.total_units_sold} units</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="report-section">
              <h4>4. Chronological Outbound Invoice Ledger (Latest 15)</h4>
              {report.transactions.length === 0 ? (
                <p className="report-no-data">No invoice records present.</p>
              ) : (
                <table className="report-table mini-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Asset Name</th>
                      <th>Shop / Source</th>
                      <th>Volume</th>
                      <th>Revenue</th>
                      <th>Discount</th>
                      <th>Net Yield</th>
                      <th>Sourced From</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.slice(0, 15).map(tx => (
                      <tr key={tx.id}>
                        <td>{new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{tx.product_name}</td>
                        <td>{tx.warehouse_name}</td>
                        <td>{tx.quantity}</td>
                        <td>GH₵{parseFloat(tx.revenue + parseFloat(tx.discount_amount || 0)).toFixed(2)}</td>
                        <td>{parseFloat(tx.discount_amount) > 0 ? `GH₵${parseFloat(tx.discount_amount).toFixed(2)}` : '-'}</td>
                        <td>GH₵{parseFloat(tx.profit).toFixed(2)}</td>
                        <td>{tx.is_competitor_sourced === 1 ? 'Competitor' : 'Internal'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="report-signatures">
              <div className="signature-block">
                <div className="sig-line"></div>
                <p><strong>Prepared By:</strong></p>
                <p>HIMS Ledger & Operations Administrator</p>
              </div>
              <div className="signature-block">
                <div className="sig-line"></div>
                <p><strong>Approved By:</strong></p>
                <p>Chief Operations Officer (COO)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Profitability Widget */}
      <div className="financial-ledger">
        <div className="financial-title">Operational Financial Summary</div>
        <div className="financial-grid">
          <div className="fin-metric">
            <div className="fin-label">Sales Revenue</div>
            <div className="fin-value">GH₵{revenueVal.toFixed(2)}</div>
          </div>
          <div className="fin-metric">
            <div className="fin-label">Acquisition Cost</div>
            <div className="fin-value cost-value">GH₵{costVal.toFixed(2)}</div>
          </div>
          <div className="fin-metric profit-card">
            <div className="fin-label profit-label">Net Sales Profit</div>
            <div className={`fin-value ${profitVal >= 0 ? 'profit-positive' : 'profit-negative'}`}>
              GH₵{profitVal.toFixed(2)}
            </div>
          </div>
          <div className="fin-metric">
            <div className="fin-label">Total Outflow</div>
            <div className="fin-value units-value">{unitsSold} Units</div>
          </div>
        </div>

        {/* Visual Progress/Ratio Meter */}
        {(revenueVal > 0 || costVal > 0) && (
          <div className="ratio-meter-wrapper">
            <div className="ratio-bar">
              <div 
                className="ratio-segment cost-segment" 
                style={{ width: `${costPercent}%` }} 
                title={`Cost: ${costPercent.toFixed(1)}%`}
              ></div>
              {profitPercent > 0 && (
                <div 
                  className="ratio-segment profit-segment" 
                  style={{ width: `${profitPercent}%` }} 
                  title={`Profit: ${profitPercent.toFixed(1)}%`}
                ></div>
              )}
            </div>
            <div className="ratio-legend">
              <span className="legend-item"><span className="legend-color cost"></span> Cost ({costPercent.toFixed(0)}%)</span>
              <span className="legend-item"><span className="legend-color profit"></span> Profit ({profitPercent.toFixed(0)}%)</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Shop Sales Breakdown & History split */}
      {report && (
        <div className="analytics-details-grid">
          {/* Shop Breakdown Table */}
          <div className="shop-sales-box">
            <div className="sub-section-title">Daily Sales per Shop / Warehouse</div>
            {report.shopsBreakdown.length === 0 ? (
              <div className="no-data-sub">No sales registered across active shops in this period.</div>
            ) : (
              <div className="table-container">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th>Shop / Warehouse</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                      <th>Net Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.shopsBreakdown.map(s => (
                      <tr key={s.warehouse_id}>
                        <td>
                          <strong>{s.warehouse_name}</strong>
                          <span className="shop-loc-sub">{s.warehouse_location || 'No Location'}</span>
                        </td>
                        <td>{s.units_sold}</td>
                        <td>GH₵{parseFloat(s.revenue).toFixed(2)}</td>
                        <td className="profit-text">GH₵{parseFloat(s.profit).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales History Log for Period */}
          <div className="sales-history-box">
            <div className="sub-section-title">Sales Invoice Audit Log</div>
            {report.transactions.length === 0 ? (
              <div className="no-data-sub">No sales transactions recorded in this period.</div>
            ) : (
              <div className="timeline-container">
                {report.transactions.map((tx) => (
                  <div key={tx.id} className="timeline-item">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="timeline-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong>{tx.product_name}</strong> 
                        <span className="timeline-qty">x{tx.quantity} units</span>
                        {tx.is_competitor_sourced === 1 && (
                          <span className="timeline-badge-competitor" style={{
                            backgroundColor: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            textTransform: 'uppercase'
                          }}>
                            Competitor Sourced
                          </span>
                        )}
                      </div>
                      <div className="timeline-shop-detail">
                        Initiated at: <em>{tx.warehouse_name}</em>
                      </div>
                      <div className="timeline-financials">
                        Revenue: <strong>GH₵{parseFloat(tx.revenue).toFixed(2)}</strong> | Profit: <span className="profit-text-green">GH₵{parseFloat(tx.profit).toFixed(2)}</span>
                        {parseFloat(tx.discount_amount) > 0 && (
                          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700', marginLeft: '8px' }}>
                            (Discount: -GH₵{parseFloat(tx.discount_amount).toFixed(2)})
                          </span>
                        )}
                        {tx.is_competitor_sourced === 1 && tx.competitor_cost_price !== null && (
                          <span style={{ fontSize: '11px', color: '#666', marginLeft: '6px' }}>
                            (Competitor cost: GH₵{parseFloat(tx.competitor_cost_price).toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div className="timeline-time">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Best Performing Product Widget */}
      <div className="best-product-section">
        <div className="financial-title">Monthly Output Leader</div>
        {bestProduct ? (
          <div className="product-stat-box">
            <div className="stat-info">
              <span className="product-label">Highest Output Asset</span>
              <span className="product-name">{bestProduct.name}</span>
              <code className="product-sku">{bestProduct.sku}</code>
              
              {/* Sparkline Chart */}
              <div className="sparkline-chart">
                <span className="sparkline-label">30-Day Dispatch Trend:</span>
                <svg viewBox="0 0 240 60" className="spark-svg">
                  <path
                    d="M 0,45 Q 20,25 40,50 T 80,20 T 120,40 T 160,15 T 200,30 T 240,10"
                    fill="none"
                    stroke="var(--hw-green)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0,45 Q 20,25 40,50 T 80,20 T 120,40 T 160,15 T 200,30 T 240,10 L 240,60 L 0,60 Z"
                    fill="url(#grad-spark)"
                    opacity="0.15"
                    stroke="none"
                  />
                  <defs>
                    <linearGradient id="grad-spark" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--hw-green)" />
                      <stop offset="100%" stopColor="var(--hw-green)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
            
            <div className="stat-metric">
              <div className="digital-counter">
                <span className="digit-value">{bestProduct.total_units_sold}</span>
                <span className="metric-suffix">Units</span>
              </div>
              <span className="metric-label">Dispatched this Month</span>
            </div>
          </div>
        ) : (
          <div className="no-sales-state">
            <p>No outbound stock movements logged for the current month.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .analytics-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 20px;
          font-family: 'Inter', sans-serif;
        }
        .analytics-loading {
          padding: 30px;
          text-align: center;
          color: var(--hw-steel);
          font-style: italic;
          font-weight: 600;
        }
        .analytics-error {
          padding: 12px;
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
        }
        
        /* Query Form Styles */
        .sales-query-card {
          background: #ffffff;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          padding: 15px;
          box-shadow: var(--hw-shadow);
        }
        .query-form-row {
          display: grid;
          grid-template-columns: auto auto auto;
          gap: 15px;
          align-items: flex-end;
          justify-content: start;
        }
        @media (max-width: 600px) {
          .query-form-row {
            grid-template-columns: 1fr;
            justify-content: stretch;
          }
        }
        .query-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .query-group label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .query-group select, .query-group input {
          width: 140px;
          padding: 8px 12px;
          border: 1px solid var(--hw-border);
          border-radius: 4px;
          font-size: 13px;
          color: var(--hw-charcoal);
          background-color: #ffffff;
          height: 38px;
          box-sizing: border-box;
        }
        @media (max-width: 600px) {
          .query-group select, .query-group input {
            width: 100%;
          }
        }
        .btn-query-submit {
          height: 38px !important;
          padding: 0 16px !important;
          background-color: var(--hw-steel) !important;
          color: white !important;
          border: none !important;
          border-radius: 4px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-sizing: border-box !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
        }
        .btn-query-submit:hover {
          background-color: var(--hw-orange) !important;
        }
        .btn-query-submit.btn-pdf-report {
          background-color: #10b981 !important;
        }
        .btn-query-submit.btn-pdf-report:hover {
          background-color: #059669 !important;
        }
        .active-period-label {
          margin-top: 10px;
          font-size: 12px;
          color: #475569;
          border-top: 1px solid #f1f5f9;
          padding-top: 8px;
        }
        .active-period-label strong {
          color: var(--hw-orange);
        }

        .financial-ledger {
          background: #f8fafc;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          padding: 16px;
        }
        .financial-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--hw-steel);
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }
        .financial-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 768px) {
          .financial-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .fin-metric {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 10px 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .fin-label {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .fin-value {
          font-size: 15px;
          font-weight: 800;
          color: var(--hw-charcoal);
        }
        .cost-value {
          color: #64748b;
        }
        .units-value {
          color: var(--hw-orange);
        }
        .profit-card {
          border-left: 4px solid #10b981;
        }
        .profit-label {
          color: #059669;
        }
        .profit-positive {
          color: #059669;
        }
        .profit-negative {
          color: #dc2626;
        }

        /* Analytics Details Layout */
        .analytics-details-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .analytics-details-grid {
            grid-template-columns: 1fr;
          }
        }
        .shop-sales-box, .sales-history-box {
          background: #ffffff;
          border: 1px solid var(--hw-border);
          border-radius: 6px;
          padding: 16px;
          box-shadow: var(--hw-shadow);
        }
        .sub-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--hw-steel);
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--hw-bg);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .no-data-sub {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
          padding: 20px 0;
          text-align: center;
        }
        .table-container {
          overflow-x: auto;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: left;
        }
        .summary-table th {
          background: #f8fafc;
          padding: 8px 10px;
          font-weight: 700;
          color: #475569;
          border-bottom: 2px solid var(--hw-border);
        }
        .summary-table td {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .shop-loc-sub {
          display: block;
          font-size: 10px;
          color: #94a3b8;
          font-weight: normal;
          margin-top: 2px;
        }
        .profit-text {
          font-weight: 700;
          color: #059669;
        }

        /* Timeline / History Log Styles */
        .timeline-container {
          max-height: 250px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-left: 5px;
          padding-right: 5px;
        }
        .timeline-item {
          position: relative;
          padding-left: 15px;
          border-left: 2px solid #e2e8f0;
        }
        .timeline-marker {
          position: absolute;
          left: -5px;
          top: 4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--hw-orange);
        }
        .timeline-content {
          font-size: 11px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .timeline-header {
          display: flex;
          justify-content: space-between;
          color: var(--hw-charcoal);
        }
        .timeline-qty {
          color: var(--hw-steel);
          font-weight: 600;
        }
        .timeline-shop-detail {
          font-size: 10px;
          color: #64748b;
        }
        .timeline-financials {
          color: #475569;
        }
        .profit-text-green {
          color: #059669;
          font-weight: 600;
        }
        .timeline-time {
          font-size: 9px;
          color: #94a3b8;
          align-self: flex-end;
          margin-top: 2px;
        }

        /* Best Product */
        .best-product-section {
          display: flex;
          flex-direction: column;
          margin-top: 10px;
        }
        .product-stat-box {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 6px;
          border: 1px solid #334155;
          box-shadow: var(--hw-shadow);
        }
        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .product-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
        }
        .product-name {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
        }
        .product-sku {
          font-size: 12px;
          color: #f97316;
          font-weight: 700;
        }
        .stat-metric {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .digital-counter {
          display: flex;
          align-items: baseline;
          gap: 4px;
          background: #020617;
          padding: 4px 12px;
          border-radius: 4px;
          border: 1px solid #1e293b;
        }
        .digit-value {
          font-size: 22px;
          font-weight: 900;
          color: #10b981;
          font-family: monospace;
        }
        .metric-suffix {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .metric-label {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }
        .ratio-meter-wrapper {
          margin-top: 15px;
          border-top: 1px dashed var(--hw-border);
          padding-top: 12px;
        }
        .ratio-bar {
          display: flex;
          height: 8px;
          background-color: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 6px;
        }
        .ratio-segment {
          height: 100%;
          transition: width 0.3s ease;
        }
        .ratio-segment.cost-segment {
          background-color: #94a3b8;
        }
        .ratio-segment.profit-segment {
          background-color: var(--hw-green);
        }
        .ratio-legend {
          display: flex;
          gap: 15px;
          font-size: 11px;
          font-weight: 600;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
        }
        .legend-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .legend-color.cost {
          background-color: #94a3b8;
        }
        .legend-color.profit {
          background-color: var(--hw-green);
        }

        .sparkline-chart {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 10px;
        }
        .sparkline-label {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }
        .spark-svg {
          width: 180px;
          height: 45px;
        }
        .no-sales-state {
          padding: 20px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          text-align: center;
          color: #64748b;
          font-size: 13px;
          font-style: italic;
        }

        /* Dark Mode Adjustments */
        :global(.dark-theme) .sales-query-card,
        :global(.dark-theme) .shop-sales-box,
        :global(.dark-theme) .sales-history-box {
          background: #1e293b !important;
          border-color: #334155 !important;
        }
        :global(.dark-theme) .query-group select,
        :global(.dark-theme) .query-group input {
          background-color: #0f172a !important;
          color: white !important;
          border-color: #334155 !important;
        }
        :global(.dark-theme) .active-period-label {
          border-top-color: #334155 !important;
        }
        :global(.dark-theme) .summary-table th {
          background: #0f172a !important;
          color: #94a3b8 !important;
          border-bottom-color: #334155 !important;
        }
        :global(.dark-theme) .summary-table td {
          border-bottom-color: #334155 !important;
        }
        :global(.dark-theme) .timeline-item {
          border-left-color: #334155 !important;
        }

        /* Printable Paper Styling */
        .printable-executive-report {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #f1f5f9;
          z-index: 9999;
          padding: 40px 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #1e293b;
        }
        .print-control-bar {
          display: flex;
          gap: 15px;
          margin-bottom: 25px;
          max-width: 850px;
          width: 100%;
          justify-content: flex-end;
        }
        .btn-print-confirm {
          background-color: #10b981 !important;
          color: white !important;
          border: none !important;
          padding: 10px 20px !important;
          border-radius: 4px !important;
          font-weight: 700 !important;
          cursor: pointer;
          font-size: 13px !important;
        }
        .btn-print-close {
          background-color: #64748b !important;
          color: white !important;
          border: none !important;
          padding: 10px 20px !important;
          border-radius: 4px !important;
          font-weight: 700 !important;
          cursor: pointer;
          font-size: 13px !important;
        }
        .report-paper {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 50px 60px;
          max-width: 850px;
          width: 100%;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 25px;
        }
        .report-header {
          border-bottom: 3px double #cbd5e1;
          padding-bottom: 15px;
          text-align: center;
        }
        .report-title-block h1 {
          font-size: 22px;
          font-weight: 900;
          margin: 0 0 5px 0;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .report-title-block h3 {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 5px 0;
          color: #4f46e5;
          letter-spacing: 0.05em;
        }
        .report-meta {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          font-weight: 600;
          text-transform: uppercase;
        }
        .report-metadata-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 12px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
        }
        .meta-item {
          color: #475569;
          text-align: left;
        }
        .meta-item strong {
          color: #0f172a;
        }
        .report-divider {
          border: none;
          border-top: 1px dashed #cbd5e1;
          margin: 0;
        }
        .report-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-align: left;
        }
        .report-section h4 {
          margin: 0;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: 0.03em;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .report-table th, .report-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }
        .report-table th {
          font-weight: 700;
          color: #475569;
          background-color: #f8fafc;
        }
        .highlight-row {
          background-color: #f0fdf4;
          font-weight: 700;
        }
        .highlight-row td {
          border-top: 1px solid #bbf7d0;
          border-bottom: 2px solid #86efac;
        }
        .report-callout-box {
          background-color: #e0f2fe;
          border-left: 4px solid #0284c7;
          padding: 15px;
          border-radius: 4px;
          font-size: 12px;
          color: #0369a1;
          line-height: 1.5;
          text-align: left;
        }
        .report-callout-box p {
          margin: 0;
        }
        .mini-table {
          font-size: 11px;
        }
        .mini-table th, .mini-table td {
          padding: 6px 8px;
        }
        .report-no-data {
          font-size: 12px;
          font-style: italic;
          color: #94a3b8;
          margin: 10px 0;
        }
        .report-signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #cbd5e1;
        }
        .signature-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 40%;
          font-size: 11px;
          color: #64748b;
        }
        .sig-line {
          width: 100%;
          border-bottom: 1px solid #475569;
          margin-bottom: 8px;
          height: 30px;
        }
        .signature-block p {
          margin: 2px 0;
        }

        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .printable-executive-report {
            position: absolute;
            top: 0;
            left: 0;
            background-color: #ffffff !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
          .report-paper {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;
