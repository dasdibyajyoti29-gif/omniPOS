import React, { useRef, useState } from 'react';
import { Keyboard, X, Search, Navigation, ShoppingBag, FileSpreadsheet, Layers } from 'lucide-react';
import { useFocusTrap } from '../utils/focusTrap';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'global' | 'billing' | 'forms' | 'tables';
}

const SHORTCUTS: ShortcutItem[] = [
  // Global
  { keys: ['F1'], description: 'Show keyboard shortcuts help dialog', category: 'global' },
  { keys: ['F2'], description: 'Open POS Fast Billing screen', category: 'global' },
  { keys: ['F5'], description: 'Open Purchase Stock & Inward Goods screen', category: 'global' },
  { keys: ['F6'], description: 'Open Medicine Inventory screen', category: 'global' },
  { keys: ['F7'], description: 'Open Sales & Invoices History screen', category: 'global' },
  { keys: ['F9'], description: 'Open Pharmacy Dashboard screen', category: 'global' },
  { keys: ['Ctrl / ⌘', 'K'], description: 'Open Quick Navigation & Search command palette', category: 'global' },
  { keys: ['Esc'], description: 'Close active overlay, dialog, dropdown, or cancel action', category: 'global' },

  // Billing
  { keys: ['F3'], description: 'Focus medicine search / barcode input field', category: 'billing' },
  { keys: ['↑', '↓'], description: 'Navigate medicine autocomplete search results or cart rows', category: 'billing' },
  { keys: ['Enter'], description: 'Add selected medicine to cart or submit scanned barcode', category: 'billing' },
  { keys: ['F4'], description: 'Focus quantity input for the selected / active item in cart', category: 'billing' },
  { keys: ['+ / -'], description: 'Increase or decrease quantity in cart', category: 'billing' },
  { keys: ['Delete'], description: 'Remove focused item from the billing cart', category: 'billing' },
  { keys: ['F8'], description: 'Initiate Checkout & Payment review (when cart has items)', category: 'billing' },
  { keys: ['Tab'], description: 'Navigate forward between discount, payment methods, and confirm buttons', category: 'billing' },
  { keys: ['Shift', 'Tab'], description: 'Navigate backward through billing controls', category: 'billing' },
  { keys: ['Ctrl / ⌘', 'P'], description: 'Print the current receipt / invoice in receipt modal', category: 'billing' },

  // Forms
  { keys: ['Ctrl / ⌘', 'S'], description: 'Save current draft or form (Settings, Inventory, Purchases)', category: 'forms' },
  { keys: ['Enter'], description: 'Submit active form (inserts newline in multiline text areas)', category: 'forms' },
  { keys: ['Esc'], description: 'Close dialog (confirms before discarding unsaved changes)', category: 'forms' },
  { keys: ['Tab / Shift+Tab'], description: 'Move focus forward/backward between form fields', category: 'forms' },

  // Tables
  { keys: ['↑', '↓'], description: 'Navigate up and down through table rows', category: 'tables' },
  { keys: ['Enter'], description: 'Open, edit, or reprint the selected record / row', category: 'tables' },
  { keys: ['Home / End'], description: 'Jump directly to the first or last record in table', category: 'tables' },
  { keys: ['Delete'], description: 'Delete selected record (with keyboard confirmation)', category: 'tables' },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useFocusTrap(modalRef, {
    isOpen,
    onEscape: onClose,
    initialFocusRef: searchInputRef,
  });

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUTS.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const q = filterQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.description.toLowerCase().includes(q) ||
      item.keys.some((k) => k.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      className="modal-overlay"
      id="shortcut-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-modal-title"
    >
      <div
        className="modal-content"
        ref={modalRef}
        style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="kpi-icon-wrap" style={{ width: '36px', height: '36px', color: '#026289' }}>
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="modal-title" id="shortcut-modal-title" style={{ fontSize: '1.15rem' }}>
                Keyboard Shortcuts & Navigation
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Operate the entire POS system without touching the mouse
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            id="btn-close-shortcuts-modal"
            aria-label="Close keyboard shortcuts help"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-faint)',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
              placeholder="Filter shortcuts (e.g. checkout, inventory, print, F8)..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              id="input-filter-shortcuts"
              aria-label="Filter shortcuts"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Shortcuts', icon: Layers },
              { id: 'global', label: 'Global Navigation', icon: Navigation },
              { id: 'billing', label: 'POS Billing', icon: ShoppingBag },
              { id: 'forms', label: 'Forms & Modals', icon: FileSpreadsheet },
              { id: 'tables', label: 'Tables & Lists', icon: Layers },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`btn ${activeCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.74rem', gap: '0.35rem' }}
                  onClick={() => setActiveCategory(cat.id)}
                  id={`btn-shortcut-cat-${cat.id}`}
                >
                  <Icon size={12} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcuts List */}
        <div
          className="modal-body"
          style={{ overflowY: 'auto', maxHeight: '420px', padding: '0.75rem 1.25rem' }}
          role="region"
          aria-label="Shortcuts List"
        >
          {filteredShortcuts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No shortcuts found matching "{filterQuery}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredShortcuts.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
                    backgroundColor: 'var(--bg-card-hover)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', flex: 1, paddingRight: '1rem' }}>
                    {item.description}
                  </span>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="shortcut-kbd"
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.2rem 0.5rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: '#026289',
                          fontWeight: 700,
                          boxShadow: '0 1px 2px rgba(2, 98, 137, 0.08)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
            Tip: Press <kbd style={{ padding: '0.1rem 0.35rem', background: '#e2e8f0', borderRadius: '3px' }}>Esc</kbd> anytime to dismiss overlays.
          </div>
          <button className="btn btn-primary" onClick={onClose} id="btn-done-shortcuts">
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
