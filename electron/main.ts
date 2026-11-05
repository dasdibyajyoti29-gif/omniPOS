import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, closeDatabase } from './db/index';
import { getAllMedicines, getMedicineById, getMedicineByBarcode, addMedicine, updateMedicine, deleteMedicine } from './db/medicines';
import { getAllPurchases, recordPurchase } from './db/purchases';
import { createSale, getSaleById, getSaleByInvoice, getSalesHistory, getDailySalesSummary } from './db/sales';
import { getDashboardStats } from './db/dashboard';
import { getSyncStatus, syncWithGoogleSheets } from './db/sync';
import { getAppSettings, updateAppSettings } from './db/settings';
import { backupDatabase, exportMedicinesCSV, exportSalesCSV, exportPurchasesCSV } from './db/backup';

let mainWindow: BrowserWindow | null = null;
let autoSyncInterval: NodeJS.Timeout | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    title: 'Pharmacy POS',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Security: Deny new window openings and restrict navigation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register all IPC Handlers
function registerIpcHandlers(): void {
  // Medicines
  ipcMain.handle('medicines:get-all', async (_, search) => getAllMedicines(search));
  ipcMain.handle('medicines:get-by-id', async (_, id) => getMedicineById(id));
  ipcMain.handle('medicines:get-by-barcode', async (_, barcode) => getMedicineByBarcode(barcode));
  ipcMain.handle('medicines:add', async (_, data) => addMedicine(data));
  ipcMain.handle('medicines:update', async (_, id, data) => updateMedicine(id, data));
  ipcMain.handle('medicines:delete', async (_, id) => deleteMedicine(id));

  // Purchases
  ipcMain.handle('purchases:get-all', async (_, limit) => getAllPurchases(limit));
  ipcMain.handle('purchases:record', async (_, data) => recordPurchase(data));

  // Sales
  ipcMain.handle('sales:create', async (_, data) => createSale(data));
  ipcMain.handle('sales:get-by-id', async (_, id) => getSaleById(id));
  ipcMain.handle('sales:get-by-invoice', async (_, inv) => getSaleByInvoice(inv));
  ipcMain.handle('sales:get-history', async (_, search, date, limit) => getSalesHistory(search, date, limit));
  ipcMain.handle('sales:get-daily-summary', async (_, date) => getDailySalesSummary(date));

  // Dashboard
  ipcMain.handle('dashboard:get-stats', async () => getDashboardStats());

  // Sync
  ipcMain.handle('sync:get-status', async () => getSyncStatus());
  ipcMain.handle('sync:trigger', async (_, url) => syncWithGoogleSheets(url));

  // Settings
  ipcMain.handle('settings:get', async () => getAppSettings());
  ipcMain.handle('settings:update', async (_, settings) => updateAppSettings(settings));

  // System status
  ipcMain.handle('system:is-online', async () => {
    try {
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  });

  // Backup SQLite database
  ipcMain.handle('backup:database', async () => {
    if (!mainWindow) return { success: false, filePath: '' };

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Database Backup',
      defaultPath: `pharmacy_pos_backup_${dateStr}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    });

    if (canceled || !filePath) {
      return { success: false, filePath: '', canceled: true };
    }

    return await backupDatabase(filePath);
  });

  // Export CSV
  ipcMain.handle('backup:export-csv', async (_, type: 'medicines' | 'sales' | 'purchases') => {
    if (!mainWindow) return { success: false };

    let csvContent = '';
    let defaultFilename = '';

    if (type === 'medicines') {
      csvContent = exportMedicinesCSV();
      defaultFilename = `medicines_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (type === 'sales') {
      csvContent = exportSalesCSV();
      defaultFilename = `sales_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (type === 'purchases') {
      csvContent = exportPurchasesCSV();
      defaultFilename = `purchases_export_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${type.toUpperCase()} to CSV`,
      defaultPath: defaultFilename,
      filters: [{ name: 'CSV File', extensions: ['csv'] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(filePath, csvContent, 'utf-8');
    return { success: true, filePath };
  });

  // Receipt Printing
  ipcMain.handle('print:receipt', async (_, htmlContent: string, width: '80mm' | '58mm' | 'a4' = '80mm') => {
    try {
      const printWindow = new BrowserWindow({
        show: false,
        width: width === 'a4' ? 800 : width === '58mm' ? 300 : 380,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: ${width === 'a4' ? 'A4 portrait' : width === '58mm' ? '58mm auto' : '80mm auto'};
              margin: ${width === 'a4' ? '15mm' : '4mm'};
            }
            body {
              font-family: 'Courier New', Courier, monospace, system-ui;
              font-size: ${width === 'a4' ? '13px' : '11px'};
              color: #000;
              margin: 0;
              padding: 4px;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { padding: 3px 1px; font-size: inherit; }
            th { border-bottom: 1px dashed #000; border-top: 1px dashed #000; text-align: left; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 1px double #000; margin: 6px 0; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

      return new Promise((resolve) => {
        printWindow.webContents.print(
          {
            silent: false,
            printBackground: true,
            margins: { marginType: 'none' },
          },
          (success, failureReason) => {
            printWindow.close();
            if (!success) {
              resolve({ success: false, error: failureReason });
            } else {
              resolve({ success: true });
            }
          }
        );
      });
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

// Background Auto-Sync loop (every 60s if enabled)
function setupAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  autoSyncInterval = setInterval(async () => {
    try {
      const settings = getAppSettings();
      if (settings.auto_sync_enabled && settings.gas_web_app_url) {
        await syncWithGoogleSheets();
      }
    } catch (err) {
      console.warn('Auto-sync periodic check skipped:', err);
    }
  }, 60000);
}

app.whenReady().then(() => {
  // Enforce Cross-Origin Isolation for SharedArrayBuffer / SQLite WASM
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    });
  });

  // Initialize SQLite database
  initDatabase();

  registerIpcHandlers();
  createWindow();
  setupAutoSync();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});