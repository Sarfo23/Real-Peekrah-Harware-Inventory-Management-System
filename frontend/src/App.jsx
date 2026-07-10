import React, { useState, useEffect, useRef } from 'react';
import ProductSearch from './components/ProductSearch';
import DailyLedgerSummary from './components/DailyLedgerSummary';
import StockMovementForm from './components/StockMovementForm';
import CategoryManager from './components/CategoryManager';
import AuditLogList from './components/AuditLogList';
import ProductCreatorForm from './components/ProductCreatorForm';
import ProductInventoryList from './components/ProductInventoryList';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import StockTransferForm from './components/StockTransferForm';
import SalesForm from './components/SalesForm';
import LocationManager from './components/LocationManager';
import BulkImporter from './components/BulkImporter';
import SystemManual from './components/SystemManual';
import Login from './components/Login';
import UserAdmin from './components/UserAdmin';
import ResetDefaultAdminForm from './components/ResetDefaultAdminForm';
import logo from './assets/Logo.png';

// Global Fetch Interceptor to automatically inject JWT token headers and handle auto-logout
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('hims_token');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  
  const response = await originalFetch(url, options);
  
  // If unauthorized, auto-clear credentials and reload (but don't do it on login requests)
  if ((response.status === 401 || response.status === 403) && !url.includes('/api/auth/login')) {
    if (localStorage.getItem('hims_token')) {
      localStorage.removeItem('hims_token');
      localStorage.removeItem('hims_user');
      window.location.reload();
    }
  }
  return response;
};

/**
 * Main HIMS Dashboard
 * Upgraded with premium Industrial Hardware aesthetics:
 * Heavy carbon-charcoal headers, high-visibility safety amber/orange indicators, rugged steel trims, and clean engineering metadata layouts.
 */
