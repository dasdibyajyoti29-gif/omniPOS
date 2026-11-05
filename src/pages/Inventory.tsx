import React, { useState, useEffect, useRef } from 'react';
import { Medicine } from '../types/pos';
import { posApi } from '../services/api';
import { useFocusTrap } from '../utils/focusTrap';
import { useShortcuts } from '../context/ShortcutContext';
import { useAria } from '../context/AriaContext';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  AlertCircle,
  X,
  Check,
  Barcode,
  Keyboard,
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { registerAction } = useShortcuts();
  const { announce, showToast } = useAria();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    batch_number: '',
    expiry_date: '',
    purchase_price: '',
    selling_price: '',
    mrp: '',
    stock_quantity: '',
  });

  // Focus Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const handleRequestCloseModal = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }
    setIsModalOpen(false);
    setIsDirty(false);
  };

  useFocusTrap(modalRef, {
    isOpen: isModalOpen,
    onEscape: handleRequestCloseModal,
    initialFocusRef: nameInputRef,
  });

  const loadMedicines = async (search?: string) => {
    setIsLoading(true);
    try {
      const data = await posApi.getMedicines(search);
      setMedicines(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load medicines');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines(searchQuery);
  }, [searchQuery]);

  // Register focus search (F3) on inventory page
  useEffect(() => {
    const unregisterF3 = registerAction('focusSearch', () => {
      searchInputRef.current?.focus();
      return true;
    });
    return () => unregisterF3();
  }, [registerAction]);

  // Register Ctrl+S to save when modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const unregisterSave = registerAction('save', () => {
      const formEl = document.getElementById('medicine-form') as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
      return true;
    });
    return () => unregisterSave();
  }, [isModalOpen, registerAction]);

  const openAddModal = () => {
    setEditingMedicine(null);
    setIsDirty(false);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    setFormData({
      name: '',
      barcode: '',
      batch_number: '',
      expiry_date: futureDate.toISOString().split('T')[0],
      purchase_price: '',
      selling_price: '',
      mrp: '',
      stock_quantity: '0',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (med: Medicine) => {
    setEditingMedicine(med);
    setIsDirty(false);
    setFormData({
      name: med.name,
      barcode: med.barcode || '',
      batch_number: med.batch_number,
      expiry_date: med.expiry_date,
      purchase_price: String(med.purchase_price),
      selling_price: String(med.selling_price),
      mrp: String(med.mrp),
      stock_quantity: String(med.stock_quantity),
    });
    setIsModalOpen(true);
  };

  const handleFieldChange = (field: string, value: string) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation checks with focus on first invalid field
    if (!formData.name.trim()) {
      setErrorMsg('Medicine name is required.');
      announce('Medicine name is required.', 'assertive');
      nameInputRef.current?.focus();
      return;
    }
    if (!formData.batch_number.trim()) {
      setErrorMsg('Batch number is required.');
      announce('Batch number is required.', 'assertive');
      batchInputRef.current?.focus();
      return;
    }
    if (!formData.expiry_date) {
      setErrorMsg('Expiry date is required.');
      announce('Expiry date is required.', 'assertive');
      expiryInputRef.current?.focus();
      return;
    }

    const payload = {
      name: formData.name.trim(),
      barcode: formData.barcode.trim(),
      batch_number: formData.batch_number.trim(),
      expiry_date: formData.expiry_date,
      purchase_price: Number(formData.purchase_price) || 0,
      selling_price: Number(formData.selling_price) || 0,
      mrp: Number(formData.mrp) || 0,
      stock_quantity: Math.max(0, parseInt(formData.stock_quantity, 10) || 0),
    };

    try {
      if (editingMedicine) {
        await posApi.updateMedicine(editingMedicine.id, payload);
        announce(`Updated medicine "${payload.name}" successfully.`);
        showToast(`Updated "${payload.name}"`, 'success');
      } else {
        await posApi.addMedicine(payload);
        announce(`Added new medicine "${payload.name}" successfully.`);
        showToast(`Added "${payload.name}" to inventory`, 'success');
      }
      setIsModalOpen(false);
      setIsDirty(false);
      loadMedicines(searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
      announce(err.message || 'Operation failed', 'assertive');
    }
  };

  const handleDelete = async (med: Medicine) => {
    if (!window.confirm(`Are you sure you want to delete "${med.name}"?`)) return;

    try {
      await posApi.deleteMedicine(med.id);
      announce(`Deleted medicine "${med.name}".`);
      showToast(`Deleted "${med.name}"`, 'info');
      loadMedicines(searchQuery);
    } catch (err: any) {
      alert(err.message || 'Could not delete medicine');
      announce('Could not delete medicine', 'assertive');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await posApi.exportCSV('medicines');
      if (res.success && res.filePath) {
        alert(`Exported medicines to: ${res.filePath}`);
      }
    } catch (err: any) {
      alert('CSV Export failed: ' + err.message);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, index: number, med: Medicine) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(medicines.length - 1, index + 1);
      rowRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      rowRefs.current[prev]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openEditModal(med);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleDelete(med);
    } else if (e.key === 'Home') {
      e.preventDefault();
      rowRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      rowRefs.current[medicines.length - 1]?.focus();
    }
  };

  return (
    <div className="page-content" id="inventory-page">
      {/* Top Search & Actions Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, maxWidth: '480px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              id="inventory-search-input"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search medicine name, barcode, or batch (F3)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search medicines"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            id="btn-export-medicines-csv"
            title="Export CSV of all medicines"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            ref={addBtnRef}
            className="btn btn-primary"
            onClick={openAddModal}
            id="btn-add-medicine"
          >
            <Plus size={16} /> Add Medicine
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Medicines Table */}
      <div className="table-container">
        <table className="pos-table" id="medicines-table" role="table" aria-label="Medicine Inventory Table">
          <thead>
            <tr>
              <th scope="col">Medicine Name</th>
              <th scope="col">Barcode</th>
              <th scope="col">Batch #</th>
              <th scope="col">Expiry Date</th>
              <th scope="col">Purchase Price</th>
              <th scope="col">Selling Price</th>
              <th scope="col">MRP</th>
              <th scope="col">Stock</th>
              <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading medicines...
                </td>
              </tr>
            ) : medicines.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No medicines found. Click "Add Medicine" to create your first item.
                </td>
              </tr>
            ) : (
              medicines.map((med, idx) => {
                const isLowStock = med.stock_quantity <= 10;
                return (
                  <tr
                    key={med.id}
                    id={`med-row-${med.id}`}
                    ref={(el) => (rowRefs.current[idx] = el)}
                    tabIndex={0}
                    onKeyDown={(e) => handleRowKeyDown(e, idx, med)}
                    aria-label={`${med.name}, batch ${med.batch_number}, stock ${med.stock_quantity} units`}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{med.name}</div>
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {med.barcode ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Barcode size={14} /> {med.barcode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.82rem' }}>
                      {med.batch_number}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.82rem' }}>
                      {med.expiry_date}
                    </td>
                    <td className="font-mono">₹{med.purchase_price.toFixed(2)}</td>
                    <td className="font-mono" style={{ color: '#026289', fontWeight: 600 }}>
                      ₹{med.selling_price.toFixed(2)}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      ₹{med.mrp.toFixed(2)}
                    </td>
                    <td>
                      <span className={`pill ${isLowStock ? 'pill-danger' : 'pill-success'} font-mono`}>
                        {med.stock_quantity} units
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          className="btn btn-secondary btn-icon"
                          onClick={() => openEditModal(med)}
                          id={`btn-edit-med-${med.id}`}
                          title="Edit medicine (Enter)"
                          aria-label={`Edit ${med.name}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon"
                          onClick={() => handleDelete(med)}
                          id={`btn-del-med-${med.id}`}
                          title="Delete medicine (Del)"
                          aria-label={`Delete ${med.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Medicine Modal */}
      {isModalOpen && (
        <div
          className="modal-overlay"
          id="medicine-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="med-modal-title"
        >
          <div className="modal-content" ref={modalRef}>
            <div className="modal-header">
              <h3 className="modal-title" id="med-modal-title">
                {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={handleRequestCloseModal}
                id="btn-close-med-modal"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} id="medicine-form">
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="input-med-name">
                    Medicine Brand / Generic Name *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    id="input-med-name"
                    required
                    className="form-input"
                    placeholder="e.g. Paracetamol 650mg (Dolo)"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-barcode">
                      Barcode / GTIN
                    </label>
                    <input
                      type="text"
                      id="input-med-barcode"
                      className="form-input font-mono"
                      placeholder="Scan or type barcode"
                      value={formData.barcode}
                      onChange={(e) => handleFieldChange('barcode', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-batch">
                      Batch Number *
                    </label>
                    <input
                      ref={batchInputRef}
                      type="text"
                      id="input-med-batch"
                      required
                      className="form-input font-mono"
                      placeholder="e.g. DL-2024-B1"
                      value={formData.batch_number}
                      onChange={(e) => handleFieldChange('batch_number', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-expiry">
                      Expiry Date *
                    </label>
                    <input
                      ref={expiryInputRef}
                      type="date"
                      id="input-med-expiry"
                      required
                      className="form-input font-mono"
                      value={formData.expiry_date}
                      onChange={(e) => handleFieldChange('expiry_date', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-stock">
                      Initial Stock Quantity
                    </label>
                    <input
                      type="number"
                      id="input-med-stock"
                      min="0"
                      className="form-input font-mono"
                      value={formData.stock_quantity}
                      onChange={(e) => handleFieldChange('stock_quantity', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-purchase-price">
                      Purchase Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      id="input-med-purchase-price"
                      className="form-input font-mono"
                      placeholder="0.00"
                      value={formData.purchase_price}
                      onChange={(e) => handleFieldChange('purchase_price', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-selling-price">
                      Selling Price (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      id="input-med-selling-price"
                      className="form-input font-mono"
                      placeholder="0.00"
                      value={formData.selling_price}
                      onChange={(e) => handleFieldChange('selling_price', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="input-med-mrp">
                      MRP (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      id="input-med-mrp"
                      className="form-input font-mono"
                      placeholder="0.00"
                      value={formData.mrp}
                      onChange={(e) => handleFieldChange('mrp', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRequestCloseModal}
                  id="btn-cancel-med"
                >
                  Cancel (Esc)
                </button>
                <button type="submit" className="btn btn-primary" id="btn-save-med">
                  <Check size={16} /> Save Medicine (Ctrl+S)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
