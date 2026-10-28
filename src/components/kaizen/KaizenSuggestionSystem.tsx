import React, { useState, useEffect, useCallback } from "react";
import { Home, Plus, ListChecks, Star, BarChart3, Settings, Hammer, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";
import { KaizenPersonnel, KaizenCriteria, KaizenSuggestion, KaizenApproval, KaizenEvaluation, KaizenImplementation as KaizenImpl } from "./kaizenTypes";
import { canDecideAsManager } from "./kaizenCalc";
import KaizenHome from "./KaizenHome";
import KaizenNewSuggestion from "./KaizenNewSuggestion";
import KaizenMySuggestions from "./KaizenMySuggestions";
import KaizenApprovals from "./KaizenApprovals";
import KaizenReports from "./KaizenReports";
import KaizenSetup from "./KaizenSetup";
import KaizenImplementation from "./KaizenImplementation";
import { daysWaiting } from "./kaizenCalc";
import { KaizenSettings, DEFAULT_KAIZEN_SETTINGS, normalizeKaizenSettings } from "../../utils/kaizenSettings";
import { getAuthToken } from "../../utils/authToken";
import { buildOrg, subordinateIds } from "../../utils/kaizenOrg";

export type KaizenApi = {
  get: (path: string) => Promise<any[]>;
  one: (path: string) => Promise<any | null>; // single full record (e.g. with photos), null on failure
  post: (path: string, body: any) => Promise<any>;
  del: (path: string) => Promise<any>;
  download: (path: string, filename: string) => Promise<void>;
};

function makeCrud<T extends { id: string }>(
  api: KaizenApi,
  path: string,
  setState: React.Dispatch<React.SetStateAction<T[]>>,
  showToast: (msg: string) => void
) {
  return {
    save: async (record: Partial<T> & { id?: string }) => {
      const res = await api.post(path, record);
      if (res.success) {
        setState(prev => {
          const idx = prev.findIndex(r => r.id === res.data.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = res.data;
            return copy;
          }
          return [...prev, res.data];
        });
      } else {
        showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
      }
      return res;
    },
    remove: async (id: string) => {
      const res = await api.del(`${path}/${id}`);
      if (res.success) {
        setState(prev => prev.filter(r => r.id !== id));
      } else {
        showToast(`Hata: ${res.error || "Silinemedi."}`);
      }
      return res;
    }
  };
}

export default function KaizenSuggestionSystem() {
  const { selectedCustomer, globalState } = useFactory();
  const appUser = globalState?.CurrentUser;
  const factoryId = selectedCustomer?.id || "default";

  const [section, setSection] = useState<"home" | "new" | "mine" | "approvals" | "impl" | "reports" | "setup">("home");
  const [editingSuggestion, setEditingSuggestion] = useState<KaizenSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  const [personnel, setPersonnel] = useState<KaizenPersonnel[]>([]);
  const [criteria, setCriteria] = useState<KaizenCriteria[]>([]);
  const [suggestions, setSuggestions] = useState<KaizenSuggestion[]>([]);
  const [approvals, setApprovals] = useState<KaizenApproval[]>([]);
  const [evaluations, setEvaluations] = useState<KaizenEvaluation[]>([]);
  const [implementations, setImplementations] = useState<KaizenImpl[]>([]);
  const [settings, setSettings] = useState<KaizenSettings>(DEFAULT_KAIZEN_SETTINGS);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    // Errors stay longer — they usually ask the user to do something.
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), /^hata|oturum/i.test(msg) ? 9000 : 3500);
  }, []);

  // Token is read per request (it may be in sessionStorage, and may be renewed by a new login).
  const headers = () => ({ "Authorization": `Bearer ${getAuthToken()}`, "x-factory-id": factoryId });
  const jsonHeaders = () => ({ ...headers(), "Content-Type": "application/json" });
  // An expired session gets a clear Turkish message; the caller keeps its form state, so nothing typed is lost.
  const SESSION_ERROR = "Oturumunuz sona erdi. Girdiğiniz bilgiler kaybolmadı; yeni sekmede tekrar giriş yapıp bu sayfaya dönerek yeniden gönderebilirsiniz.";
  const toJson = async (r: Response) => {
    if (r.status === 401) return { success: false, error: SESSION_ERROR, sessionExpired: true };
    try { return await r.json(); } catch { return { success: false, error: `Sunucu hatası (HTTP ${r.status}).` }; }
  };

  const api: KaizenApi = {
    get: async (path: string) => {
      const res = await fetch(`/api/business/kaizen/${path}`, { headers: headers() }).then(toJson);
      if (res.sessionExpired) showToast(SESSION_ERROR);
      return res.success ? res.data : [];
    },
    one: async (path: string) => {
      const res = await fetch(`/api/business/kaizen/${path}`, { headers: headers() }).then(toJson);
      if (res.sessionExpired) showToast(SESSION_ERROR);
      return res.success ? res.data : null;
    },
    post: async (path: string, body: any) =>
      fetch(`/api/business/kaizen/${path}`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(body) }).then(toJson),
    del: async (path: string) =>
      fetch(`/api/business/kaizen/${path}`, { method: "DELETE", headers: headers() }).then(toJson),
    // Authenticated file download: a plain <a href> cannot send the Bearer token.
    download: async (path: string, filename: string) => {
      const res = await fetch(`/api/business/kaizen/${path}`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [per, cri, sug, apr, evl, imp, set] = await Promise.all([
      api.get("personnel"), api.get("criteria"), api.get("suggestions"), api.get("approvals"), api.get("evaluations"), api.get("implementations"),
      api.get("settings")
    ]);
    setPersonnel(per); setCriteria(cri); setSuggestions(sug); setApprovals(apr); setEvaluations(evl); setImplementations(imp);
    setSettings(normalizeKaizenSettings(set));
    setLoading(false);
  }, [factoryId]);

  useEffect(() => {
    loadAll();
  }, [factoryId]);

  const saveSettings = async (next: KaizenSettings) => {
    const res = await api.post("settings", next);
    if (res.success) {
      setSettings(normalizeKaizenSettings(res.data));
      showToast("Ayarlar kaydedildi.");
    } else {
      showToast(`Hata: ${res.error || "Kaydedilemedi."}`);
    }
    return res;
  };

  const personnelCrud = makeCrud<KaizenPersonnel>(api, "personnel", setPersonnel, showToast);
  const criteriaCrud = makeCrud<KaizenCriteria>(api, "criteria", setCriteria, showToast);

  const myPersonnelRecord = personnel.find(p => (p.email || "").toLowerCase() === (appUser?.email || "").toLowerCase());
  // Kurul Yöneticisi (Faz 3.3): inside this module a personnel record flagged isBoardAdmin acts with
  // Admin powers (the server enforces the same rule). Screens below receive this Kaizen-effective
  // user, so their existing Admin/Consultant checks cover the Kurul Yöneticisi too.
  const isStaffUser = appUser?.role === "Admin" || appUser?.role === "Consultant";
  const isKaizenAdmin = isStaffUser || !!myPersonnelRecord?.isBoardAdmin;
  const currentUser = React.useMemo(
    () => (appUser && isKaizenAdmin && !isStaffUser ? { ...appUser, role: "Admin", kaizenRole: "Kurul Yöneticisi" } : appUser),
    [appUser, isKaizenAdmin, isStaffUser]
  );
  const isBoardMember = isKaizenAdmin || !!myPersonnelRecord?.isBoardMember;
  // My whole team at any depth (Faz 3.1): a hat yöneticisi also sees the takım liderleri's teams.
  const org = React.useMemo(() => buildOrg(personnel), [personnel]);
  const myTeamIds = React.useMemo(() => (myPersonnelRecord ? subordinateIds(myPersonnelRecord.id, org) : new Set<string>()), [myPersonnelRecord?.id, org]);
  const isTeamLeader = myTeamIds.size > 0 || suggestions.some(s => canDecideAsManager(currentUser?.email || "", currentUser?.role || "", s.teamLeaderEmail));
  const canSeeApprovals = isBoardMember || isTeamLeader || currentUser?.role === "Admin" || currentUser?.role === "Consultant";

  // Queue sizes drive the nav badge and the Home to-do card.
  const managerQueue = suggestions.filter(s => s.approvalStatus === "Pending" && canDecideAsManager(currentUser?.email || "", currentUser?.role || "", s.teamLeaderEmail));
  const boardQueue = isBoardMember ? suggestions.filter(s => s.approvalStatus === "First Approval") : [];
  const managerApprovalDate = new Map<string, string>();
  approvals.filter(a => a.stage === "Manager" && a.approved).forEach(a => managerApprovalDate.set(a.suggestionId, a.createdAt));
  const oldestWaitingDays = Math.max(
    0,
    ...managerQueue.map(s => daysWaiting(s.createdAt)),
    ...boardQueue.map(s => daysWaiting(managerApprovalDate.get(s.id) || s.createdAt))
  );
  const approvalsBadge = managerQueue.length + boardQueue.length;

  // Lists carry no photos (Faz 3.4): editing must start from the full record, or resubmitting
  // would drop the photos.
  const openEdit = async (s: KaizenSuggestion) => {
    const full = await api.one(`suggestions/${s.id}`);
    if (!full) { showToast("Hata: Öneri yüklenemedi."); return; }
    setEditingSuggestion(full);
    setSection("new");
  };

  const NAV_ITEMS: { key: typeof section; label: string; icon: any; badge?: number }[] = [
    { key: "home", label: "Ana Sayfa", icon: Home },
    { key: "new", label: "Yeni Öneri", icon: Plus },
    { key: "mine", label: "Önerilerim", icon: ListChecks },
    ...(canSeeApprovals ? [{ key: "approvals" as const, label: "Değerlendirmeler", icon: Star, badge: approvalsBadge }] : []),
    { key: "impl", label: "Uygulama", icon: Hammer },
    ...(isBoardMember ? [{ key: "reports" as const, label: "Rapor", icon: BarChart3 }] : []),
    ...(isKaizenAdmin ? [{ key: "setup" as const, label: "Kurulum", icon: Settings }] : [])
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Kaizen öneri verileri yükleniyor">
        <div className="h-14 rounded-2xl bg-slate-200/70" />
        <div className="h-56 rounded-3xl bg-slate-200/70" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-200/60" />)}</div>
      </div>
    );
  }

  const isError = !!toast && /^hata|oturum/i.test(toast);

  return (
    <div className="space-y-6 font-sans w-full">
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 left-6 sm:left-auto z-50 sm:max-w-md animate-toast-in">
          <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 shadow-2xl ring-1 backdrop-blur ${isError ? "bg-white ring-red-200 text-slate-800" : "bg-slate-900/95 ring-white/10 text-white"}`}>
            {isError ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            <p className="text-sm font-medium flex-1">{toast.replace(/^Hata:\s*/, "")}</p>
            <button onClick={() => setToast(null)} aria-label="Kapat" className={`shrink-0 -mr-1 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${isError ? "text-slate-400 hover:bg-slate-100" : "text-white/60 hover:bg-white/10"}`}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Module bar: identity + section navigation (scrolls horizontally on phones) */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2 bg-gradient-to-b from-[#fafafa] via-[#fafafa]/95 to-[#fafafa]/0">
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur rounded-2xl ring-1 ring-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)] p-1.5 pl-3">
          <div className="hidden sm:flex items-center gap-2.5 pr-3 mr-1 border-r border-slate-200 shrink-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-600/30"><Star className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-slate-900 whitespace-nowrap">Kaizen Öneri</span>
          </div>
          <nav aria-label="Kaizen bölümleri" className="flex-1 min-w-0 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (item.key === "new") setEditingSuggestion(null);
                    setSection(item.key);
                  }}
                  className={`relative shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                    active
                      ? item.key === "new" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-900 text-white shadow-sm"
                      : item.key === "new" ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center tabular-nums ${active ? "bg-white text-slate-900" : "bg-red-500 text-white"}`}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {section === "home" && (
        <KaizenHome
          currentUser={currentUser}
          personnelRecord={myPersonnelRecord}
          suggestions={suggestions}
          evaluations={evaluations}
          managerQueueCount={managerQueue.length}
          boardQueueCount={boardQueue.length}
          oldestWaitingDays={oldestWaitingDays}
          waitingWarningDays={settings.waitingWarningDays}
          waitingOverdueDays={settings.waitingOverdueDays}
          onNewSuggestion={() => { setEditingSuggestion(null); setSection("new"); }}
          onShowMine={() => setSection("mine")}
          onShowApprovals={() => setSection("approvals")}
          onShowImplementation={() => setSection("impl")}
          onEditSuggestion={openEdit}
          canSeeApprovals={canSeeApprovals}
          api={api}
        />
      )}

      {section === "new" && (
        <KaizenNewSuggestion
          currentUser={currentUser}
          personnel={personnel}
          editingSuggestion={editingSuggestion}
          teamIds={myTeamIds}
          api={api}
          showToast={showToast}
          settings={settings}
          onSaved={(s, stay) => {
            setSuggestions(prev => {
              const idx = prev.findIndex(r => r.id === s.id);
              if (idx !== -1) { const copy = [...prev]; copy[idx] = s; return copy; }
              return [...prev, s];
            });
            setEditingSuggestion(null);
            if (!stay) setSection("mine");
          }}
        />
      )}

      {section === "mine" && (
        <KaizenMySuggestions
          currentUser={currentUser}
          suggestions={suggestions}
          approvals={approvals}
          evaluations={evaluations}
          onEdit={openEdit}
          api={api}
          showToast={showToast}
          onReload={loadAll}
          settings={settings}
          personnel={personnel}
          teamIds={myTeamIds}
        />
      )}

      {section === "approvals" && canSeeApprovals && (
        <KaizenApprovals
          currentUser={currentUser}
          suggestions={suggestions}
          approvals={approvals}
          evaluations={evaluations}
          criteria={criteria}
          isBoardMember={isBoardMember}
          api={api}
          showToast={showToast}
          onReload={loadAll}
          settings={settings}
        />
      )}

      {section === "impl" && (
        <KaizenImplementation
          currentUser={currentUser}
          suggestions={suggestions}
          implementations={implementations}
          evaluations={evaluations}
          personnel={personnel}
          isBoardMember={isBoardMember}
          api={api}
          showToast={showToast}
          onSaved={(i) => setImplementations(prev => {
            const idx = prev.findIndex(r => r.id === i.id);
            if (idx !== -1) { const copy = [...prev]; copy[idx] = i; return copy; }
            return [...prev, i];
          })}
          onReload={loadAll}
          companyName={selectedCustomer?.companyName}
          settings={settings}
        />
      )}

      {section === "reports" && isBoardMember && (
        <KaizenReports suggestions={suggestions} evaluations={evaluations} personnel={personnel} implementations={implementations} api={api} settings={settings} />
      )}

      {section === "setup" && isKaizenAdmin && (
        <KaizenSetup
          canGrantBoardAdmin={isStaffUser}
          api={api}
          showToast={showToast}
          personnel={personnel}
          criteria={criteria}
          personnelCrud={personnelCrud}
          criteriaCrud={criteriaCrud}
          settings={settings}
          onSaveSettings={saveSettings}
          onPersonnelChanged={async () => setPersonnel(await api.get("personnel"))}
        />
      )}
    </div>
  );
}

// Loads the full record (with photos) for a list item; `data` stays undefined until it arrives.
export function useFullRecord<T>(api: KaizenApi, path: string | null): { data: T | undefined; loading: boolean } {
  const [state, setState] = useState<{ path: string | null; data: T | undefined }>({ path: null, data: undefined });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    api.one(path).then(d => { if (alive) setState({ path, data: d ?? undefined }); });
    return () => { alive = false; };
  }, [path]);
  const ready = !!path && state.path === path;
  return { data: ready ? state.data : undefined, loading: !!path && !ready };
}
