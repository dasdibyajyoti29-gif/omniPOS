export interface Medicine {
  id: number;
  name: string;
  barcode: string;
  batch_number: string;
  expiry_date: string; // YYYY-MM-DD
  purchase_price: number;
  selling_price: number;
  mrp: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
  sync_status?: 'pending' | 'synced';
  synced_at?: string | null;
}

export interface Purchase {
  id: number;
  purchase_number: string;
  medicine_id: number;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  total_amount: number;
  supplier_name: string;
  invoice_date: string;
  created_at: string;
  sync_status?: 'pending' | 'synced';
  synced_at?: string | null;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  medicine_id: number;
  medicine_name: string;
  barcode: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  mrp: number;
  unit_price: number; // selling price
  unit_cost: number;  // actual purchase price for this batch
  subtotal: number;   // quantity * unit_price
  profit: number;     // (unit_price - unit_cost) * quantity
}

export interface Sale {
  id: number;
  invoice_number: string;
  customer_type: string;
  payment_method: 'CASH' | 'UPI';
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  total_cost: number;     // sum of item purchase costs
  gross_profit: number;   // total_amount - total_cost
  cash_tendered?: number;
  change_returned?: number;
  upi_reference?: string;
  created_at: string;
  sync_status?: 'pending' | 'synced';
  synced_at?: string | null;
  items?: SaleItem[];
}

export interface StockMovement {
  id: number;
  medicine_id: number;
  medicine_name: string;
  batch_number: string;
  movement_type: 'INITIAL' | 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  quantity: number; // positive or negative
  previous_stock: number;
  new_stock: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
  sync_status?: 'pending' | 'synced';
}

export interface DashboardStats {
  todaySales: number;
  todayGrossProfit: number;
  todayInvoicesCount: number;
  totalMedicinesCount: number;
  totalStockUnits: number;
  lowStockItems: Medicine[];
  upcomingExpiries: Medicine[];
}

export interface AppSettings {
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  pharmacy_gst: string;
  thermal_width: '80mm' | '58mm' | 'a4';
  gas_web_app_url: string;
  auto_sync_enabled: boolean;
  auto_sync_interval_mins: number;
  last_sync_time?: string;
}

export interface SyncStatus {
  pendingCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
  lastError: string | null;
}
