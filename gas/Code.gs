/**
 * ===================================================================
 * PHARMACY POS - GOOGLE APPS SCRIPT WEB APP INTEGRATION
 * ===================================================================
 * This script receives synchronization payloads from the Pharmacy POS desktop
 * application and writes records to Google Sheets tabs:
 * 1. "Medicines" (Live inventory catalog and stock levels)
 * 2. "Purchases" (Inward stock records and supplier invoices)
 * 3. "Sales" (Invoice details, payment modes, revenue, and gross profit)
 * 4. "Stock_Movements" (Audit log of stock increments and decrements)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Wait up to 30 seconds for concurrent requests
  lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondJson({ success: false, error: 'Empty post data received.' });
    }

    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure all required sheets exist with styled headers
    initSheetTabs(ss);

    var processedIds = [];

    if (payload.batch && Array.isArray(payload.batch)) {
      payload.batch.forEach(function (item) {
        var queueId = item.queueId;
        var entityType = item.entityType;
        var action = item.action;
        var data = item.data;

        if (entityType === 'medicine') {
          syncMedicineRecord(ss, data, action);
        } else if (entityType === 'purchase') {
          syncPurchaseRecord(ss, data);
        } else if (entityType === 'sale') {
          syncSaleRecord(ss, data);
        }

        processedIds.push(queueId);
      });
    }

    return respondJson({
      success: true,
      processedIds: processedIds,
      message: 'Successfully synchronized ' + processedIds.length + ' record(s).'
    });

  } catch (err) {
    return respondJson({
      success: false,
      error: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return respondJson({
    status: 'online',
    app: 'Pharmacy POS Google Apps Script Sync Endpoint',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}

function respondJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ensures required tabs with headers exist in the spreadsheet
 */
function initSheetTabs(ss) {
  var schema = {
    'Medicines': [
      'Medicine ID', 'Medicine Name', 'Barcode', 'Batch Number', 
      'Expiry Date', 'Cost Price (₹)', 'Selling Price (₹)', 'MRP (₹)', 
      'Stock Quantity', 'Last Updated'
    ],
    'Purchases': [
      'PO Number', 'Invoice Date', 'Medicine Name', 'Batch Number', 
      'Expiry Date', 'Quantity', 'Purchase Price (₹)', 'Total Amount (₹)', 
      'Supplier Name', 'Recorded At'
    ],
    'Sales': [
      'Invoice Number', 'Invoice Date', 'Payment Method', 'Subtotal (₹)', 
      'Discount %', 'Discount Amt (₹)', 'Net Total (₹)', 'Total Cost (₹)', 
      'Gross Profit (₹)', 'Items Summary', 'Recorded At'
    ],
    'Stock_Movements': [
      'Timestamp', 'Medicine Name', 'Batch Number', 'Movement Type', 
      'Quantity (+/-)', 'Previous Stock', 'New Stock', 'Reference ID', 'Notes'
    ]
  };

  for (var sheetName in schema) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = schema[sheetName];
      sheet.appendRow(headers);
      
      // Style headers: bold, background color, frozen row
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#0f172a');
      headerRange.setFontColor('#f8fafc');
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * Synchronize medicine catalog row (insert or update by ID)
 */
function syncMedicineRecord(ss, med, action) {
  var sheet = ss.getSheetByName('Medicines');
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  // Search if medicine already exists by ID (Column 1)
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(med.id)) {
      rowIdx = i + 1; // 1-indexed for Sheets
      break;
    }
  }

  var rowValues = [
    med.id,
    med.name,
    med.barcode || '',
    med.batch_number || '',
    med.expiry_date || '',
    med.purchase_price || 0,
    med.selling_price || 0,
    med.mrp || 0,
    med.stock_quantity || 0,
    new Date()
  ];

  if (rowIdx > 0) {
    if (action === 'delete') {
      sheet.deleteRow(rowIdx);
    } else {
      sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
    }
  } else if (action !== 'delete') {
    sheet.appendRow(rowValues);
  }
}

/**
 * Append inward purchase stock record
 */
function syncPurchaseRecord(ss, p) {
  var sheet = ss.getSheetByName('Purchases');
  sheet.appendRow([
    p.purchase_number,
    p.invoice_date,
    p.medicine_name,
    p.batch_number,
    p.expiry_date,
    p.quantity,
    p.purchase_price,
    p.total_amount,
    p.supplier_name || 'Direct Supplier',
    p.created_at || new Date()
  ]);
}

/**
 * Append sales invoice record with items breakdown & gross profit
 */
function syncSaleRecord(ss, s) {
  var sheet = ss.getSheetByName('Sales');
  var itemsSummary = (s.items || [])
    .map(function (it) {
      return it.medicine_name + ' (' + it.quantity + 'x @ ₹' + it.unit_price + ')';
    })
    .join('; ');

  sheet.appendRow([
    s.invoice_number,
    s.created_at || new Date(),
    s.payment_method,
    s.subtotal,
    s.discount_percent || 0,
    s.discount_amount || 0,
    s.total_amount,
    s.total_cost,
    s.gross_profit,
    itemsSummary,
    new Date()
  ]);
}
