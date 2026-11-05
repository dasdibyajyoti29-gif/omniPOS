import { initDatabase, getDatabasePath } from './index';
import fs from 'fs';
import path from 'path';

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function backupDatabase(targetFilePath?: string): Promise<{ success: boolean; filePath: string }> {
  const db = initDatabase();

  let destination = targetFilePath;
  if (!destination) {
    const backupDir = path.join(path.dirname(getDatabasePath()), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    destination = path.join(backupDir, `pharmacy_pos_backup_${timestamp}.db`);
  }

  // better-sqlite3 native backup method ensures WAL is safely flushed and consistent
  await db.backup(destination);

  return { success: true, filePath: destination };
}

export function exportMedicinesCSV(): string {
  const db = initDatabase();
  const rows = db.prepare(`SELECT * FROM medicines ORDER BY name ASC`).all() as any[];

  const headers = [
    'ID',
    'Medicine Name',
    'Barcode',
    'Batch Number',
    'Expiry Date',
    'Purchase Price',
    'Selling Price',
    'MRP',
    'Stock Quantity',
    'Created At',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        escapeCSV(r.name),
        escapeCSV(r.barcode),
        escapeCSV(r.batch_number),
        escapeCSV(r.expiry_date),
        r.purchase_price,
        r.selling_price,
        r.mrp,
        r.stock_quantity,
        escapeCSV(r.created_at),
      ].join(',')
    );
  }

  return lines.join('\n');
}

export function exportSalesCSV(): string {
  const db = initDatabase();
  const rows = db
    .prepare(
      `SELECT 
        s.id as sale_id,
        s.invoice_number,
        s.customer_type,
        s.payment_method,
        s.created_at,
        s.subtotal,
        s.discount_percent,
        s.discount_amount,
        s.total_amount,
        s.total_cost,
        s.gross_profit,
        si.medicine_name,
        si.batch_number,
        si.quantity,
        si.unit_price,
        si.unit_cost,
        si.subtotal as item_total,
        si.profit as item_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      ORDER BY s.id DESC`
    )
    .all() as any[];

  const headers = [
    'Invoice Number',
    'Date & Time',
    'Customer Type',
    'Payment Method',
    'Medicine Name',
    'Batch',
    'Quantity',
    'Unit Cost (Purchase)',
    'Unit Selling Price',
    'Item Total',
    'Item Profit',
    'Invoice Subtotal',
    'Discount %',
    'Discount Amt',
    'Invoice Total',
    'Invoice Total Cost',
    'Invoice Gross Profit',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCSV(r.invoice_number),
        escapeCSV(r.created_at),
        escapeCSV(r.customer_type),
        escapeCSV(r.payment_method),
        escapeCSV(r.medicine_name),
        escapeCSV(r.batch_number),
        r.quantity || '',
        r.unit_cost || '',
        r.unit_price || '',
        r.item_total || '',
        r.item_profit || '',
        r.subtotal,
        r.discount_percent,
        r.discount_amount,
        r.total_amount,
        r.total_cost,
        r.gross_profit,
      ].join(',')
    );
  }

  return lines.join('\n');
}

export function exportPurchasesCSV(): string {
  const db = initDatabase();
  const rows = db.prepare(`SELECT * FROM purchases ORDER BY id DESC`).all() as any[];

  const headers = [
    'PO Number',
    'Invoice Date',
    'Medicine Name',
    'Batch Number',
    'Expiry Date',
    'Quantity',
    'Purchase Price',
    'Total Amount',
    'Supplier Name',
    'Created At',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCSV(r.purchase_number),
        escapeCSV(r.invoice_date),
        escapeCSV(r.medicine_name),
        escapeCSV(r.batch_number),
        escapeCSV(r.expiry_date),
        r.quantity,
        r.purchase_price,
        r.total_amount,
        escapeCSV(r.supplier_name),
        escapeCSV(r.created_at),
      ].join(',')
    );
  }

  return lines.join('\n');
}
