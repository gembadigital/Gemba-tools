import React, { useState, useEffect, useCallback } from "react";
import { Home, ClipboardCheck, Settings, ListChecks, Footprints, LayoutDashboard } from "lucide-react";
import { useFactory } from "../../context/FactoryContext";
import {
  FiveSDepartment, FiveSArea, FiveSPersonnel, FiveSQuestion, FiveSAuditHeader,
  FiveSTeamAssignment, FiveSAuditAnswer, FiveSAuditResult, FiveSProblemCategory, GembaWalkFinding
} from "./fiveSTypes";
import FiveSHome from "./FiveSHome";
import FiveSDashboard from "./FiveSDashboard";
import FiveSSetup from "./FiveSSetup";
import FiveSAuditWorkflow from "./FiveSAuditWorkflow";
import FiveSActions from "./FiveSActions";
import FiveSGembaWalk from "./FiveSGembaWalk";

export type FiveSApi = {
  get: (path: string) => Promise<any[]>;
  post: (path: string, body: any) => Promise<any>;
  del: (path: string) => Promise<any>;
};

function makeCrud<T extends { id: string }>(
  api: FiveSApi,
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

export default function FiveSAuditSystem() {
  const { selectedCustomer, globalState } = useFactory();
  const currentUser = globalState?.CurrentUser;
  const token = localStorage.getItem("gemba_token") || "";
  const factoryId = selectedCustomer?.id || "default";

  const [section, setSection] = useState<"home" | "dashboard" | "audits" | "setup" | "actions" | "gembawalk">("home");
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<FiveSDepartment[]>([]);
  const [areas, setAreas] = useState<FiveSArea[]>([]);
  const [personnel, setPersonnel] = useState<FiveSPersonnel[]>([]);
  const [questions, setQuestions] = useState<FiveSQuestion[]>([]);
  const [problemCategories, setProblemCategories] = useState<FiveSProblemCategory[]>([]);
  const [audits, setAudits] = useState<FiveSAuditHeader[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<FiveSTeamAssignment[]>([]);
  const [answers, setAnswers] = useState<FiveSAuditAnswer[]>([]);
  const [results, setResults] = useState<FiveSAuditResult[]>([]);
  const [gembaWalkFindings, setGembaWalkFindings] = useState<GembaWalkFinding[]>([]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const headers = { "Authorization": `Bearer ${token}`, "x-factory-id": factoryId };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const api: FiveSApi = {
    get: async (path: string) => {
      const res = await fetch(`/api/business/five-s/${path}`, { headers }).then(r => r.json());
      return res.success ? res.data : [];
    },
    post: async (path: string, body: any) =>
      fetch(`/api/business/five-s/${path}`, { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) }).then(r => r.json()),
    del: async (path: string) =>
      fetch(`/api/business/five-s/${path}`, { method: "DELETE", headers }).then(r => r.json())
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Fetched first, on its own: the departments endpoint bootstraps a brand-new factory's default
    // 5S question bank server-side (see ensureFiveSDefaults in db.ts) — awaiting it alone first
    // avoids a race where the parallel "questions" fetch below reads before that seeding commits.
    const dep = await api.get("departments");
    const [ar, per, que, cat, aud, team, ans, res, gw] = await Promise.all([
      api.get("areas"), api.get("personnel"), api.get("questions"),
      api.get("problem-categories"), api.get("audits"), api.get("team-assignments"),
      api.get("answers"), api.get("results"), api.get("gemba-walk")
    ]);
    setDepartments(dep); setAreas(ar); setPersonnel(per); setQuestions(que);
    setProblemCategories(cat); setAudits(aud); setTeamAssignments(team);
    setAnswers(ans); setResults(res); setGembaWalkFindings(gw);
    setLoading(false);
    return { dep, ar, per, que, cat };
  }, [factoryId, token]);

  useEffect(() => {
    loadAll();
  }, [factoryId]);

  const departmentsCrud = makeCrud<FiveSDepartment>(api, "departments", setDepartments, showToast);
  const areasCrud = makeCrud<FiveSArea>(api, "areas", setAreas, showToast);
  const personnelCrud = makeCrud<FiveSPersonnel>(api, "personnel", setPersonnel, showToast);
  const questionsCrud = makeCrud<FiveSQuestion>(api, "questions", setQuestions, showToast);
  const problemCategoriesCrud = makeCrud<FiveSProblemCategory>(api, "problem-categories", setProblemCategories, showToast);
  const gembaWalkCrud = makeCrud<GembaWalkFinding>(api, "gemba-walk", setGembaWalkFindings, showToast);
  const answersCrud = makeCrud<FiveSAuditAnswer>(api, "answers", setAnswers, showToast);

  const myPersonnelRecord = personnel.find(p => p.name === currentUser?.full_name || p.email === currentUser?.email);
  const isFiveSAdmin = currentUser?.role === "Admin" || currentUser?.role === "Consultant" || !!myPersonnelRecord?.isAdmin;
  const isAuditor = isFiveSAdmin || !!myPersonnelRecord?.isAuditor;

  const NAV_ITEMS: { key: typeof section; label: string; icon: any; gated?: boolean }[] = [
    { key: "home", label: "Ana Sayfa", icon: Home },
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "audits", label: "5S Denetimleri", icon: ClipboardCheck, gated: !isAuditor },
    { key: "setup", label: "Kurulum", icon: Settings, gated: !isFiveSAdmin },
    { key: "actions", label: "Aksiyon Listesi", icon: ListChecks },
    { key: "gembawalk", label: "Gemba Walk", icon: Footprints }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 font-bold text-sm">
        5S Denetim verileri yükleniyor...
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
          <div className="p-2.5 bg-slate-900 rounded-xl text-white">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">5S Olgunluk Sistemi</p>
            <h2 className="text-lg font-black text-slate-800">5S Audit &amp; Gemba Walk</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (item.gated) {
                    showToast("Bu sayfaya erişim yetkiniz yoktur.");
                    return;
                  }
                  setSection(item.key);
                }}
                className={`py-2 px-3.5 rounded-lg font-black text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer ${
                  section === item.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : item.gated
                      ? "text-slate-300 cursor-not-allowed"
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
        <FiveSHome
          currentUser={currentUser}
          departments={departments}
          areas={areas}
          personnel={personnel}
          audits={audits}
          teamAssignments={teamAssignments}
          answers={answers}
          results={results}
          gembaWalkFindings={gembaWalkFindings}
        />
      )}

      {section === "dashboard" && (
        <FiveSDashboard
          departments={departments}
          areas={areas}
          personnel={personnel}
          audits={audits}
          teamAssignments={teamAssignments}
          answers={answers}
          results={results}
          gembaWalkFindings={gembaWalkFindings}
        />
      )}

      {section === "audits" && (
        <FiveSAuditWorkflow
          currentUser={currentUser}
          isFiveSAdmin={isFiveSAdmin}
          departments={departments}
          areas={areas}
          personnel={personnel}
          questions={questions}
          audits={audits}
          teamAssignments={teamAssignments}
          answers={answers}
          results={results}
          api={api}
          showToast={showToast}
          onReload={loadAll}
          setAudits={setAudits}
          setTeamAssignments={setTeamAssignments}
          setAnswers={setAnswers}
          setResults={setResults}
        />
      )}

      {section === "setup" && (
        <FiveSSetup
          departments={departments}
          areas={areas}
          personnel={personnel}
          questions={questions}
          departmentsCrud={departmentsCrud}
          areasCrud={areasCrud}
          personnelCrud={personnelCrud}
          questionsCrud={questionsCrud}
        />
      )}

      {section === "actions" && (
        <FiveSActions
          departments={departments}
          areas={areas}
          questions={questions}
          audits={audits}
          teamAssignments={teamAssignments}
          answers={answers}
          currentUser={currentUser}
          isFiveSAdmin={isFiveSAdmin}
          answersCrud={answersCrud}
          api={api}
          showToast={showToast}
        />
      )}

      {section === "gembawalk" && (
        <FiveSGembaWalk
          departments={departments}
          areas={areas}
          personnel={personnel}
          problemCategories={problemCategories}
          findings={gembaWalkFindings}
          currentUser={currentUser}
          isFiveSAdmin={isFiveSAdmin}
          gembaWalkCrud={gembaWalkCrud}
          problemCategoriesCrud={problemCategoriesCrud}
          areasCrud={areasCrud}
          api={api}
          showToast={showToast}
        />
      )}
    </div>
  );
}
