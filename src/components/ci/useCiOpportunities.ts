// Loads the CI opportunity pool of a customer (GET /api/business/ci/opportunities, plan step C5).
// One-time bridge: if the server has no Loss Capacity matrix yet but this browser still holds one
// (the Loss Analysis screen used to keep it only locally), it is uploaded first so it joins the pool.
import { useCallback, useEffect, useState } from "react";
import type { CiOpportunity } from "../../utils/ciOpportunityPool";
import { ciAuthToken } from "./useCiSettings";

export interface CiOpportunityPool {
  items: CiOpportunity[];
  lossProductFamily: { name: string | null; ratio: number; updatedAt: string | null } | null;
}

const EMPTY: CiOpportunityPool = { items: [], lossProductFamily: null };

export function useCiOpportunities(customerId: string | undefined, enabled = true) {
  const [pool, setPool] = useState<CiOpportunityPool>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${ciAuthToken()}`, "x-factory-id": customerId, "Content-Type": "application/json" };
    try {
      let res = await fetch("/api/business/ci/opportunities", { headers }).then(r => r.json());
      if (res.success && !res.data.lossProductFamily) {
        let local: any = null;
        try { local = JSON.parse(localStorage.getItem(`gemba_loss_capacity_${customerId}`) || "null"); } catch { /* ignore */ }
        if (local && Array.isArray(local.recoveryMatrixData) && local.recoveryMatrixData.length) {
          const up = await fetch("/api/business/ci/loss-snapshot", {
            method: "POST", headers,
            body: JSON.stringify({ recoveryMatrixData: local.recoveryMatrixData, productFamilyName: local.productFamilyName, productFamilyRatio: local.productFamilyRatio, updatedAt: local.updatedAt })
          });
          if (up.ok) res = await fetch("/api/business/ci/opportunities", { headers }).then(r => r.json());
        }
      }
      if (res.success) setPool(res.data);
      else setError(res.error || "Fırsat havuzu yüklenemedi.");
    } catch {
      setError("Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { setPool(EMPTY); if (enabled) load(); }, [load, enabled]);

  return { pool, loading, error, reload: load };
}
