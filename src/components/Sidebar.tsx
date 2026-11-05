import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  PackagePlus,
  Receipt,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
} from 'lucide-react';
import { SyncStatus } from '../types/pos';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  syncStatus: SyncStatus;
  isOnline: boolean;
  onTriggerSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  syncStatus,
  isOnline,
  onTriggerSync,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'F9' },
    { id: 'billing', label: 'POS Billing', icon: ShoppingCart, highlight: true, shortcut: 'F2' },
    { id: 'inventory', label: 'Medicine Inventory', icon: Pill, shortcut: 'F6' },
    { id: 'purchases', label: 'Purchase Stock', icon: PackagePlus, shortcut: 'F5' },
    { id: 'sales', label: 'Sales History', icon: Receipt, shortcut: 'F7' },
    { id: 'settings', label: 'Settings & Backup', icon: Settings },
  ];

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleNavKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % navItems.length;
      document.getElementById(`nav-${navItems[nextIndex].id}`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + navItems.length) % navItems.length;
      document.getElementById(`nav-${navItems[prevIndex].id}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      document.getElementById(`nav-${navItems[0].id}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      document.getElementById(`nav-${navItems[navItems.length - 1].id}`)?.focus();
    }
  };

  return (
    <aside className="app-sidebar" id="app-sidebar" aria-label="Sidebar Navigation">
      <div>
        {/* Brand Header */}
        <div className="brand-section">
          <div className="brand-icon-box" aria-hidden="true">
            <Pill size={24} />
          </div>
          <div>
            <div className="brand-title">OmniPOS</div>
            <div className="brand-sub">Point of Sale Suite</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="nav-menu" role="navigation" aria-label="Main Navigation">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
                onKeyDown={(e) => handleNavKeyDown(e, idx)}
                aria-current={isActive ? 'page' : undefined}
                style={
                  item.highlight && !isActive
                    ? {
                        backgroundColor: 'rgba(2, 98, 137, 0.08)',
                        color: '#026289',
                        fontWeight: 600,
                      }
                    : {}
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1 }}>
                  <Icon size={19} aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                {item.shortcut && (
                  <kbd
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.1rem 0.35rem',
                      backgroundColor: isActive ? 'rgba(2, 98, 137, 0.15)' : '#f1f5f9',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: isActive ? '#026289' : 'var(--text-faint)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Connectivity & Google Sheets Sync */}
      <div className="sidebar-footer">
        <div className="sync-status-card" id="sidebar-sync-card">
          <div className="sync-status-header">
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Cloud Sync</span>
            <span className={`sync-badge ${!isOnline ? 'offline' : syncStatus.pendingCount > 0 ? 'pending' : 'synced'}`}>
              {!isOnline ? (
                <>
                  <WifiOff size={12} /> Offline
                </>
              ) : syncStatus.pendingCount > 0 ? (
                <>
                  <RefreshCw size={12} className={syncStatus.isSyncing ? 'animate-spin' : ''} /> {syncStatus.pendingCount} Pending
                </>
              ) : (
                <>
                  <Wifi size={12} /> Synced
                </>
              )}
            </span>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '0.5rem' }}>
            Last sync: {formatLastSync(syncStatus.lastSyncAt)}
          </div>

          <button
            id="btn-sidebar-sync-now"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', gap: '0.35rem' }}
            onClick={onTriggerSync}
            disabled={syncStatus.isSyncing}
          >
            <RefreshCw size={13} style={syncStatus.isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
            {syncStatus.isSyncing ? 'Syncing Sheets...' : 'Sync Now'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            <Database size={12} /> SQLite WAL
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
