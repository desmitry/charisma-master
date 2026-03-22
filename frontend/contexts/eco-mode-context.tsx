"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type EcoModeContextType = {
  isEcoMode: boolean;
  toggleEcoMode: () => void;
};

const EcoModeContext = createContext<EcoModeContextType | null>(null);

export function EcoModeProvider({ children }: { children: ReactNode }) {
  const [isEcoMode, setIsEcoMode] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("eco_mode") === "false") {
      setIsEcoMode(false);
    }
  }, []);

  const toggleEcoMode = useCallback(() => {
    setIsEcoMode((prev) => !prev);
  }, []);

  return (
    <EcoModeContext.Provider value={{ isEcoMode, toggleEcoMode }}>
      {children}
    </EcoModeContext.Provider>
  );
}

export function useEcoMode() {
  const context = useContext(EcoModeContext);
  if (!context) {
    throw new Error("useEcoMode должен использоваться внутри EcoModeProvider");
  }
  return context;
}



