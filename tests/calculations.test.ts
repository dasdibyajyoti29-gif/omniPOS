import { describe, it, expect } from 'vitest';

export function calculateSaleTotals(
  items: Array<{ quantity: number; unit_price: number; unit_cost: number }>,
  discountPercent: number = 0
) {
  let subtotal = 0;
  let totalCost = 0;

  for (const item of items) {
    subtotal += item.quantity * item.unit_price;
    totalCost += item.quantity * item.unit_cost;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  totalCost = Math.round(totalCost * 100) / 100;

  const validDiscountPercent = Math.min(100, Math.max(0, discountPercent));
  const discountAmount = Math.round((subtotal * (validDiscountPercent / 100)) * 100) / 100;
  const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  const grossProfit = Math.round((totalAmount - totalCost) * 100) / 100;

  return {
    subtotal,
    totalCost,
    discountAmount,
    totalAmount,
    grossProfit,
  };
}

describe('Pharmacy POS Profit and Billing Calculations', () => {
  it('calculates gross profit correctly without discount', () => {
    // 2 units of Paracetamol (Cost: 18.50, Selling: 30.00)
    // 1 unit of Azithral (Cost: 65.00, Selling: 110.00)
    const items = [
      { quantity: 2, unit_price: 30.00, unit_cost: 18.50 },
      { quantity: 1, unit_price: 110.00, unit_cost: 65.00 },
    ];

    const result = calculateSaleTotals(items, 0);

    // Subtotal = 2 * 30 + 1 * 110 = 170.00
    expect(result.subtotal).toBe(170.00);

    // Total Cost = 2 * 18.50 + 1 * 65 = 37 + 65 = 102.00
    expect(result.totalCost).toBe(102.00);

    // Discount = 0
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(170.00);

    // Gross profit = 170 - 102 = 68.00
    expect(result.grossProfit).toBe(68.00);
  });

  it('calculates gross profit accurately when discount is applied', () => {
    // 10 units @ 100 each (Cost: 60 each) -> Subtotal: 1000, Cost: 600
    // Discount: 10% -> Discount Amount: 100, Total Amount: 900
    // Gross Profit should be: 900 - 600 = 300
    const items = [{ quantity: 10, unit_price: 100.00, unit_cost: 60.00 }];
    const result = calculateSaleTotals(items, 10);

    expect(result.subtotal).toBe(1000.00);
    expect(result.discountAmount).toBe(100.00);
    expect(result.totalAmount).toBe(900.00);
    expect(result.totalCost).toBe(600.00);
    expect(result.grossProfit).toBe(300.00);
  });

  it('handles fractional currency and decimal precision correctly', () => {
    // 3 units @ 33.33 each (Cost: 21.15 each)
    const items = [{ quantity: 3, unit_price: 33.33, unit_cost: 21.15 }];
    const result = calculateSaleTotals(items, 5); // 5% discount

    // Subtotal = 99.99
    expect(result.subtotal).toBe(99.99);
    // Cost = 63.45
    expect(result.totalCost).toBe(63.45);
    // Discount = 99.99 * 0.05 = 5.00
    expect(result.discountAmount).toBe(5.00);
    // Total Amount = 94.99
    expect(result.totalAmount).toBe(94.99);
    // Profit = 94.99 - 63.45 = 31.54
    expect(result.grossProfit).toBe(31.54);
  });
});
