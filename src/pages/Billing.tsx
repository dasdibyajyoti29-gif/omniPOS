import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Medicine, Sale, AppSettings } from '../types/pos';
import { posApi } from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';
import { CheckoutModal } from '../components/CheckoutModal';
import { useShortcuts } from '../context/ShortcutContext';
import { useAria } from '../context/AriaContext';
import {
  Barcode,
  Search,
  Trash2,
  Plus,
  Minus,
  TrendingUp,
  Printer,
  AlertCircle,
  X,
} from 'lucide-react';

interface CartItem {
  medicine: Medicine;
  quantity: number;
  unit_price: number;
}

interface BillingProps {
  settings: AppSettings;
  initialAddMedicine?: Medicine | null;
  autoFocusSearch?: boolean;
}

export const Billing: React.FC<BillingProps> = ({ settings, initialAddMedicine, autoFocusSearch }) => {
  const shortcutContext = useShortcuts();
  const registerAction = shortcutContext?.registerAction || (() => () => {});

  const ariaContext = useAria();
  const announce = useCallback((msg: string, politeness?: 'polite' | 'assertive') => {
    try {
      ariaContext?.announce?.(msg, politeness);
    } catch {
      // safe fallback
    }
  }, [ariaContext]);

  const showToast = useCallback((msg: string, type?: 'info' | 'success' | 'warning' | 'error') => {
    try {
      ariaContext?.showToast?.(msg, type);
    } catch {
      // safe fallback
    }
  }, [ariaContext]);

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Discount & Payment
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [, setCashTendered] = useState<string>('');
  const [, setUpiReference] = useState<string>('');

  // Active / Selected cart item tracking for keyboard navigation
  const [, setSelectedCartIndex] = useState<number>(-1);
  const [lastAddedMedicineId, setLastAddedMedicineId] = useState<number | null>(null);

  // Daily Summary Banner
  const [dailySummary, setDailySummary] = useState<{
    totalSales: number;
    grossProfit: number;
    invoiceCount: number;
  }>({ totalSales: 0, grossProfit: 0, invoiceCount: 0 });

  // Modals & Status
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);

  // Focus management refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const cartRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const loadData = async () => {
    try {
      const [allMeds, summary] = await Promise.all([
        posApi?.getMedicines ? posApi.getMedicines() : Promise.resolve([]),
        posApi?.getDailySalesSummary ? posApi.getDailySalesSummary() : Promise.resolve(null),
      ]);
      setMedicines(Array.isArray(allMeds) ? allMeds : []);
      if (summary) setDailySummary(summary);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    }
  };

  useEffect(() => {
    loadData();
    if (autoFocusSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    } else if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [autoFocusSearch]);

  // Handle incoming medicine from Command Palette or initial navigation
  useEffect(() => {
    if (initialAddMedicine && initialAddMedicine.id) {
      addToCart(initialAddMedicine);
    }
  }, [initialAddMedicine]);

  // Search autocomplete
  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      setSearchResults([]);
      setHighlightedIndex(-1);
      return;
    }

    const matches = (medicines || [])
      .filter((m) => {
        if (!m) return false;
        const name = (m.name || '').toLowerCase();
        const barcode = (m.barcode || '').toLowerCase();
        const batch = (m.batch_number || '').toLowerCase();
        return name.includes(trimmed) || barcode.includes(trimmed) || batch.includes(trimmed);
      })
      .slice(0, 8);

    setSearchResults(matches);
    setHighlightedIndex(matches.length > 0 ? 0 : -1);
  }, [searchQuery, medicines]);

  // Add to cart helper
  const addToCart = useCallback((med: Medicine) => {
    try {
      if (!med || !med.id) return;
      setAlertError(null);

      const sanitizedMed: Medicine = {
        ...med,
        id: Number(med.id),
        name: med.name || 'Unnamed Item',
        selling_price: Number(med.selling_price) || 0,
        purchase_price: Number(med.purchase_price) || 0,
        stock_quantity: Number(med.stock_quantity) || 0,
        batch_number: med.batch_number ?? '',
        expiry_date: med.expiry_date ?? '',
        barcode: med.barcode ?? '',
      };

      const stock = sanitizedMed.stock_quantity;

      if (stock <= 0) {
        const msg = `"${sanitizedMed.name}" is completely OUT OF STOCK!`;
        setAlertError(msg);
        announce(msg, 'assertive');
        return;
      }

      setCart((prevCart) => {
        const safeCart = Array.isArray(prevCart) ? prevCart : [];
        const existingIdx = safeCart.findIndex((item) => item?.medicine?.id === sanitizedMed.id);

        if (existingIdx >= 0) {
          const currentQty = safeCart[existingIdx].quantity || 1;
          if (currentQty + 1 > stock) {
            const msg = `Cannot add more. Only ${stock} unit(s) available in stock.`;
            setAlertError(msg);
            announce(msg, 'assertive');
            return safeCart;
          }
          const updated = [...safeCart];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: currentQty + 1,
          };
          announce(`Increased ${sanitizedMed.name} quantity to ${currentQty + 1}.`);
          return updated;
        } else {
          announce(`Added ${sanitizedMed.name} to cart.`);
          return [
            ...safeCart,
            { medicine: sanitizedMed, quantity: 1, unit_price: sanitizedMed.selling_price },
          ];
        }
      });

      setLastAddedMedicineId(sanitizedMed.id);
      setSearchQuery('');
      setSearchResults([]);
      setHighlightedIndex(-1);

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    } catch (err: any) {
      console.error('addToCart error:', err);
      setAlertError(err.message || 'Failed to add item to cart');
    }
  }, [announce]);

  // Handle Barcode Scan / Enter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertError(null);
    const code = barcodeInput.trim();
    if (!code) return;

    const med = medicines.find(
      (m) => m && m.barcode && m.barcode.trim().toLowerCase() === code.toLowerCase()
    );
    if (!med) {
      const msg = `No medicine found with barcode "${code}".`;
      setAlertError(msg);
      announce(msg, 'assertive');
      return;
    }

    addToCart(med);
    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // Autocomplete dropdown keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected =
          highlightedIndex >= 0 && highlightedIndex < searchResults.length
            ? searchResults[highlightedIndex]
            : searchResults[0];
        if (selected) {
          addToCart(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchResults([]);
        setHighlightedIndex(-1);
        setSearchQuery('');
        return;
      }
    }
  };

  const updateQuantity = (medId: number, newQty: number) => {
    setAlertError(null);
    setCart((prevCart) => {
      const target = prevCart.find((it) => it?.medicine?.id === medId);
      if (!target) return prevCart;

      if (newQty <= 0) {
        announce(`Removed ${target.medicine?.name || 'item'} from cart.`);
        return prevCart.filter((it) => it?.medicine?.id !== medId);
      }

      const availableStock = Number(target.medicine?.stock_quantity || 0);
      if (newQty > availableStock) {
        const msg = `Cannot exceed stock. Only ${availableStock} available for "${target.medicine?.name}".`;
        setAlertError(msg);
        announce(msg, 'assertive');
        return prevCart;
      }

      announce(`Updated quantity to ${newQty}.`);
      return prevCart.map((it) => (it?.medicine?.id === medId ? { ...it, quantity: newQty } : it));
    });
  };

  const removeFromCart = (medId: number) => {
    const item = cart.find((it) => it?.medicine?.id === medId);
    if (item) {
      announce(`Removed ${item.medicine?.name || 'item'} from cart.`);
    }
    setCart((prev) => prev.filter((it) => it?.medicine?.id !== medId));
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setCashTendered('');
    setUpiReference('');
    setAlertError(null);
    announce('Cart cleared.');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Register Global Shortcuts
  useEffect(() => {
    const unregisterF3 = registerAction('focusSearch', () => {
      if (document.activeElement === searchInputRef.current) {
        barcodeInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
      return true;
    });

    const unregisterF4 = registerAction('focusQuantity', () => {
      if (cart.length === 0) {
        showToast('Cart is empty. Add a medicine first.', 'warning');
        return true;
      }
      const targetMedId = lastAddedMedicineId || cart[cart.length - 1]?.medicine?.id;
      if (targetMedId) {
        const el = document.getElementById(`qty-input-${targetMedId}`) as HTMLInputElement | null;
        if (el) {
          el.focus();
          el.select();
        }
      }
      return true;
    });

    const unregisterF8 = registerAction('checkout', () => {
      if (cart.length === 0) {
        setAlertError('Cart is empty. Scan or search medicines to bill.');
        announce('Cart is empty. Scan or search medicines to bill.', 'assertive');
        return true;
      }
      setIsCheckoutModalOpen(true);
      return true;
    });

    return () => {
      unregisterF3();
      unregisterF4();
      unregisterF8();
    };
  }, [cart, lastAddedMedicineId, registerAction, showToast, announce]);

  // Calculations
  const subtotal = cart.reduce((acc, it) => acc + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0), 0);
  const totalCost = cart.reduce(
    (acc, it) => acc + (Number(it?.quantity) || 0) * (Number(it?.medicine?.purchase_price) || 0),
    0
  );
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const netPayable = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const grossProfit = Math.round((netPayable - totalCost) * 100) / 100;

  // Complete Checkout Confirmation Handler
  const handleConfirmCheckout = async (data: {
    paymentMethod: 'CASH' | 'UPI';
    cashTendered: number;
    upiReference: string;
    discountPercent: number;
  }) => {
    setIsProcessing(true);
    setAlertError(null);

    try {
      const sale = await posApi.createSale({
        customer_type: 'Walk-in Customer',
        payment_method: data.paymentMethod,
        discount_percent: data.discountPercent,
        cash_tendered: data.paymentMethod === 'CASH' ? data.cashTendered : undefined,
        upi_reference: data.paymentMethod === 'UPI' ? data.upiReference : undefined,
        items: cart.map((it) => ({
          medicine_id: it.medicine.id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
      });

      setIsCheckoutModalOpen(false);
      setCompletedSale(sale);
      announce(`Sale completed! Invoice number ${sale.invoice_number} created.`);
      showToast(`Sale completed! Invoice #${sale.invoice_number}`, 'success');

      clearCart();
      loadData();
    } catch (err: any) {
      setAlertError(err.message || 'Checkout failed');
      announce(err.message || 'Checkout failed', 'assertive');
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard navigation for cart rows
  const handleCartRowKeyDown = (e: React.KeyboardEvent, index: number, medId: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(cart.length - 1, index + 1);
      setSelectedCartIndex(nextIdx);
      cartRowRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(0, index - 1);
      setSelectedCartIndex(prevIdx);
      cartRowRefs.current[prevIdx]?.focus();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeFromCart(medId);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      const item = cart[index];
      if (item) updateQuantity(medId, item.quantity + 1);
    } else if (e.key === '-') {
      e.preventDefault();
      const item = cart[index];
      if (item) updateQuantity(medId, item.quantity - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const inputEl = document.getElementById(`qty-input-${medId}`) as HTMLInputElement | null;
      inputEl?.focus();
    }
  };

  return (
    <div className="page-content" id="billing-page" style={{ padding: '1.25rem' }}>
      {/* Daily Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1.25rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Today's Invoices
            </span>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {dailySummary.invoiceCount || 0}
            </div>
          </div>
          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Today's Sales
            </span>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#026289' }}>
              ₹{Number(dailySummary.totalSales || 0).toFixed(2)}
            </div>
          </div>
          <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Today's Gross Profit
            </span>
            <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#026289' }}>
              ₹{Number(dailySummary.grossProfit || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <kbd style={{ padding: '0.12rem 0.4rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#026289', fontWeight: 700 }}>F3</kbd>
            <span>Search</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <kbd style={{ padding: '0.12rem 0.4rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#026289', fontWeight: 700 }}>F4</kbd>
            <span>Qty</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <kbd style={{ padding: '0.12rem 0.4rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#026289', fontWeight: 700 }}>F8</kbd>
            <span>Checkout</span>
          </span>
        </div>
      </div>

      {alertError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{alertError}</span>
          </div>
          <button
            onClick={() => setAlertError(null)}
            style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer' }}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Billing Grid */}
      <div className="billing-layout">
        <div className="billing-main">
          {/* Scan & Search Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <form onSubmit={handleBarcodeSubmit}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="billing-barcode-input" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Barcode size={14} color="#026289" /> Scan Barcode (Auto-Add)
                </label>
                <input
                  type="text"
                  id="billing-barcode-input"
                  ref={barcodeInputRef}
                  className="form-input font-mono"
                  placeholder="Scan barcode or press Enter..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                />
              </div>
            </form>

            <div style={{ position: 'relative' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="billing-search-input" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Search size={14} color="#4C8EBB" /> Search Medicine Name (F3)
                </label>
                <input
                  type="text"
                  id="billing-search-input"
                  ref={searchInputRef}
                  className="form-input"
                  placeholder="Type brand name (↑/↓ to choose, Enter to add)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-autocomplete="list"
                  aria-controls="search-results-dropdown"
                  aria-activedescendant={highlightedIndex >= 0 ? `search-item-${highlightedIndex}` : undefined}
                />
              </div>

              {searchResults.length > 0 && (
                <div
                  id="search-results-dropdown"
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid rgba(2, 98, 137, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    marginTop: '4px',
                  }}
                >
                  {searchResults.map((m, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <div
                        key={m.id || idx}
                        id={`search-item-${idx}`}
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => addToCart(m)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        style={{
                          padding: '0.65rem 0.9rem',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: isHighlighted ? 'rgba(152, 216, 255, 0.25)' : 'transparent',
                          borderLeft: isHighlighted ? '3px solid #026289' : '3px solid transparent',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isHighlighted ? '#026289' : 'var(--text-main)' }}>
                            {m.name || 'Unnamed'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                            Batch: {m.batch_number || 'N/A'} | Exp: {m.expiry_date || 'N/A'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div className="font-mono" style={{ color: '#026289', fontWeight: 600 }}>
                            ₹{Number(m.selling_price || 0).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: Number(m.stock_quantity || 0) <= 10 ? '#f59e0b' : 'var(--text-muted)' }}>
                            Stock: {m.stock_quantity ?? 0}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table Container */}
          <div className="cart-card">
            <div className="table-header-bar">
              <span className="table-title">Cart Items ({cart.reduce((a, b) => a + (b.quantity || 0), 0)})</span>
              {cart.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  onClick={clearCart}
                  id="btn-clear-cart"
                >
                  Clear Cart
                </button>
              )}
            </div>

            <div className="cart-items-scroll">
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  <Barcode size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>Scan or Search to Start Billing</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                    Type medicine name above (press Enter to add) or scan barcode. Press F8 to checkout.
                  </div>
                </div>
              ) : (
                <table className="pos-table" role="table" aria-label="Cart Items">
                  <thead>
                    <tr>
                      <th scope="col">Medicine</th>
                      <th scope="col">Batch / Expiry</th>
                      <th scope="col">Price</th>
                      <th scope="col">Cost</th>
                      <th scope="col">Qty (F4)</th>
                      <th scope="col">Subtotal</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => {
                      if (!item || !item.medicine) return null;
                      const medId = item.medicine.id;
                      const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

                      return (
                        <tr
                          key={medId || idx}
                          ref={(el) => {
                            if (cartRowRefs.current) {
                              cartRowRefs.current[idx] = el;
                            }
                          }}
                          tabIndex={0}
                          onKeyDown={(e) => handleCartRowKeyDown(e, idx, medId)}
                          aria-label={`${item.medicine.name || 'Item'}, ${item.quantity} units, subtotal ${itemSubtotal.toFixed(2)}`}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.medicine.name || 'Unknown'}</div>
                          </td>
                          <td className="font-mono" style={{ fontSize: '0.78rem' }}>
                            <div>{item.medicine.batch_number || 'N/A'}</div>
                            <div style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>
                              Exp: {item.medicine.expiry_date || 'N/A'}
                            </div>
                          </td>
                          <td className="font-mono">₹{Number(item.unit_price || 0).toFixed(2)}</td>
                          <td className="font-mono" style={{ color: 'var(--text-faint)' }}>
                            ₹{Number(item.medicine.purchase_price || 0).toFixed(2)}
                          </td>
                          <td>
                            <div className="qty-control">
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() => updateQuantity(medId, item.quantity - 1)}
                                aria-label={`Decrease quantity of ${item.medicine.name}`}
                              >
                                <Minus size={12} />
                              </button>
                              <input
                                id={`qty-input-${medId}`}
                                type="text"
                                className="qty-input"
                                aria-label={`Quantity for ${item.medicine.name}`}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) updateQuantity(medId, val);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    searchInputRef.current?.focus();
                                  } else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
                                    e.preventDefault();
                                    updateQuantity(medId, item.quantity + 1);
                                  } else if (e.key === 'ArrowDown' || e.key === '-') {
                                    e.preventDefault();
                                    updateQuantity(medId, item.quantity - 1);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="qty-btn"
                                onClick={() => updateQuantity(medId, item.quantity + 1)}
                                aria-label={`Increase quantity of ${item.medicine.name}`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="font-mono" style={{ fontWeight: 600 }}>
                            ₹{itemSubtotal.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-icon"
                              style={{ padding: '0.25rem' }}
                              onClick={() => removeFromCart(medId)}
                              aria-label={`Remove ${item.medicine.name} from cart`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Summary */}
        <div className="billing-sidebar">
          <div className="table-container" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Bill Summary</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="billing-discount-input" style={{ color: 'var(--text-muted)', margin: 0 }}>
                  Discount (%):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '90px' }}>
                  <input
                    ref={discountInputRef}
                    type="number"
                    min="0"
                    max="100"
                    id="billing-discount-input"
                    className="form-input font-mono"
                    style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  />
                  <span>%</span>
                </div>
              </div>

              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                  <span>Discount Amount:</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div
                style={{
                  backgroundColor: 'rgba(2, 98, 137, 0.08)',
                  border: '1px solid rgba(2, 98, 137, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.85rem',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Cost of Sold Batch:</span>
                  <span className="font-mono">₹{totalCost.toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#026289',
                    marginTop: '0.25rem',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <TrendingUp size={14} /> Gross Profit:
                  </span>
                  <span className="font-mono">₹{grossProfit.toFixed(2)}</span>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px dashed var(--border-subtle)',
                  paddingTop: '0.85rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>NET PAYABLE:</span>
                <span className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#026289' }}>
                  ₹{netPayable.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '1.5rem',
                gap: '0.65rem',
              }}
              disabled={cart.length === 0 || isProcessing}
              onClick={() => setIsCheckoutModalOpen(true)}
              id="btn-complete-checkout"
            >
              <Printer size={18} />
              <span>Checkout & Print (F8)</span>
            </button>
          </div>
        </div>
      </div>

      {isCheckoutModalOpen && (
        <CheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => {
            setIsCheckoutModalOpen(false);
            setTimeout(() => searchInputRef.current?.focus(), 30);
          }}
          onConfirm={handleConfirmCheckout}
          subtotal={subtotal}
          initialDiscountPercent={discountPercent}
          itemsCount={cart.reduce((a, b) => a + (b.quantity || 0), 0)}
          isProcessing={isProcessing}
        />
      )}

      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          settings={settings}
          onClose={() => {
            setCompletedSale(null);
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 50);
          }}
        />
      )}
    </div>
  );
};