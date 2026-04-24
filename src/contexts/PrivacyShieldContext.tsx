import React, { createContext, useContext, useState, useCallback } from "react";

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
}

const PrivacyShieldContext = createContext<PrivacyShieldContextType | null>(null);

const SHIELD_PASSWORD = "Bliss@3040";

export const PrivacyShieldProvider = ({ children }: { children: React.ReactNode }) => {
  // Start SHIELDED — data is hidden by default
  const [isShielded, setIsShielded] = useState(true);
  const [isDialogOpen, setDialogOpen] = useState(false);

  const requestUnlock = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const lock = useCallback(() => {
    setIsShielded(true);
  }, []);

  const tryUnlock = useCallback((password: string): boolean => {
    if (password === SHIELD_PASSWORD) {
      setIsShielded(false);
      setDialogOpen(false);
      return true;
    }
    return false;
  }, []);

  return (
    <PrivacyShieldContext.Provider value={{ isShielded, requestUnlock, lock, isDialogOpen, setDialogOpen, tryUnlock }}>
      {children}
    </PrivacyShieldContext.Provider>
  );
};

export const usePrivacyShield = () => {
  const ctx = useContext(PrivacyShieldContext);
  if (!ctx) throw new Error("usePrivacyShield must be used within PrivacyShieldProvider");
  return ctx;
};
