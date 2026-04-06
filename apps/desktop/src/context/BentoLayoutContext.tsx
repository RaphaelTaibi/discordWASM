import React, { createContext, useContext, useState, useCallback } from "react";
import type { LayoutWindow, LayoutBatchUpdate, BentoLayoutContextValue } from "../models/layout.model";

const BentoLayoutContext = createContext<BentoLayoutContextValue | undefined>(undefined);

/**
 * Provider for BentoLayoutContext.
 * @param children React children
 */
export const BentoLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<LayoutWindow[]>([]);

  /**
   * Updates the layout with a batch update from Rust.
   * @param batch Batch update from Rust
   */
  const updateBatch = useCallback((batch: LayoutBatchUpdate) => {
    setWindows(batch.windows);
  }, []);

  return (
    <BentoLayoutContext.Provider value={{ windows, setWindows, updateBatch }}>
      {children}
    </BentoLayoutContext.Provider>
  );
};

/**
 * Hook to access the BentoLayoutContext.
 * @returns Context value
 */
export function useBentoLayoutContext(): BentoLayoutContextValue {
  const ctx = useContext(BentoLayoutContext);
  if (!ctx) throw new Error("useBentoLayoutContext must be used within a BentoLayoutProvider");
  return ctx;
}
