import React, { useState, useEffect } from 'react';

/**
 * DailyLedgerSummary Component
 * Displays Opening/Closing stock, Today's IN/OUT metrics, 
 * and a high-density daily operational summary.
 */
const DailyLedgerSummary = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/analytics/daily-summary');
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch ledger summary', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) return <div className="ledger-skeleton">Scanning Daily Ledger...</div>;
  if (!data) return null;

  return (
    <div className="daily-ledger-grid">
      {/* 1. Opening Stock Card */}
      <div className="ledger-card opening">
        <div className="ledger-card-label">Opening Stock (00:00)</div>
        <div className="ledger-card-value">{data.openingStock}</div>
        <div className="ledger-card-footer">System snapshot at start of day</div>
      </div>

      {/* 2. Stock In Card */}
      <div className="ledger-card stock-in">
        <div className="ledger-card-label">Today's Inbound (+)</div>
        <div className="ledger-card-value">+{data.todayIn}</div>
        <div className="ledger-card-footer">Total hardware assets received</div>
      </div>

      {/* 3. Stock Out Card */}
      <div className="ledger-card stock-out">
        <div className="ledger-card-label">Today's Outbound (-)</div>
        <div className="ledger-card-value">-{data.todayOut}</div>
        <div className="ledger-card-footer">Total hardware assets dispatched</div>
      </div>

      {/* 4. Closing Stock Card */}
      <div className="ledger-card closing">
        <div className="ledger-card-label">Live Closing Stock</div>
        <div className="ledger-card-value">{data.closingStock}</div>
        <div className="ledger-card-footer">Current real-time asset total</div>
      </div>

      {/* Daily Operations Feed Section */}
      <div className="daily-ops-feed card">
        <h3>Today's Warehouse Throughput</h3>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Trans.</th>
              <th>In</th>
              <th>Out</th>
              <th>Net Flow</th>
            </tr>
          </thead>
          <tbody>
            {data.warehouseBreakdown.map((wb, idx) => (
              <tr key={idx}>
                <td><strong>{wb.warehouse_name}</strong></td>
                <td>{wb.transaction_count}</td>
                <td className="text-in">+{wb.total_in}</td>
                <td className="text-out">-{wb.total_out}</td>
                <td className={wb.total_in - wb.total_out >= 0 ? 'pos' : 'neg'}>
                  {wb.total_in - wb.total_out > 0 ? '+' : ''}{wb.total_in - wb.total_out}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .daily-ledger-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 900px) {
          .daily-ledger-grid { grid-template-columns: 1fr 1fr; }
        }

        .ledger-card {
          background: var(--hw-panel-bg);
          border-radius: var(--hw-radius);
          padding: 18px;
          border: 1px solid var(--hw-border);
          border-left: 5px solid var(--hw-steel);
          box-shadow: var(--hw-shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .ledger-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .ledger-card.opening { border-left-color: var(--hw-steel); }
        .ledger-card.stock-in { border-left-color: var(--hw-green); }
        .ledger-card.stock-out { border-left-color: var(--hw-red); }
        .ledger-card.closing { border-left-color: var(--hw-orange); }

        .ledger-card-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--hw-steel);
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .ledger-card-value {
          font-size: 28px;
          font-weight: 800;
          color: var(--hw-charcoal);
          margin-bottom: 4px;
        }

        .ledger-card-footer {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 500;
        }

        .daily-ops-feed {
          grid-column: span 4;
          background: var(--hw-panel-bg);
          padding: 20px;
          border-radius: var(--hw-radius);
          border: 1px solid var(--hw-border);
          box-shadow: var(--hw-shadow);
          margin-top: 10px;
        }

        @media (max-width: 900px) {
          .daily-ops-feed { grid-column: span 2; }
        }

        .daily-ops-feed h3 {
          margin: 0 0 15px 0;
          font-size: 13px;
          text-transform: uppercase;
          color: var(--hw-charcoal);
          letter-spacing: 0.05em;
        }

        .ops-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ops-table th { text-align: left; color: var(--hw-steel); font-weight: 600; padding: 8px 12px; background: var(--hw-bg-light); }
        .ops-table td { padding: 10px 12px; border-bottom: 1px solid var(--hw-bg); }
        .text-in { color: var(--hw-green); font-weight: 600; }
        .text-out { color: var(--hw-red); font-weight: 600; }
        .pos { color: #059669; font-weight: 700; }
        .neg { color: var(--hw-red); font-weight: 700; }
        .ledger-skeleton { padding: 40px; text-align: center; color: #94a3b8; font-style: italic; background: white; border-radius: 8px; }
      `}</style>
    </div>
  );
};

export default DailyLedgerSummary;
