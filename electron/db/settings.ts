import { initDatabase } from './index';
import { AppSettings } from '../../src/types/pos';

export function getAppSettings(): AppSettings {
  const db = initDatabase();
  const rows = db.prepare(`SELECT key, value FROM app_settings`).all() as Array<{ key: string; value: string }>;

  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }

  return {
    pharmacy_name: settingsMap.pharmacy_name || 'Omni 24/7 Store & Pharmacy',
    pharmacy_address: settingsMap.pharmacy_address || '102 Healthcare Avenue, Medical Plaza',
    pharmacy_phone: settingsMap.pharmacy_phone || '+91 98765 43210',
    pharmacy_gst: settingsMap.pharmacy_gst || '',
    thermal_width: (settingsMap.thermal_width as any) || '80mm',
    gas_web_app_url: settingsMap.gas_web_app_url || '',
    auto_sync_enabled: settingsMap.auto_sync_enabled === 'true',
    auto_sync_interval_mins: Number(settingsMap.auto_sync_interval_mins) || 15,
    last_sync_time: settingsMap.last_sync_time || '',
  };
}

export function updateAppSettings(settings: Partial<AppSettings>): AppSettings {
  const db = initDatabase();
  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  const transaction = db.transaction(() => {
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) {
        upsert.run(k, String(v));
      }
    }
  });

  transaction();
  return getAppSettings();
}
