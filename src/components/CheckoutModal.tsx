import React, { useState, useRef, useEffect } from 'react';
import { Banknote, CreditCard, CheckCircle, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { useFocusTrap } from '../utils/focusTrap';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    paymentMethod: 'CASH' | 'UPI';
    cashTendered: number;
    upiReference: string;
    discountPercent: number;
  }) => Promise<void>;
  subtotal: number;
  initialDiscountPercent: number;
  itemsCount: number;
  isProcessing: boolean;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  subtotal,
  initialDiscountPercent,
  itemsCount,
  isProcessing,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const upiInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [discountPercent, setDiscountPercent] = useState<number>(initialDiscountPercent);

  const discountAmount = Math.round((subtotal * (discountPercent / 100)) * 100) / 100;
  const netPayable = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  const [cashTendered, setCashTendered] = useState<string>(netPayable.toFixed(2));
  const [upiReference, setUpiReference] = useState<string>('');

  useFocusTrap(modalRef, {
    isOpen,
    onEscape: onClose,
    initialFocusRef: paymentMethod === 'CASH' ? cashInputRef : upiInputRef,
  });

  useEffect(() => {
    if (isOpen) {
      setDiscountPercent(initialDiscountPercent);
      const computedNet = Math.max(0, Math.round((subtotal - Math.round((subtotal * (initialDiscountPercent / 100)) * 100) / 100) * 100) / 100);
      setCashTendered(computedNet.toFixed(2));
    }
  }, [isOpen, subtotal, initialDiscountPercent]);

  if (!isOpen) return null;

  const parsedCash = parseFloat(cashTendered) || 0;
  const changeToReturn = Math.max(0, Math.round((parsedCash - netPayable) * 100) / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    onConfirm({
      paymentMethod,
      cashTendered: parsedCash,
      upiReference: upiReference.trim(),
      discountPercent,
    });
  };

  return (
    <div
      className="modal-overlay"
      id="checkout-confirm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div
        className="modal-content"
        ref={modalRef}
        style={{ maxWidth: '500px', border: '1px solid rgba(2, 98, 137, 0.3)' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="kpi-icon-wrap" style={{ width: '38px', height: '38px', color: '#026289' }}>
              <CheckCircle size={22} />
            </div>
            <div>
              <h2 className="modal-title" id="checkout-modal-title" style={{ fontSize: '1.2rem' }}>
                Confirm Sale & Payment
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Review amounts and confirm transaction
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            id="btn-close-checkout-modal"
            aria-label="Close checkout review"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} id="checkout-confirm-form">
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Bill Summary Banner */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Items in Cart:</span>
                <span className="font-mono" style={{ fontWeight: 600 }}>{itemsCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#f59e0b' }}>
                  <span>Discount ({discountPercent}%):</span>
                  <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  borderTop: '1px dashed var(--border-subtle)',
                  paddingTop: '0.65rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>NET PAYABLE:</span>
                <span className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 900, color: '#026289' }}>
                  ₹{netPayable.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="form-label" id="label-pay-method">Payment Method</label>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}
                role="radiogroup"
                aria-labelledby="label-pay-method"
              >
                <button
                  type="button"
                  id="checkout-btn-pay-cash"
                  role="radio"
                  aria-checked={paymentMethod === 'CASH'}
                  className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.75rem', gap: '0.5rem' }}
                  onClick={() => {
                    setPaymentMethod('CASH');
                    setTimeout(() => cashInputRef.current?.focus(), 50);
                  }}
                >
                  <Banknote size={18} /> Cash (C)
                </button>
                <button
                  type="button"
                  id="checkout-btn-pay-upi"
                  role="radio"
                  aria-checked={paymentMethod === 'UPI'}
                  className={`btn ${paymentMethod === 'UPI' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.75rem', gap: '0.5rem' }}
                  onClick={() => {
                    setPaymentMethod('UPI');
                    setTimeout(() => upiInputRef.current?.focus(), 50);
                  }}
                >
                  <CreditCard size={18} /> UPI / QR (U)
                </button>
              </div>
            </div>

            {/* Cash Tendered & Change Return UI */}
            {paymentMethod === 'CASH' ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="checkout-input-cash-tendered">
                  Cash Received from Customer (₹)
                </label>
                <input
                  ref={cashInputRef}
                  type="number"
                  step="0.01"
                  min="0"
                  id="checkout-input-cash-tendered"
                  className="form-input font-mono"
                  style={{ fontSize: '1.1rem', padding: '0.65rem 0.85rem' }}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.6rem',
                    padding: '0.6rem 0.9rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Change to Return:</span>
                  <span className="font-mono" style={{ fontWeight: 800, fontSize: '1.2rem', color: '#026289' }}>
                    ₹{changeToReturn.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="checkout-input-upi-reference">
                  UPI Reference / UTR Number (Optional)
                </label>
                <input
                  ref={upiInputRef}
                  type="text"
                  id="checkout-input-upi-reference"
                  className="form-input font-mono"
                  placeholder="e.g. 423984029348 or Scan Ref"
                  value={upiReference}
                  onChange={(e) => setUpiReference(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              id="btn-cancel-checkout"
            >
              Cancel (Esc)
            </button>

            <button
              ref={confirmBtnRef}
              type="submit"
              className="btn btn-primary"
              disabled={isProcessing}
              id="btn-confirm-final-sale"
              style={{ padding: '0.7rem 1.4rem', fontWeight: 700 }}
            >
              {isProcessing ? 'Processing Sale...' : 'Confirm Sale (Enter)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
