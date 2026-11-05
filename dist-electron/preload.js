"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  // Medicines
  getMedicines: (search) => import_electron.ipcRenderer.invoke("medicines:get-all", search),
  getMedicineById: (id) => import_electron.ipcRenderer.invoke("medicines:get-by-id", id),
  getMedicineByBarcode: (barcode) => import_electron.ipcRenderer.invoke("medicines:get-by-barcode", barcode),
  addMedicine: (data) => import_electron.ipcRenderer.invoke("medicines:add", data),
  updateMedicine: (id, data) => import_electron.ipcRenderer.invoke("medicines:update", id, data),
  deleteMedicine: (id) => import_electron.ipcRenderer.invoke("medicines:delete", id),
  // Purchases
  getPurchases: (limit) => import_electron.ipcRenderer.invoke("purchases:get-all", limit),
  recordPurchase: (data) => import_electron.ipcRenderer.invoke("purchases:record", data),
  // Sales & POS
  createSale: (data) => import_electron.ipcRenderer.invoke("sales:create", data),
  getSaleById: (id) => import_electron.ipcRenderer.invoke("sales:get-by-id", id),
  getSaleByInvoice: (inv) => import_electron.ipcRenderer.invoke("sales:get-by-invoice", inv),
  getSalesHistory: (search, date, limit) => import_electron.ipcRenderer.invoke("sales:get-history", search, date, limit),
  getDailySalesSummary: (date) => import_electron.ipcRenderer.invoke("sales:get-daily-summary", date),
  // Dashboard
  getDashboardStats: () => import_electron.ipcRenderer.invoke("dashboard:get-stats"),
  // Sync
  getSyncStatus: () => import_electron.ipcRenderer.invoke("sync:get-status"),
  syncWithGoogleSheets: (url) => import_electron.ipcRenderer.invoke("sync:trigger", url),
  // Settings
  getAppSettings: () => import_electron.ipcRenderer.invoke("settings:get"),
  updateAppSettings: (settings) => import_electron.ipcRenderer.invoke("settings:update", settings),
  // Backup & CSV Export
  backupDatabase: () => import_electron.ipcRenderer.invoke("backup:database"),
  exportCSV: (type) => import_electron.ipcRenderer.invoke("backup:export-csv", type),
  // Printing
  printReceipt: (html, width) => import_electron.ipcRenderer.invoke("print:receipt", html, width),
  // System
  isOnline: () => import_electron.ipcRenderer.invoke("system:is-online")
};
import_electron.contextBridge.exposeInMainWorld("api", api);
