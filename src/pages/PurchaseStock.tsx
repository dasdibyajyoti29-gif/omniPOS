import React, { useState, useEffect, useRef } from 'react';
import { Medicine, Purchase } from '../types/pos';
import { posApi } from '../services/api';
import { useShortcuts } from '../context/ShortcutContext';
import { useAria } from '../context/AriaContext';
import {
  PackagePlus,
  CheckCircle,
  AlertCircle,
  Truck,
  Download,
  Calendar,
} from 'lucide-react';

interface PurchaseStockProps {
  initialMedicine?: Medicine | null;
}

export const PurchaseStock: React.FC<PurchaseStockProps> = ({ initialMedicine }) => {
  const { registerAction } = useShortcuts();
  const { announce, showToast } = useAria();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [selectedMedId, setSelectedMedId] = useState<string>(
    initialMedicine ? String(initialMedicine.id) : ''
  );
  const [isNewMed, setIsNewMed] = useState<boolean>(false);
  const [medName, setMedName] = useState<string>(initialMedicine ? initialMedicine.name : '');
  const [barcode, setBarcode] = useState<string>(initialMedicine ? initialMedicine.barcode : '');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('50');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('Apex Pharma Distributors');
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Focus Refs
  const medSelectRef = useRef<HTMLSelectElement>(null);
  const medNameRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [medsData, purchasesData] = await Promise.all([
        posApi.getMedicines(),
        posApi.getPurchases(50),
      ]);
      setMedicines(medsData);
      setPurchases(purchasesData);

      if (initialMedicine) {
        populateFromMedicine(initialMedicine);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load purchase data');
    } finally {
      setIsLoading(false);
    }
  };

  const populateFromMedicine = (med: Medicine) => {
    setSelectedMedId(String(med.id));
    setIsNewMed(false);
    setMedName(med.name);
    setBarcode(med.barcode || '');
    setPurchasePrice(String(med.purchase_price));
    setSellingPrice(String(med.selling_price));
    setMrp(String(med.mrp));
    setBatchNumber(med.batch_number + '-NEW');
    setExpiryDate(med.expiry_date);
  };

  useEffect(() => {
    loadData();
    // Auto-focus the medicine select field on open
    setTimeout(() => {
      medSelectRef.current?.focus();
    }, 50);
  }, [initialMedicine]);

  // Register Ctrl+S to save purchase
  useEffect(() => {
    const unregisterSave = registerAction('save', () => {
      const formEl = document.getElementById('form-purchase-stock') as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
      return true;
    });
    return () => unregisterSave();
  }, [registerAction]);

  const handleMedicineSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMedId(val);

    if (val === 'NEW') {
      setIsNewMed(true);
      setMedName('');
      setBarcode('');
      setBatchNumber('');
      setExpiryDate('');
      setPurchasePrice('');
      setSellingPrice('');
      setMrp('');
      setTimeout(() => medNameRef.current?.focus(), 20);
    } else {
      setIsNewMed(false);
      const med = medicines.find((m) => String(m.id) === val);
      if (med) {
        populateFromMedicine(med);
        setTimeout(() => qtyRef.current?.focus(), 20);
      }
    }
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const qty = parseInt(quantity, 10);
    const pPrice = parseFloat(purchasePrice);

    if (!medName.trim()) {
      setErrorMsg('Medicine name is required.');
      announce('Medicine name is required.', 'assertive');
      medNameRef.current?.focus();
      return;
    }
    if (!batchNumber.trim()) {
      setErrorMsg('Batch number is required.');
      announce('Batch number is required.', 'assertive');
      batchRef.current?.focus();
      return;
    }
    if (!expiryDate) {
      setErrorMsg('Expiry date is required.');
      announce('Expiry date is required.', 'assertive');
      expiryRef.current?.focus();
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Please enter a valid quantity greater than 0.');
      announce('Please enter a valid quantity greater than 0.', 'assertive');
      qtyRef.current?.focus();
      return;
    }
    if (isNaN(pPrice) || pPrice <= 0) {
      setErrorMsg('Please enter a valid purchase price.');
      announce('Please enter a valid purchase price.', 'assertive');
      priceRef.current?.focus();
      return;
    }

    try {
      const res = await posApi.recordPurchase({
        medicine_id: selectedMedId && selectedMedId !== 'NEW' ? Number(selectedMedId) : undefined,
        medicine_name: medName.trim(),
        barcode: barcode.trim(),
        batch_number: batchNumber.trim(),
        expiry_date: expiryDate,
        quantity: qty,
        purchase_price: pPrice,
        selling_price: parseFloat(sellingPrice) || undefined,
        mrp: parseFloat(mrp) || undefined,
        supplier_name: supplierName.trim(),
        invoice_date: invoiceDate,
      });

      const message = `Purchase ${res.purchase.purchase_number} recorded! Added ${qty} units to "${res.medicine.name}". Total stock is now ${res.medicine.stock_quantity}.`;
      setSuccessMsg(message);
      announce(message);
      showToast(`Stock inward recorded: +${qty} units`, 'success');

      // Reset form fields
      setQuantity('50');
      loadData();
      medSelectRef.current?.focus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record purchase stock');
      announce(err.message || 'Failed to record purchase stock', 'assertive');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await posApi.exportCSV('purchases');
      if (res.success && res.filePath) {
        alert(`Exported purchases to: ${res.filePath}`);
      }
    } catch (err: any) {
      alert('CSV Export failed: ' + err.message);
    }
  };

  const handleTableRowKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(purchases.length - 1, index + 1);
      tableRowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      tableRowRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      tableRowRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      tableRowRefs.current[purchases.length - 1]?.focus();
    }
  };

  const totalPurchaseCost = (parseInt(quantity, 10) || 0) * (parseFloat(purchasePrice) || 0);

  return (
    <div className="page-content" id="purchase-stock-page">
      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Side: Record Purchase Form */}
        <div className="table-container" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
            <div className="kpi-icon-wrap" style={{ color: '#026289', width: '38px', height: '38px' }}>
              <PackagePlus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Record Inward Stock</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Purchases automatically increase live inventory. (Save with Ctrl+S)
              </p>
            </div>
          </div>

          {successMsg && (
            <div
              role="status"
              style={{
                backgroundColor: 'rgba(2, 98, 137, 0.1)',
                border: '1px solid rgba(2, 98, 137, 0.25)',
                color: '#026289',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              style={{
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRecordPurchase} id="form-purchase-stock">
            <div className="form-group">
              <label className="form-label" htmlFor="select-purchase-medicine">
                Select Existing Medicine or Add New
              </label>
              <select
                ref={medSelectRef}
                className="form-select"
                id="select-purchase-medicine"
                value={selectedMedId}
                onChange={handleMedicineSelect}
              >
                <option value="">-- Choose Existing Medicine --</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Cur. Stock: {m.stock_quantity})
                  </option>
                ))}
                <option value="NEW">+ Register New Medicine from Purchase</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="purchase-med-name">
                Medicine Name *
              </label>
              <input
                ref={medNameRef}
                type="text"
                id="purchase-med-name"
                required
                className="form-input"
                placeholder="Medicine Brand / Generic Name"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="purchase-barcode">
                  Barcode / GTIN
                </label>
                <input
                  type="text"
                  id="purchase-barcode"
                  className="form-input font-mono"
                  placeholder="Barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="purchase-batch">
                  Batch Number *
                </label>
                <input
                  ref={batchRef}
                  type="text"
                  id="purchase-batch"
                  required
                  className="form-input font-mono"
                  placeholder="e.g. BT-9921"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="purchase-expiry">
                  Expiry Date *
                </label>
                <input
                  ref={expiryRef}
                  type="date"
                  id="purchase-expiry"
                  required
                  className="form-input font-mono"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="purchase-qty">
                  Units Purchased *
                </label>
                <input
                  ref={qtyRef}
                  type="number"
                  id="purchase-qty"
                  min="1"
                  required
                  className="form-input font-mono"
                  placeholder="50"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="purchase-cost">
                  Cost/Unit (₹) *
                </label>
                <input
                  ref={priceRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  id="purchase-cost"
                  className="form-input font-mono"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="purchase-selling-price">
                  Selling Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="purchase-selling-price"
                  className="form-input font-mono"
                  placeholder="0.00"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="purchase-mrp">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="purchase-mrp"
                  className="form-input font-mono"
                  placeholder="0.00"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="purchase-supplier">
                  Distributor / Supplier Name
                </label>
                <input
                  type="text"
                  id="purchase-supplier"
                  className="form-input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="purchase-date">
                  Invoice Date
                </label>
                <input
                  type="date"
                  id="purchase-date"
                  className="form-input font-mono"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Total Cost Calculation Banner */}
            <div
              style={{
                backgroundColor: 'rgba(2, 98, 137, 0.08)',
                border: '1px solid rgba(2, 98, 137, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                margin: '1rem 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Purchase Inward:</span>
              <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#026289' }}>
                ₹{totalPurchaseCost.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', gap: '0.5rem' }}
              id="btn-submit-purchase"
            >
              <Truck size={17} />
              Confirm & Increase Inventory (Ctrl+S)
            </button>
          </form>
        </div>

        {/* Right Side: Recent Inward Purchases History */}
        <div className="table-container">
          <div className="table-header-bar">
            <div className="table-title">
              <Calendar size={18} color="#026289" />
              <span>Recent Inward Purchases</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleExportCSV}
              id="btn-export-purchases-csv"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <table className="pos-table" id="purchases-table" role="table" aria-label="Recent Purchases Table">
            <thead>
              <tr>
                <th scope="col">PO Number</th>
                <th scope="col">Date</th>
                <th scope="col">Medicine</th>
                <th scope="col">Batch</th>
                <th scope="col">Qty</th>
                <th scope="col">Cost/Unit</th>
                <th scope="col">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No inward purchases recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((p, idx) => (
                  <tr
                    key={p.id}
                    ref={(el) => (tableRowRefs.current[idx] = el)}
                    tabIndex={0}
                    onKeyDown={(e) => handleTableRowKeyDown(e, idx)}
                    aria-label={`Purchase ${p.purchase_number}, ${p.medicine_name}, quantity ${p.quantity}`}
                  >
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {p.purchase_number}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                      {p.invoice_date}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.medicine_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{p.supplier_name}</div>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                      {p.batch_number}
                    </td>
                    <td>
                      <span className="pill pill-info font-mono">+{p.quantity}</span>
                    </td>
                    <td className="font-mono">₹{p.purchase_price.toFixed(2)}</td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      ₹{p.total_amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
