import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDatabase, closeDatabase } from '../electron/db/index';
import { addMedicine, getMedicineById, getAllMedicines } from '../electron/db/medicines';
import { recordPurchase } from '../electron/db/purchases';
import { createSale, getSalesHistory } from '../electron/db/sales';
import { getDashboardStats } from '../electron/db/dashboard';

describe('Pharmacy POS SQLite Database Integration Tests', () => {
  beforeEach(() => {
    // Initialize in-memory database for testing
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('initializes demo inventory and settings', () => {
    const meds = getAllMedicines();
    expect(meds.length).toBeGreaterThan(0);
    expect(meds.some((m) => m.name.includes('Paracetamol'))).toBe(true);
  });

  it('adds a new medicine and verifies inventory fields', () => {
    const newMed = addMedicine({
      name: 'Ibuprofen 400mg',
      barcode: '999888777111',
      batch_number: 'IB-99',
      expiry_date: '2026-12-31',
      purchase_price: 15.00,
      selling_price: 28.00,
      mrp: 30.00,
      stock_quantity: 50,
    });

    expect(newMed.id).toBeDefined();
    expect(newMed.name).toBe('Ibuprofen 400mg');
    expect(newMed.stock_quantity).toBe(50);

    const fetched = getMedicineById(newMed.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.barcode).toBe('999888777111');
  });

  it('replenishes stock automatically on purchase', () => {
    // Record purchase for Paracetamol (demo id 1 has 120 initial stock)
    const initialMed = getMedicineById(1)!;
    const initialStock = initialMed.stock_quantity;

    const { purchase, medicine } = recordPurchase({
      medicine_id: 1,
      medicine_name: initialMed.name,
      batch_number: 'DL-2025-X2',
      expiry_date: '2027-01-01',
      quantity: 50,
      purchase_price: 19.00,
      supplier_name: 'Apex Pharma Distributors',
    });

    expect(purchase.quantity).toBe(50);
    expect(purchase.purchase_price).toBe(19.00);
    expect(purchase.total_amount).toBe(50 * 19.00);
    expect(medicine.stock_quantity).toBe(initialStock + 50);
    expect(medicine.batch_number).toBe('DL-2025-X2');
    expect(medicine.purchase_price).toBe(19.00);
  });

  it('processes sales, deducts stock, and records gross profit accurately', () => {
    const med = getMedicineById(1)!; // Paracetamol, cost 18.50, selling 30.00
    const initialStock = med.stock_quantity;

    const sale = createSale({
      payment_method: 'CASH',
      discount_percent: 0,
      cash_tendered: 100,
      items: [{ medicine_id: 1, quantity: 2 }],
    });

    expect(sale.invoice_number).toMatch(/^INV-/);
    expect(sale.subtotal).toBe(60.00); // 2 * 30.00
    expect(sale.total_amount).toBe(60.00);
    const expectedCost = med.purchase_price * 2;
    expect(sale.total_cost).toBe(expectedCost);
    expect(sale.gross_profit).toBe(60.00 - expectedCost);
    expect(sale.change_returned).toBe(40.00); // 100 - 60

    // Verify stock deduction
    const updatedMed = getMedicineById(1)!;
    expect(updatedMed.stock_quantity).toBe(initialStock - 2);

    // Verify sales history
    const history = getSalesHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].invoice_number).toBe(sale.invoice_number);
  });

  it('rejects sale and throws error if stock is insufficient', () => {
    const med = getMedicineById(1)!;
    const requested = med.stock_quantity + 999;

    expect(() => {
      createSale({
        payment_method: 'UPI',
        items: [{ medicine_id: 1, quantity: requested }],
      });
    }).toThrow(/Insufficient stock/);

    // Verify stock did NOT change
    const untouchedMed = getMedicineById(1)!;
    expect(untouchedMed.stock_quantity).toBe(med.stock_quantity);
  });

  it('computes correct dashboard metrics', () => {
    const stats = getDashboardStats();
    expect(stats.totalMedicinesCount).toBeGreaterThan(0);
    expect(stats.totalStockUnits).toBeGreaterThan(0);
    expect(Array.isArray(stats.lowStockItems)).toBe(true);
    expect(Array.isArray(stats.upcomingExpiries)).toBe(true);
  });
});