function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'movement'
  const [activeOpTab, setActiveOpTab] = useState('log'); // 'log' or 'register'
  const [lowStockCount, setLowStockCount] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('hims_token') || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hims_user')) || null;
    } catch {
      return null;
    }
  });
  const [requiresReset, setRequiresReset] = useState(localStorage.getItem('hims_requires_reset') === 'true');

  const hasAccess = (section) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    const sections = user.allowed_sections ? user.allowed_sections.split(',') : [];
    return sections.includes(section);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('hims_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Logout log error:', err);
    }
    localStorage.removeItem('hims_token');
    localStorage.removeItem('hims_user');
    localStorage.removeItem('hims_requires_reset');
    setToken(null);
    setUser(null);
    setRequiresReset(false);
    window.location.reload();
  };

  useEffect(() => {
    if (!user) return;
    
    const isStandardUser = user.role === 'USER';
    
    if (isStandardUser) {
      if (currentView === 'dashboard') {
        if (hasAccess('WAREHOUSE')) {
          navigateTo('movement');
        } else if (hasAccess('SALES')) {
          navigateTo('sales');
        }
      }
    }

    if (currentView === 'sales' && !hasAccess('SALES')) {
      navigateTo(isStandardUser ? 'movement' : 'dashboard');
    }
    if (currentView === 'movement' && !hasAccess('WAREHOUSE')) {
      navigateTo(isStandardUser ? 'sales' : 'dashboard');
    }
  }, [currentView, user]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [preselectedProductId, setPreselectedProductId] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const bellRef = useRef(null);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('hims-dark-mode') === 'true';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hims_offline_queue')) || [];
    } catch {
      return [];
    }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('hims-dark-mode', darkMode);
  }, [darkMode]);

  // Handle Online/Offline Status and Queue Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global helpers for other forms
    window.HIMS_isOnline = () => navigator.onLine;
    window.HIMS_queueTransaction = (url, payload, tempLabel) => {
      const newTx = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        url,
        payload,
        tempLabel,
        timestamp: new Date().toISOString()
      };
      setOfflineQueue(prev => {
        const updated = [...prev, newTx];
        localStorage.setItem('hims_offline_queue', JSON.stringify(updated));
        return updated;
      });
      return true;
    };

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background sync processor
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && !isSyncing) {
      const syncQueue = async () => {
        setIsSyncing(true);
        setSyncMessage(`Syncing ${offlineQueue.length} offline transaction(s) to Railway cloud...`);
        const queueToSync = [...offlineQueue];

        for (const tx of queueToSync) {
          try {
            const response = await fetch(tx.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(tx.payload)
            });

            if (response.ok) {
              setOfflineQueue(prev => {
                const updated = prev.filter(item => item.id !== tx.id);
                localStorage.setItem('hims_offline_queue', JSON.stringify(updated));
                return updated;
              });
            } else {
              console.error('Offline transaction rejected by server:', tx, await response.text());
              // Remove bad transaction to avoid clogging queue
              setOfflineQueue(prev => {
                const updated = prev.filter(item => item.id !== tx.id);
                localStorage.setItem('hims_offline_queue', JSON.stringify(updated));
                return updated;
              });
            }
          } catch (err) {
            console.error('Offline sync connection failed, will retry:', err);
            setSyncMessage('Network sync failed. Retrying when connection stabilizes.');
            break; 
          }
        }
        setIsSyncing(false);
        setSyncMessage('');
        setRefreshKey(prev => prev + 1);
      };

      const timer = setTimeout(syncQueue, 3000); 
      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineQueue, isSyncing]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotificationsData = async () => {
      try {
        const [prodRes, txRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/transactions/history')
        ]);
        
        if (prodRes.ok && txRes.ok) {
          const prods = await prodRes.json();
          const txs = await txRes.json();
          
          const alerts = [];
          
          // 1. Generate Low Stock Alerts
          const lowProds = prods.filter(p => p.quantity < p.low_stock_threshold);
          setLowStockCount(lowProds.length);
          setLowStockProducts(lowProds);
          
          lowProds.forEach(p => {
            alerts.push({
              id: `low-stock-${p.id}`,
              type: 'low-stock',
              productId: p.id,
              sku: p.sku,
              title: 'Critical Low Stock Alert',
              message: `Asset "${p.name}" (${p.sku}) is below limit. Current stock: ${p.quantity} (Min: ${p.low_stock_threshold}).`,
              timestamp: p.created_at || new Date(),
              unread: true
            });
          });
          
          // 2. Generate Transaction Notifications (latest 10)
          const recentTxs = txs.slice(0, 10);
          recentTxs.forEach(t => {
            alerts.push({
              id: `tx-${t.id}`,
              type: 'transaction',
              title: t.type === 'IN' ? 'Replenishment Recorded' : 'Outbound Dispatch',
              message: `${t.type === 'IN' ? 'Restocked' : 'Dispatched'} ${t.quantity} units of ${t.product_name} (${t.sku}) at ${t.warehouse_name}.`,
              timestamp: t.timestamp,
              unread: false
            });
          });
          
          // Sort by type: low-stock first, then transactions by timestamp desc
          alerts.sort((a, b) => {
            if (a.type === 'low-stock' && b.type !== 'low-stock') return -1;
            if (a.type !== 'low-stock' && b.type === 'low-stock') return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
          });
          
          setNotifications(alerts);
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };
    
    fetchNotificationsData();
  }, [refreshKey]);

  const handleNotificationClick = (n) => {
    if (n.type === 'low-stock') {
      navigateTo('movement');
      setActiveOpTab('log');
      setPreselectedProductId(n.productId);
      setBellOpen(false);
    }
    markAsRead(n.id);
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleTransactionComplete = () => {
    setRefreshKey(prev => prev + 1);
  };

  const navigateTo = (view) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  if (!token) {
    return <Login onLoginSuccess={(t, u, reset) => { setToken(t); setUser(u); setRequiresReset(!!reset); }} />;
  }

  if (requiresReset) {
    return (
      <ResetDefaultAdminForm 
        onResetSuccess={(newToken, newUser) => {
          setToken(newToken);
          setUser(newUser);
          setRequiresReset(false);
        }}
        onCancel={handleLogout}
      />
    );
  }

  return (
    <div className={`hardware-hims-app ${darkMode ? 'dark-theme' : ''}`}>
      {/* Heavy-Duty Industrial Top Bar */}
      <header className="hardware-nav">
        <div className="hardware-nav-container">
          <div className="hardware-brand" onClick={() => { if (user && user.role !== 'USER') navigateTo('dashboard'); }} style={{cursor: user && user.role !== 'USER' ? 'pointer' : 'default'}}>
            <img src={logo} alt="HIMS Logo" className="hardware-logo" />
            <div className="hardware-brand-text">
              <h1>REAL PEEKRAH COMPANY LIMITED</h1>
              <p>Hardware Asset & Inventory Ledger</p>
            </div>
          </div>
          
          <div className="hardware-nav-actions">
            {/* Super Admin / Admin Dashboard Back button */}
            {(currentView === 'movement' || currentView === 'sales') && user && user.role !== 'USER' && (
              <button
                className="back-btn"
                onClick={() => navigateTo('dashboard')}
              >
                ← Return to Master Dashboard
              </button>
            )}

            {/* Standard Operator View Toggle Tabs */}
            {user && user.role === 'USER' && hasAccess('WAREHOUSE') && hasAccess('SALES') && (
              <div className="operator-nav-toggle" style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`nav-action-btn ${currentView === 'movement' ? 'active-nav-btn' : ''}`}
                  onClick={() => navigateTo('movement')}
                  style={{
                    backgroundColor: currentView === 'movement' ? 'var(--hw-orange)' : 'transparent',
                    border: '1px solid var(--hw-orange)',
                    color: currentView === 'movement' ? 'white' : 'var(--hw-orange)',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  📦 Warehouse
                </button>
                <button
                  className={`nav-action-btn ${currentView === 'sales' ? 'active-nav-btn' : ''}`}
                  onClick={() => navigateTo('sales')}
                  style={{
                    backgroundColor: currentView === 'sales' ? 'var(--hw-orange)' : 'transparent',
                    border: '1px solid var(--hw-orange)',
                    color: currentView === 'sales' ? 'white' : 'var(--hw-orange)',
                    fontSize: '11px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  💰 Sales Terminal
                </button>
              </div>
            )}

            {/* Admin / Super Admin navigation buttons */}
            {currentView === 'dashboard' && user && user.role !== 'USER' && (
              <>
                {hasAccess('SALES') && (
                  <button
                    className="nav-action-btn"
                    onClick={() => navigateTo('sales')}
                    style={{ marginRight: '10px' }}
                  >
                    Record Sale
                  </button>
                )}
                {hasAccess('WAREHOUSE') && (
                  <button
                    className="nav-action-btn"
                    onClick={() => navigateTo('movement')}
                  >
                    Log Movement
                  </button>
                )}
              </>
            )}
            {currentView === 'dashboard' && (
              <button 
                className="bell-btn search-trigger-btn"
                onClick={() => setSearchOpen(true)}
                title="Open Real-Time Inventory Query Engine"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>🔍</span>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Query</span>
              </button>
            )}
            {/* Notification Bell */}
            <div className="notification-bell-container" ref={bellRef}>
              <button 
                className="bell-btn" 
                onClick={() => setBellOpen(!bellOpen)}
                title="System Notifications"
              >
                🔔
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="bell-badge">
                    {notifications.filter(n => n.unread).length}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="notifications-popover">
                  <div className="popover-header">
                    <h3>Operational Alert Center</h3>
                    {notifications.some(n => n.unread) && (
                      <button onClick={markAllAsRead} className="btn-mark-all">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="popover-body">
                    {notifications.length === 0 ? (
                      <p className="no-notifications">No operational alerts.</p>
                    ) : (
                      <div className="notifications-list">
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            className={`notification-item ${n.unread ? 'unread' : ''} ${n.type}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div className="notification-icon">
                              {n.type === 'low-stock' ? '⚠️' : '🔄'}
                            </div>
                            <div className="notification-details">
                              <div className="notification-title-row">
                                <span className="notification-title">{n.title}</span>
                                {n.unread && <span className="unread-dot"></span>}
                              </div>
                              <p className="notification-msg">{n.message}</p>
                              <span className="notification-time">
                                {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {n.type === 'low-stock' && (
                              <button 
                                className="notification-resolve-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(n);
                                }}
                              >
                                RESTOCK
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {user && (
              <>
                <div 
                  className="welcome-pill"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--hw-panel-bg, #f1f5f9)',
                    border: '1px solid var(--hw-border, #e2e8f0)',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--hw-slate-dark)',
                    textTransform: 'uppercase',
                    marginRight: '10px',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ fontSize: '12px' }}>👤</span>
                  <span>Welcome, <strong>{user.role === 'SUPER_ADMIN' ? user.username : (user.name === 'User' ? user.username : user.name)}</strong> <span style={{ color: 'var(--hw-orange)', fontSize: '9px', marginLeft: '4px' }}>({user.role})</span></span>
                </div>

                <button 
                  className="theme-toggle-btn" 
                  onClick={handleLogout}
                  title="Logout Session"
                  style={{ marginRight: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>🔓</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Logout</span>
                </button>
              </>
            )}

            <button 
              className="theme-toggle-btn" 
              onClick={() => setManualOpen(true)}
              title="System User Manual & Guide"
              style={{ marginRight: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>📖</span>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>Manual</span>
            </button>

            <button 
              className="theme-toggle-btn" 
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Dark Mode"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      {/* Offline Status & Sync Banners */}
      {!isOnline && (
        <div className="global-alert-banner offline-banner" style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b', color: '#b45309' }}>
          <div className="alert-content">
            <span className="alert-pulse-dot" style={{ backgroundColor: '#d97706' }}></span>
            <strong>OFFLINE MODE ACTIVE:</strong> Connection to Railway server lost. Transactions will queue locally in browser storage and sync when online. (Pending: {offlineQueue.length})
          </div>
        </div>
      )}
      {isOnline && isSyncing && (
        <div className="global-alert-banner sync-banner" style={{ backgroundColor: '#d1fae5', borderColor: '#10b981', color: '#065f46' }}>
          <div className="alert-content">
            <span className="alert-sync-spinner">🔄</span>
            <strong>SYNCING OFFLINE DATA:</strong> {syncMessage}
          </div>
        </div>
      )}

      {/* Actionable Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="global-alert-banner">
          <div className="alert-content">
            <span className="alert-pulse-dot"></span>
            <strong>CRITICAL STOCK WARNING:</strong> {lowStockCount} hardware asset{lowStockCount > 1 ? 's are' : ' is'} below the UMO low-stock limit!
          </div>
          <button className="alert-action-btn" onClick={() => {
            navigateTo('movement');
            setActiveOpTab('log');
            if (lowStockProducts.length > 0) {
              setPreselectedProductId(lowStockProducts[0].id);
            }
          }}>
            Configure Replenishment →
          </button>
        </div>
      )}

      {/* Main Industrial Operational Workspace */}
      <main className="hardware-workspace">
        
        {currentView === 'dashboard' ? (
          <>
            {/* Dashboard View */}
            <section className="hardware-summary-row">
              <DailyLedgerSummary key={`ledger-${refreshKey}`} />
            </section>

            <div className="dashboard-widescreen-grid">
              {/* Column 1: Operational Metrics & Performance */}
              <div className="dashboard-col">
                <div className="hardware-panel analytics-panel">
                  <div className="panel-heading">
                    <div className="panel-indicator analytics"></div>
                    <div>
                      <h2>Operational Sales Performance</h2>
                      <p>Monthly metrics for the highest-performing hardware unit</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    {hasAccess('SALES') ? (
                      <AnalyticsDashboard key={`analytics-${refreshKey}`} />
                    ) : (
                      <div className="restricted-placeholder" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--hw-steel)', fontStyle: 'italic', fontSize: '13px' }}>
                        🔒 Sales analysis metrics are restricted to authorized personnel.
                      </div>
                    )}
                  </div>
                </div>
              </div>



              {/* Column 3: Transaction Ledger Audit */}
              <div className="dashboard-col">
                <div className="hardware-panel ledger-panel">
                  <div className="panel-heading">
                    <div className="panel-indicator ledger"></div>
                    <div>
                      <h2>Immutable Transaction Ledger Audit</h2>
                      <p>Timeline log of physical stock assignments</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <AuditLogList key={`audit-${refreshKey}`} />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : currentView === 'sales' ? (
          /* Dedicated Sales View - Widescreen Layout */
          <div className="dedicated-view-container widescreen">
            <div className="movement-header-row">
              <div className="movement-header-left">
                <h2>Real-Time Sales Control Center</h2>
                <p>Record customer orders, process outbound sales invoices, and track hardware asset dispatches.</p>
              </div>
            </div>

            <div className="movement-widescreen-grid">
              {/* Left Column: Product Registry Reference */}
              <div className="movement-col-left">
                <div className="hardware-panel category-accent full-height-panel">
                  <div className="panel-heading">
                    <div className="panel-indicator"></div>
                    <div>
                      <h2>Active Hardware Registry Reference</h2>
                      <p>Visual status of registered asset quantities, unit costs, and warehouses</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <ProductInventoryList 
                      key={`registry-sales-${refreshKey}`} 
                      preselectedProductId={preselectedProductId}
                      onClearPreselected={() => setPreselectedProductId(null)}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Record Sale Form */}
              <div className="movement-col-right">
                <div className="hardware-panel primary-accent operation-tabs-panel">
                  <div className="panel-heading">
                    <div className="panel-indicator"></div>
                    <div>
                      <h2>Record Customer Order</h2>
                      <p>Deduct stock directly from source warehouse for sales billing</p>
                    </div>
                  </div>
                  <div className="panel-body large-padding">
                    <SalesForm 
                      key={`sales-${refreshKey}`} 
                      onTransactionComplete={handleTransactionComplete} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="view-footer-info">
              <p>Sales recorded here deduct warehouse quantities, log under the Immutable Transaction Ledger, and update daily revenue/profit analytics instantly.</p>
            </div>
          </div>
        ) : (
          /* Dedicated Stock Movement View - Redesigned Widescreen Layout */
          <div className="dedicated-view-container widescreen">
            <div className="movement-header-row">
              <div className="movement-header-left">
                <h2>Operational Control Center</h2>
                <p>Track hardware inventory movements, manage warehouse stock distributions, and register asset masters.</p>
              </div>
            </div>

            <div className="movement-widescreen-grid">
              {/* Left Column: Product Registry Reference (Widescreen) */}
              <div className="movement-col-left">
                <div className="hardware-panel category-accent full-height-panel">
                  <div className="panel-heading">
                    <div className="panel-indicator"></div>
                    <div>
                      <h2>Active Hardware Registry Reference</h2>
                      <p>Visual status of registered asset quantities, unit costs, and warehouses</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <ProductInventoryList 
                      key={`registry-${refreshKey}`} 
                      preselectedProductId={preselectedProductId}
                      onClearPreselected={() => setPreselectedProductId(null)}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Operation Panel with Tabs */}
              <div className="movement-col-right">
                <div className="hardware-panel primary-accent operation-tabs-panel">
                  <div className="operation-tabs-header">
                    {hasAccess('WAREHOUSE') && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'log' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('log')}
                      >
                        <span className="tab-icon">🔄</span> Log Movement
                      </button>
                    )}
                    {hasAccess('WAREHOUSE') && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'register' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('register')}
                      >
                        <span className="tab-icon">➕</span> Register Asset
                      </button>
                    )}
                    {hasAccess('WAREHOUSE') && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'category' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('category')}
                      >
                        <span className="tab-icon">📁</span> Categories
                      </button>
                    )}
                    {hasAccess('WAREHOUSE') && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'transfer' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('transfer')}
                      >
                        <span className="tab-icon">🚚</span> Transfer
                      </button>
                    )}
                    {user && user.role !== 'USER' && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'locations' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('locations')}
                      >
                        <span className="tab-icon">🏢</span> Facilities
                      </button>
                    )}
                    {user && user.role !== 'USER' && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'bulk' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('bulk')}
                      >
                        <span className="tab-icon">📤</span> Bulk Import
                      </button>
                    )}
                    {user && user.role === 'SUPER_ADMIN' && (
                      <button 
                        className={`operation-tab-btn ${activeOpTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveOpTab('users')}
                      >
                        <span className="tab-icon">👤</span> Users
                      </button>
                    )}
                  </div>
                  
                  <div className="panel-body large-padding">
                    {activeOpTab === 'log' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Record Stock Movement</h3>
                          <p>Record real-time warehouse inbound replenishment (IN) or outbound dispatch (OUT) logs.</p>
                        </div>
                        <StockMovementForm 
                          key={`movement-${refreshKey}`} 
                          preselectedProductId={preselectedProductId}
                          onTransactionComplete={handleTransactionComplete} 
                        />
                      </div>
                    )}
                    {activeOpTab === 'register' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Register Asset Master</h3>
                          <p>Define a new hardware part number (UMO), unit costs, and configure initial location.</p>
                        </div>
                        <ProductCreatorForm key={`creator-${refreshKey}`} onProductCreated={handleTransactionComplete} />
                      </div>
                    )}
                    {activeOpTab === 'category' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Structural Category Matrix</h3>
                          <p>Configure hierarchical category tree to segregate hardware assets.</p>
                        </div>
                        <CategoryManager onCategoryAdded={handleTransactionComplete} />
                      </div>
                    )}
                    {activeOpTab === 'transfer' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Internal Stock Transfer</h3>
                          <p>Transfer hardware assets directly between warehouses/shops. This logs matching outbound and inbound transactions.</p>
                        </div>
                        <StockTransferForm key={`transfer-${refreshKey}`} onTransferComplete={handleTransactionComplete} />
                      </div>
                    )}
                    {activeOpTab === 'locations' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Facility Control Center</h3>
                          <p>Register and manage retail shops (sales) and storage warehouses (replenishment).</p>
                        </div>
                        <LocationManager key={`locations-${refreshKey}`} onLocationAdded={handleTransactionComplete} />
                      </div>
                    )}
                    {activeOpTab === 'bulk' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>Bulk Spreadsheet Import</h3>
                          <p>Import catalog products or log batch stock movements in bulk using Excel or CSV templates.</p>
                        </div>
                        <BulkImporter onImportComplete={handleTransactionComplete} />
                      </div>
                    )}
                    {activeOpTab === 'users' && user && user.role === 'SUPER_ADMIN' && (
                      <div className="tab-content-wrapper">
                        <div className="tab-intro">
                          <h3>User Account Administration</h3>
                          <p>Manage registered system operators, assign access privileges, and edit security roles.</p>
                        </div>
                        <UserAdmin />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="view-footer-info">
              <p>Transactions recorded here are logged to the Immutable Transaction Ledger and impact real-time Closing Stock calculations.</p>
            </div>
          </div>
        )}
      </main>

      {/* Premium Glassmorphism Search Modal */}
      {searchOpen && (
        <div className="search-modal-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="panel-indicator query" style={{ backgroundColor: '#0284c7', width: '10px', height: '10px', borderRadius: '2px' }}></div>
                <h2>Real-Time Inventory Query Engine</h2>
              </div>
              <button className="close-modal-btn" onClick={() => setSearchOpen(false)}>×</button>
            </div>
            <div className="search-modal-body">
              <ProductSearch key={`global-search-${refreshKey}`} />
            </div>
          </div>
        </div>
      )}

      {/* Embedded Virtual User Manual */}
      <SystemManual isOpen={manualOpen} onClose={() => setManualOpen(false)} />

      <footer className="hardware-footer">
        <p>REAL PEEKRAH COMPANY LIMITED System Control Room &bull; Steel Core Asset Lifecycle Architecture &bull; 2026</p>
      </footer>

      <style jsx global>{`
        :root {
          --hw-orange: #f97316;          /* High-Vis Industrial Safety Orange */
          --hw-orange-hover: #ea580c;
          --hw-steel: #475569;           /* Steel Trim Gray */
          --hw-charcoal: #1e293b;        /* Heavy Carbon Charcoal */
          --hw-slate-dark: #0f172a;       /* Black Iron */
          --hw-bg: #f1f5f9;              /* Light Workshop Cement Gray */
          --hw-panel-bg: #ffffff;
          --hw-border: #cbd5e1;          /* Structural Joint Line */
          --hw-radius: 6px;              /* Clean structural edges */
          --hw-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
          --hw-green: #10b981;           /* Normal Stock Indicator */
          --hw-red: #ef4444;             /* Out of Stock Alert */
          --hw-blue: #0284c7;            /* Query / Info Blue */
          --hw-indigo: #4f46e5;          /* Ledger Indigo */
          --hw-bg-light: #f8fafc;        /* Soft Bevel background */
          --hw-dark-bg: #1e293b;         /* Dark Background for Nav and Footer */
        }

        /* Dark Theme Variables & Styles */
        .hardware-hims-app.dark-theme {
          --hw-bg: #0f172a;               /* Midnight Black Iron */
          --hw-panel-bg: #1e293b;         /* Heavy Carbon Charcoal */
          --hw-border: #334155;           /* Heavy trim edge */
          --hw-slate-dark: #f8fafc;       /* Muted off-white text */
          --hw-bg-light: #0f172a;         /* Dark inner bevels */
          --hw-charcoal: #f8fafc;         /* Light text for charcoal */
          --hw-steel: #94a3b8;            /* Light gray text for steel */
          --hw-shadow: 0 4px 20px -2px rgba(2, 6, 17, 0.5);
          --hw-dark-bg: #0f172a;          /* Darker background in Dark Theme */
        }

        .hardware-hims-app.dark-theme .panel-heading {
          background-color: #0f172a;
          border-bottom: 1px solid var(--hw-border);
        }

        .hardware-hims-app.dark-theme select,
        .hardware-hims-app.dark-theme input,
        .hardware-hims-app.dark-theme textarea {
          background-color: #0f172a !important;
          color: white !important;
          border-color: #334155 !important;
        }

        .hardware-hims-app.dark-theme .operation-tabs-header {
          background-color: #0f172a;
        }

        .hardware-hims-app.dark-theme .operation-tab-btn {
          color: #94a3b8 !important;
        }

        .hardware-hims-app.dark-theme .operation-tab-btn.active {
          color: white !important;
          border-bottom-color: var(--hw-orange) !important;
        }

        .hardware-hims-app.dark-theme .ledger-skeleton,
        .hardware-hims-app.dark-theme .no-sales-state {
          background-color: #0f172a !important;
          border-color: #334155 !important;
        }

        .hardware-hims-app.dark-theme .fin-metric {
          background-color: #0f172a !important;
          border-color: #334155 !important;
        }

        /* Sub-Component Dark overrides for labels, texts and tables */
        .hardware-hims-app.dark-theme label,
        .hardware-hims-app.dark-theme .input-group label,
        .hardware-hims-app.dark-theme .form-group label {
          color: #94a3b8 !important;
        }

        .hardware-hims-app.dark-theme strong,
        .hardware-hims-app.dark-theme .strong {
          color: #ffffff !important;
        }

        .hardware-hims-app.dark-theme h3,
        .hardware-hims-app.dark-theme h4,
        .hardware-hims-app.dark-theme .tab-intro h3,
        .hardware-hims-app.dark-theme .allocation-box h4 {
          color: #ffffff !important;
        }

        .hardware-hims-app.dark-theme p,
        .hardware-hims-app.dark-theme .tab-intro p,
        .hardware-hims-app.dark-theme .view-footer-info p {
          color: #94a3b8 !important;
        }

        .hardware-hims-app.dark-theme .audit-table th,
        .hardware-hims-app.dark-theme th {
          background-color: #0f172a !important;
          color: #94a3b8 !important;
          border-bottom-color: #334155 !important;
        }

        .hardware-hims-app.dark-theme .audit-table td,
        .hardware-hims-app.dark-theme td {
          border-bottom-color: #334155 !important;
          color: #cbd5e1 !important;
        }

        .hardware-hims-app.dark-theme .timestamp-cell {
          color: #94a3b8 !important;
        }

        .hardware-hims-app.dark-theme .sku-code {
          background-color: #0f172a !important;
          color: var(--hw-orange) !important;
        }

        .hardware-hims-app.dark-theme .table-wrapper {
          border-color: #334155 !important;
        }

        .hardware-hims-app.dark-theme .card-inside-row,
        .hardware-hims-app.dark-theme .allocation-box {
          background-color: #0f172a !important;
          border-color: #334155 !important;
        }

        /* ----------------------------------------------------
           Robust Dark Theme Sub-Component Stylesheet Overrides 
           ---------------------------------------------------- */
        
        /* Active Hardware Registry (ProductInventoryList) */
        .hardware-hims-app.dark-theme .inventory-ref-panel {
          background: transparent !important;
        }
        .hardware-hims-app.dark-theme .ref-table tr:hover {
          background-color: var(--hw-bg-light) !important;
        }
        .hardware-hims-app.dark-theme .modal-container {
          background-color: var(--hw-panel-bg) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .modal-body-split {
          background-color: var(--hw-panel-bg) !important;
        }
        .hardware-hims-app.dark-theme .modal-quick-movement {
          background-color: var(--hw-bg-light) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .modal-quick-movement h4 {
          color: #ffffff !important;
        }
        .hardware-hims-app.dark-theme .breakdown-table th {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          border-bottom-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .breakdown-table td {
          border-bottom-color: var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .modal-footer-close {
          background-color: var(--hw-bg-light) !important;
          border-top-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .modal-col-details h4,
        .hardware-hims-app.dark-theme .modal-col-stock h4 {
          color: #ffffff !important;
        }
        .hardware-hims-app.dark-theme .modal-form .form-group label,
        .hardware-hims-app.dark-theme .quick-move-form label {
          color: var(--hw-steel) !important;
        }
        .hardware-hims-app.dark-theme .btn-cancel {
          background-color: var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .btn-cancel:hover {
          background-color: var(--hw-steel) !important;
          color: #ffffff !important;
        }

        /* StockMovementForm overrides */
        .hardware-hims-app.dark-theme .stock-info-banner {
          background-color: var(--hw-bg-light) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .stock-label {
          color: var(--hw-steel) !important;
        }
        .hardware-hims-app.dark-theme .stock-value {
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .computed-total-label {
          color: var(--hw-steel) !important;
        }

        /* StockTransferForm overrides */
        .hardware-hims-app.dark-theme .stock-level-indicator.out-of-stock {
          background-color: rgba(239, 68, 68, 0.15) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          color: #fca5a5 !important;
        }

        /* LocationManager overrides */
        .hardware-hims-app.dark-theme .radio-label {
          background-color: var(--hw-panel-bg) !important;
          color: var(--hw-steel) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .radio-label.active {
          background-color: rgba(249, 115, 22, 0.15) !important;
          color: var(--hw-orange) !important;
          border-color: var(--hw-orange) !important;
          box-shadow: 0 0 0 1px var(--hw-orange) !important;
        }
        .hardware-hims-app.dark-theme .location-item {
          background-color: var(--hw-panel-bg) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .loc-details strong {
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .loc-details span {
          color: var(--hw-steel) !important;
        }

        /* CategoryManager overrides */
        .hardware-hims-app.dark-theme .sub-ul {
          color: var(--hw-steel) !important;
        }

        /* BulkImporter overrides */
        .hardware-hims-app.dark-theme .toggle-btn {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .toggle-btn:hover {
          background-color: var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .toggle-btn.active {
          background-color: var(--hw-steel) !important;
          color: #ffffff !important;
          border-color: var(--hw-steel) !important;
        }
        .hardware-hims-app.dark-theme .btn-secondary {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .btn-secondary:hover {
          background-color: var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
        }
        .hardware-hims-app.dark-theme .preview-table-wrapper {
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .preview-table th {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          border-bottom-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .preview-table td {
          border-bottom-color: var(--hw-border) !important;
          color: var(--hw-slate-dark) !important;
        }

        /* SalesForm overrides */
        .hardware-hims-app.dark-theme .competitor-price-inputs {
          background-color: rgba(245, 158, 11, 0.1) !important;
          border-color: rgba(245, 158, 11, 0.2) !important;
          color: #ffffff !important;
        }
        .hardware-hims-app.dark-theme .price-preview-input {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .invoice-summary-box {
          background-color: var(--hw-bg-light) !important;
          border-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .invoice-row {
          color: var(--hw-steel) !important;
        }
        .hardware-hims-app.dark-theme .invoice-row.grand-total {
          color: var(--hw-slate-dark) !important;
          border-top-color: var(--hw-border) !important;
        }
        .hardware-hims-app.dark-theme .expected-profit-row {
          border-top-color: var(--hw-border) !important;
        }

        /* ---------------------------------------------------- */

        .back-btn {
          background-color: var(--hw-steel) !important;
          color: white !important;
          border: 1px solid var(--hw-border) !important;
          padding: 0 14px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 34px !important;
          box-sizing: border-box !important;
          white-space: nowrap !important;
        }
        .back-btn:hover {
          background-color: var(--hw-orange) !important;
          border-color: var(--hw-orange) !important;
        }

        .theme-toggle-btn {
          background-color: var(--hw-steel) !important;
          color: white !important;
          border: 1px solid var(--hw-border) !important;
          padding: 0 14px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 34px !important;
          box-sizing: border-box !important;
          white-space: nowrap !important;
        }
        .theme-toggle-btn:hover {
          background-color: var(--hw-orange) !important;
          border-color: var(--hw-orange) !important;
        }

        /* Notification Bell Styling */
        .notification-bell-container {
          position: relative;
          display: inline-flex !important;
          align-items: center !important;
        }

        .bell-btn {
          background-color: var(--hw-charcoal) !important;
          border: 1px solid var(--hw-border) !important;
          color: white !important;
          padding: 0 12px !important;
          font-size: 14px !important;
          border-radius: 4px;
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s ease, transform 0.1s ease !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 34px !important;
          box-sizing: border-box !important;
        }

        .bell-btn:hover {
          background-color: var(--hw-steel) !important;
          transform: scale(1.05);
        }

        .bell-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background-color: var(--hw-red);
          color: white;
          border-radius: 50%;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 700;
          border: 2px solid var(--hw-charcoal);
          min-width: 10px;
          text-align: center;
          line-height: 1;
        }

        .notifications-popover {
          position: absolute;
          top: 45px;
          right: 0;
          width: 380px;
          background-color: var(--hw-panel-bg);
          border: 1px solid var(--hw-border);
          border-radius: var(--hw-radius);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          z-index: 1000;
          overflow: hidden;
          animation: fadeIn 0.2s ease-out;
        }

        .popover-header {
          background-color: var(--hw-dark-bg);
          color: white;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--hw-border);
        }

        .popover-header h3 {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .btn-mark-all {
          background: transparent !important;
          border: none !important;
          color: var(--hw-orange) !important;
          padding: 0 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          cursor: pointer;
          text-transform: uppercase;
        }

        .btn-mark-all:hover {
          color: var(--hw-orange-hover) !important;
          text-decoration: underline;
        }

        .popover-body {
          max-height: 350px;
          overflow-y: auto;
          background-color: var(--hw-panel-bg);
        }

        .no-notifications {
          padding: 20px;
          text-align: center;
          color: var(--hw-steel);
          font-size: 13px;
          font-style: italic;
          margin: 0;
        }

        .notifications-list {
          display: flex;
          flex-direction: column;
        }

        .notification-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--hw-border);
          cursor: pointer;
          transition: background-color 0.2s ease;
          position: relative;
          align-items: flex-start;
          text-align: left;
        }

        .notification-item:hover {
          background-color: var(--hw-bg-light);
        }

        .notification-item.unread {
          background-color: rgba(249, 115, 22, 0.04);
        }

        .hardware-hims-app.dark-theme .notification-item.unread {
          background-color: rgba(249, 115, 22, 0.08);
        }

        .notification-icon {
          font-size: 16px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .notification-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex-grow: 1;
        }

        .notification-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .notification-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--hw-slate-dark);
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .unread-dot {
          width: 6px;
          height: 6px;
          background-color: var(--hw-orange);
          border-radius: 50%;
        }

        .notification-msg {
          margin: 0;
          font-size: 11px;
          color: var(--hw-steel);
          line-height: 1.4;
        }

        .notification-time {
          font-size: 10px;
          color: #94a3b8;
        }

        .notification-resolve-btn {
          align-self: center;
          background-color: var(--hw-orange) !important;
          color: white !important;
          border: none !important;
          border-radius: 3px !important;
          padding: 4px 8px !important;
          font-size: 9px !important;
          font-weight: 700 !important;
          cursor: pointer;
          flex-shrink: 0;
          transition: background-color 0.1s ease !important;
        }

        .notification-resolve-btn:hover {
          background-color: var(--hw-orange-hover) !important;
        }

        /* Adjustments for dark theme */
        .hardware-hims-app.dark-theme .notifications-popover {
          background-color: var(--hw-panel-bg);
          border-color: var(--hw-border);
        }

        .hardware-hims-app.dark-theme .popover-header {
          background-color: #0f172a;
        }

        .hardware-hims-app.dark-theme .notification-item {
          border-bottom-color: var(--hw-border);
        }

        .hardware-hims-app.dark-theme .notification-item:hover {
          background-color: #0f172a;
        }

        .hardware-hims-app.dark-theme .notification-title {
          color: white;
        }

        .hardware-hims-app.dark-theme .bell-btn {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .hardware-hims-app.dark-theme .bell-badge {
          border-color: #1e293b;
        }

        body {
          margin: 0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: var(--hw-bg);
          color: var(--hw-slate-dark);
          letter-spacing: -0.01em;
          -webkit-font-smoothing: antialiased;
        }

        .hardware-hims-app {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background-color: var(--hw-bg);
          color: var(--hw-slate-dark);
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        /* Actionable Global Alert Banner */
        .global-alert-banner {
          background-color: #fee2e2;
          border-bottom: 2px solid #fca5a5;
          padding: 10px 2.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          animation: slideDown 0.3s ease-out;
        }
        .alert-sync-spinner {
          display: inline-block;
          animation: spin-sync 1.2s linear infinite;
          font-size: 15px;
        }
        @keyframes spin-sync {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .alert-content {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #991b1b;
          font-weight: 500;
        }

        .alert-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--hw-red);
          border-radius: 50%;
          display: inline-block;
          animation: alertPulse 1.5s infinite;
        }

        @keyframes alertPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .alert-action-btn {
          background-color: var(--hw-red) !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 6px 12px !important;
          border-radius: 4px !important;
          cursor: pointer;
          border: none !important;
          text-transform: uppercase;
          transition: background 0.2s ease !important;
        }

        .alert-action-btn:hover {
          background-color: #b91c1c !important;
        }

        /* Rugged Industrial Header Navbar */
        .hardware-nav {
          background-color: var(--hw-dark-bg);
          border-bottom: 4px solid var(--hw-orange);
          padding: 1.1rem 2.5rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
        }

        .hardware-nav-container {
          max-width: 1550px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hardware-nav-actions {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .nav-action-btn {
          background: transparent;
          border: 1px solid var(--hw-orange);
          color: var(--hw-orange);
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-action-btn:hover, .nav-action-btn.active {
          background: var(--hw-orange);
          color: white;
        }

        .hardware-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .hardware-logo {
          height: 42px;
          width: auto;
          object-fit: contain;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .bolt-head {
          width: 10px;
          height: 10px;
          background-color: var(--hw-charcoal);
          border-radius: 50%;
        }

        .hardware-brand-text h1 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .hardware-brand-text p {
          margin: 1px 0 0;
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .hardware-badge-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
          background-color: rgba(249, 115, 22, 0.15);
          padding: 6px 14px;
          border-radius: 4px;
          border: 1px solid rgba(249, 115, 22, 0.3);
        }

        .hardware-pulse {
          width: 8px;
          height: 8px;
          background-color: var(--hw-orange);
          border-radius: 50%;
          animation: hwPulse 2s infinite;
        }

        @keyframes hwPulse {
          0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
          100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
        }

        /* Content Operational Space */
        .hardware-workspace {
          max-width: 1550px;
          width: 100%;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 2.5rem;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .hardware-layout-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 2rem;
          align-items: start;
        }

        .dashboard-widescreen-grid {
          display: grid;
          grid-template-columns: 1.15fr 1.35fr;
          gap: 2rem;
          align-items: start;
        }

        .dashboard-col {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        @media (max-width: 900px) {
          .dashboard-widescreen-grid { grid-template-columns: 1fr; }
        }

        /* Search Modal Styles */
        .search-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: modalFadeIn 0.2s ease-out;
        }
        .search-modal-content {
          background-color: var(--hw-panel-bg);
          border: 1px solid var(--hw-border);
          border-radius: var(--hw-radius);
          width: 90%;
          max-width: 800px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .search-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--hw-border);
          background-color: #f8fafc;
        }
        .hardware-hims-app.dark-theme .search-modal-header {
          background-color: #0f172a;
        }
        .search-modal-header h2 {
          margin: 0;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--hw-charcoal);
          font-weight: 700;
        }
        .hardware-hims-app.dark-theme .search-modal-header h2 {
          color: white;
        }
        .close-modal-btn {
          background: none !important;
          border: none !important;
          font-size: 24px;
          color: var(--hw-steel) !important;
          cursor: pointer;
          line-height: 1;
          padding: 0 !important;
        }
        .close-modal-btn:hover {
          color: var(--hw-orange) !important;
        }
        .search-modal-body {
          padding: 20px;
          max-height: 80vh;
          overflow-y: auto;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1100px) {
          .hardware-layout-grid { grid-template-columns: 1fr; }
        }

        .hardware-col {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* Machined Industrial Panels */
        .hardware-panel {
          background: var(--hw-panel-bg);
          border-radius: var(--hw-radius);
          border: 1px solid var(--hw-border);
          box-shadow: var(--hw-shadow);
          overflow: hidden;
        }

        .primary-accent { border-top: 4px solid var(--hw-orange); }
        .action-accent { border-top: 4px solid var(--hw-steel); }
        .category-accent { border-top: 4px solid var(--hw-charcoal); }
        .query-panel { border-top: 4px solid #0284c7; }
        .ledger-panel { border-top: 4px solid #4f46e5; }
        .analytics-panel { border-top: 4px solid #10b981; }


        .panel-heading {
          padding: 1.1rem 1.5rem;
          background-color: #f8fafc;
          border-bottom: 1px solid var(--hw-border);
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .panel-indicator {
          width: 10px;
          height: 10px;
          background-color: var(--hw-orange);
          border-radius: 2px; /* Square machine look */
        }
        .panel-indicator.query { background-color: #0284c7; }
        .panel-indicator.ledger { background-color: #4f46e5; }
        .panel-indicator.analytics { background-color: #10b981; }


        .panel-heading h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--hw-charcoal);
          letter-spacing: -0.01em;
          text-transform: uppercase;
        }

        .panel-heading p {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--hw-steel);
        }

        .panel-body {
          padding: 1.5rem;
        }

        .dedicated-view-container {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        .dedicated-view-container.widescreen {
          max-width: 1550px;
          margin: 0 auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .movement-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid var(--hw-border);
          padding-bottom: 1rem;
          margin-bottom: 0.5rem;
        }

        .movement-header-left h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--hw-charcoal);
          text-transform: uppercase;
          letter-spacing: -0.02em;
        }

        .movement-header-left p {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--hw-steel);
        }

        .back-btn-top {
          background-color: var(--hw-charcoal) !important;
          border: 1px solid var(--hw-border) !important;
          color: #ffffff !important;
          padding: 8px 16px !important;
          text-transform: none;
          font-weight: 600;
        }

        .back-btn-top:hover {
          background-color: var(--hw-steel) !important;
        }

        .movement-widescreen-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 2rem;
          align-items: start;
        }

        @media (max-width: 1200px) {
          .movement-widescreen-grid {
            grid-template-columns: 1fr;
          }
        }

        .full-height-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .full-height-panel .panel-body {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
        }

        /* Tabs for Operation Center */
        .operation-tabs-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .operation-tabs-header {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background-color: #f1f5f9;
          border-bottom: 1px solid var(--hw-border);
        }

        .operation-tab-btn {
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          color: var(--hw-steel) !important;
          padding: 14px 10px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease !important;
          border-bottom: 3px solid transparent !important;
        }

        .operation-tab-btn:hover {
          background-color: #e2e8f0 !important;
          color: var(--hw-charcoal) !important;
        }

        .operation-tab-btn.active {
          background-color: var(--hw-panel-bg) !important;
          color: var(--hw-orange) !important;
          border-bottom: 3px solid var(--hw-orange) !important;
        }

        .tab-icon {
          font-size: 14px;
        }

        .tab-content-wrapper {
          animation: fadeIn 0.2s ease-out;
        }

        .tab-intro {
          border-bottom: 1px dashed var(--hw-border);
          padding-bottom: 1rem;
          margin-bottom: 1.25rem;
        }

        .tab-intro h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--hw-charcoal);
        }

        .tab-intro p {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--hw-steel);
        }

        .movement-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .movement-grid { grid-template-columns: 1fr; }
        }

        .back-btn {
          background: none;
          border: none;
          color: var(--hw-steel);
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .back-btn:hover {
          color: var(--hw-orange);
        }

        .large-padding { padding: 2.5rem; }

        .view-footer-info {
          margin-top: 20px;
          font-size: 13px;
          color: var(--hw-steel);
          text-align: center;
          font-style: italic;
        }

        input, select {
          border-radius: 4px !important;
          border: 1px solid #cbd5e1 !important;
          padding: 9px 12px !important;
          font-size: 13px !important;
          background-color: #ffffff !important;
        }

        input:focus, select:focus {
          border-color: var(--hw-orange) !important;
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.1) !important;
        }

        /* Unified Table Styling */
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th {
          background-color: var(--hw-bg-light) !important;
          color: var(--hw-steel) !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 10px 12px;
          border-bottom: 2px solid var(--hw-border) !important;
          text-align: left;
        }
        td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--hw-bg) !important;
          vertical-align: middle;
          color: var(--hw-slate-dark);
        }
        tr:hover {
          background-color: var(--hw-bg-light) !important;
        }

        /* Responsive Table Scroll-Wrappers */
        .ref-table-wrapper, .table-wrapper, .product-results, .daily-ops-feed {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
        }

        /* Custom Scrollbar Styles for consistent Industrial feel */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background-color: var(--hw-steel);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background-color: var(--hw-orange);
        }

        button, .btn-submit, .btn-create-submit {
          border-radius: 4px !important;
          background-color: var(--hw-orange) !important;
          border: none !important;
          color: white !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding: 10px 16px !important;
          cursor: pointer;
          transition: background 0.1s ease !important;
        }

        button:hover, .btn-submit:hover, .btn-create-submit:hover {
          background-color: var(--hw-orange-hover) !important;
        }

        .row-low-stock { background-color: #fff7ed !important; }
        .low-stock-badge { background-color: var(--hw-orange) !important; }
        .card { box-shadow: none !important; padding: 0 !important; background: transparent !important; }
        .card h2, .product-search-container h2, .audit-log-container h2, .category-manager-container h2 { display: none !important; }

        .hardware-footer {
          background-color: var(--hw-dark-bg);
          color: #94a3b8;
          text-align: center;
          padding: 1.5rem;
          font-size: 12px;
          border-top: 4px solid var(--hw-orange);
        }

        /* Mobile and Tablet Responsiveness Overrides */
        @media (max-width: 768px) {
          .hardware-nav {
            padding: 1rem !important;
          }
          
          .hardware-nav-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 15px !important;
            text-align: center !important;
          }
          
          .hardware-brand {
            flex-direction: column !important;
            align-items: center !important;
            gap: 8px !important;
          }
          
          .hardware-brand-text h1 {
            font-size: 14px !important;
            line-height: 1.3 !important;
            text-align: center !important;
          }

          .hardware-brand-text p {
            text-align: center !important;
          }

          .hardware-nav-actions {
            flex-wrap: wrap !important;
            justify-content: center !important;
            gap: 10px !important;
            width: 100% !important;
          }

          .welcome-pill {
            margin-right: 0 !important;
            width: 100% !important;
            justify-content: center !important;
            box-sizing: border-box !important;
          }

          .theme-toggle-btn {
            margin-right: 0 !important;
            flex-grow: 1 !important;
            justify-content: center !important;
          }

          /* Main Workspace Padding */
          .large-padding {
            padding: 1rem !important;
          }

          .hardware-col {
            gap: 1.5rem !important;
          }

          /* Grid structures inside components */
          .manager-grid, .user-admin-grid, .dashboard-grid {
            grid-template-columns: 1fr !important;
            gap: 15px !important;
          }

          .financial-grid {
            grid-template-columns: 1fr !important;
          }

          .movement-grid {
            grid-template-columns: 1fr !important;
          }

          /* Form structures */
          .form-section, .creator-form .form-section {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .allocation-box .form-section {
            grid-template-columns: 1fr !important;
          }

          .import-toggle-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }

          .action-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          
          .file-input-label {
            width: 100% !important;
            box-sizing: border-box !important;
            text-align: center !important;
          }

          /* Responsive Tables scroll wrapper */
          .table-responsive, 
          .preview-table-wrapper, 
          .logs-table-container, 
          .active-stock-wrapper {
            width: 100% !important;
            overflow-x: auto !important;
            display: block !important;
            -webkit-overflow-scrolling: touch !important;
            border: 1px solid var(--hw-border) !important;
            margin-bottom: 10px !important;
          }

          table {
            min-width: 600px !important;
          }

          /* Search results and lists */
          .search-bar-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          /* Modal sizing */
          .search-modal-content, .decom-options-modal, .edit-facility-modal {
            width: 95% !important;
            margin: 10px !important;
            max-height: 90vh !important;
          }
          
          .modal-body-split {
            grid-template-columns: 1fr !important;
            gap: 15px !important;
          }

          .decom-btn-group {
            flex-direction: column !important;
            gap: 10px !important;
          }
          
          .decom-option-card {
            padding: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;