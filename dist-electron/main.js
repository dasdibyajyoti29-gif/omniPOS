"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_path3 = __toESM(require("path"));
var import_fs3 = __toESM(require("fs"));

// electron/db/index.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_path = __toESM(require("path"));
var import_fs = __toESM(require("fs"));
var dbInstance = null;
function getDatabasePath(customUserDataPath) {
  let baseDir;
  if (customUserDataPath) {
    baseDir = customUserDataPath;
  } else {
    try {
      const { app: app2 } = require("electron");
      baseDir = app2 ? app2.getPath("userData") : import_path.default.join(process.cwd(), "data");
    } catch {
      baseDir = import_path.default.join(process.cwd(), "data");
    }
  }
  if (!import_fs.default.existsSync(baseDir)) {
    import_fs.default.mkdirSync(baseDir, { recursive: true });
  }
  return import_path.default.join(baseDir, "pharmacy_pos.db");
}
function initDatabase(dbPathOrMemory) {
  if (dbInstance && !dbPathOrMemory) {
    return dbInstance;
  }
  const dbPath = dbPathOrMemory || getDatabasePath();
  const db = new import_better_sqlite3.default(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      mrp REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
    CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
    CREATE INDEX IF NOT EXISTS idx_medicines_expiry ON medicines(expiry_date);

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      medicine_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purchase_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      supplier_name TEXT DEFAULT 'Direct Supplier',
      invoice_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      synced_at TEXT,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      customer_type TEXT DEFAULT 'Walk-in',
      payment_method TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL,
      gross_profit REAL NOT NULL,
      cash_tendered REAL DEFAULT 0,
      change_returned REAL DEFAULT 0,
      upi_reference TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      medicine_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      mrp REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      subtotal REAL NOT NULL,
      profit REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      medicine_name TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Ensure empty string barcodes are normalized to NULL to prevent UNIQUE constraint violations
    UPDATE medicines SET barcode = NULL WHERE barcode = '' OR trim(barcode) = '';
  `);
  const countSettings = db.prepare(`SELECT count(*) as cnt FROM app_settings`).get();
  if (countSettings.cnt === 0) {
    const defaultSettings = [
      ["pharmacy_name", "Omni 24/7 Store & Pharmacy"],
      ["pharmacy_address", "102 Healthcare Avenue, Medical Plaza, City"],
      ["pharmacy_phone", "+91 98765 43210"],
      ["pharmacy_gst", "29ABCDE1234F1Z5"],
      ["thermal_width", "80mm"],
      ["gas_web_app_url", ""],
      ["auto_sync_enabled", "false"],
      ["auto_sync_interval_mins", "15"],
      ["last_sync_time", ""]
    ];
    const insertSetting = db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`);
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }
  }
  const countMeds = db.prepare(`SELECT count(*) as cnt FROM medicines`).get();
  if (countMeds.cnt === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const futureDate = (days) => {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };
    const initialMedicines = [
      {
        name: "Paracetamol 650mg (Dolo)",
        barcode: "8901234567890",
        batch_number: "DL-2024-B1",
        expiry_date: futureDate(360),
        purchase_price: 18.5,
        selling_price: 30,
        mrp: 32.5,
        stock_quantity: 120
      },
      {
        name: "Azithromycin 500mg (Azithral)",
        barcode: "8901234567891",
        batch_number: "AZ-2024-C9",
        expiry_date: futureDate(450),
        purchase_price: 65,
        selling_price: 110,
        mrp: 125,
        stock_quantity: 45
      },
      {
        name: "Amoxicillin + Clav 625mg (Augmentin)",
        barcode: "8901234567892",
        batch_number: "AG-2024-K2",
        expiry_date: futureDate(180),
        purchase_price: 130,
        selling_price: 210,
        mrp: 235,
        stock_quantity: 6
        // Low stock test (<10)
      },
      {
        name: "Cetirizine 10mg (Okacet)",
        barcode: "8901234567893",
        batch_number: "CT-2024-A4",
        expiry_date: futureDate(25),
        // Upcoming expiry test (<30 days)
        purchase_price: 12,
        selling_price: 22,
        mrp: 25,
        stock_quantity: 80
      },
      {
        name: "Omeprazole 20mg (Omez)",
        barcode: "8901234567894",
        batch_number: "OM-2024-F7",
        expiry_date: futureDate(540),
        purchase_price: 35,
        selling_price: 60,
        mrp: 68,
        stock_quantity: 60
      }
    ];
    const insertMed = db.prepare(`
      INSERT INTO medicines (name, barcode, batch_number, expiry_date, purchase_price, selling_price, mrp, stock_quantity, created_at, updated_at, sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (medicine_id, medicine_name, batch_number, movement_type, quantity, previous_stock, new_stock, reference_id, notes, created_at)
      VALUES (?, ?, ?, 'INITIAL', ?, 0, ?, 'INIT', 'Initial demo inventory', ?)
    `);
    const insertSync = db.prepare(`
      INSERT INTO sync_queue (entity_type, entity_id, action, payload, status, created_at, updated_at)
      VALUES ('medicine', ?, 'create', ?, 'pending', ?, ?)
    `);
    const seedTransaction = db.transaction(() => {
      for (const m of initialMedicines) {
        const res = insertMed.run(
          m.name,
          m.barcode,
          m.batch_number,
          m.expiry_date,
          m.purchase_price,
          m.selling_price,
          m.mrp,
          m.stock_quantity,
          now,
          now
        );
        const medId = Number(res.lastInsertRowid);
        insertMovement.run(medId, m.name, m.batch_number, m.stock_quantity, m.stock_quantity, now);
        insertSync.run(medId, JSON.stringify({ ...m, id: medId }), now, now);
      }
    });
    seedTransaction();
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
    }
    dbInstance = null;
  }
  dbInstance = db;
  return db;
}
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// electron/db/medicines.ts
function getAllMedicines(search) {
  const db = initDatabase();
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db.prepare(
      `SELECT * FROM medicines 
         WHERE name LIKE ? OR barcode LIKE ? OR batch_number LIKE ?
         ORDER BY name ASC`
    ).all(q, q, q);
  }
  return db.prepare(`SELECT * FROM medicines ORDER BY name ASC`).all();
}
function getMedicineById(id) {
  const db = initDatabase();
  const med = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(id);
  return med || null;
}
function getMedicineByBarcode(barcode) {
  const db = initDatabase();
  const med = db.prepare(`SELECT * FROM medicines WHERE barcode = ?`).get(barcode);
  return med || null;
}
function addMedicine(data) {
  const db = initDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const cleanedBarcode = data.barcode && data.barcode.trim() ? data.barcode.trim() : null;
  if (cleanedBarcode) {
    const existing = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ?`).get(cleanedBarcode);
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
  return getMedicineById(createdId);
}
function updateMedicine(id, data) {
  const db = initDatabase();
  const current = getMedicineById(id);
  if (!current) {
    throw new Error(`Medicine with ID ${id} not found.`);
  }
  if (data.barcode && data.barcode.trim() !== current.barcode) {
    const existing = db.prepare(`SELECT id FROM medicines WHERE barcode = ? AND id != ?`).get(data.barcode.trim(), id);
    if (existing) {
      throw new Error(`A medicine with barcode "${data.barcode}" already exists.`);
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedStock = data.stock_quantity !== void 0 ? Number(data.stock_quantity) : current.stock_quantity;
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
      data.name !== void 0 ? data.name.trim() : current.name,
      data.barcode !== void 0 ? data.barcode.trim() : current.barcode,
      data.batch_number !== void 0 ? data.batch_number.trim() : current.batch_number,
      data.expiry_date !== void 0 ? data.expiry_date : current.expiry_date,
      data.purchase_price !== void 0 ? Number(data.purchase_price) : current.purchase_price,
      data.selling_price !== void 0 ? Number(data.selling_price) : current.selling_price,
      data.mrp !== void 0 ? Number(data.mrp) : current.mrp,
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
  return getMedicineById(id);
}
function deleteMedicine(id) {
  const db = initDatabase();
  const current = getMedicineById(id);
  if (!current) {
    throw new Error(`Medicine with ID ${id} not found.`);
  }
  const salesCount = db.prepare(`SELECT count(*) as cnt FROM sale_items WHERE medicine_id = ?`).get(id);
  if (salesCount.cnt > 0) {
    throw new Error(
      `Cannot delete "${current.name}" because it is referenced in past sales invoices. You can set its stock to 0 instead.`
    );
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
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

// electron/db/purchases.ts
function getAllPurchases(limit = 100) {
  const db = initDatabase();
  return db.prepare(`SELECT * FROM purchases ORDER BY id DESC LIMIT ?`).all(limit);
}
function recordPurchase(input) {
  const db = initDatabase();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const invoiceDate = input.invoice_date || now.split("T")[0];
  const supplierName = input.supplier_name?.trim() || "Direct Supplier";
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 0));
  const purchasePrice = Number(input.purchase_price) || 0;
  const totalAmount = quantity * purchasePrice;
  const dateStr = invoiceDate.replace(/-/g, "");
  const countRow = db.prepare(`SELECT count(*) as cnt FROM purchases WHERE date(created_at) = date(?)`).get(now);
  const seq = String(countRow.cnt + 1).padStart(4, "0");
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
  let updatedMed = null;
  const cleanedBarcode = input.barcode && input.barcode.trim() ? input.barcode.trim() : null;
  const transaction = db.transaction(() => {
    let existing = null;
    if (targetMedId) {
      existing = getMedicineById(targetMedId);
    } else if (cleanedBarcode) {
      existing = db.prepare(`SELECT * FROM medicines WHERE barcode = ?`).get(cleanedBarcode);
    } else {
      existing = db.prepare(`SELECT * FROM medicines WHERE LOWER(name) = LOWER(?)`).get(targetMedName);
    }
    if (existing) {
      if (cleanedBarcode && cleanedBarcode !== existing.barcode) {
        const dup = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ? AND id != ?`).get(cleanedBarcode, existing.id);
        if (dup) {
          throw new Error(`A medicine with barcode "${cleanedBarcode}" already exists ("${dup.name}").`);
        }
      }
      targetMedId = existing.id;
      targetMedName = existing.name;
      const prevStock = existing.stock_quantity;
      const newStock = prevStock + quantity;
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
        const dup = db.prepare(`SELECT id, name FROM medicines WHERE barcode = ?`).get(cleanedBarcode);
        if (dup) {
          throw new Error(`A medicine with barcode "${cleanedBarcode}" already exists ("${dup.name}").`);
        }
      }
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
    insertSync.run(
      "purchase",
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
        created_at: now
      }),
      now,
      now
    );
    updatedMed = getMedicineById(targetMedId);
  });
  transaction();
  const purchase = db.prepare(`SELECT * FROM purchases WHERE id = ?`).get(purchaseId);
  return { purchase, medicine: updatedMed };
}

