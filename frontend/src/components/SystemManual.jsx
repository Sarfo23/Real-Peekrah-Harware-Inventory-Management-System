import React, { useState } from 'react';

/**
 * SystemManual Component
 * A premium, interactive virtual user manual embedded into HIMS.
 * Designed with industrial-engineering themes (charcoal slate, safety amber, and glassmorphism).
 */
const SystemManual = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const sections = [
    {
      id: 'overview',
      title: '🚀 System Overview',
      icon: '🚀',
      tags: 'welcome workflow getting started architecture ledger',
      content: (
        <div className="manual-content-block">
          <h3>Welcome to the HIMS Control Room</h3>
          <p>
            The Hardware Inventory Management System (HIMS) is designed to track high-value physical assets, 
            manage location-specific stock allocations (Warehouses and Shops), and record retail dispatches 
            with real-time financial tracking.
          </p>

          <div className="manual-diagram-container">
            <h4>Physical Asset Flow Architecture</h4>
            <div className="flowchart-svg-wrapper">
              <svg viewBox="0 0 800 240" className="flowchart-svg">
                {/* Definitions for markers */}
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
                  </marker>
                </defs>

                {/* Warehouse Node */}
                <rect x="30" y="60" width="160" height="80" rx="6" className="node-rect warehouse-node" />
                <text x="110" y="95" className="node-title">🏭 STORAGE</text>
                <text x="110" y="115" className="node-subtitle">Warehouses (IN logs)</text>

                {/* Transfer Arrow */}
                <path d="M 190 100 L 320 100" className="flow-arrow" markerEnd="url(#arrow)" />
                <text x="255" y="90" className="flow-label">🚚 TRANSFER</text>
                <text x="255" y="120" className="flow-sublabel">Internal Moves</text>

                {/* Shop Node */}
                <rect x="330" y="60" width="160" height="80" rx="6" className="node-rect shop-node" />
                <text x="410" y="95" className="node-title">🛒 RETAIL SHOP</text>
                <text x="410" y="115" className="node-subtitle">Shops (Sales Only)</text>

                {/* Dispatch Arrow */}
                <path d="M 490 100 L 620 100" className="flow-arrow" markerEnd="url(#arrow)" />
                <text x="555" y="90" className="flow-label">💰 SALES</text>
                <text x="555" y="120" className="flow-sublabel">Outbound Billing</text>

                {/* Client Node */}
                <rect x="630" y="60" width="140" height="80" rx="6" className="node-rect client-node" />
                <text x="700" y="95" className="node-title">👷 CLIENT</text>
                <text x="700" y="115" className="node-subtitle">End-user Dispatch</text>
              </svg>
            </div>
            <p className="diagram-caption">
              <strong>Core Rule:</strong> Stock enters the system at Storage Warehouses (Replenishment IN), 
              is transferred internally to Retail Shops (Internal Transfer), and leaves the system via Shop sales (OUT logs).
            </p>
          </div>

          <h4>Key UI Indicators & Terminology</h4>
          <div className="reference-grid">
            <div className="ref-card">
              <span className="ref-badge orange">UMO (SKU)</span>
              <p><strong>Unit of Measure:</strong> Identifies packaging. <code>PCS</code> refers to individual items; <code>BX</code> represents boxed batches.</p>
            </div>
            <div className="ref-card">
              <span className="ref-badge steel">Closing Stock</span>
              <p>The real-time cumulative asset count currently sitting in all active facilities combined.</p>
            </div>
            <div className="ref-card">
              <span className="ref-badge green">Expected Profit</span>
              <p>Calculated instantly on sales as: <code>(Selling Price - Cost Price) * Qty - Discount</code>.</p>
            </div>
            <div className="ref-card">
              <span className="ref-badge blue">Immutable Ledger</span>
              <p>Every inbound/outbound move writes an unalterable history row ensuring accounting auditability.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'movements',
      title: '🔄 Stock Movements',
      icon: '🔄',
      tags: 'stock movement in out restock dispatch qty boxes pieces',
      content: (
        <div className="manual-content-block">
          <h3>Logging Inbound & Outbound Movements</h3>
          <p>
            To log daily inventory transactions, navigate to the <strong>Log Movement</strong> screen from the dashboard.
          </p>

          <div className="step-guide-list">
            <div className="step-item">
              <div className="step-num">1</div>
              <div className="step-text">
                <h5>Select Product (UMO) & Target Location</h5>
                <p>Choose the hardware item from the dropdown list. Next, choose the warehouse where stock is arriving or leaving.</p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-num">2</div>
              <div className="step-text">
                <h5>Define Input Unit & Transaction Type</h5>
                <p>
                  Choose <strong>PCS</strong> to record units in pieces, or <strong>BX</strong> for boxes. 
                  Select <strong>IN (Restock)</strong> to add stock, or <strong>OUT (Dispatch)</strong> to deduct stock.
                </p>
              </div>
            </div>
            <div className="step-item">
              <div className="step-num">3</div>
              <div className="step-text">
                <h5>Enter Quantities & Execute</h5>
                <p>
                  If you chose boxes (BX), input the number of boxes and the quantity inside each box. The system will auto-compute 
                  the total pieces. Click <strong>Submit Transaction</strong> to record.
                </p>
              </div>
            </div>
          </div>

          <div className="manual-alert warning">
            <strong>⚠️ Stock Safety Rule:</strong> Outbound (OUT) transactions will be blocked if the requested 
            quantity exceeds the current stock available at the selected location.
          </div>
        </div>
      )
    },
    {
      id: 'transfers',
      title: '🚚 Internal Transfers',
      icon: '🚚',
      tags: 'transfer internal warehouse shop moving location',
      content: (
        <div className="manual-content-block">
          <h3>Internal Location Transfers</h3>
          <p>
            When you need to move stock from a central holding depot to a retail branch, do NOT log separate OUT and IN movements. 
            Instead, use the <strong>Transfer</strong> tab in the Operational Control Center.
          </p>

          <h4>Transfer Steps:</h4>
          <ol className="manual-ol">
            <li>Select the product to move. The system will display its available stock at the source location.</li>
            <li>Select the <strong>Source Warehouse</strong> and the <strong>Destination Warehouse/Shop</strong>.</li>
            <li>Choose your input unit (Pieces or Boxes) and specify the quantity.</li>
            <li>Click <strong>Initiate Internal Transfer</strong>.</li>
          </ol>

          <div className="manual-alert info">
            <strong>ℹ️ How it works:</strong> The transfer engine executes an atomic database transaction that simultaneously 
            deducts stock from the source, adds it to the destination, and logs matching OUT and IN records under the transaction ledger.
          </div>
        </div>
      )
    },
    {
      id: 'sales',
      title: '💰 Sales & Competitors',
      icon: '💰',
      tags: 'sales customer order billing discounts competitor sourcing profit margin',
      content: (
        <div className="manual-content-block">
          <h3>Recording Customer Sales</h3>
          <p>
            Sales should be recorded directly inside the <strong>Record Sale</strong> screen. Unlike simple dispatches, 
            sales record revenue, capture discounts, and update the financial dashboard.
          </p>

          <div className="manual-columns">
            <div className="manual-col">
              <h5>Standard Sales</h5>
              <p>
                Deducts stock from your active <strong>Retail Shop</strong> locations. The system pre-fills the unit selling price 
                and computes expected margins based on the item's catalog cost.
              </p>
            </div>
            <div className="manual-col">
              <h5>Competitor-Sourced Sales</h5>
              <p>
                Use this when a client requests an item you do not currently have in stock, and you purchase it from a third-party 
                competitor to fulfill the sale immediately.
              </p>
            </div>
          </div>

          <h4>Fulfilling Competitor-Sourced Orders:</h4>
          <ul className="manual-ul">
            <li>Check the <strong>Sourced from Competitor</strong> box on the Sales Form.</li>
            <li>Enter the custom product name.</li>
            <li>Specify the competitor's cost price (your purchase price) and the price you are charging the client.</li>
            <li>This sale logs revenue without altering local warehouse inventory levels.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'bulk',
      title: '📤 Bulk Import Engine',
      icon: '📤',
      tags: 'bulk import excel csv spreadsheet upload templates catalog',
      content: (
        <div className="manual-content-block">
          <h3>Bulk Spreadsheet Import Engine</h3>
          <p>
            To upload an existing inventory sheet or migrate catalog items from external software, navigate to 
            <strong>Log Movement</strong> and select the <strong>Bulk Import</strong> tab.
          </p>

          <div className="import-steps-box">
            <h4>Bulk Upload Guidelines:</h4>
            <div className="bullet-desc">
              <strong>1. Download Template:</strong> Click the <strong>Download Spreadsheet Template</strong> button 
              to get the correct header columns (e.g. Product Name, UMO, Category, Cost, Price).
            </div>
            <div className="bullet-desc">
              <strong>2. Populate Data:</strong> Fill in the rows using Excel or any CSV editor. Ensure there are no 
              empty names or SKUs.
            </div>
            <div className="bullet-desc">
              <strong>3. Pre-Validation Check:</strong> Drag and drop your file. The system will pre-validate all rows. 
              Any errors (missing values, invalid types) will highlight in red.
            </div>
            <div className="bullet-desc">
              <strong>4. Execute Transaction:</strong> Click <strong>Confirm Upload & Execute</strong> to commit the batch. 
              The import is transactional—either all rows succeed, or the entire upload is rolled back.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'offline',
      title: '🌐 Offline Synchronization',
      icon: '🌐',
      tags: 'offline network lost connection sync railway queue storage',
      content: (
        <div className="manual-content-block">
          <h3>Real-Time Offline Operational Continuity</h3>
          <p>
            HIMS is equipped with advanced browser-level data queuing. If your internet connection drops 
            or communication with the cloud server is lost:
          </p>

          <div className="offline-feature-grid">
            <div className="offline-feature-card">
              <h5>📴 Seamless Offline Storage</h5>
              <p>The system detects offline status instantly. A amber warning banner appears, and all transactions (sales, movements) are securely written to the local browser memory queue.</p>
            </div>
            <div className="offline-feature-card">
              <h5>🔄 Auto-Sync on Recovery</h5>
              <p>As soon as a stable connection is restored, the synchronization engine will trigger in the background, flushing queued actions to the database and recalculating balances automatically.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'roles',
      title: '🛡️ User Roles & Security',
      icon: '🛡️',
      tags: 'user roles security super admin login privilege credentials audit footprint',
      content: (
        <div className="manual-content-block">
          <h3>Security, User Roles & Footprint Logs</h3>
          <p>
            HIMS protects all transactions, inventories, and catalog modifications using Role-Based 
            Access Control (RBAC) and records an immutable audit history of all actions.
          </p>

          <h4>The Three User Roles:</h4>
          <div className="reference-grid">
            <div className="ref-card">
              <span className="ref-badge orange">Super Admin</span>
              <p style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
                Complete access to all screens. Super Admins are the only users who can add, edit, or delete 
                user accounts, assign roles, change allowed sections, and view system activity footprints.
              </p>
            </div>
            <div className="ref-card">
              <span className="ref-badge blue">Admin</span>
              <p style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
                Operational supervisors. Admins have access to all dashboards, inventory forms, catalog 
                registers, category managers, transfers, and bulk tools, but cannot manage users.
              </p>
            </div>
            <div className="ref-card">
              <span className="ref-badge steel">User (Operator)</span>
              <p style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.4' }}>
                Standard operators. Standard user views are restricted to specific modules assigned to them 
                by a Super Admin. They have no access to facility control tables or bulk import spreadsheets.
              </p>
            </div>
          </div>

          <h4>Custom Section Assigning (For Operators):</h4>
          <p>
            When registering or editing a standard <strong>User</strong> account, the Super Admin can toggle two 
            specific privileges:
          </p>
          <ul className="manual-ul">
            <li><strong>Warehouse Access:</strong> Grants visibility to log movements, view the registered products table, manage category trees, and log transfers.</li>
            <li><strong>Sales Access:</strong> Grants access to the sales form and daily revenue/profit analysis dashboards.</li>
          </ul>

          <h4>👣 Monitoring Activity Footprints:</h4>
          <p>
            Every login, logout, account creation, product register, stock transfer, and catalog update writes 
            an unalterable footprint trail. Super Admins can monitor this by navigating to the 
            <strong>Users</strong> tab and clicking on the <strong>User Footprints & Audit Trail</strong> log viewer.
          </p>
        </div>
      )
    }
  ];

  const filteredSections = sections.filter(sec => {
    const query = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(query) ||
      sec.tags.toLowerCase().includes(query)
    );
  });

  const activeData = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="manual-modal-overlay" onClick={onClose}>
      <div className="manual-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="manual-header">
          <div className="manual-brand">
            <span className="manual-logo-icon">📖</span>
            <div className="manual-brand-text">
              <h2>Interactive User Manual & Operations Guide</h2>
              <p>HIMS SYSTEM CONTROL & USER ASSISTANCE ENGINE</p>
            </div>
          </div>
          <button className="manual-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Workspace Split */}
        <div className="manual-workspace-split">
          
          {/* Sidebar */}
          <div className="manual-sidebar">
            <div className="manual-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search guide topics..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <ul className="manual-nav-list">
              {filteredSections.map(sec => (
                <li key={sec.id}>
                  <button
                    className={`manual-nav-btn ${activeSection === sec.id ? 'active' : ''}`}
                    onClick={() => setActiveSection(sec.id)}
                  >
                    <span className="btn-icon">{sec.icon}</span>
                    <span className="btn-text">{sec.title.replace(/^[^\s]+\s/, '')}</span>
                  </button>
                </li>
              ))}
              {filteredSections.length === 0 && (
                <li className="no-results-item">No guides match search query.</li>
              )}
            </ul>
          </div>

          {/* Main Content Viewport */}
          <div className="manual-viewport">
            {activeData.content}
          </div>

        </div>

        {styleBlock}
      </div>
    </div>
  );
};

// Rich styles matching the HIMS premium industrial engineering layout
const styleBlock = (
  <style jsx>{`
    .manual-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: modalFadeIn 0.2s ease-out;
    }

    .manual-modal-container {
      background-color: var(--hw-panel-bg);
      border: 1px solid var(--hw-border);
      border-top: 4px solid var(--hw-orange);
      border-radius: var(--hw-radius);
      width: 100%;
      max-width: 1100px;
      height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--hw-shadow), 0 25px 50px -12px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .manual-header {
      background-color: var(--hw-dark-bg, #1e293b);
      border-bottom: 2px solid var(--hw-orange);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .manual-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .manual-logo-icon {
      font-size: 24px;
    }

    .manual-brand-text h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .manual-brand-text p {
      margin: 2px 0 0;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .manual-close-btn {
      background: none !important;
      border: none !important;
      font-size: 28px !important;
      color: #94a3b8 !important;
      cursor: pointer;
      line-height: 1;
      padding: 0 !important;
    }

    .manual-close-btn:hover {
      color: #ffffff !important;
    }

    .manual-workspace-split {
      display: grid;
      grid-template-columns: 280px 1fr;
      flex-grow: 1;
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .manual-workspace-split {
        grid-template-columns: 1fr;
      }
      .manual-sidebar {
        display: none; /* Hide sidebar on mobile in favor of standard stack */
      }
    }

    /* Sidebar list */
    .manual-sidebar {
      border-right: 1px solid var(--hw-border);
      background-color: var(--hw-bg-light);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .manual-search-box {
      padding: 15px;
      position: relative;
      border-bottom: 1px solid var(--hw-border);
    }

    .manual-search-box input {
      width: 100%;
      padding: 8px 10px 8px 30px !important;
      font-size: 12px !important;
      background-color: var(--hw-panel-bg) !important;
      color: var(--hw-slate-dark) !important;
      border: 1px solid var(--hw-border) !important;
      border-radius: 4px !important;
    }

    .manual-search-box .search-icon {
      position: absolute;
      left: 24px;
      top: 24px;
      color: #94a3b8;
      font-size: 12px;
      pointer-events: none;
    }

    .manual-nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .manual-nav-btn {
      width: 100%;
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 14px 20px !important;
      text-align: left;
      font-size: 13px !important;
      font-weight: 700 !important;
      color: var(--hw-steel) !important;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.15s ease !important;
      border-left: 3px solid transparent !important;
    }

    .manual-nav-btn:hover {
      background-color: rgba(249, 115, 22, 0.05) !important;
      color: var(--hw-orange) !important;
    }

    .manual-nav-btn.active {
      background-color: rgba(249, 115, 22, 0.08) !important;
      color: var(--hw-orange) !important;
      border-left-color: var(--hw-orange) !important;
    }

    .no-results-item {
      padding: 20px;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      font-style: italic;
    }

    /* Main Content Viewport */
    .manual-viewport {
      padding: 30px;
      overflow-y: auto;
      background-color: var(--hw-panel-bg);
      text-align: left;
    }

    .manual-content-block {
      animation: fadeIn 0.25s ease-out;
    }

    .manual-content-block h3 {
      margin: 0 0 15px 0;
      font-size: 18px;
      font-weight: 800;
      color: var(--hw-orange);
      text-transform: uppercase;
      letter-spacing: -0.01em;
    }

    .manual-content-block h4 {
      margin: 25px 0 12px 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--hw-slate-dark);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border-left: 3px solid var(--hw-orange);
      padding-left: 8px;
    }

    .manual-content-block p {
      font-size: 13px;
      line-height: 1.6;
      color: var(--hw-steel);
      margin-bottom: 15px;
    }

    /* Vector Workflow Flowchart */
    .manual-diagram-container {
      background-color: var(--hw-bg-light);
      border: 1px solid var(--hw-border);
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }

    .manual-diagram-container h4 {
      margin-top: 0;
    }

    .flowchart-svg-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    .flowchart-svg {
      width: 100%;
      min-width: 600px;
      height: auto;
    }

    .node-rect {
      fill: var(--hw-panel-bg);
      stroke: var(--hw-border);
      stroke-width: 2;
      transition: all 0.2s;
    }

    .warehouse-node { stroke: var(--hw-steel); }
    .shop-node { stroke: var(--hw-orange); }
    .client-node { stroke: var(--hw-green); }

    .node-title {
      font-weight: 800;
      font-size: 12px;
      fill: var(--hw-slate-dark);
      text-anchor: middle;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .node-subtitle {
      font-size: 10px;
      fill: var(--hw-steel);
      text-anchor: middle;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .flow-arrow {
      fill: none;
      stroke: var(--hw-orange);
      stroke-width: 2;
      stroke-dasharray: 4 4;
      animation: dash 15s linear infinite;
    }

    @keyframes dash {
      to {
        stroke-dashoffset: -200;
      }
    }

    .flow-label {
      font-size: 9px;
      font-weight: 800;
      fill: var(--hw-orange);
      text-anchor: middle;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .flow-sublabel {
      font-size: 8px;
      fill: var(--hw-steel);
      text-anchor: middle;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .diagram-caption {
      margin: 12px 0 0 0 !important;
      font-size: 11px !important;
      color: var(--hw-steel);
      font-style: italic;
    }

    /* Reference Cards Grid */
    .reference-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 15px 0;
    }

    @media (max-width: 600px) {
      .reference-grid {
        grid-template-columns: 1fr;
      }
    }

    .ref-card {
      background-color: var(--hw-bg-light);
      border: 1px solid var(--hw-border);
      border-radius: 6px;
      padding: 14px;
    }

    .ref-card p {
      margin: 8px 0 0 0 !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
    }

    .ref-badge {
      font-size: 9px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: white;
      display: inline-block;
    }

    .ref-badge.orange { background-color: var(--hw-orange); }
    .ref-badge.steel { background-color: var(--hw-steel); }
    .ref-badge.green { background-color: var(--hw-green); }
    .ref-badge.blue { background-color: var(--hw-blue); }

    /* Step guide numbers */
    .step-guide-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin: 20px 0;
    }

    .step-item {
      display: flex;
      gap: 15px;
      align-items: flex-start;
    }

    .step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: var(--hw-orange);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
      flex-shrink: 0;
    }

    .step-text h5 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 700;
      color: var(--hw-slate-dark);
    }

    .step-text p {
      margin: 0 !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
    }

    /* Alert Boxes */
    .manual-alert {
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.5;
      margin: 20px 0;
      border-left: 4px solid;
    }

    .manual-alert.warning {
      background-color: rgba(239, 68, 68, 0.08);
      border-color: var(--hw-red);
      color: #f87171;
    }

    .hardware-hims-app:not(.dark-theme) .manual-alert.warning {
      background-color: #fee2e2;
      color: #991b1b;
    }

    .manual-alert.info {
      background-color: rgba(2, 132, 199, 0.08);
      border-color: var(--hw-blue);
      color: #38bdf8;
    }

    .hardware-hims-app:not(.dark-theme) .manual-alert.info {
      background-color: #e0f2fe;
      color: #0369a1;
    }

    .manual-ol, .manual-ul {
      margin-bottom: 20px;
      padding-left: 20px;
      font-size: 12px;
      color: var(--hw-steel);
      line-height: 1.6;
    }

    .manual-ol li, .manual-ul li {
      margin-bottom: 8px;
    }

    .manual-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 15px 0;
    }

    @media (max-width: 600px) {
      .manual-columns {
        grid-template-columns: 1fr;
      }
    }

    .manual-col {
      background-color: var(--hw-bg-light);
      border: 1px solid var(--hw-border);
      border-radius: 6px;
      padding: 15px;
    }

    .manual-col h5 {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: var(--hw-slate-dark);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .manual-col p {
      margin: 0 !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
    }

    .import-steps-box {
      background-color: var(--hw-bg-light);
      border: 1px dashed var(--hw-border);
      border-radius: 6px;
      padding: 20px;
      margin-top: 15px;
    }

    .import-steps-box h4 {
      margin-top: 0;
    }

    .bullet-desc {
      font-size: 12px;
      line-height: 1.5;
      color: var(--hw-steel);
      margin-bottom: 12px;
    }

    .offline-feature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 15px;
    }

    @media (max-width: 600px) {
      .offline-feature-grid {
        grid-template-columns: 1fr;
      }
    }

    .offline-feature-card {
      background-color: var(--hw-bg-light);
      border: 1px solid var(--hw-border);
      border-radius: 6px;
      padding: 15px;
    }

    .offline-feature-card h5 {
      margin: 0 0 6px 0;
      font-size: 12px;
      color: var(--hw-slate-dark);
      font-weight: 700;
    }

    .offline-feature-card p {
      margin: 0 !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(15px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `}</style>
);

export default SystemManual;
