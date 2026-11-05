import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  PackagePlus,
  Receipt,
  Settings,
  Keyboard,
  RefreshCw,
  Download,
  Database,
  Search,
  ArrowRight,
  PlusCircle,
} from 'lucide-react';
import { useFocusTrap } from '../utils/focusTrap';
import { Medicine } from '../types/pos';
import { posApi } from '../services/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, state?: any) => void;
  onTriggerSync: () => void;
  onOpenShortcuts: () => void;
}

interface PaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  shortcut?: string;
  category: 'Navigation' | 'Actions' | 'Medicines';
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerSync,
  onOpenShortcuts,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  useFocusTrap(modalRef, {
    isOpen,
    onEscape: onClose,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Pre-fetch medicines for instant search
      posApi.getMedicines().then((res) => setMedicines(res)).catch(() => {});
    }
  }, [isOpen]);

  const baseActions: PaletteAction[] = [
    {
      id: 'nav-billing',
      title: 'POS Fast Billing',
      subtitle: 'Open terminal for barcode scanning & billing',
      icon: ShoppingCart,
      shortcut: 'F2',
      category: 'Navigation',
      action: () => {
        onNavigate('billing');
        onClose();
      },
    },
    {
      id: 'nav-dashboard',
      title: 'Pharmacy Dashboard',
      subtitle: 'View real-time sales, profit, and stock health',
      icon: LayoutDashboard,
      shortcut: 'F9',
      category: 'Navigation',
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-inventory',
      title: 'Medicine Inventory',
      subtitle: 'Manage items, prices, batches, and stock',
      icon: Pill,
      shortcut: 'F6',
      category: 'Navigation',
      action: () => {
        onNavigate('inventory');
        onClose();
      },
    },
    {
      id: 'nav-purchases',
      title: 'Purchase Stock & Inward Goods',
      subtitle: 'Record inward batch purchases and restock items',
      icon: PackagePlus,
      shortcut: 'F5',
      category: 'Navigation',
      action: () => {
        onNavigate('purchases');
        onClose();
      },
    },
    {
      id: 'nav-sales',
      title: 'Sales & Invoices History',
      subtitle: 'View and reprint past transactions and bills',
      icon: Receipt,
      shortcut: 'F7',
      category: 'Navigation',
      action: () => {
        onNavigate('sales');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Settings & Cloud Backup',
      subtitle: 'Configure store info, Google Sheets sync, and database',
      icon: Settings,
      category: 'Navigation',
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    {
      id: 'action-shortcuts',
      title: 'Keyboard Shortcuts Reference',
      subtitle: 'View full cheat sheet of keyboard operations',
      icon: Keyboard,
      shortcut: 'F1',
      category: 'Actions',
      action: () => {
        onClose();
        setTimeout(onOpenShortcuts, 50);
      },
    },
    {
      id: 'action-sync',
      title: 'Sync with Google Sheets',
      subtitle: 'Trigger instant two-way cloud ledger synchronization',
      icon: RefreshCw,
      category: 'Actions',
      action: () => {
        onTriggerSync();
        onClose();
      },
    },
    {
      id: 'action-export-meds',
      title: 'Export Medicines CSV',
      subtitle: 'Download complete inventory spreadsheet',
      icon: Download,
      category: 'Actions',
      action: async () => {
        onClose();
        try {
          const res = await posApi.exportCSV('medicines');
          if (res.success && res.filePath) alert(`Medicines exported to: ${res.filePath}`);
        } catch (e: any) {
          alert('Export failed: ' + e.message);
        }
      },
    },
    {
      id: 'action-export-sales',
      title: 'Export Sales History CSV',
      subtitle: 'Download complete sales ledger spreadsheet',
      icon: Download,
      category: 'Actions',
      action: async () => {
        onClose();
        try {
          const res = await posApi.exportCSV('sales');
          if (res.success && res.filePath) alert(`Sales exported to: ${res.filePath}`);
        } catch (e: any) {
          alert('Export failed: ' + e.message);
        }
      },
    },
    {
      id: 'action-backup',
      title: 'Backup SQLite Database',
      subtitle: 'Save a timestamped copy of the local database',
      icon: Database,
      category: 'Actions',
      action: async () => {
        onClose();
        try {
          const res = await posApi.backupDatabase();
          if (res.success) alert(`Database backed up to: ${res.filePath}`);
        } catch (e: any) {
          alert('Backup failed: ' + e.message);
        }
      },
    },
  ];

  // Also include medicine search if query is entered
  const medicineActions: PaletteAction[] =
    query.trim().length > 1
      ? medicines
          .filter(
            (m) =>
              m.name.toLowerCase().includes(query.toLowerCase()) ||
              m.barcode.toLowerCase().includes(query.toLowerCase()) ||
              m.batch_number.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 5)
          .map((m) => ({
            id: `med-${m.id}`,
            title: m.name,
            subtitle: `₹${m.selling_price.toFixed(2)} | Stock: ${m.stock_quantity} | Batch: ${m.batch_number}`,
            icon: Pill,
            category: 'Medicines',
            action: () => {
              onNavigate('billing', { addMedicine: m });
              onClose();
            },
          }))
      : [];

  const allFilteredActions = [...baseActions, ...medicineActions].filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  });

  // Ensure selectedIndex is always within range
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allFilteredActions.length || 1));
      scrollSelectedIntoView((selectedIndex + 1) % (allFilteredActions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (allFilteredActions.length || 1)) % (allFilteredActions.length || 1));
      scrollSelectedIntoView((selectedIndex - 1 + (allFilteredActions.length || 1)) % (allFilteredActions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentAction = allFilteredActions[selectedIndex];
      if (currentAction) {
        currentAction.action();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
      scrollSelectedIntoView(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = Math.max(0, allFilteredActions.length - 1);
      setSelectedIndex(last);
      scrollSelectedIntoView(last);
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    const list = listRef.current;
    if (!list) return;
    const itemEl = list.children[index] as HTMLElement;
    if (itemEl) {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      id="command-palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        ref={modalRef}
        style={{
          maxWidth: '580px',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 40px rgba(2, 98, 137, 0.15), 0 0 30px rgba(152, 216, 255, 0.2)',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '0.75rem',
          }}
        >
          <Search size={18} color="#026289" />
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: 0,
              fontSize: '1rem',
              color: 'var(--text-main)',
            }}
            placeholder="Type a screen, action, or medicine..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            id="input-command-palette"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={allFilteredActions[selectedIndex] ? `palette-item-${selectedIndex}` : undefined}
          />
          <kbd
            style={{
              padding: '0.15rem 0.45rem',
              backgroundColor: '#f1f5f9',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '0.5rem',
          }}
        >
          {allFilteredActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No commands or medicines match "{query}"
            </div>
          ) : (
            allFilteredActions.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  id={`palette-item-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(152, 216, 255, 0.25)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #026289' : '3px solid transparent',
                    transition: 'background-color 100ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'rgba(2, 98, 137, 0.12)' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isSelected ? '#026289' : 'var(--text-muted)',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: isSelected ? '#026289' : 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: isSelected ? '#475569' : 'var(--text-faint)',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {item.shortcut && (
                      <kbd
                        style={{
                          padding: '0.15rem 0.45rem',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#026289',
                          fontWeight: 600,
                        }}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{item.category}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 1.25rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-faint)',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>
              <kbd style={{ padding: '0.1rem 0.3rem', background: '#e2e8f0', borderRadius: '3px' }}>↑</kbd>{' '}
              <kbd style={{ padding: '0.1rem 0.3rem', background: '#e2e8f0', borderRadius: '3px' }}>↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ padding: '0.1rem 0.3rem', background: '#e2e8f0', borderRadius: '3px' }}>Enter</kbd> Select
            </span>
          </div>
          <span>OmniPOS Command Hub</span>
        </div>
      </div>
    </div>
  );
};
