import { initDatabase } from './index';
import { Medicine } from '../../src/types/pos';

export function getAllMedicines(search?: string): Medicine[] {
  const db = initDatabase();
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db
      .prepare(
        `SELECT * FROM medicines 
         WHERE name LIKE ? OR barcode LIKE ? OR batch_number LIKE ?
         ORDER BY name ASC`
      )
      .all(q, q, q) as Medicine[];
  }

  return db.prepare(`SELECT * FROM medicines ORDER BY name ASC`).all() as Medicine[];
}

export function getMedicineById(id: number): Medicine | null {
  const db = initDatabase();
  const med = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(id);
  return (med as Medicine) || null;
}

export function getMedicineByBarcode(barcode: string): Medicine | null {
  const db = initDatabase();
  const med = db.prepare(`SELECT * FROM medicines WHERE barcode = ?`).get(barcode);
  return (med as Medicine) || null;
}

export function addMedicine(data: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>): Medicine {
  const db = initDatabase();
  const now = new Date().toISOString();

  // Validate barcode uniqueness if provided
  const cleanedBarcode = data.barcode && data.barcode.trim() ? data.barcode.trim() : null;
  if (cleanedBarcode) {
    const existing = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ?`).get(cleanedBarcode) as { id: number; name: string } | null;
    if (existing) {
      throw new Error(`A medicine with barcode "${cleanedBarcode}" already exists ("${existing.name}").`);
    }
  }

  const insertMed = db.prepare(`
    INSERT INTO medicines (
      name, barcode, batch_number, expiry_date, 
      purchase_price, selling_price, mrp, stock_quantity, 
      created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      medicine_id, medicine_name, batch_number, movement_type, 
      quantity, previous_stock, new_stock, reference_id, notes, created_at
    ) VALUES (?, ?, ?, 'INITIAL', ?, 0, ?, 'INITIAL_ENTRY', 'Initial inventory entry', ?)
  `);

  const insertSync = db.prepare(`
    INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
    VALUES ('medicine', ?, 'create', ?, 'pending', ?, ?)
  `);

  let createdId = 0;
  const transaction = db.transaction(() => {
    const res = insertMed.run(
      data.name.trim(),
      cleanedBarcode,
      data.batch_number.trim(),
      data.expiry_date,
      Number(data.purchase_price) || 0,
      Number(data.selling_price) || 0,
      Number(data.mrp) || 0,
      Number(data.stock_quantity) || 0,
      now,
      now
    );

    createdId = Number(res.lastInsertRowid);

    if (data.stock_quantity > 0) {
      insertMovement.run(
        createdId,
        data.name.trim(),
        data.batch_number.trim(),
        data.stock_quantity,
        data.stock_quantity,
        now
      );
    }

    insertSync.run(
      createdId,
      JSON.stringify({ ...data, id: createdId }),
      now,
      now
    );
  });

  transaction();
  return getMedicineById(createdId)!;
}

export function updateMedicine(id: number, data: Partial<Medicine>): Medicine {
  const db = initDatabase();
  const current = getMedicineById(id);
  if (!current) {
    throw new Error(`Medicine with ID ${id} not found.`);
  }

  // Barcode uniqueness check if updating barcode
  if (data.barcode && data.barcode.trim() !== current.barcode) {
    const existing = db.prepare(`SELECT id FROM medicines WHERE barcode = ? AND id != ?`).get(data.barcode.trim(), id);
    if (existing) {
      throw new Error(`A medicine with barcode "${data.barcode}" already exists.`);
    }
  }

  const now = new Date().toISOString();
  const updatedStock = data.stock_quantity !== undefined ? Number(data.stock_quantity) : current.stock_quantity;
  const stockDiff = updatedStock - current.stock_quantity;

  const updateStmt = db.prepare(`
    UPDATE medicines SET
      name = ?,
      barcode = ?,
      batch_number = ?,
      expiry_date = ?,
      purchase_price = ?,
      selling_price = ?,
      mrp = ?,
      stock_quantity = ?,
      updated_at = ?,
      sync_status = 'pending'
    WHERE id = ?
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (
      medicine_id, medicine_name, batch_number, movement_type, 
      quantity, previous_stock, new_stock, reference_id, notes, created_at
    ) VALUES (?, ?, ?, 'ADJUSTMENT', ?, ?, ?, 'MANUAL_EDIT', 'Manual stock adjustment via edit', ?)
  `);

  const insertSync = db.prepare(`
    INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
    VALUES ('medicine', ?, 'update', ?, 'pending', ?, ?)
  `);

  const transaction = db.transaction(() => {
    updateStmt.run(
      data.name !== undefined ? data.name.trim() : current.name,
      data.barcode !== undefined ? data.barcode.trim() : current.barcode,
      data.batch_number !== undefined ? data.batch_number.trim() : current.batch_number,
      data.expiry_date !== undefined ? data.expiry_date : current.expiry_date,
      data.purchase_price !== undefined ? Number(data.purchase_price) : current.purchase_price,
      data.selling_price !== undefined ? Number(data.selling_price) : current.selling_price,
      data.mrp !== undefined ? Number(data.mrp) : current.mrp,
      updatedStock,
      now,
      id
    );

    if (stockDiff !== 0) {
      insertMovement.run(
        id,
        data.name || current.name,
        data.batch_number || current.batch_number,
        stockDiff,
        current.stock_quantity,
        updatedStock,
        now
      );
    }

    insertSync.run(
      id,
      JSON.stringify({ id, ...current, ...data, updated_at: now }),
      now,
      now
    );
  });

  transaction();
  return getMedicineById(id)!;
}

export function deleteMedicine(id: number): { success: boolean; message?: string } {
  const db = initDatabase();
  const current = getMedicineById(id);
  if (!current) {
    throw new Error(`Medicine with ID ${id} not found.`);
  }

  // Check if medicine has sales attached
  const salesCount = db.prepare(`SELECT count(*) as cnt FROM sale_items WHERE medicine_id = ?`).get(id) as { cnt: number };
  if (salesCount.cnt > 0) {
    throw new Error(
      `Cannot delete "${current.name}" because it is referenced in past sales invoices. You can set its stock to 0 instead.`
    );
  }

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM purchases WHERE medicine_id = ?`).run(id);
    db.prepare(`DELETE FROM stock_movements WHERE medicine_id = ?`).run(id);
    db.prepare(`DELETE FROM medicines WHERE id = ?`).run(id);

    db.prepare(`
      INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
      VALUES ('medicine', ?, 'delete', ?, 'pending', ?, ?)
    `).run(id, JSON.stringify({ id, name: current.name }), now, now);
  });

  transaction();
  return { success: true };
}
