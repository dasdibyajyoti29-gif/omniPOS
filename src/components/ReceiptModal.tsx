import React, { useRef, useEffect } from 'react';
import { Sale, AppSettings } from '../types/pos';
import { Printer, X, CheckCircle, FileText } from 'lucide-react';
import { posApi } from '../services/api';
import { useFocusTrap } from '../utils/focusTrap';

interface ReceiptModalProps {
  sale: Sale;
  settings: AppSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [printWidth, setPrintWidth] = React.useState<'80mm' | '58mm' | 'a4'>(settings.thermal_width || '80mm');
  const modalRef = useRef<HTMLDivElement>(null);
  const printBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(modalRef, {
    isOpen: true,
    onEscape: onClose,
    initialFocusRef: printBtnRef,
  });

  const formattedDate = new Date(sale.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const getReceiptHtml = (width: '80mm' | '58mm' | 'a4'): string => {
    const itemsHtml = (sale.items || [])
      .map(
        (it) => `
        <tr>
          <td style="padding: 4px 0;">
            <div style="font-weight: bold;">${it.medicine_name}</div>
            <div style="font-size: 10px; color: #555;">Batch: ${it.batch_number} | Exp: ${it.expiry_date}</div>
          </td>
          <td style="text-align: center; vertical-align: top; padding: 4px 0;">${it.quantity}</td>
          <td style="text-align: right; vertical-align: top; padding: 4px 0;">₹${it.unit_price.toFixed(2)}</td>
          <td style="text-align: right; vertical-align: top; padding: 4px 0;">₹${it.subtotal.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    return `
      <div style="text-align: center; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: ${width === 'a4' ? '20px' : '16px'}; font-weight: bold;">${settings.pharmacy_name}</h2>
        <div style="font-size: 11px; margin-top: 2px;">${settings.pharmacy_address}</div>
        <div style="font-size: 11px;">Phone: ${settings.pharmacy_phone} ${settings.pharmacy_gst ? `| GST: ${settings.pharmacy_gst}` : ''}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin: 6px 0; font-size: 11px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Invoice: <b>${sale.invoice_number}</b></span>
          <span>Payment: <b>${sale.payment_method}</b></span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Date: ${formattedDate}</span>
          <span>Customer: ${sale.customer_type}</span>
        </div>
        ${sale.upi_reference ? `<div>UPI Ref: ${sale.upi_reference}</div>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding-bottom: 4px;">Item</th>
            <th style="text-align: center; padding-bottom: 4px; width: 40px;">Qty</th>
            <th style="text-align: right; padding-bottom: 4px; width: 60px;">Price</th>
            <th style="text-align: right; padding-bottom: 4px; width: 65px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 11px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Subtotal:</span>
          <span>₹${sale.subtotal.toFixed(2)}</span>
        </div>
        ${
          sale.discount_amount > 0
            ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #000;">
            <span>Discount (${sale.discount_percent}%):</span>
            <span>-₹${sale.discount_amount.toFixed(2)}</span>
          </div>
        `
            : ''
        }
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 4px 0;">
          <span>NET PAYABLE:</span>
          <span>₹${sale.total_amount.toFixed(2)}</span>
        </div>
        ${
          sale.payment_method === 'CASH'
            ? `
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Cash Tendered:</span>
            <span>₹${(sale.cash_tendered || sale.total_amount).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px;">
            <span>Change Returned:</span>
            <span>₹${(sale.change_returned || 0).toFixed(2)}</span>
          </div>
        `
            : ''
        }
      </div>

      <div style="text-align: center; margin-top: 14px; font-size: 10px; border-top: 1px dashed #000; padding-top: 6px;">
        <div>Thank you for your visit! Get well soon.</div>
        <div style="color: #666; margin-top: 2px;">Please retain this receipt for warranty or returns.</div>
      </div>
    `;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const html = getReceiptHtml(printWidth);
      await posApi.printReceipt(html, printWidth);
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [printWidth, sale]);

  return (
    <div
      className="modal-overlay"
      id="receipt-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="modal-content" ref={modalRef} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={20} color="#10b981" />
            <h3 className="modal-title" id="receipt-modal-title">Invoice #{sale.invoice_number}</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose} id="btn-close-receipt" aria-label="Close invoice">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ backgroundColor: '#0b1120' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }} role="group" aria-label="Receipt format">
            <button
              className={`btn ${printWidth === '80mm' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setPrintWidth('80mm')}
              id="btn-format-80mm"
              aria-pressed={printWidth === '80mm'}
            >
              80mm Thermal
            </button>
            <button
              className={`btn ${printWidth === '58mm' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setPrintWidth('58mm')}
              id="btn-format-58mm"
              aria-pressed={printWidth === '58mm'}
            >
              58mm Thermal
            </button>
            <button
              className={`btn ${printWidth === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setPrintWidth('a4')}
              id="btn-format-a4"
              aria-pressed={printWidth === 'a4'}
            >
              A4 Standard
            </button>
          </div>

          {/* Realistic Receipt Preview Card */}
          <div
            className="thermal-receipt-preview"
            style={{
              maxWidth: printWidth === '58mm' ? '280px' : printWidth === 'a4' ? '100%' : '350px',
            }}
            dangerouslySetInnerHTML={{ __html: getReceiptHtml(printWidth) }}
          />
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Gross Profit: <span style={{ color: '#10b981', fontWeight: 'bold' }}>₹{sale.gross_profit.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={onClose} id="btn-done-receipt">
              Done (Esc)
            </button>
            <button
              ref={printBtnRef}
              className="btn btn-primary"
              onClick={handlePrint}
              disabled={isPrinting}
              id="btn-print-receipt-action"
            >
              <Printer size={16} />
              {isPrinting ? 'Printing...' : 'Print Receipt (Ctrl+P)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
