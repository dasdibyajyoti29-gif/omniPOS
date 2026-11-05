import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(customUserDataPath?: string): string {
  let baseDir: string;
  if (customUserDataPath) {
    baseDir = customUserDataPath;
  } else {
    try {
      // In electron environment
      const { app } = require('electron');
      baseDir = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
    } catch {
      baseDir = path.join(process.cwd(), 'data');
    }
  }

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return path.join(baseDir, 'pharmacy_pos.db');
}

export function initDatabase(dbPathOrMemory?: string): Database.Database {
  if (dbInstance && !dbPathOrMemory) {
    return dbInstance;
  }

  const dbPath = dbPathOrMemory || getDatabasePath();
  const db = new Database(dbPath);

  // Enable WAL mode for high performance and durability
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
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

  // Initialize default settings if not exists
  const countSettings = db.prepare(`SELECT count(*) as cnt FROM app_settings`).get() as { cnt: number };
  if (countSettings.cnt === 0) {
    const defaultSettings = [
      ['pharmacy_name', 'Omni 24/7 Store & Pharmacy'],
      ['pharmacy_address', '102 Healthcare Avenue, Medical Plaza, City'],
      ['pharmacy_phone', '+91 98765 43210'],
      ['pharmacy_gst', '29ABCDE1234F1Z5'],
      ['thermal_width', '80mm'],
      ['gas_web_app_url', ''],
      ['auto_sync_enabled', 'false'],
      ['auto_sync_interval_mins', '15'],
      ['last_sync_time', ''],
    ];

    const insertSetting = db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`);
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }
  }

  // Insert sample medicines if database is brand new and empty to help immediately test
  const countMeds = db.prepare(`SELECT count(*) as cnt FROM medicines`).get() as { cnt: number };
  if (countMeds.cnt === 0) {
    const now = new Date().toISOString();
    const futureDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };

    const initialMedicines = [
      {
        name: 'Paracetamol 650mg (Dolo)',
        barcode: '8901234567890',
        batch_number: 'DL-2024-B1',
        expiry_date: futureDate(360),
        purchase_price: 18.50,
        selling_price: 30.00,
        mrp: 32.50,
        stock_quantity: 120,
      },
      {
        name: 'Azithromycin 500mg (Azithral)',
        barcode: '8901234567891',
        batch_number: 'AZ-2024-C9',
        expiry_date: futureDate(450),
        purchase_price: 65.00,
        selling_price: 110.00,
        mrp: 125.00,
        stock_quantity: 45,
      },
      {
        name: 'Amoxicillin + Clav 625mg (Augmentin)',
        barcode: '8901234567892',
        batch_number: 'AG-2024-K2',
        expiry_date: futureDate(180),
        purchase_price: 130.00,
        selling_price: 210.00,
        mrp: 235.00,
        stock_quantity: 6, // Low stock test (<10)
      },
      {
        name: 'Cetirizine 10mg (Okacet)',
        barcode: '8901234567893',
        batch_number: 'CT-2024-A4',
        expiry_date: futureDate(25), // Upcoming expiry test (<30 days)
        purchase_price: 12.00,
        selling_price: 22.00,
        mrp: 25.00,
        stock_quantity: 80,
      },
      {
        name: 'Omeprazole 20mg (Omez)',
        barcode: '8901234567894',
        batch_number: 'OM-2024-F7',
        expiry_date: futureDate(540),
        purchase_price: 35.00,
        selling_price: 60.00,
        mrp: 68.00,
        stock_quantity: 60,
      },
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
    } catch {}
    dbInstance = null;
  }

  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
