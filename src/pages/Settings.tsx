import React, { useState, useRef, useEffect } from 'react';
import { AppSettings } from '../types/pos';
import { posApi } from '../services/api';
import { useShortcuts } from '../context/ShortcutContext';
import { useAria } from '../context/AriaContext';
import { useFocusTrap } from '../utils/focusTrap';
import {
  Save,
  Database,
  Cloud,
  CheckCircle,
  AlertCircle,
  Download,
  Code,
  RefreshCw,
  Printer,
  Shield,
  Copy,
} from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onTriggerSync: () => Promise<void>;
}

const GAS_SCRIPT_CODE = `// Google Apps Script (Code.gs)
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var processedIds = [];

    // Ensure tabs exist
    var tabs = ['Medicines', 'Purchases', 'Sales', 'Stock_Movements'];
    tabs.forEach(function(t) {
      if (!ss.getSheetByName(t)) {
        var s = ss.insertSheet(t);
        if (t === 'Medicines') s.appendRow(['ID', 'Name', 'Barcode', 'Batch', 'Expiry', 'Cost', 'Price', 'MRP', 'Stock', 'Updated']);
        if (t === 'Purchases') s.appendRow(['PO Number', 'Date', 'Medicine', 'Batch', 'Expiry', 'Qty', 'Cost', 'Total', 'Supplier']);
        if (t === 'Sales') s.appendRow(['Invoice', 'Date', 'Payment', 'Subtotal', 'Discount', 'Total', 'Gross Profit', 'Items Summary']);
        if (t === 'Stock_Movements') s.appendRow(['Time', 'Medicine', 'Batch', 'Type', 'Qty', 'Old Stock', 'New Stock', 'Reference']);
      }
    });

    if (data.batch && data.batch.length > 0) {
      data.batch.forEach(function(item) {
        if (item.entityType === 'medicine') {
          var m = item.data;
          var s = ss.getSheetByName('Medicines');
          s.appendRow([m.id, m.name, m.barcode || '', m.batch_number, m.expiry_date, m.purchase_price, m.selling_price, m.mrp, m.stock_quantity, new Date()]);
        } else if (item.entityType === 'purchase') {
          var p = item.data;
          var s = ss.getSheetByName('Purchases');
          s.appendRow([p.purchase_number, p.invoice_date, p.medicine_name, p.batch_number, p.expiry_date, p.quantity, p.purchase_price, p.total_amount, p.supplier_name]);
        } else if (item.entityType === 'sale') {
          var sl = item.data;
          var s = ss.getSheetByName('Sales');
          var summary = (sl.items || []).map(function(i) { return i.medicine_name + ' x' + i.quantity; }).join(', ');
          s.appendRow([sl.invoice_number, sl.created_at, sl.payment_method, sl.subtotal, sl.discount_amount, sl.total_amount, sl.gross_profit, summary]);
        }
        processedIds.push(item.queueId);
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      processedIds: processedIds,
      message: 'Processed ' + processedIds.length + ' records.'
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const SettingsPage: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onTriggerSync,
}) => {
  const { registerAction } = useShortcuts();
  const { announce, showToast } = useAria();

  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);

  const gasModalRef = useRef<HTMLDivElement>(null);
  const gasCloseBtnRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(gasModalRef, {
    isOpen: showGasModal,
    onEscape: () => setShowGasModal(false),
    initialFocusRef: gasCloseBtnRef,
  });

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GAS_SCRIPT_CODE);
      showToast('Apps Script code copied to clipboard', 'success');
      announce('Code copied to clipboard');
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Register Ctrl+S to save settings
  useEffect(() => {
    const unregisterSave = registerAction('save', () => {
      const formEl = document.getElementById('settings-form') as HTMLFormElement | null;
      if (formEl) {
        formEl.requestSubmit();
      }
      return true;
    });
    return () => unregisterSave();
  }, [registerAction]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const updated = await posApi.updateAppSettings(formData);
      onUpdateSettings(updated);
      const msg = 'Settings updated and saved successfully!';
      setStatusMsg({ type: 'success', text: msg });
      announce(msg);
      showToast('Settings saved', 'success');
    } catch (err: any) {
      const msg = err.message || 'Failed to save settings';
      setStatusMsg({ type: 'error', text: msg });
      announce(msg, 'assertive');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupDb = async () => {
    setIsBackingUp(true);
    setStatusMsg(null);
    try {
      const res = await posApi.backupDatabase();
      if (res.canceled) {
        setIsBackingUp(false);
        return;
      }
      if (res.success) {
        const msg = `Database safely backed up to: ${res.filePath}`;
        setStatusMsg({ type: 'success', text: msg });
        announce(msg);
        showToast('Database backup complete', 'success');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Backup failed: ' + err.message });
      announce('Backup failed: ' + err.message, 'assertive');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="page-content" id="settings-page">
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        {statusMsg && (
          <div
            style={{
              backgroundColor: statusMsg.type === 'success' ? 'rgba(2, 98, 137, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${statusMsg.type === 'success' ? 'rgba(2, 98, 137, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
              color: statusMsg.type === 'success' ? '#026289' : '#e11d48',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {statusMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} id="settings-form">
          {/* Pharmacy Details */}
          <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} color="#026289" /> Store / Business Information
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              These details appear on your printed receipts and invoices.
            </p>

            <div className="form-group">
              <label className="form-label">Store / Pharmacy Name *</label>
              <input
                type="text"
                id="setting-pharmacy-name"
                required
                className="form-input"
                value={formData.pharmacy_name}
                onChange={(e) => setFormData({ ...formData, pharmacy_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address Line</label>
              <input
                type="text"
                id="setting-pharmacy-address"
                className="form-input"
                value={formData.pharmacy_address}
                onChange={(e) => setFormData({ ...formData, pharmacy_address: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  id="setting-pharmacy-phone"
                  className="form-input"
                  value={formData.pharmacy_phone}
                  onChange={(e) => setFormData({ ...formData, pharmacy_phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">GST / Drug License No.</label>
                <input
                  type="text"
                  id="setting-pharmacy-gst"
                  className="form-input font-mono"
                  value={formData.pharmacy_gst}
                  onChange={(e) => setFormData({ ...formData, pharmacy_gst: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Printer size={14} /> Default Receipt Print Width
              </label>
              <select
                id="setting-thermal-width"
                className="form-select"
                value={formData.thermal_width}
                onChange={(e) => setFormData({ ...formData, thermal_width: e.target.value as any })}
              >
                <option value="80mm">80mm Thermal (Standard POS roll)</option>
                <option value="58mm">58mm Thermal (Compact mobile roll)</option>
                <option value="a4">A4 Standard Sheet (Full Page)</option>
              </select>
            </div>
          </div>

          {/* Google Sheets Synchronization */}
          <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cloud size={18} color="#4C8EBB" /> Google Sheets & Google Apps Script Sync
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                onClick={() => setShowGasModal(true)}
                id="btn-view-gas-code"
              >
                <Code size={14} /> View Apps Script Code
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Synchronizes medicines, stock movements, purchases, and sales in real-time to your Google Sheet.
            </p>

            <div className="form-group">
              <label className="form-label">Google Apps Script Web App URL</label>
              <input
                type="url"
                id="setting-gas-url"
                className="form-input font-mono"
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                value={formData.gas_web_app_url}
                onChange={(e) => setFormData({ ...formData, gas_web_app_url: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                Paste the Web App deployment URL generated from Google Apps Script.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  id="setting-auto-sync"
                  checked={formData.auto_sync_enabled}
                  onChange={(e) => setFormData({ ...formData, auto_sync_enabled: e.target.checked })}
                />
                <span>Enable automatic background sync</span>
              </label>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={onTriggerSync}
                id="btn-settings-sync-now"
                style={{ fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} /> Test & Sync Now
              </button>
            </div>
          </div>

          {/* Database Backup & Maintenance */}
          <div className="table-container" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="#026289" /> Persistent SQLite Database & Backups
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Database is stored persistently in your system's user data directory with full WAL durability.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBackupDb}
                disabled={isBackingUp}
                id="btn-backup-sqlite-now"
              >
                <Download size={15} />
                {isBackingUp ? 'Saving Database...' : 'Backup Full Database (.db)'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const res = await posApi.exportCSV('medicines');
                  if (res.success && res.filePath) alert('Exported: ' + res.filePath);
                }}
                id="btn-settings-export-meds"
              >
                <Download size={15} /> Export Medicines CSV
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={async () => {
                  const res = await posApi.exportCSV('sales');
                  if (res.success && res.filePath) alert('Exported: ' + res.filePath);
                }}
                id="btn-settings-export-sales"
              >
                <Download size={15} /> Export Sales CSV
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', gap: '0.5rem' }}
              disabled={isSaving}
              id="btn-save-settings"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Settings (Ctrl+S)'}
            </button>
          </div>
        </form>
      </div>

      {/* Google Apps Script Modal */}
      {showGasModal && (
        <div
          className="modal-overlay"
          id="gas-code-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gas-modal-title"
        >
          <div className="modal-content" ref={gasModalRef} style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="modal-title" id="gas-modal-title">Google Apps Script Code & Setup</h3>
              <button
                ref={gasCloseBtnRef}
                className="btn btn-secondary btn-icon"
                onClick={() => setShowGasModal(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>
              <h4 style={{ color: '#026289', marginBottom: '0.5rem' }}>Quick Setup Instructions:</h4>
              <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                <li>Create a new spreadsheet in Google Sheets (e.g. named <b>"OmniPOS Live Data"</b>).</li>
                <li>In Google Sheets, click <b>Extensions &gt; Apps Script</b>.</li>
                <li>Delete existing code in <code>Code.gs</code> and paste the code below.</li>
                <li>Click <b>Deploy &gt; New deployment</b>.</li>
                <li>Select type: <b>Web app</b>.</li>
                <li>Set <b>Execute as</b>: <i>Me</i>, and <b>Who has access</b>: <i>Anyone</i>.</li>
                <li>Click <b>Deploy</b> and copy the Web App URL into the settings field above!</li>
              </ol>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                <pre className="font-mono" style={{ fontSize: '0.78rem', color: '#026289' }}>
                  {GAS_SCRIPT_CODE}
                </pre>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyScript}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Copy size={14} /> Copy Code
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowGasModal(false)}
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};