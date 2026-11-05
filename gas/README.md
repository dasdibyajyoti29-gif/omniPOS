# Google Sheets & Google Apps Script Setup Guide

Follow these steps to connect your Pharmacy POS desktop application to your Google Sheets:

---

### Step 1: Create a Google Spreadsheet
1. Open [Google Sheets](https://sheets.google.com).
2. Create a new blank spreadsheet.
3. Rename the spreadsheet to **`Pharmacy POS Live Data`** (or your pharmacy's name).

---

### Step 2: Open the Apps Script Editor
1. In the top menu bar, click **Extensions** &gt; **Apps Script**.
2. A new tab will open with the script editor.
3. Replace any code in `Code.gs` with the code in `gas/Code.gs`.

---

### Step 3: Deploy as a Web App
1. In the top right corner of the Apps Script editor, click the blue **Deploy** button and select **New deployment**.
2. In the deployment modal, click the gear icon (⚙️) next to *Select type* and select **Web app**.
3. Configure the following settings:
   - **Description**: `Pharmacy POS Sync API v1`
   - **Execute as**: `Me (<your_email@gmail.com>)`
   - **Who has access**: `Anyone` *(Crucial: This enables the desktop app to POST sync data securely without OAuth tokens)*.
4. Click **Deploy**.
5. When prompted, click **Authorize access**, select your Google account, and click **Allow**.
6. Copy the generated **Web app URL** (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Step 4: Configure the Desktop Application
1. Launch the Pharmacy POS application.
2. In the sidebar, navigate to **Settings & Backup**.
3. Paste your Web App URL into the **Google Apps Script Web App URL** input field.
4. Check **Enable automatic background sync** if you want automatic 60-second synchronization.
5. Click **Save Settings**, then click **Test & Sync Now**.

---

### How Offline Synchronization Works:
- When you create sales, add medicines, or record inward stock without an internet connection, all operations occur with zero delay in your local **SQLite** database.
- Every pending change is safely enqueued in the local SQLite `sync_queue`.
- When an internet connection is detected, the app automatically uploads queued batches to Google Sheets.
- Your Google Sheet will populate with 4 organized tabs:
  - **`Medicines`**: Real-time catalog with current stock levels.
  - **`Purchases`**: Purchase order log with inward supplier costs.
  - **`Sales`**: Invoice records with payment method, revenue, and gross profit.
  - **`Stock_Movements`**: Complete audit trail of stock adjustments.
