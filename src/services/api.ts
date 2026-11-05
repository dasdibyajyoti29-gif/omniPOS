import { Medicine, Purchase, Sale, DashboardStats, AppSettings, SyncStatus } from '../types/pos';
import { NewPurchaseInput } from '../../electron/db/purchases';
import { CreateSaleInput } from '../../electron/db/sales';
import { SyncResult } from '../../electron/db/sync';

// Check if running inside Electron with IPC bridge
const hasElectron = typeof window !== 'undefined' && !!window.api;

// Mock local storage fallback for standalone browser preview if launched outside Electron
const STORAGE_PREFIX = 'pharmacy_pos_mock_';
function getMockStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setMockStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {}
}

const mockDefaultMedicines: Medicine[] = [
  {
    id: 1,
    name: 'Paracetamol 650mg (Dolo)',
    barcode: '8901234567890',
    batch_number: 'DL-2024-B1',
    expiry_date: '2027-10-15',
    purchase_price: 18.5,
    selling_price: 30.0,
    mrp: 32.5,
    stock_quantity: 120,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Azithromycin 500mg (Azithral)',
    barcode: '8901234567891',
    batch_number: 'AZ-2024-C9',
    expiry_date: '2027-12-30',
    purchase_price: 65.0,
    selling_price: 110.0,
    mrp: 125.0,
    stock_quantity: 45,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Amoxicillin + Clav 625mg (Augmentin)',
    barcode: '8901234567892',
    batch_number: 'AG-2024-K2',
    expiry_date: '2026-11-20',
    purchase_price: 130.0,
    selling_price: 210.0,
    mrp: 235.0,
    stock_quantity: 6, // Low stock demo
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Cetirizine 10mg (Okacet)',
    barcode: '8901234567893',
    batch_number: 'CT-2024-A4',
    expiry_date: '2026-11-05', // Expiring in < 30 days
    purchase_price: 12.0,
    selling_price: 22.0,
    mrp: 25.0,
    stock_quantity: 80,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 5,
    name: 'Omeprazole 20mg (Omez)',
    barcode: '8901234567894',
    batch_number: 'OM-2024-F7',
    expiry_date: '2028-04-10',
    purchase_price: 35.0,
    selling_price: 60.0,
    mrp: 68.0,
    stock_quantity: 60,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const posApi = {
  // Medicines
  getMedicines: async (search?: string): Promise<Medicine[]> => {
    if (hasElectron) return window.api!.getMedicines(search);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    if (!search || !search.trim()) return meds;
    const q = search.toLowerCase().trim();
    return meds.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.barcode.toLowerCase().includes(q) ||
        m.batch_number.toLowerCase().includes(q)
    );
  },

  getMedicineById: async (id: number): Promise<Medicine | null> => {
    if (hasElectron) return window.api!.getMedicineById(id);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    return meds.find((m) => m.id === id) || null;
  },

  getMedicineByBarcode: async (barcode: string): Promise<Medicine | null> => {
    if (hasElectron) return window.api!.getMedicineByBarcode(barcode);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    return meds.find((m) => m.barcode === barcode.trim()) || null;
  },

  addMedicine: async (data: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>): Promise<Medicine> => {
    if (hasElectron) return window.api!.addMedicine(data);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    const newMed: Medicine = {
      ...data,
      id: Date.now(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };
    meds.push(newMed);
    setMockStorage('medicines', meds);
    return newMed;
  },

  updateMedicine: async (id: number, data: Partial<Medicine>): Promise<Medicine> => {
    if (hasElectron) return window.api!.updateMedicine(id, data);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    const idx = meds.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Medicine #${id} not found.`);
    meds[idx] = { ...meds[idx], ...data, updated_at: new Date().toISOString() };
    setMockStorage('medicines', meds);
    return meds[idx];
  },

  deleteMedicine: async (id: number): Promise<{ success: boolean; message?: string }> => {
    if (hasElectron) return window.api!.deleteMedicine(id);
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    const filtered = meds.filter((m) => m.id !== id);
    setMockStorage('medicines', filtered);
    return { success: true };
  },

  // Purchases
  getPurchases: async (limit?: number): Promise<Purchase[]> => {
    if (hasElectron) return window.api!.getPurchases(limit);
    return getMockStorage('purchases', []);
  },

  recordPurchase: async (data: NewPurchaseInput): Promise<{ purchase: Purchase; medicine: Medicine }> => {
    if (hasElectron) return window.api!.recordPurchase(data);
    const purchases = getMockStorage('purchases', [] as Purchase[]);
    const meds = getMockStorage('medicines', mockDefaultMedicines);

    let targetMed = meds.find((m) => m.id === data.medicine_id || m.barcode === data.barcode);
    const now = new Date().toISOString();
    const purchaseNum = `PO-${now.slice(0, 10).replace(/-/g, '')}-${String(purchases.length + 1).padStart(4, '0')}`;
    const qty = Number(data.quantity) || 1;
    const cost = Number(data.purchase_price) || 0;

    if (targetMed) {
      targetMed.stock_quantity += qty;
      targetMed.purchase_price = cost;
      targetMed.batch_number = data.batch_number;
      targetMed.expiry_date = data.expiry_date;
      targetMed.updated_at = now;
    } else {
      targetMed = {
        id: Date.now(),
        name: data.medicine_name,
        barcode: data.barcode || '',
        batch_number: data.batch_number,
        expiry_date: data.expiry_date,
        purchase_price: cost,
        selling_price: Number(data.selling_price) || cost * 1.3,
        mrp: Number(data.mrp) || cost * 1.4,
        stock_quantity: qty,
        created_at: now,
        updated_at: now,
      };
      meds.push(targetMed);
    }
    setMockStorage('medicines', meds);

    const purchase: Purchase = {
      id: Date.now(),
      purchase_number: purchaseNum,
      medicine_id: targetMed.id,
      medicine_name: targetMed.name,
      batch_number: data.batch_number,
      expiry_date: data.expiry_date,
      quantity: qty,
      purchase_price: cost,
      total_amount: qty * cost,
      supplier_name: data.supplier_name || 'Direct Supplier',
      invoice_date: data.invoice_date || now.slice(0, 10),
      created_at: now,
    };
    purchases.unshift(purchase);
    setMockStorage('purchases', purchases);

    return { purchase, medicine: targetMed };
  },

  // Sales & POS
  createSale: async (data: CreateSaleInput): Promise<Sale> => {
    if (hasElectron) return window.api!.createSale(data);
    const sales = getMockStorage('sales', [] as Sale[]);
    const meds = getMockStorage('medicines', mockDefaultMedicines);

    const now = new Date().toISOString();
    const invoiceNumber = `INV-${now.slice(0, 10).replace(/-/g, '')}-${String(sales.length + 1).padStart(4, '0')}`;

    let subtotal = 0;
    let totalCost = 0;
    const items = [];

    for (const item of data.items) {
      const med = meds.find((m) => m.id === item.medicine_id);
      if (!med) throw new Error(`Medicine #${item.medicine_id} not found.`);
      if (med.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for "${med.name}". Available: ${med.stock_quantity}`);
      }

      med.stock_quantity -= item.quantity;
      const unitPrice = item.unit_price || med.selling_price;
      const itemSubtotal = item.quantity * unitPrice;
      const itemCost = item.quantity * med.purchase_price;

      subtotal += itemSubtotal;
      totalCost += itemCost;

      items.push({
        medicine_id: med.id,
        medicine_name: med.name,
        barcode: med.barcode,
        batch_number: med.batch_number,
        expiry_date: med.expiry_date,
        quantity: item.quantity,
        mrp: med.mrp,
        unit_price: unitPrice,
        unit_cost: med.purchase_price,
        subtotal: itemSubtotal,
        profit: itemSubtotal - itemCost,
      });
    }

    setMockStorage('medicines', meds);

    const discountPercent = data.discount_percent || 0;
    const discountAmount = Math.round((subtotal * (discountPercent / 100)) * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    const grossProfit = Math.round((totalAmount - totalCost) * 100) / 100;

    const sale: Sale = {
      id: Date.now(),
      invoice_number: invoiceNumber,
      customer_type: data.customer_type || 'Walk-in',
      payment_method: data.payment_method,
      subtotal,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      total_cost: totalCost,
      gross_profit: grossProfit,
      cash_tendered: data.cash_tendered || totalAmount,
      change_returned: Math.max(0, (data.cash_tendered || totalAmount) - totalAmount),
      upi_reference: data.upi_reference,
      created_at: now,
      items,
    };

    sales.unshift(sale);
    setMockStorage('sales', sales);

    return sale;
  },

  getSaleById: async (id: number): Promise<Sale | null> => {
    if (hasElectron) return window.api!.getSaleById(id);
    const sales = getMockStorage('sales', [] as Sale[]);
    return sales.find((s) => s.id === id) || null;
  },

  getSaleByInvoice: async (invoiceNumber: string): Promise<Sale | null> => {
    if (hasElectron) return window.api!.getSaleByInvoice(invoiceNumber);
    const sales = getMockStorage('sales', [] as Sale[]);
    return sales.find((s) => s.invoice_number === invoiceNumber) || null;
  },

  getSalesHistory: async (search?: string, date?: string, limit?: number): Promise<Sale[]> => {
    if (hasElectron) return window.api!.getSalesHistory(search, date, limit);
    let sales = getMockStorage('sales', [] as Sale[]);
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      sales = sales.filter((s) => s.invoice_number.toLowerCase().includes(q));
    }
    if (date && date.trim()) {
      sales = sales.filter((s) => s.created_at.startsWith(date));
    }
    return sales.slice(0, limit || 100);
  },

  getDailySalesSummary: async (date?: string) => {
    if (hasElectron) return window.api!.getDailySalesSummary(date);
    const sales = getMockStorage('sales', [] as Sale[]);
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const daySales = sales.filter((s) => s.created_at.startsWith(targetDate));
    const totalSales = daySales.reduce((acc, s) => acc + s.total_amount, 0);
    const totalCost = daySales.reduce((acc, s) => acc + s.total_cost, 0);
    const grossProfit = daySales.reduce((acc, s) => acc + s.gross_profit, 0);
    return {
      date: targetDate,
      totalSales,
      totalCost,
      grossProfit,
      invoiceCount: daySales.length,
    };
  },

  // Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    if (hasElectron) return window.api!.getDashboardStats();
    const meds = getMockStorage('medicines', mockDefaultMedicines);
    const sales = getMockStorage('sales', [] as Sale[]);
    const today = new Date().toISOString().slice(0, 10);
    const daySales = sales.filter((s) => s.created_at.startsWith(today));

    const todaySales = daySales.reduce((acc, s) => acc + s.total_amount, 0);
    const todayGrossProfit = daySales.reduce((acc, s) => acc + s.gross_profit, 0);
    const totalStockUnits = meds.reduce((acc, m) => acc + m.stock_quantity, 0);

    const lowStockItems = meds.filter((m) => m.stock_quantity <= 10);
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
    const upcomingExpiries = meds.filter((m) => new Date(m.expiry_date) <= sixtyDaysLater);

    return {
      todaySales,
      todayGrossProfit,
      todayInvoicesCount: daySales.length,
      totalMedicinesCount: meds.length,
      totalStockUnits,
      lowStockItems,
      upcomingExpiries,
    };
  },

  // Sync
  getSyncStatus: async (): Promise<SyncStatus> => {
    if (hasElectron) return window.api!.getSyncStatus();
    return {
      pendingCount: 0,
      lastSyncAt: new Date().toISOString(),
      isSyncing: false,
      lastError: null,
    };
  },

  syncWithGoogleSheets: async (overrideUrl?: string): Promise<SyncResult> => {
    if (hasElectron) return window.api!.syncWithGoogleSheets(overrideUrl);
    return {
      success: true,
      syncedCount: 5,
      pendingCount: 0,
      message: 'Mock Browser Sync: Records synchronized successfully.',
      lastSyncAt: new Date().toISOString(),
    };
  },

  // Settings
  getAppSettings: async (): Promise<AppSettings> => {
    if (hasElectron) return window.api!.getAppSettings();
    return getMockStorage('settings', {
      pharmacy_name: 'Omni 24/7 Store & Pharmacy',
      pharmacy_address: '102 Healthcare Avenue, Medical Plaza',
      pharmacy_phone: '+91 98765 43210',
      pharmacy_gst: '29ABCDE1234F1Z5',
      thermal_width: '80mm',
      gas_web_app_url: '',
      auto_sync_enabled: false,
      auto_sync_interval_mins: 15,
      last_sync_time: '',
    });
  },

  updateAppSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    if (hasElectron) return window.api!.updateAppSettings(settings);
    const cur = getMockStorage('settings', {} as AppSettings);
    const updated = { ...cur, ...settings };
    setMockStorage('settings', updated);
    return updated;
  },

  // Backup & CSV Export
  backupDatabase: async () => {
    if (hasElectron) return window.api!.backupDatabase();
    return { success: true, filePath: 'mock_backup_path.db' };
  },

  exportCSV: async (type: 'medicines' | 'sales' | 'purchases') => {
    if (hasElectron) return window.api!.exportCSV(type);
    return { success: true, filePath: `mock_${type}.csv` };
  },

  // Print
  printReceipt: async (htmlContent: string, width: '80mm' | '58mm' | 'a4' = '80mm') => {
    if (hasElectron) return window.api!.printReceipt(htmlContent, width);
    window.print();
    return { success: true };
  },

  // System
  isOnline: async (): Promise<boolean> => {
    if (hasElectron) return window.api!.isOnline();
    return navigator.onLine;
  },
};
