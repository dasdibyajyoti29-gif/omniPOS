import { initDatabase } from './index';
import { getAppSettings, updateAppSettings } from './settings';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  pendingCount: number;
  message: string;
  lastSyncAt: string | null;
}

export function getPendingSyncCount(): number {
  const db = initDatabase();
  const row = db
    .prepare(`SELECT count(*) as cnt FROM sync_queue WHERE status = 'pending' OR status = 'failed'`)
    .get() as { cnt: number };
  return row.cnt || 0;
}

export function getSyncStatus(): { pendingCount: number; lastSyncAt: string | null } {
  const pendingCount = getPendingSyncCount();
  const settings = getAppSettings();
  return {
    pendingCount,
    lastSyncAt: settings.last_sync_time || null,
  };
}

export async function syncWithGoogleSheets(overrideUrl?: string): Promise<SyncResult> {
  const db = initDatabase();
  const settings = getAppSettings();
  const gasUrl = overrideUrl || settings.gas_web_app_url;

  const initialPendingCount = getPendingSyncCount();

  if (!gasUrl || !gasUrl.trim()) {
    return {
      success: false,
      syncedCount: 0,
      pendingCount: initialPendingCount,
      message: 'Google Apps Script Web App URL is not set. Go to Settings to configure it.',
      lastSyncAt: settings.last_sync_time || null,
    };
  }

  // Fetch pending items (batch of up to 100)
  const pendingItems = db
    .prepare(
      `SELECT * FROM sync_queue 
       WHERE status = 'pending' OR status = 'failed' 
       ORDER BY id ASC LIMIT 100`
    )
    .all() as Array<{
      id: number;
      entity_type: string;
      entity_id: number;
      action: string;
      payload: string;
      status: string;
      retry_count: number;
    }>;

  if (pendingItems.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      pendingCount: 0,
      message: 'All records are already up to date with Google Sheets.',
      lastSyncAt: settings.last_sync_time || null,
    };
  }

  // Format payload for Google Apps Script
  const syncPayload = {
    source: 'PharmacyPOS_Desktop',
    version: '1.0',
    timestamp: new Date().toISOString(),
    batch: pendingItems.map((item) => ({
      queueId: item.id,
      entityType: item.entity_type,
      entityId: item.entity_id,
      action: item.action,
      data: JSON.parse(item.payload),
    })),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const response = await fetch(gasUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      processedIds?: number[];
      message?: string;
      error?: string;
    };

    if (!result.success) {
      throw new Error(result.error || result.message || 'Google Apps Script returned an error.');
    }

    const processedIds: number[] = result.processedIds || pendingItems.map((i) => i.id);
    const now = new Date().toISOString();

    // Mark items as synced in a transaction
    const updateQueue = db.prepare(
      `UPDATE sync_queue SET status = 'synced', updated_at = ? WHERE id = ?`
    );

    const syncTransaction = db.transaction(() => {
      for (const queueId of processedIds) {
        updateQueue.run(now, queueId);
      }
    });

    syncTransaction();

    // Update settings with last sync time
    updateAppSettings({ last_sync_time: now });

    const remaining = getPendingSyncCount();

    return {
      success: true,
      syncedCount: processedIds.length,
      pendingCount: remaining,
      message: `Successfully synchronized ${processedIds.length} record(s) to Google Sheets.`,
      lastSyncAt: now,
    };
  } catch (err: any) {
    const errorMsg = err.name === 'AbortError' ? 'Sync timed out (20s). Will retry.' : err.message;

    // Increment retry count in sync queue
    const markFailed = db.prepare(
      `UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1, last_error = ?, updated_at = ? WHERE id = ?`
    );
    const now = new Date().toISOString();
    for (const item of pendingItems) {
      markFailed.run(errorMsg, now, item.id);
    }

    return {
      success: false,
      syncedCount: 0,
      pendingCount: getPendingSyncCount(),
      message: `Offline / Sync failed: ${errorMsg}. All data remains safely stored locally in SQLite.`,
      lastSyncAt: settings.last_sync_time || null,
    };
  }
}
