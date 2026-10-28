// Loads the CI settings of a customer (GET /api/business/ci/settings). Until the request answers —
// or when it fails — the defaults are used, which equal the behavior before settings existed.
import { useEffect, useState } from "react";
import { CiSettings, DEFAULT_CI_SETTINGS, normalizeCiSettings } from "../../utils/ciSettings";

export const ciAuthToken = () => localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";

export function useCiSettings(customerId: string | undefined) {
  const [settings, setSettings] = useState<CiSettings>(DEFAULT_CI_SETTINGS);

  useEffect(() => {
    setSettings(DEFAULT_CI_SETTINGS);
    if (!customerId) return;
    let cancelled = false;
    fetch("/api/business/ci/settings", {
      headers: { Authorization: `Bearer ${ciAuthToken()}`, "x-factory-id": customerId }
    })
      .then(r => r.json())
      .then(res => { if (!cancelled && res.success) setSettings(normalizeCiSettings(res.data)); })
      .catch(err => console.error("CI settings could not be loaded; using defaults", err));
    return () => { cancelled = true; };
  }, [customerId]);

  // Saves and, on success, makes the saved (server-normalized) settings current.
  const save = async (next: CiSettings): Promise<{ ok: boolean; error?: string }> => {
    if (!customerId) return { ok: false, error: "Müşteri seçili değil." };
    try {
      const res = await fetch("/api/business/ci/settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${ciAuthToken()}`, "x-factory-id": customerId, "Content-Type": "application/json" },
        body: JSON.stringify(next)
      }).then(r => r.json());
      if (!res.success) return { ok: false, error: res.error || "Ayarlar kaydedilemedi." };
      setSettings(normalizeCiSettings(res.data));
      return { ok: true };
    } catch {
      return { ok: false, error: "Sunucuya ulaşılamadı." };
    }
  };

  return { settings, save };
}
