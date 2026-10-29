// Shares one useVsmWorkspace() instance with the VSM tab components.
import { createContext, useContext } from "react";
import type { VsmWorkspace } from "./useVsmWorkspace";

export const VsmContext = createContext<VsmWorkspace | null>(null);

export function useVsm(): VsmWorkspace {
  const ctx = useContext(VsmContext);
  if (!ctx) throw new Error("useVsm must be used inside <VsmContext.Provider>");
  return ctx;
}