// electron/db/sales.ts
function createSale(input) {
  const db = initDatabase();
  if (!input.items || input.items.length === 0) {
    throw new Error("Cannot create an empty sale invoice. Please add at least one medicine.");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const dateStr = now.split("T")[0].replace(/-/g, "");
  const todayCountRow = db.prepare(`SELECT count(*) as cnt FROM sales WHERE date(created_at) = date(?)`).get(now);
  const seq = String(todayCountRow.cnt + 1).padStart(4, "0");
  const invoiceNumber = `INV-${dateStr}-${seq}`;
  const discountPercent = Math.min(100, Math.max(0, Number(input.discount_percent) || 0));
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
  const processedItems = [];
  const transaction = db.transaction(() => {
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
      const unitPrice = item.unit_price !== void 0 ? Number(item.unit_price) : med.selling_price;
      const unitCost = med.purchase_price;
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
        profit: Math.round(itemProfit * 100) / 100
      });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    totalCost = Math.round(totalCost * 100) / 100;
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    const grossProfit = Math.round((totalAmount - totalCost) * 100) / 100;
    let cashTendered = 0;
    let changeReturned = 0;
    if (input.payment_method === "CASH") {
      cashTendered = Number(input.cash_tendered) || totalAmount;
      changeReturned = Math.max(0, Math.round((cashTendered - totalAmount) * 100) / 100);
    }
    const saleRes = insertSaleStmt.run(
      invoiceNumber,
      input.customer_type?.trim() || "Walk-in",
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
      const curMed = getMedicineById(item.medicine_id);
      const prevStock = curMed.stock_quantity;
      const newStock = prevStock - item.quantity;
      updateStockStmt.run(item.quantity, now, item.medicine_id);
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
    insertSync.run(
      "sale",
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
        items: processedItems
      }),
      now,
      now
    );
  });
  transaction();
  return getSaleById(saleId);
}
function getSaleById(id) {
  const db = initDatabase();
  const sale = db.prepare(`SELECT * FROM sales WHERE id = ?`).get(id);
  if (!sale) return null;
  const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(id);
  return { ...sale, items };
}
function getSaleByInvoice(invoiceNumber) {
  const db = initDatabase();
  const sale = db.prepare(`SELECT * FROM sales WHERE invoice_number = ?`).get(invoiceNumber);
  if (!sale) return null;
  const items = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`).all(sale.id);
  return { ...sale, items };
}
function getSalesHistory(search, date, limit = 200) {
  const db = initDatabase();
  let query = `SELECT * FROM sales WHERE 1=1`;
  const params = [];
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
  const sales = db.prepare(query).all(...params);
  const itemStmt = db.prepare(`SELECT * FROM sale_items WHERE sale_id = ?`);
  for (const sale of sales) {
    sale.items = itemStmt.all(sale.id);
  }
  return sales;
}
function getDailySalesSummary(dateString) {
  const db = initDatabase();
  const targetDate = dateString || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const row = db.prepare(
    `SELECT 
        COUNT(*) as invoiceCount,
        COALESCE(SUM(total_amount), 0) as totalSales,
        COALESCE(SUM(total_cost), 0) as totalCost,
        COALESCE(SUM(gross_profit), 0) as grossProfit
      FROM sales 
      WHERE date(created_at) = date(?)`
  ).get(targetDate);
  return {
    date: targetDate,
    totalSales: Math.round((row.totalSales || 0) * 100) / 100,
    totalCost: Math.round((row.totalCost || 0) * 100) / 100,
    grossProfit: Math.round((row.grossProfit || 0) * 100) / 100,
    invoiceCount: row.invoiceCount || 0
  };
}

// electron/db/dashboard.ts
function getDashboardStats() {
  const db = initDatabase();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const todayRow = db.prepare(
    `SELECT 
        COUNT(*) as invoiceCount,
        COALESCE(SUM(total_amount), 0) as todaySales,
        COALESCE(SUM(gross_profit), 0) as todayGrossProfit
      FROM sales 
      WHERE date(created_at) = date(?)`
  ).get(today);
  const stockRow = db.prepare(
    `SELECT 
        COUNT(*) as totalMedicinesCount,
        COALESCE(SUM(stock_quantity), 0) as totalStockUnits
      FROM medicines`
  ).get();
  const lowStockItems = db.prepare(
    `SELECT * FROM medicines 
       WHERE stock_quantity <= 10 
       ORDER BY stock_quantity ASC, name ASC 
       LIMIT 10`
  ).all();
  const upcomingExpiries = db.prepare(
    `SELECT * FROM medicines 
       WHERE date(expiry_date) <= date('now', '+60 days')
       ORDER BY expiry_date ASC, name ASC 
       LIMIT 10`
  ).all();
  return {
    todaySales: Math.round((todayRow.todaySales || 0) * 100) / 100,
    todayGrossProfit: Math.round((todayRow.todayGrossProfit || 0) * 100) / 100,
    todayInvoicesCount: todayRow.invoiceCount || 0,
    totalMedicinesCount: stockRow.totalMedicinesCount || 0,
    totalStockUnits: stockRow.totalStockUnits || 0,
    lowStockItems,
    upcomingExpiries
  };
}

// electron/db/settings.ts
function getAppSettings() {
  const db = initDatabase();
  const rows = db.prepare(`SELECT key, value FROM app_settings`).all();
  const settingsMap = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }
  return {
    pharmacy_name: settingsMap.pharmacy_name || "Omni 24/7 Store & Pharmacy",
    pharmacy_address: settingsMap.pharmacy_address || "102 Healthcare Avenue, Medical Plaza",
    pharmacy_phone: settingsMap.pharmacy_phone || "+91 98765 43210",
    pharmacy_gst: settingsMap.pharmacy_gst || "",
    thermal_width: settingsMap.thermal_width || "80mm",
    gas_web_app_url: settingsMap.gas_web_app_url || "",
    auto_sync_enabled: settingsMap.auto_sync_enabled === "true",
    auto_sync_interval_mins: Number(settingsMap.auto_sync_interval_mins) || 15,
    last_sync_time: settingsMap.last_sync_time || ""
  };
}
function updateAppSettings(settings) {
  const db = initDatabase();
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const transaction = db.transaction(() => {
    for (const [k, v] of Object.entries(settings)) {
      if (v !== void 0) {
        upsert.run(k, String(v));
      }
    }
  });
  transaction();
  return getAppSettings();
}

// electron/db/sync.ts
function getPendingSyncCount() {
  const db = initDatabase();
  const row = db.prepare(`SELECT count(*) as cnt FROM sync_queue WHERE status = 'pending' OR status = 'failed'`).get();
  return row.cnt || 0;
}
function getSyncStatus() {
  const pendingCount = getPendingSyncCount();
  const settings = getAppSettings();
  return {
    pendingCount,
    lastSyncAt: settings.last_sync_time || null
  };
}
async function syncWithGoogleSheets(overrideUrl) {
  const db = initDatabase();
  const settings = getAppSettings();
  const gasUrl = overrideUrl || settings.gas_web_app_url;
  const initialPendingCount = getPendingSyncCount();
  if (!gasUrl || !gasUrl.trim()) {
    return {
      success: false,
      syncedCount: 0,
      pendingCount: initialPendingCount,
      message: "Google Apps Script Web App URL is not set. Go to Settings to configure it.",
      lastSyncAt: settings.last_sync_time || null
    };
  }
  const pendingItems = db.prepare(
    `SELECT * FROM sync_queue 
       WHERE status = 'pending' OR status = 'failed' 
       ORDER BY id ASC LIMIT 100`
  ).all();
  if (pendingItems.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      pendingCount: 0,
      message: "All records are already up to date with Google Sheets.",
      lastSyncAt: settings.last_sync_time || null
    };
  }
  const syncPayload = {
    source: "PharmacyPOS_Desktop",
    version: "1.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    batch: pendingItems.map((item) => ({
      queueId: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      action: item.action,
      data: JSON.parse(item.payload)
    }))
  };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2e4);
    const response = await fetch(gasUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(syncPayload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || result.message || "Google Apps Script returned an error.");
    }
    const processedIds = result.processedIds || pendingItems.map((i) => i.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updateQueue = db.prepare(
      `UPDATE sync_queue SET status = 'synced', updated_at = ? WHERE id = ?`
    );
    const syncTransaction = db.transaction(() => {
      for (const queueId of processedIds) {
        updateQueue.run(now, queueId);
      }
    });
    syncTransaction();
    updateAppSettings({ last_sync_time: now });
    const remaining = getPendingSyncCount();
    return {
      success: true,
      syncedCount: processedIds.length,
      pendingCount: remaining,
      message: `Successfully synchronized ${processedIds.length} record(s) to Google Sheets.`,
      lastSyncAt: now
    };
  } catch (err) {
    const errorMsg = err.name === "AbortError" ? "Sync timed out (20s). Will retry." : err.message;
    const markFailed = db.prepare(
      `UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ?, updated_at = ? WHERE id = ?`
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const item of pendingItems) {
      markFailed.run(errorMsg, now, item.id);
    }
    return {
      success: false,
      syncedCount: 0,
      pendingCount: getPendingSyncCount(),
      message: `Offline / Sync failed: ${errorMsg}. All data remains safely stored locally in SQLite.`,
      lastSyncAt: settings.last_sync_time || null
    };
  }
}

// electron/db/backup.ts
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
function escapeCSV(val) {
  if (val === null || val === void 0) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
async function backupDatabase(targetFilePath) {
  const db = initDatabase();
  let destination = targetFilePath;
  if (!destination) {
    const backupDir = import_path2.default.join(import_path2.default.dirname(getDatabasePath()), "backups");
    if (!import_fs2.default.existsSync(backupDir)) {
      import_fs2.default.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    destination = import_path2.default.join(backupDir, `pharmacy_pos_backup_${timestamp}.db`);
  }
  await db.backup(destination);
  return { success: true, filePath: destination };
}
function exportMedicinesCSV() {
  const db = initDatabase();
  const rows = db.prepare(`SELECT * FROM medicines ORDER BY name ASC`).all();
  const headers = [
    "ID",
    "Medicine Name",
    "Barcode",
    "Batch Number",
    "Expiry Date",
    "Purchase Price",
    "Selling Price",
    "MRP",
    "Stock Quantity",
    "Created At"
  ];
  const lines = [headers.join(",")];
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
        escapeCSV(r.created_at)
      ].join(",")
    );
  }
  return lines.join("\n");
}
function exportSalesCSV() {
  const db = initDatabase();
  const rows = db.prepare(
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
  ).all();
  const headers = [
    "Invoice Number",
    "Date & Time",
    "Customer Type",
    "Payment Method",
    "Medicine Name",
    "Batch",
    "Quantity",
    "Unit Cost (Purchase)",
    "Unit Selling Price",
    "Item Total",
    "Item Profit",
    "Invoice Subtotal",
    "Discount %",
    "Discount Amt",
    "Invoice Total",
    "Invoice Total Cost",
    "Invoice Gross Profit"
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCSV(r.invoice_number),
        escapeCSV(r.created_at),
        escapeCSV(r.customer_type),
        escapeCSV(r.payment_method),
        escapeCSV(r.medicine_name),
        escapeCSV(r.batch_number),
        r.quantity || "",
        r.unit_cost || "",
        r.unit_price || "",
        r.item_total || "",
        r.item_profit || "",
        r.subtotal,
        r.discount_percent,
        r.discount_amount,
        r.total_amount,
        r.total_cost,
        r.gross_profit
      ].join(",")
    );
  }
  return lines.join("\n");
}
function exportPurchasesCSV() {
  const db = initDatabase();
  const rows = db.prepare(`SELECT * FROM purchases ORDER BY id DESC`).all();
  const headers = [
    "PO Number",
    "Invoice Date",
    "Medicine Name",
    "Batch Number",
    "Expiry Date",
    "Quantity",
    "Purchase Price",
    "Total Amount",
    "Supplier Name",
    "Created At"
  ];
  const lines = [headers.join(",")];
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
        escapeCSV(r.created_at)
      ].join(",")
    );
  }
  return lines.join("\n");
}

// electron/main.ts
var mainWindow = null;
var autoSyncInterval = null;
var isDev = process.env.NODE_ENV === "development" || !import_electron.app.isPackaged;
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1340,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    title: "Pharmacy POS",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: import_path3.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(import_path3.default.join(__dirname, "../dist/renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function registerIpcHandlers() {
  import_electron.ipcMain.handle("medicines:get-all", async (_, search) => getAllMedicines(search));
  import_electron.ipcMain.handle("medicines:get-by-id", async (_, id) => getMedicineById(id));
  import_electron.ipcMain.handle("medicines:get-by-barcode", async (_, barcode) => getMedicineByBarcode(barcode));
  import_electron.ipcMain.handle("medicines:add", async (_, data) => addMedicine(data));
  import_electron.ipcMain.handle("medicines:update", async (_, id, data) => updateMedicine(id, data));
  import_electron.ipcMain.handle("medicines:delete", async (_, id) => deleteMedicine(id));
  import_electron.ipcMain.handle("purchases:get-all", async (_, limit) => getAllPurchases(limit));
  import_electron.ipcMain.handle("purchases:record", async (_, data) => recordPurchase(data));
  import_electron.ipcMain.handle("sales:create", async (_, data) => createSale(data));
  import_electron.ipcMain.handle("sales:get-by-id", async (_, id) => getSaleById(id));
  import_electron.ipcMain.handle("sales:get-by-invoice", async (_, inv) => getSaleByInvoice(inv));
  import_electron.ipcMain.handle("sales:get-history", async (_, search, date, limit) => getSalesHistory(search, date, limit));
  import_electron.ipcMain.handle("sales:get-daily-summary", async (_, date) => getDailySalesSummary(date));
  import_electron.ipcMain.handle("dashboard:get-stats", async () => getDashboardStats());
  import_electron.ipcMain.handle("sync:get-status", async () => getSyncStatus());
  import_electron.ipcMain.handle("sync:trigger", async (_, url) => syncWithGoogleSheets(url));
  import_electron.ipcMain.handle("settings:get", async () => getAppSettings());
  import_electron.ipcMain.handle("settings:update", async (_, settings) => updateAppSettings(settings));
  import_electron.ipcMain.handle("system:is-online", async () => {
    try {
      const res = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        signal: AbortSignal.timeout(3e3)
      });
      return res.ok;
    } catch {
      return false;
    }
  });
  import_electron.ipcMain.handle("backup:database", async () => {
    if (!mainWindow) return { success: false, filePath: "" };
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const { canceled, filePath } = await import_electron.dialog.showSaveDialog(mainWindow, {
      title: "Save Database Backup",
      defaultPath: `pharmacy_pos_backup_${dateStr}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db", "sqlite"] }]
    });
    if (canceled || !filePath) {
      return { success: false, filePath: "", canceled: true };
    }
    return await backupDatabase(filePath);
  });
  import_electron.ipcMain.handle("backup:export-csv", async (_, type) => {
    if (!mainWindow) return { success: false };
    let csvContent = "";
    let defaultFilename = "";
    if (type === "medicines") {
      csvContent = exportMedicinesCSV();
      defaultFilename = `medicines_export_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    } else if (type === "sales") {
      csvContent = exportSalesCSV();
      defaultFilename = `sales_export_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    } else if (type === "purchases") {
      csvContent = exportPurchasesCSV();
      defaultFilename = `purchases_export_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv`;
    }
    const { canceled, filePath } = await import_electron.dialog.showSaveDialog(mainWindow, {
      title: `Export ${type.toUpperCase()} to CSV`,
      defaultPath: defaultFilename,
      filters: [{ name: "CSV File", extensions: ["csv"] }]
    });
    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }
    import_fs3.default.writeFileSync(filePath, csvContent, "utf-8");
    return { success: true, filePath };
  });
  import_electron.ipcMain.handle("print:receipt", async (_, htmlContent, width = "80mm") => {
    try {
      const printWindow = new import_electron.BrowserWindow({
        show: false,
        width: width === "a4" ? 800 : width === "58mm" ? 300 : 380,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: ${width === "a4" ? "A4 portrait" : width === "58mm" ? "58mm auto" : "80mm auto"};
              margin: ${width === "a4" ? "15mm" : "4mm"};
            }
            body {
              font-family: 'Courier New', Courier, monospace, system-ui;
              font-size: ${width === "a4" ? "13px" : "11px"};
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
            margins: { marginType: "none" }
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
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
function setupAutoSync() {
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
      console.warn("Auto-sync periodic check skipped:", err);
    }
  }, 6e4);
}
import_electron.app.whenReady().then(() => {
  import_electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Cross-Origin-Opener-Policy": ["same-origin"],
        "Cross-Origin-Embedder-Policy": ["require-corp"]
      }
    });
  });
  initDatabase();
  registerIpcHandlers();
  createWindow();
  setupAutoSync();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }
  closeDatabase();
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
