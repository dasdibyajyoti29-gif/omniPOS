import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface AriaContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  announcement: string;
  toast: { message: string; type: 'info' | 'success' | 'warning' | 'error' } | null;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const AriaContext = createContext<AriaContextType>({
  announce: () => {},
  announcement: '',
  toast: null,
  showToast: () => {},
});

export const AriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [announcement, setAnnouncement] = useState('');
  const [ariaPriority, setAriaPriority] = useState<'polite' | 'assertive'>('polite');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAriaPriority(priority);
    // Clear and re-set to trigger screen reader announcement if repeated
    setAnnouncement('');
    setTimeout(() => {
      setAnnouncement(message);
    }, 50);
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ message, type });
    announce(message, type === 'error' ? 'assertive' : 'polite');

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, [announce]);

  return (
    <AriaContext.Provider value={{ announce, announcement, toast, showToast }}>
      {children}
      {/* Screen Reader Live Region */}
      <div
        className="sr-only"
        aria-live={ariaPriority}
        aria-atomic="true"
        role="status"
        id="pos-aria-announcer"
      >
        {announcement}
      </div>

      {/* Visual Keyboard Toast / Notification Banner */}
      {toast && (
        <div
          role="alert"
          className={`aria-toast aria-toast-${toast.type}`}
          id="pos-aria-toast"
        >
          <span>{toast.message}</span>
        </div>
      )}
    </AriaContext.Provider>
  );
};

export const useAria = () => useContext(AriaContext);
