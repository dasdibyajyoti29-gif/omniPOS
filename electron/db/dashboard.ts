import { initDatabase } from './index';
import { DashboardStats, Medicine } from '../../src/types/pos';

export function getDashboardStats(): DashboardStats {
  const db = initDatabase();
  const today = new Date().toISOString().split('T')[0];

  // Today sales, gross profit, and invoice count
  const todayRow = db
    .prepare(
      `SELECT 
        COUNT(*) as invoiceCount,
        COALESCE(SUM(total_amount), 0) as todaySales,
        COALESCE(SUM(gross_profit), 0) as todayGrossProfit
      FROM sales 
      WHERE date(created_at) = date(?)`
    )
    .get(today) as any;

  // Total medicines count & total stock units
  const stockRow = db
    .prepare(
      `SELECT 
        COUNT(*) as totalMedicinesCount,
        COALESCE(SUM(stock_quantity), 0) as totalStockUnits
      FROM medicines`
    )
    .get() as any;

  // Low-stock items (stock_quantity <= 10)
  const lowStockItems = db
    .prepare(
      `SELECT * FROM medicines 
       WHERE stock_quantity <= 10 
       ORDER BY stock_quantity ASC, name ASC 
       LIMIT 10`
    )
    .all() as Medicine[];

  // Upcoming expiries within 60 days
  // julianday(expiry_date) - julianday('now') <= 60
  const upcomingExpiries = db
    .prepare(
      `SELECT * FROM medicines 
       WHERE date(expiry_date) <= date('now', '+60 days')
       ORDER BY expiry_date ASC, name ASC 
       LIMIT 10`
    )
    .all() as Medicine[];

  return {
    todaySales: Math.round((todayRow.todaySales || 0) * 100) / 100,
    todayGrossProfit: Math.round((todayRow.todayGrossProfit || 0) * 100) / 100,
    todayInvoicesCount: todayRow.invoiceCount || 0,
    totalMedicinesCount: stockRow.totalMedicinesCount || 0,
    totalStockUnits: stockRow.totalStockUnits || 0,
    lowStockItems,
    upcomingExpiries,
  };
}
