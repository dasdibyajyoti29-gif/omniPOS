import React, { useState, useEffect, useRef } from 'react';
import { Sale, AppSettings } from '../types/pos';
import { posApi } from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';
import { useShortcuts } from '../context/ShortcutContext';
import { useAria } from '../context/AriaContext';
import {
  Search,
  Calendar,
  Receipt,
  Printer,
  Download,
  CreditCard,
  Banknote,
} from 'lucide-react';

interface SalesHistoryProps {
  settings: AppSettings;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ settings }) => {
  const { registerAction } = useShortcuts();
  const { announce } = useAria();

  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Daily Summary for selected date or today
  const [summary, setSummary] = useState<{
    date: string;
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    invoiceCount: number;
  }>({ date: '', totalSales: 0, totalCost: 0, grossProfit: 0, invoiceCount: 0 });

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const [history, daily] = await Promise.all([
        posApi.getSalesHistory(searchQuery, dateFilter),
        posApi.getDailySalesSummary(dateFilter || undefined),
      ]);
      setSales(history);
      setSummary(daily);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [searchQuery, dateFilter]);

  // Register F3 for search
  useEffect(() => {
    const unregisterF3 = registerAction('focusSearch', () => {
      searchInputRef.current?.focus();
      return true;
    });
    return () => unregisterF3();
  }, [registerAction]);

  const handleExportCSV = async () => {
    try {
      const res = await posApi.exportCSV('sales');
      if (res.success && res.filePath) {
        alert(`Sales history exported to: ${res.filePath}`);
      }
    } catch (err: any) {
      alert('CSV Export failed: ' + err.message);
    }
  };

  const handleReprint = (sale: Sale) => {
    setSelectedSale(sale);
    announce(`Opened invoice ${sale.invoice_number}`);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, index: number, sale: Sale) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(sales.length - 1, index + 1);
      tableRowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      tableRowRefs.current[prev]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleReprint(sale);
    } else if (e.key === 'Home') {
      e.preventDefault();
      tableRowRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      tableRowRefs.current[sales.length - 1]?.focus();
    }
  };

  return (
    <div className="page-content" id="sales-history-page">
      {/* Daily Metrics Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Invoices ({dateFilter || 'Today'})
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {summary.invoiceCount}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Sales
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#026289' }}>
            ₹{summary.totalSales.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Cost of Goods (COGS)
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-faint)' }}>
            ₹{summary.totalCost.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Gross Profit
          </div>
          <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4C8EBB' }}>
            ₹{summary.grossProfit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '600px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              id="sales-search-input"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search invoice number, customer, payment (F3)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search sales invoices"
            />
          </div>

          <div style={{ width: '180px' }}>
            <input
              type="date"
              id="sales-date-filter"
              className="form-input font-mono"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by invoice date"
            />
          </div>

          {dateFilter && (
            <button
              className="btn btn-secondary"
              onClick={() => setDateFilter('')}
              style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
            >
              Clear Date
            </button>
          )}
        </div>

        <button className="btn btn-secondary" onClick={handleExportCSV} id="btn-export-sales-csv">
          <Download size={15} /> Export Sales CSV
        </button>
      </div>

      {/* Invoices Log Table */}
      <div className="table-container">
        <table className="pos-table" id="sales-history-table" role="table" aria-label="Sales History Table">
          <thead>
            <tr>
              <th scope="col">Invoice #</th>
              <th scope="col">Date & Time</th>
              <th scope="col">Payment</th>
              <th scope="col">Items</th>
              <th scope="col">Subtotal</th>
              <th scope="col">Discount</th>
              <th scope="col">Total Paid</th>
              <th scope="col">Gross Profit</th>
              <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading sales invoices...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No sales found matching your criteria.
                </td>
              </tr>
            ) : (
              sales.map((s, idx) => (
                <tr
                  key={s.id}
                  id={`sale-row-${s.id}`}
                  ref={(el) => (tableRowRefs.current[idx] = el)}
                  tabIndex={0}
                  onKeyDown={(e) => handleRowKeyDown(e, idx, s)}
                  aria-label={`Invoice ${s.invoice_number}, amount ${s.total_amount.toFixed(2)}, press Enter to view`}
                >
                  <td className="font-mono" style={{ fontWeight: 700, color: '#026289' }}>
                    {s.invoice_number}
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                    {new Date(s.created_at).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    <span
                      className={`pill ${s.payment_method === 'CASH' ? 'pill-success' : 'pill-info'}`}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {s.payment_method === 'CASH' ? <Banknote size={12} /> : <CreditCard size={12} />}
                      {s.payment_method}
                    </span>
                  </td>
                  <td>{s.items?.length || 0} item(s)</td>
                  <td className="font-mono">₹{s.subtotal.toFixed(2)}</td>
                  <td className="font-mono" style={{ color: s.discount_amount > 0 ? '#f59e0b' : 'inherit' }}>
                    {s.discount_amount > 0 ? `-₹${s.discount_amount.toFixed(2)}` : '—'}
                  </td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>
                    ₹{s.total_amount.toFixed(2)}
                  </td>
                  <td className="font-mono" style={{ color: '#026289', fontWeight: 600 }}>
                    ₹{s.gross_profit.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => handleReprint(s)}
                      id={`btn-reprint-${s.id}`}
                      title="View Details & Reprint Receipt (Enter)"
                      aria-label={`View and reprint invoice ${s.invoice_number}`}
                    >
                      <Printer size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Reprint Receipt Modal */}
      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          settings={settings}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
};
