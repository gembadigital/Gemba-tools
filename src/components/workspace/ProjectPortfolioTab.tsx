import React, { useState, useEffect, useMemo } from "react";
import { CompanyWorkspaceExtended, ProjectPortfolioItem } from "../../types/workspace";
import { Plus, Briefcase, Calendar, CheckCircle2, AlertCircle, Trash2, Edit, RefreshCw, Zap, GitCommit } from "lucide-react";

interface ProjectPortfolioTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateProjects: (projects: ProjectPortfolioItem[]) => void;
}

export default function ProjectPortfolioTab({ workspace, onUpdateProjects }: ProjectPortfolioTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [objective, setObjective] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ProjectPortfolioItem["status"]>("Planned");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("₺");
  const [roiPercent, setRoiPercent] = useState("");
  const [projectManager, setProjectManager] = useState("");

  // Sync projects from the real CI/Kaizen and VSM backend collections (previously this read from
  // localStorage keys — gemba_kaizens/gemba_vsms/vsm_maps/etc. — that are never written anywhere;
  // both modules persist to the backend, not localStorage, so the sync silently did nothing).
  const [liveKaizens, setLiveKaizens] = useState<any[]>([]);
  const [liveVsmProjects, setLiveVsmProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!workspace.customerId) return;
    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
    const headers = { "Authorization": `Bearer ${token}`, "x-factory-id": workspace.customerId };

    fetch("/api/business/kaizens", { headers })
      .then(r => r.json())
      .then(d => { if (d.success) setLiveKaizens(d.data); })
      .catch(() => {});

    fetch("/api/business/vsm-projects", { headers })
      .then(r => r.json())
      .then(d => { if (d.success) setLiveVsmProjects(d.data); })
      .catch(() => {});
  }, [workspace.customerId]);

  const allProjects = useMemo(() => {
    // 1. Existing manually saved projects (filtered from old mock dummy items)
    const existingFiltered = (workspace.projects || []).filter(
      p => !p.id.startsWith("dummy_") && !p.id.startsWith("mock_")
    );

    // 2. Real CI/Kaizen projects
    const ciProjects: ProjectPortfolioItem[] = liveKaizens
      .filter((k: any) => k.title)
      .map((k: any) => ({
        id: `ci_${k.id}`,
        name: k.title,
        code: `KZN-${k.id?.slice(-4) || "01"}`,
        objective: k.problemDefinition || k.description || "CI / Kaizen İyileştirme Çalışması",
        startDate: k.dateProposed || new Date().toISOString().split("T")[0],
        endDate: k.plannedFinishDate || k.realizedFinishDate || "",
        status: k.status === "Completed" ? "Completed" : (k.status === "In Progress" ? "Active" : "Planned"),
        budget: k.estimatedCost || 0,
        currency: "₺",
        roiPercent: k.estimatedCost > 0 ? Math.round(((k.actualSavings || k.expectedGain || 0) / k.estimatedCost) * 100) : 0,
        projectManager: k.projectLeader || k.originator || "Kaizen Ekibi",
        sourceModule: "CI" as const
      }));

    // 3. Real VSM projects
    const vsmProjects: ProjectPortfolioItem[] = liveVsmProjects
      .filter((v: any) => v.name)
      .map((v: any) => ({
        id: `vsm_${v.id}`,
        name: v.name,
        code: `VSM-${v.id?.slice(-4) || "01"}`,
        objective: v.description || "Değer Akış Haritalama ve Akış İyileştirme Projesi",
        startDate: v.startDate || v.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        endDate: v.targetDate || "",
        status: v.status === "Tamamlandı" ? "Completed" : "Active",
        budget: 0,
        currency: "₺",
        roiPercent: 0,
        projectManager: v.leader || "VSM Ekip Lideri",
        sourceModule: "VSM" as const
      }));

    // Deduplicate by code/id
    const combinedMap = new Map<string, ProjectPortfolioItem>();
    existingFiltered.forEach(p => combinedMap.set(p.id, p));
    ciProjects.forEach(p => combinedMap.set(p.id, p));
    vsmProjects.forEach(p => combinedMap.set(p.id, p));

    return Array.from(combinedMap.values());
  }, [workspace.projects, liveKaizens, liveVsmProjects]);

  const handleOpenAddForm = () => {
    setEditingId(null);
    setName("");
    setCode("PRJ-OPEX-" + Math.floor(Math.random() * 100));
    setObjective("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setStatus("Planned");
    setBudget("");
    setRoiPercent("");
    setProjectManager("");
    setShowForm(true);
  };

  const handleOpenEditForm = (prj: ProjectPortfolioItem) => {
    setEditingId(prj.id);
    setName(prj.name);
    setCode(prj.code);
    setObjective(prj.objective);
    setStartDate(prj.startDate);
    setEndDate(prj.endDate);
    setStatus(prj.status);
    setBudget(prj.budget.toString());
    setCurrency(prj.currency);
    setRoiPercent(prj.roiPercent.toString());
    setProjectManager(prj.projectManager);
    setShowForm(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    const prjData: ProjectPortfolioItem = {
      id: editingId || "prj_" + Math.random().toString(36).substring(2, 9),
      name,
      code,
      objective,
      startDate,
      endDate,
      status,
      budget: parseFloat(budget) || 0,
      currency,
      roiPercent: parseFloat(roiPercent) || 0,
      projectManager,
      sourceModule: "Manual"
    };

    let updatedList: ProjectPortfolioItem[];
    if (editingId) {
      updatedList = allProjects.map((p) => (p.id === editingId ? prjData : p));
    } else {
      updatedList = [...allProjects, prjData];
    }

    onUpdateProjects(updatedList);
    setShowForm(false);
    setEditingId(null);
  };

  const handleDeleteProject = (id: string) => {
    onUpdateProjects(allProjects.filter((p) => p.id !== id));
  };

  const getStatusBadgeClass = (s: ProjectPortfolioItem["status"]) => {
    switch (s) {
      case "Completed":
        return "bg-green-50 text-green-700 border-green-100";
      case "Active":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "Delayed":
        return "bg-red-50 text-red-700 border-red-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  return (
    <div className="space-y-6" id="project-portfolio-module">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Müşteri Proje Portföyü (Project Portfolio)</h4>
          <p className="text-[10px] text-gray-500 mt-1">Sürekli İyileştirme (CI) ve VSM modüllerindeki aktif projeler bu panele otomatik yansır.</p>
        </div>
        {!showForm && (
          <button
            id="btn-add-portfolio-project"
            onClick={handleOpenAddForm}
            className="px-4 py-2 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            Yeni Proje Tanımla
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSaveProject} className="bg-white border border-gray-100 rounded-xl p-6 space-y-4 shadow-2xs" id="project-portfolio-form">
          <h4 className="font-semibold text-gray-900 text-xs">
            {editingId ? "Proje Düzenleme Formu" : "Yeni Sürekli İyileştirme Projesi Oluştur"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Proje Adı</label>
              <input
                id="input-project-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Proje Kodu</label>
              <input
                id="input-project-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Proje Lideri / Yöneticisi</label>
              <input
                id="input-project-manager"
                type="text"
                value={projectManager}
                onChange={(e) => setProjectManager(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Başlangıç Tarihi</label>
              <input
                id="input-project-startdate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Bitiş Tarihi</label>
              <input
                id="input-project-enddate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Mevcut Durum</label>
              <select
                id="select-project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-hidden"
              >
                <option value="Planned">Planned (Planlandı)</option>
                <option value="Active">Active (Aktif Yürütülüyor)</option>
                <option value="Completed">Completed (Kapatıldı / Başarıldı)</option>
                <option value="Delayed">Delayed (Riske Girdi / Gecikti)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Bütçe</label>
              <div className="flex gap-1.5">
                <input
                  id="input-project-budget"
                  type="number"
                  placeholder="Örn: 50000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white"
                >
                  <option value="₺">₺</option>
                  <option value="€">€</option>
                  <option value="$">$</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Beklenen ROI (%)</label>
              <input
                id="input-project-roi"
                type="number"
                placeholder="Örn: 150"
                value={roiPercent}
                onChange={(e) => setRoiPercent(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden"
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Proje Amacı / Odaklanılan İsraf (Objective)</label>
              <textarea
                id="input-project-objective"
                rows={2}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-hidden resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              id="btn-project-cancel"
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              id="btn-project-save"
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Projeyi Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Grid List View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="project-portfolio-list">
        {allProjects.map((project) => (
          <div key={project.id} className="bg-white border border-gray-100 rounded-xl p-5 relative hover:shadow-xs transition-shadow flex flex-col justify-between min-h-[190px]">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(project.status)}`}>
                    {project.status}
                  </span>
                  {project.sourceModule === "CI" && (
                    <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-600" />
                      CI Kaizen
                    </span>
                  )}
                  {project.sourceModule === "VSM" && (
                    <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                      <GitCommit className="w-3 h-3 text-indigo-600" />
                      VSM Akışı
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400">{project.code}</span>
              </div>

              <h4 className="font-semibold text-gray-900 text-xs line-clamp-1 mb-1">{project.name}</h4>
              <p className="text-[11px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">{project.objective || "Açıklama girilmemiş."}</p>
            </div>

            <div className="border-t border-gray-50 pt-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400">Yönetici:</span>
                <span className="font-semibold text-gray-700">{project.projectManager || "Belirtilmedi"}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400">Yatırım / ROI:</span>
                <span className="font-semibold text-gray-700">
                  {project.currency}{project.budget.toLocaleString()} / <span className="text-green-600 font-bold">%{project.roiPercent} ROI</span>
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400">Takvim:</span>
                <span className="font-semibold text-gray-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {project.startDate} / {project.endDate || "Devam Ediyor"}
                </span>
              </div>

              <div className="flex justify-end gap-1 pt-3 border-t border-gray-50/50 mt-1">
                <button
                  id={`btn-edit-project-${project.id}`}
                  onClick={() => handleOpenEditForm(project)}
                  className="p-1.5 text-zinc-900 hover:bg-gray-50 rounded-md transition-colors"
                  title="Düzenle"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`btn-delete-project-${project.id}`}
                  onClick={() => handleDeleteProject(project.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  title="Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {allProjects.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white border border-dashed border-gray-100 rounded-xl">
            <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Bu müşteri için henüz tanımlı bir proje veya CI/VSM kaydı bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </div>
  );
}
