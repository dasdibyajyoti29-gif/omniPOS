import { contextBridge, ipcRenderer } from 'electron';
import { Medicine, Purchase, Sale, DashboardStats, AppSettings, SyncStatus } from '../src/types/pos';
import { NewPurchaseInput } from './db/purchases';
import { CreateSaleInput } from './db/sales';
import { SyncResult } from './db/sync';

export interface ElectronAPI {
  // Medicines
  getMedicines: (search?: string) => Promise<Medicine[]>;
  getMedicineById: (id: number) => Promise<Medicine | null>;
  getMedicineByBarcode: (barcode: string) => Promise<Medicine | null>;
  addMedicine: (data: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>) => Promise<Medicine>;
  updateMedicine: (id: number, data: Partial<Medicine>) => Promise<Medicine>;
  deleteMedicine: (id: number) => Promise<{ success: boolean; message?: string }>;

  // Purchases
  getPurchases: (limit?: number) => Promise<Purchase[]>;
  recordPurchase: (data: NewPurchaseInput) => Promise<{ purchase: Purchase; medicine: Medicine }>;

  // Sales & POS
  createSale: (data: CreateSaleInput) => Promise<Sale>;
  getSaleById: (id: number) => Promise<Sale | null>;
  getSaleByInvoice: (invoiceNumber: string) => Promise<Sale | null>;
  getSalesHistory: (search?: string, date?: string, limit?: number) => Promise<Sale[]>;
  getDailySalesSummary: (date?: string) => Promise<{
    date: string;
    totalSales: number;
    totalCost: number;
    grossProfit: number;
    invoiceCount: number;
  }>;

  // Dashboard
  getDashboardStats: () => Promise<DashboardStats>;

  // Sync
  getSyncStatus: () => Promise<SyncStatus>;
  syncWithGoogleSheets: (overrideUrl?: string) => Promise<SyncResult>;

  // Settings
  getAppSettings: () => Promise<AppSettings>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

  // Backup & CSV Export
  backupDatabase: () => Promise<{ success: boolean; filePath: string; canceled?: boolean }>;
  exportCSV: (type: 'medicines' | 'sales' | 'purchases') => Promise<{ success: boolean; filePath?: string; canceled?: boolean }>;

  // Printing
  printReceipt: (htmlContent: string, width?: '80mm' | '58mm' | 'a4') => Promise<{ success: boolean; error?: string }>;

  // System
  isOnline: () => Promise<boolean>;
}

const api: ElectronAPI = {
  // Medicines
  getMedicines: (search) => ipcRenderer.invoke('medicines:get-all', search),
  getMedicineById: (id) => ipcRenderer.invoke('medicines:get-by-id', id),
  getMedicineByBarcode: (barcode) => ipcRenderer.invoke('medicines:get-by-barcode', barcode),
  addMedicine: (data) => ipcRenderer.invoke('medicines:add', data),
  updateMedicine: (id, data) => ipcRenderer.invoke('medicines:update', id, data),
  deleteMedicine: (id) => ipcRenderer.invoke('medicines:delete', id),

  // Purchases
  getPurchases: (limit) => ipcRenderer.invoke('purchases:get-all', limit),
  recordPurchase: (data) => ipcRenderer.invoke('purchases:record', data),

  // Sales & POS
  createSale: (data) => ipcRenderer.invoke('sales:create', data),
  getSaleById: (id) => ipcRenderer.invoke('sales:get-by-id', id),
  getSaleByInvoice: (inv) => ipcRenderer.invoke('sales:get-by-invoice', inv),
  getSalesHistory: (search, date, limit) => ipcRenderer.invoke('sales:get-history', search, date, limit),
  getDailySalesSummary: (date) => ipcRenderer.invoke('sales:get-daily-summary', date),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),

  // Sync
  getSyncStatus: () => ipcRenderer.invoke('sync:get-status'),
  syncWithGoogleSheets: (url) => ipcRenderer.invoke('sync:trigger', url),

  // Settings
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  updateAppSettings: (settings) => ipcRenderer.invoke('settings:update', settings),

  // Backup & CSV Export
  backupDatabase: () => ipcRenderer.invoke('backup:database'),
  exportCSV: (type) => ipcRenderer.invoke('backup:export-csv', type),

  // Printing
  printReceipt: (html, width) => ipcRenderer.invoke('print:receipt', html, width),

  // System
  isOnline: () => ipcRenderer.invoke('system:is-online'),
};

contextBridge.exposeInMainWorld('api', api);
