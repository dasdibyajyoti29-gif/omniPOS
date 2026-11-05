import { initDatabase } from './index';
import { Purchase, Medicine } from '../../src/types/pos';
import { getMedicineById } from './medicines';

export interface NewPurchaseInput {
  medicine_id?: number;
  medicine_name: string;
  barcode?: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  selling_price?: number;
  mrp?: number;
  supplier_name?: string;
  invoice_date?: string;
}

export function getAllPurchases(limit: number = 100): Purchase[] {
  const db = initDatabase();
  return db
    .prepare(`SELECT * FROM purchases ORDER BY id DESC LIMIT ?`)
    .all(limit) as Purchase[];
}

export function recordPurchase(input: NewPurchaseInput): { purchase: Purchase; medicine: Medicine } {
  const db = initDatabase();
  const now = new Date().toISOString();
  const invoiceDate = input.invoice_date || now.split('T')[0];
  const supplierName = input.supplier_name?.trim() || 'Direct Supplier';
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 0));
  const purchasePrice = Number(input.purchase_price) || 0;
  const totalAmount = quantity * purchasePrice;

  // Generate unique PO number PO-YYYYMMDD-XXXX
  const dateStr = invoiceDate.replace(/-/g, '');
  const countRow = db.prepare(`SELECT count(*) as cnt FROM purchases WHERE date(created_at) = date(?)`).get(now) as { cnt: number };
  const seq = String(countRow.cnt + 1).padStart(4, '0');
  const purchaseNumber = `PO-${dateStr}-${seq}`;

  let targetMedId = input.medicine_id;
  let targetMedName = input.medicine_name.trim();

  const insertPurchaseStmt = db.prepare(`
    INSERT INTO purchases (
      purchase_number, medicine_id, medicine_name, batch_number,
      expiry_date, quantity, purchase_price, total_amount,
      supplier_name, invoice_date, created_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      medicine_id, medicine_name, batch_number, movement_type,
      quantity, previous_stock, new_stock, reference_id, notes, created_at
    ) VALUES (?, ?, ?, 'PURCHASE', ?, ?, ?, ?, ?, ?)
  `);

  const insertSync = db.prepare(`
    INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
    VALUES (?, ?, 'create', ?, 'pending', ?, ?)
  `);

  let purchaseId = 0;
  let updatedMed: Medicine | null = null;
  const cleanedBarcode = input.barcode && input.barcode.trim() ? input.barcode.trim() : null;

  const transaction = db.transaction(() => {
    // 1. Check or locate existing medicine
    let existing: Medicine | null = null;
    if (targetMedId) {
      existing = getMedicineById(targetMedId);
    } else if (cleanedBarcode) {
      existing = db.prepare(`SELECT * FROM medicines WHERE barcode = ?`).get(cleanedBarcode) as Medicine | null;
    } else {
      existing = db.prepare(`SELECT * FROM medicines WHERE LOWER(name) = LOWER(?)`).get(targetMedName) as Medicine | null;
    }

    if (existing) {
      if (cleanedBarcode && cleanedBarcode !== existing.barcode) {
        const dup = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ? AND id != ?`).get(cleanedBarcode, existing.id) as { id: number; name: string } | null;
        if (dup) {
          throw new Error(`A medicine with barcode "${cleanedBarcode}" already exists ("${dup.name}").`);
        }
      }

      targetMedId = existing.id;
      targetMedName = existing.name;
      const prevStock = existing.stock_quantity;
      const newStock = prevStock + quantity;

      // Update medicine with new stock, latest batch, purchase price, barcode (if provided), and expiry
      db.prepare(`
        UPDATE medicines SET
          stock_quantity = ?,
          purchase_price = ?,
          batch_number = ?,
          expiry_date = ?,
          barcode = CASE WHEN ? IS NOT NULL THEN ? ELSE barcode END,
          selling_price = CASE WHEN ? > 0 THEN ? ELSE selling_price END,
          mrp = CASE WHEN ? > 0 THEN ? ELSE mrp END,
          updated_at = ?,
          sync_status = 'pending'
        WHERE id = ?
      `).run(
        newStock,
        purchasePrice,
        input.batch_number.trim(),
        input.expiry_date,
        cleanedBarcode,
        cleanedBarcode,
        Number(input.selling_price) || 0,
        Number(input.selling_price) || 0,
        Number(input.mrp) || 0,
        Number(input.mrp) || 0,
        now,
        targetMedId
      );

      // Record stock movement
      insertMovement.run(
        targetMedId,
        targetMedName,
        input.batch_number.trim(),
        quantity,
        prevStock,
        newStock,
        purchaseNumber,
        `Stock replenished via ${purchaseNumber} from ${supplierName}`,
        now
      );
    } else {
      if (cleanedBarcode) {
        const dup = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ?`).get(cleanedBarcode) as { id: number; name: string } | null;
        if (dup) {
          throw new Error(`A medicine with barcode "${cleanedBarcode}" already exists ("${dup.name}").`);
        }
      }

      // Create new medicine item
      const insertMed = db.prepare(`
        INSERT INTO medicines (
          name, barcode, batch_number, expiry_date,
          purchase_price, selling_price, mrp, stock_quantity,
          created_at, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        targetMedName,
        cleanedBarcode,
        input.batch_number.trim(),
        input.expiry_date,
        purchasePrice,
        Number(input.selling_price) || Math.round(purchasePrice * 1.25),
        Number(input.mrp) || Math.round(purchasePrice * 1.35),
        quantity,
        now,
        now
      );

      targetMedId = Number(insertMed.lastInsertRowid);

      insertMovement.run(
        targetMedId,
        targetMedName,
        input.batch_number.trim(),
        quantity,
        0,
        quantity,
        purchaseNumber,
        `New medicine added via purchase ${purchaseNumber}`,
        now
      );
    }

    // 2. Insert purchase record
    const pRes = insertPurchaseStmt.run(
      purchaseNumber,
      targetMedId,
      targetMedName,
      input.batch_number.trim(),
      input.expiry_date,
      quantity,
      purchasePrice,
      totalAmount,
      supplierName,
      invoiceDate,
      now
    );
    purchaseId = Number(pRes.lastInsertRowid);

    // 3. Sync queue
    insertSync.run(
      'purchase',
      purchaseId,
      JSON.stringify({
        id: purchaseId,
        purchase_number: purchaseNumber,
        medicine_id: targetMedId,
        medicine_name: targetMedName,
        batch_number: input.batch_number.trim(),
        expiry_date: input.expiry_date,
        quantity,
        purchase_price: purchasePrice,
        total_amount: totalAmount,
        supplier_name: supplierName,
        invoice_date: invoiceDate,
        created_at: now,
      }),
      now,
      now
    );

    updatedMed = getMedicineById(targetMedId)!;
  });

  transaction();

  const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId) as Purchase;
  return { purchase, medicine: updatedMed! };
}
