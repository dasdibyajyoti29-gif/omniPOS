import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Billing } from './pages/Billing';
import { Inventory } from './pages/Inventory';
import { PurchaseStock } from './pages/PurchaseStock';
import { SalesHistory } from './pages/SalesHistory';
import { SettingsPage } from './pages/Settings';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutProvider, useShortcuts } from './context/ShortcutContext';
import { AriaProvider } from './context/AriaContext';
import { AppSettings, SyncStatus, Medicine } from './types/pos';
import { posApi } from './services/api';

const AppContent: React.FC<{
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  syncStatus: SyncStatus;
  isOnline: boolean;
  onTriggerSync: () => Promise<void>;
  selectedMedicineForRestock: Medicine | null;
  billingInitialMedicine: Medicine | null;
  billingAutoFocusSearch: boolean;
  handleNavigate: (tab: string, state?: any) => void;
}> = ({
  currentTab,
  setCurrentTab,
  settings,
  setSettings,
  syncStatus,
  isOnline,
  onTriggerSync,
  selectedMedicineForRestock,
  billingInitialMedicine,
  billingAutoFocusSearch,
  handleNavigate,
}) => {
  const {
    isShortcutsHelpOpen,
    openShortcutsHelp,
    closeShortcutsHelp,
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
  } = useShortcuts();

  return (
    <div className="app-container" id="pharmacy-app-container">
      {/* Skip Link for Keyboard Accessibility */}
      <a
        href="#main-content-region"
        className="skip-to-content"
        id="link-skip-content"
      >
        Skip to main content
      </a>

      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => handleNavigate(tab)}
        syncStatus={syncStatus}
        isOnline={isOnline}
        onTriggerSync={onTriggerSync}
      />

      <main className="app-main" id="main-content-region" tabIndex={-1}>
        <Header
          currentTab={currentTab}
          onNewSale={() => handleNavigate('billing')}
          onOpenShortcuts={openShortcutsHelp}
          onOpenCommandPalette={openCommandPalette}
        />

        {currentTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentTab === 'billing' && (
          <Billing
            settings={settings}
            initialAddMedicine={billingInitialMedicine}
            autoFocusSearch={billingAutoFocusSearch}
          />
        )}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'purchases' && (
          <PurchaseStock initialMedicine={selectedMedicineForRestock} />
        )}
        {currentTab === 'sales' && <SalesHistory settings={settings} />}
        {currentTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={setSettings}
            onTriggerSync={onTriggerSync}
          />
        )}
      </main>

      {/* Global Shortcut Help Modal (F1) */}
      <ShortcutHelpModal
        isOpen={isShortcutsHelpOpen}
        onClose={closeShortcutsHelp}
      />

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        onNavigate={handleNavigate}
        onTriggerSync={onTriggerSync}
        onOpenShortcuts={openShortcutsHelp}
      />
    </div>
  );
};

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('billing');
  const [selectedMedicineForRestock, setSelectedMedicineForRestock] = useState<Medicine | null>(null);
  const [billingInitialMedicine, setBillingInitialMedicine] = useState<Medicine | null>(null);
  const [billingAutoFocusSearch, setBillingAutoFocusSearch] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [settings, setSettings] = useState<AppSettings>({
    pharmacy_name: 'Omni 24/7 Store & Pharmacy',
    pharmacy_address: '102 Healthcare Avenue, Medical Plaza',
    pharmacy_phone: '+91 98765 43210',
    pharmacy_gst: '',
    thermal_width: '80mm',
    gas_web_app_url: '',
    auto_sync_enabled: false,
    auto_sync_interval_mins: 15,
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingCount: 0,
    lastSyncAt: null,
    isSyncing: false,
    lastError: null,
  });

  // Load app settings and sync status on mount
  const refreshStatusAndSettings = async () => {
    try {
      const [appSettings, syncInfo, online] = await Promise.all([
        posApi.getAppSettings(),
        posApi.getSyncStatus(),
        posApi.isOnline(),
      ]);
      setSettings(appSettings);
      setSyncStatus((prev) => ({
        ...prev,
        pendingCount: syncInfo.pendingCount,
        lastSyncAt: syncInfo.lastSyncAt,
      }));
      setIsOnline(online);
    } catch (err) {
      console.error('Failed to load initial settings/sync status:', err);
    }
  };

  useEffect(() => {
    refreshStatusAndSettings();

    // Check online status and pending sync count periodically
    const interval = setInterval(async () => {
      try {
        const [syncInfo, online] = await Promise.all([
          posApi.getSyncStatus(),
          posApi.isOnline(),
        ]);
        setSyncStatus((prev) => ({
          ...prev,
          pendingCount: syncInfo.pendingCount,
          lastSyncAt: syncInfo.lastSyncAt,
        }));
        setIsOnline(online);
      } catch {}
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Trigger Google Sheets Sync
  const handleTriggerSync = async () => {
    setSyncStatus((prev) => ({ ...prev, isSyncing: true, lastError: null }));
    try {
      const res = await posApi.syncWithGoogleSheets();
      setSyncStatus({
        pendingCount: res.pendingCount,
        lastSyncAt: res.lastSyncAt,
        isSyncing: false,
        lastError: res.success ? null : res.message,
      });
      if (res.message) {
        alert(res.message);
      }
    } catch (err: any) {
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastError: err.message,
      }));
      alert('Sync error: ' + err.message);
    }
  };

  const handleNavigate = (tab: string, state?: any) => {
    if (tab === 'purchases' && state?.medicine) {
      setSelectedMedicineForRestock(state.medicine);
    } else {
      setSelectedMedicineForRestock(null);
    }

    if (tab === 'billing') {
      setBillingInitialMedicine(state?.addMedicine || null);
      setBillingAutoFocusSearch(!!state?.autoFocusSearch);
    } else {
      setBillingInitialMedicine(null);
      setBillingAutoFocusSearch(false);
    }

    setCurrentTab(tab);
  };

  return (
    <AriaProvider>
      <ShortcutProvider onNavigate={handleNavigate}>
        <AppContent
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          settings={settings}
          setSettings={setSettings}
          syncStatus={syncStatus}
          isOnline={isOnline}
          onTriggerSync={handleTriggerSync}
          selectedMedicineForRestock={selectedMedicineForRestock}
          billingInitialMedicine={billingInitialMedicine}
          billingAutoFocusSearch={billingAutoFocusSearch}
          handleNavigate={handleNavigate}
        />
      </ShortcutProvider>
    </AriaProvider>
  );
};
