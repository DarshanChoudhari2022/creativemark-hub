import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface PrivacyShieldContextType {
  /** true = data is HIDDEN (shield is ON) */
  isShielded: boolean;
  /** Call to show the password dialog */
  requestUnlock: () => void;
  /** Lock data again */
  lock: () => void;
  /** Password dialog state */
  isDialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  /** Attempt to unlock with password */
  tryUnlock: (password: string) => boolean;
  /** Helper to gate an action with the shield password */
  withShield: (action: () => void) => void;
}

const PrivacyShieldContext = createContext<PrivacyShieldContextType | null>(null);

const SHIELD_PASSWORD = "Bliss@3040";

export const PrivacyShieldProvider = ({ children }: { children: React.ReactNode }) => {
  // Start SHIELDED — data is hidden by default, but check session storage
  const [isShielded, setIsShielded] = useState(() => {
    try {
      const saved = sessionStorage.getItem("privacy_shield_unlocked");
      return saved !== "true";
    } catch (e) {
      return true;
    }
  });
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestUnlock = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const withShield = useCallback((action: () => void) => {
    if (!isShielded) {
      action();
    } else {
      setPendingAction(() => action);
      setDialogOpen(true);
    }
  }, [isShielded]);

  const lock = useCallback(() => {
    setIsShielded(true);
    sessionStorage.removeItem("privacy_shield_unlocked");
  }, []);

  const tryUnlock = useCallback((password: string): boolean => {
    if (password === SHIELD_PASSWORD) {
      setIsShielded(false);
      sessionStorage.setItem("privacy_shield_unlocked", "true");
      setDialogOpen(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    }
    return false;
  }, [pendingAction]);

  // Sync state if session storage changes (e.g. in another tab, though unlikely for sessionStorage)
  useEffect(() => {
    const checkShield = () => {
      const saved = sessionStorage.getItem("privacy_shield_unlocked");
      setIsShielded(saved !== "true");
    };
    window.addEventListener('storage', checkShield);
    return () => window.removeEventListener('storage', checkShield);
  }, []);

  return (
    <PrivacyShieldContext.Provider value={{ isShielded, requestUnlock, lock, isDialogOpen, setDialogOpen, tryUnlock, withShield }}>
      {children}
    </PrivacyShieldContext.Provider>
  );
};

export const usePrivacyShield = () => {
  const ctx = useContext(PrivacyShieldContext);
  if (!ctx) throw new Error("usePrivacyShield must be used within PrivacyShieldProvider");
  return ctx;
};
