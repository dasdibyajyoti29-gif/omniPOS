import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type ShortcutHandler = () => boolean | void;

interface ShortcutContextType {
  registerAction: (actionKey: string, handler: ShortcutHandler) => () => void;
  openShortcutsHelp: () => void;
  closeShortcutsHelp: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  isShortcutsHelpOpen: boolean;
  isCommandPaletteOpen: boolean;
}

const ShortcutContext = createContext<ShortcutContextType>({
  registerAction: () => () => {},
  openShortcutsHelp: () => {},
  closeShortcutsHelp: () => {},
  openCommandPalette: () => {},
  closeCommandPalette: () => {},
  isShortcutsHelpOpen: false,
  isCommandPaletteOpen: false,
});

interface ShortcutProviderProps {
  children: React.ReactNode;
  onNavigate: (tab: string, state?: any) => void;
}

export const ShortcutProvider: React.FC<ShortcutProviderProps> = ({ children, onNavigate }) => {
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const registeredHandlersRef = useRef<Map<string, ShortcutHandler>>(new Map());

  const registerAction = useCallback((actionKey: string, handler: ShortcutHandler) => {
    registeredHandlersRef.current.set(actionKey, handler);
    return () => {
      if (registeredHandlersRef.current.get(actionKey) === handler) {
        registeredHandlersRef.current.delete(actionKey);
      }
    };
  }, []);

  const openShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(true), []);
  const closeShortcutsHelp = useCallback(() => setIsShortcutsHelpOpen(false), []);
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInputElement =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 1. Ctrl / Cmd + K: Open Command Palette
      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. Ctrl / Cmd + S: Save current draft/form
      if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        const saveHandler = registeredHandlersRef.current.get('save');
        if (saveHandler) {
          saveHandler();
        }
        return;
      }

      // 3. Ctrl / Cmd + P: Print current invoice/receipt
      if (isCmdOrCtrl && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        const printHandler = registeredHandlersRef.current.get('print');
        if (printHandler) {
          printHandler();
        }
        return;
      }

      // Function keys & Global navigation
      // F1: Help
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        setIsShortcutsHelpOpen((prev) => !prev);
        return;
      }

      // F2: Open POS Fast Billing
      if (e.key === 'F2') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate('billing');
        return;
      }

      // F3: Focus Medicine Search or Barcode
      if (e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        const f3Handler = registeredHandlersRef.current.get('focusSearch');
        if (f3Handler) {
          f3Handler();
        } else {
          // If not handled on current page, switch to billing and trigger search focus
          onNavigate('billing', { autoFocusSearch: true });
        }
        return;
      }

      // F4: Focus Quantity field for selected item
      if (e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        const f4Handler = registeredHandlersRef.current.get('focusQuantity');
        if (f4Handler) {
          f4Handler();
        }
        return;
      }

      // F5: Open Purchase screen (CRITICAL: preventDefault to stop browser reload)
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate('purchases');
        return;
      }

      // F6: Open Inventory
      if (e.key === 'F6') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate('inventory');
        return;
      }

      // F7: Open Sales History
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate('sales');
        return;
      }

      // F8: Initiate checkout when cart is valid
      if (e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        const f8Handler = registeredHandlersRef.current.get('checkout');
        if (f8Handler) {
          f8Handler();
        }
        return;
      }

      // F9: Open Dashboard
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        onNavigate('dashboard');
        return;
      }

      // Escape: Close active overlays
      if (e.key === 'Escape') {
        if (isShortcutsHelpOpen) {
          e.preventDefault();
          setIsShortcutsHelpOpen(false);
          return;
        }
        if (isCommandPaletteOpen) {
          e.preventDefault();
          setIsCommandPaletteOpen(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, isShortcutsHelpOpen, isCommandPaletteOpen]);

  return (
    <ShortcutContext.Provider
      value={{
        registerAction,
        openShortcutsHelp,
        closeShortcutsHelp,
        openCommandPalette,
        closeCommandPalette,
        isShortcutsHelpOpen,
        isCommandPaletteOpen,
      }}
    >
      {children}
    </ShortcutContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutContext);
