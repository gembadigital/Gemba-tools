import React, { useState, useEffect, useCallback } from "react";
import { Home, Plus, ListChecks, Star, BarChart3, Settings } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";
import { KaizenPersonnel, KaizenCriteria, KaizenSuggestion, KaizenApproval, KaizenEvaluation } from "./kaizenTypes";
import { canDecideAsManager, canDecideAsBoard } from "./kaizenCalc";
import KaizenHome from "./KaizenHome";
import KaizenNewSuggestion from "./KaizenNewSuggestion";
import KaizenMySuggestions from "./KaizenMySuggestions";
import KaizenApprovals from "./KaizenApprovals";
import KaizenReports from "./KaizenReports";
import KaizenSetup from "./KaizenSetup";

export type KaizenApi = {
  get: (path: string) => Promise<any[]>;
  post: (path: string, body: any) => Promise<any>;
  del: (path: string) => Promise<any>;
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
  const currentUser = globalState?.CurrentUser;
  const token = localStorage.getItem("gemba_token") || "";
  const factoryId = selectedCustomer?.id || "default";

  const [section, setSection] = useState<"home" | "new" | "mine" | "approvals" | "reports" | "setup">("home");
  const [editingSuggestion, setEditingSuggestion] = useState<KaizenSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  const [personnel, setPersonnel] = useState<KaizenPersonnel[]>([]);
  const [criteria, setCriteria] = useState<KaizenCriteria[]>([]);
  const [suggestions, setSuggestions] = useState<KaizenSuggestion[]>([]);
  const [approvals, setApprovals] = useState<KaizenApproval[]>([]);
  const [evaluations, setEvaluations] = useState<KaizenEvaluation[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const headers = { "Authorization": `Bearer ${token}`, "x-factory-id": factoryId };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const api: KaizenApi = {
    get: async (path: string) => {
      const res = await fetch(`/api/business/kaizen/${path}`, { headers }).then(r => r.json());
      return res.success ? res.data : [];
    },
    post: async (path: string, body: any) =>
      fetch(`/api/business/kaizen/${path}`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) }).then(r => r.json()),
    del: async (path: string) =>
      fetch(`/api/business/kaizen/${path}`, { method: "DELETE", headers }).then(r => r.json())
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [per, cri, sug, apr, evl] = await Promise.all([
      api.get("personnel"), api.get("criteria"), api.get("suggestions"), api.get("approvals"), api.get("evaluations")
    ]);
    setPersonnel(per); setCriteria(cri); setSuggestions(sug); setApprovals(apr); setEvaluations(evl);
    setLoading(false);
  }, [factoryId, token]);

  useEffect(() => {
    loadAll();
  }, [factoryId]);

  const personnelCrud = makeCrud<KaizenPersonnel>(api, "personnel", setPersonnel, showToast);
  const criteriaCrud = makeCrud<KaizenCriteria>(api, "criteria", setCriteria, showToast);

  const myPersonnelRecord = personnel.find(p => (p.email || "").toLowerCase() === (currentUser?.email || "").toLowerCase());
  const isBoardMember = currentUser?.role === "Admin" || currentUser?.role === "Consultant" || !!myPersonnelRecord?.isBoardMember;
  const isTeamLeader = suggestions.some(s => canDecideAsManager(currentUser?.email || "", currentUser?.role || "", s.teamLeaderEmail));
  const canSeeApprovals = isBoardMember || isTeamLeader || currentUser?.role === "Admin" || currentUser?.role === "Consultant";

  const openEdit = (s: KaizenSuggestion) => {
    setEditingSuggestion(s);
    setSection("new");
  };

  const NAV_ITEMS: { key: typeof section; label: string; icon: any }[] = [
    { key: "home", label: "Ana Sayfa", icon: Home },
    { key: "new", label: "Yeni Öneri", icon: Plus },
    { key: "mine", label: "Önerilerim", icon: ListChecks },
    ...(canSeeApprovals ? [{ key: "approvals" as const, label: "Değerlendirmeler", icon: Star }] : []),
    ...(isBoardMember ? [{ key: "reports" as const, label: "Rapor", icon: BarChart3 }] : []),
    ...(currentUser?.role === "Admin" || currentUser?.role === "Consultant" ? [{ key: "setup" as const, label: "Kurulum", icon: Settings }] : [])
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 font-bold text-sm">
        Kaizen öneri verileri yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold max-w-sm">
          {toast}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500 rounded-xl text-white">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kaizen Öneri Sistemi</p>
            <h2 className="text-lg font-black text-slate-800">Öneri Kutusu &amp; Değerlendirme</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (item.key === "new") setEditingSuggestion(null);
                  setSection(item.key);
                }}
                className={`py-2 px-3.5 rounded-lg font-black text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer ${
                  section === item.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {section === "home" && (
        <KaizenHome
          currentUser={currentUser}
          suggestions={suggestions}
          evaluations={evaluations}
          onNewSuggestion={() => { setEditingSuggestion(null); setSection("new"); }}
          onShowMine={() => setSection("mine")}
          onShowApprovals={() => setSection("approvals")}
          canSeeApprovals={canSeeApprovals}
        />
      )}

      {section === "new" && (
        <KaizenNewSuggestion
          currentUser={currentUser}
          personnel={personnel}
          editingSuggestion={editingSuggestion}
          api={api}
          showToast={showToast}
          onSaved={(s) => {
            setSuggestions(prev => {
              const idx = prev.findIndex(r => r.id === s.id);
              if (idx !== -1) { const copy = [...prev]; copy[idx] = s; return copy; }
              return [...prev, s];
            });
            setEditingSuggestion(null);
            setSection("mine");
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
        />
      )}

      {section === "reports" && isBoardMember && (
        <KaizenReports suggestions={suggestions} evaluations={evaluations} personnel={personnel} api={api} />
      )}

      {section === "setup" && (currentUser?.role === "Admin" || currentUser?.role === "Consultant") && (
        <KaizenSetup
          personnel={personnel}
          criteria={criteria}
          personnelCrud={personnelCrud}
          criteriaCrud={criteriaCrud}
        />
      )}
    </div>
  );
}
