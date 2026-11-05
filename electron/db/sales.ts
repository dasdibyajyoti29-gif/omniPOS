import { initDatabase } from './index';
import { Sale, SaleItem, Medicine } from '../../src/types/pos';
import { getMedicineById } from './medicines';

export interface CreateSaleInput {
  customer_type?: string;
  payment_method: 'CASH' | 'UPI';
  discount_percent?: number;
  cash_tendered?: number;
  upi_reference?: string;
  items: Array<{
    medicine_id: number;
    quantity: number;
    unit_price?: number; // optional custom price override
  }>;
}

export function createSale(input: CreateSaleInput): Sale {
  const db = initDatabase();

  if (!input.items || input.items.length === 0) {
    throw new Error('Cannot create an empty sale invoice. Please add at least one medicine.');
  }

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0].replace(/-/g, '');

  // Generate unique invoice number: INV-YYYYMMDD-XXXX
  const todayCountRow = db
    .prepare(`SELECT count(*) as cnt FROM sales WHERE date(created_at) = date(?)`)
    .get(now) as { cnt: number };
  const seq = String(todayCountRow.cnt + 1).padStart(4, '0');
  const invoiceNumber = `INV-${dateStr}-${seq}`;

  const discountPercent = Math.min(100, Math.max(0, Number(input.discount_percent) || 0));

  // Prepare statements
  const insertSaleStmt = db.prepare(`
    INSERT INTO sales (
      invoice_number, customer_type, payment_method, subtotal,
      discount_percent, discount_amount, total_amount, total_cost,
      gross_profit, cash_tendered, change_returned, upi_reference,
      created_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const insertItemStmt = db.prepare(`
    INSERT INTO sale_items (
      sale_id, medicine_id, medicine_name, batch_number, expiry_date,
      quantity, mrp, unit_price, unit_cost, subtotal, profit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStockStmt = db.prepare(`
    UPDATE medicines SET
      stock_quantity = stock_quantity - ?,
      updated_at = ?,
      sync_status = 'pending'
    WHERE id = ?
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      medicine_id, medicine_name, batch_number, movement_type,
      quantity, previous_stock, new_stock, reference_id, notes, created_at
    ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?)
  `);

  const insertSync = db.prepare(`
    INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
    VALUES (?, ?, 'create', ?, 'pending', ?, ?)
  `);

  let saleId = 0;
  const processedItems: SaleItem[] = [];

  const transaction = db.transaction(() => {
    // Phase 1: Validate stock and prepare calculations
    let subtotal = 0;
    let totalCost = 0;

    for (const item of input.items) {
      const med = getMedicineById(item.medicine_id);
      if (!med) {
        throw new Error(`Medicine with ID ${item.medicine_id} does not exist.`);
      }

      const reqQty = Math.floor(Number(item.quantity) || 0);
      if (reqQty <= 0) {
        throw new Error(`Invalid quantity ${reqQty} for medicine "${med.name}".`);
      }

      if (med.stock_quantity < reqQty) {
        throw new Error(
          `Insufficient stock for "${med.name}". Available: ${med.stock_quantity}, Requested: ${reqQty}`
        );
      }

      const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : med.selling_price;
      const unitCost = med.purchase_price; // Actual purchase cost of this batch
      const itemSubtotal = reqQty * unitPrice;
      const itemCost = reqQty * unitCost;
      const itemProfit = itemSubtotal - itemCost;

      subtotal += itemSubtotal;
      totalCost += itemCost;

      processedItems.push({
        medicine_id: med.id,
        medicine_name: med.name,
        barcode: med.barcode,
        batch_number: med.batch_number,
        expiry_date: med.expiry_date,
        quantity: reqQty,
        mrp: med.mrp,
        unit_price: unitPrice,
        unit_cost: unitCost,
        subtotal: Math.round(itemSubtotal * 100) / 100,
        profit: Math.round(itemProfit * 100) / 100,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    totalCost = Math.round(totalCost * 100) / 100;
    const discountAmount = Math.round((subtotal * (discountPercent / 100)) * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    const grossProfit = Math.round((totalAmount - totalCost) * 100) / 100;

    // Payment calculations
    let cashTendered = 0;
    let changeReturned = 0;
    if (input.payment_method === 'CASH') {
      cashTendered = Number(input.cash_tendered) || totalAmount;
      changeReturned = Math.max(0, Math.round((cashTendered - totalAmount) * 100) / 100);
    }

    // Phase 2: Insert into sales table
    const saleRes = insertSaleStmt.run(
      invoiceNumber,
      input.customer_type?.trim() || 'Walk-in',
      input.payment_method,
      subtotal,
      discountPercent,
      discountAmount,
      totalAmount,
      totalCost,
      grossProfit,
      cashTendered,
      changeReturned,
      input.upi_reference?.trim() || null,
      now
    );

    saleId = Number(saleRes.lastInsertRowid);

    // Phase 3: Insert items, deduct stock, record movements
    for (const item of processedItems) {
      item.sale_id = saleId;
      const itemRes = insertItemStmt.run(
        saleId,
        item.medicine_id,
        item.medicine_name,
        item.batch_number,
        item.expiry_date,
        item.quantity,
        item.mrp,
        item.unit_price,
        item.unit_cost,
        item.subtotal,
        item.profit
      );
      item.id = Number(itemRes.lastInsertRowid);

      // Fetch current stock to record exact movement
      const curMed = getMedicineById(item.medicine_id)!;
      const prevStock = curMed.stock_quantity;
      const newStock = prevStock - item.quantity;

      // Deduct stock
      updateStockStmt.run(item.quantity, now, item.medicine_id);

      // Stock movement record
      insertMovement.run(
        item.medicine_id,
        item.medicine_name,
        item.batch_number,
        -item.quantity,
        prevStock,
        newStock,
        invoiceNumber,
        `Sale on invoice ${invoiceNumber}`,
        now
      );
    }

    // Phase 4: Enqueue sync for the completed sale
    insertSync.run(
      'sale',
      saleId,
      JSON.stringify({
        id: saleId,
        invoice_number: invoiceNumber,
        payment_method: input.payment_method,
        subtotal,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        total_cost: totalCost,
        gross_profit: grossProfit,
        created_at: now,
        items: processedItems,
      }),
      now,
      now
    );
  });

  transaction();

  return getSaleById(saleId)!;
}

export function getSaleById(id: number): Sale | null {
  const db = initDatabase();
  const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id) as Sale | undefined;
  if (!sale) return null;

  const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(id) as SaleItem[];
  return { ...sale, items };
}

export function getSaleByInvoice(invoiceNumber: string): Sale | null {
  const db = initDatabase();
  const sale = db.prepare(`SELECT * FROM sales WHERE invoice_number = ?`).get(invoiceNumber) as Sale | undefined;
  if (!sale) return null;

  const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(sale.id) as SaleItem[];
  return { ...sale, items };
}

export function getSalesHistory(search?: string, date?: string, limit: number = 200): Sale[] {
  const db = initDatabase();
  let query = `SELECT * FROM sales WHERE 1=1`;
  const params: any[] = [];

  if (search && search.trim()) {
    query += ` AND (invoice_number LIKE ? OR customer_type LIKE ? OR payment_method LIKE ?)`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q);
  }

  if (date && date.trim()) {
    query += ` AND date(created_at) = date(?)`;
    params.push(date.trim());
  }

  query += ` ORDER BY id DESC LIMIT ?`;
  params.push(limit);

  const sales = db.prepare(query).all(...params) as Sale[];

  // Attach items for the returned sales
  const itemStmt = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`);
  for (const sale of sales) {
    sale.items = itemStmt.all(sale.id) as SaleItem[];
  }

  return sales;
}

export function getDailySalesSummary(dateString?: string): {
  date: string;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  invoiceCount: number;
} {
  const db = initDatabase();
  const targetDate = dateString || new Date().toISOString().split('T')[0];

  const row = db
    .prepare(
      `SELECT 
        COUNT(*) as invoiceCount,
        COALESCE(SUM(total_amount), 0) as totalSales,
        COALESCE(SUM(total_cost), 0) as totalCost,
        COALESCE(SUM(gross_profit), 0) as grossProfit
      FROM sales 
      WHERE date(created_at) = date(?)`
    )
    .get(targetDate) as any;

  return {
    date: targetDate,
    totalSales: Math.round((row.totalSales || 0) * 100) / 100,
    totalCost: Math.round((row.totalCost || 0) * 100) / 100,
    grossProfit: Math.round((row.grossProfit || 0) * 100) / 100,
    invoiceCount: row.invoiceCount || 0,
  };
}
