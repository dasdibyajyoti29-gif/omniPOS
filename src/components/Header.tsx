import React from 'react';
import { PlusCircle, ShieldCheck, Keyboard, Search } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onNewSale: () => void;
  onOpenShortcuts?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNewSale,
  onOpenShortcuts,
  onOpenCommandPalette,
}) => {
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Pharmacy Dashboard';
      case 'billing':
        return 'POS Fast Billing';
      case 'inventory':
        return 'Medicine Inventory Management';
      case 'purchases':
        return 'Purchase Stock & Inward Goods';
      case 'sales':
        return 'Sales & Invoices History';
      case 'settings':
        return 'Settings & Data Backup';
      default:
        return 'OmniPOS';
    }
  };

  return (
    <header className="app-header" id="app-header" role="banner">
      <div className="header-title-box">
        <h1 className="page-title">{getTabTitle(currentTab)}</h1>
        <span
          className="pill pill-success"
          style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ShieldCheck size={13} /> SQLite Local Active
        </span>
      </div>

      <div className="header-actions">
        {onOpenCommandPalette && (
          <button
            className="btn btn-secondary"
            onClick={onOpenCommandPalette}
            id="btn-header-command-palette"
            title="Open Command Palette (Ctrl+K)"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', gap: '0.5rem' }}
          >
            <Search size={14} color="#026289" />
            <span style={{ color: 'var(--text-muted)' }}>Search / Jump</span>
            <kbd
              style={{
                fontSize: '0.68rem',
                padding: '0.1rem 0.35rem',
                backgroundColor: '#f1f5f9',
                borderRadius: 'var(--radius-sm)',
                color: '#026289',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}

        {onOpenShortcuts && (
          <button
            className="btn btn-secondary"
            onClick={onOpenShortcuts}
            id="btn-header-shortcuts-help"
            title="Show Keyboard Shortcuts Help (F1)"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', gap: '0.4rem' }}
          >
            <Keyboard size={15} color="#4C8EBB" />
            <span>Help</span>
            <kbd
              style={{
                fontSize: '0.68rem',
                padding: '0.1rem 0.35rem',
                backgroundColor: '#f1f5f9',
                borderRadius: 'var(--radius-sm)',
                color: '#4C8EBB',
                fontFamily: 'var(--font-mono)',
              }}
            >
              F1
            </kbd>
          </button>
        )}

        {currentTab !== 'billing' && (
          <button className="btn btn-primary" onClick={onNewSale} id="btn-header-new-sale">
            <PlusCircle size={16} />
            <span>New Sale</span>
            <kbd
              style={{
                fontSize: '0.68rem',
                padding: '0.1rem 0.35rem',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                borderRadius: 'var(--radius-sm)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
              }}
            >
              F2
            </kbd>
          </button>
        )}
      </div>
    </header>
  );
};
