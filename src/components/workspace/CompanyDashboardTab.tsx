import React, { useState } from "react";
import { CompanyWorkspaceExtended, KpiHistoryPoint } from "../../types/workspace";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, Percent, TrendingUp, Compass, Award, Plus, Trash2, Edit } from "lucide-react";

interface CompanyDashboardTabProps {
  workspace: CompanyWorkspaceExtended;
  onUpdateKpiHistory: (history: KpiHistoryPoint[]) => void;
}

export default function CompanyDashboardTab({ workspace, onUpdateKpiHistory }: CompanyDashboardTabProps) {
  const [showAddKpi, setShowAddKpi] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [newOee, setNewOee] = useState("");
  const [newTransport, setNewTransport] = useState("");
  const [newFives, setNewFives] = useState("");
  const [newLeadTime, setNewLeadTime] = useState("");

  const handleAddKpiPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear || !newOee || !newTransport || !newFives || !newLeadTime) return;

    const newPoint: KpiHistoryPoint = {
      year: newYear,
      oee: parseInt(newOee) || 0,
      transportationDistance: parseInt(newTransport) || 0,
      fivesScore: parseInt(newFives) || 0,
      leadTimeDays: parseInt(newLeadTime) || 0,
    };

    const updated = [...workspace.kpiHistory, newPoint].sort((a, b) => a.year.localeCompare(b.year));
    onUpdateKpiHistory(updated);

    // Reset Form
    setNewYear("");
    setNewOee("");
    setNewTransport("");
    setNewFives("");
    setNewLeadTime("");
    setShowAddKpi(false);
  };

  const handleRemoveKpiPoint = (year: string) => {
    const updated = workspace.kpiHistory.filter((k) => k.year !== year);
    onUpdateKpiHistory(updated);
  };

  // No fabricated fallback numbers: with zero KPI history points, OEE/5S fall back to the
  // customer's real, manually-entered Şirket Profili fields (opex.oee / opex.fivesLevel) — 0 if
  // those are also unset, shown as "Veri Yok" below rather than a plausible-looking guess.
  // Transportation distance and lead time have no such profile-level source at all — they only
  // ever exist once a real KPI history point is added — so they show "Veri Yok" until then instead
  // of a made-up figure (this previously showed a fixed 4500m "logistics flow" reading and a fixed
  // 10-day lead time for every customer with no data entered).
  const latestKpi = workspace.kpiHistory[workspace.kpiHistory.length - 1] || null;
  const currentOee = latestKpi ? latestKpi.oee : (workspace.opex.oee || 0);
  const currentTransportationDistance = latestKpi ? latestKpi.transportationDistance : null;
  const currentFivesScore = latestKpi ? latestKpi.fivesScore : (workspace.opex.fivesLevel ? Math.round(workspace.opex.fivesLevel * 20) : 0);

  const activeProjectsCount = workspace.projects.filter((p) => p.status === "Active").length;
  const completedProjectsCount = workspace.projects.filter((p) => p.status === "Completed").length;

  return (
    <div className="space-y-6" id="company-dashboard-module">
      {/* KPI Indicators Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:shadow-xs transition-shadow">
          <div className="p-3 bg-zinc-50 rounded-xl text-zinc-950">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Güncel OEE</span>
            <h4 className="text-xl font-bold text-gray-900 mt-0.5">{currentOee > 0 ? `%${currentOee}` : "Veri Yok"}</h4>
            {currentOee > 0 ? (
              <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5 mt-1">
                <TrendingUp className="w-3 h-3" />
                {latestKpi ? `${latestKpi.year} Yıllık Verisi` : "Şirket Profili Verisi"}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-medium mt-1 block">
                Şirket Profili'nden veya bir KPI kaydından girin
              </span>
            )}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:shadow-xs transition-shadow">
          <div className="p-3 bg-zinc-50 rounded-xl text-zinc-950">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lojistik Akış</span>
            <h4 className="text-xl font-bold text-gray-900 mt-0.5">
              {currentTransportationDistance !== null ? `${currentTransportationDistance} m/gün` : "Veri Yok"}
            </h4>
            {currentTransportationDistance !== null ? (
              <span className="text-[10px] text-green-600 font-medium mt-1 block">
                {latestKpi!.year} Yıllık Verisi
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-medium mt-1 block">
                Bir yıllık KPI veri noktası ekleyin
              </span>
            )}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:shadow-xs transition-shadow">
          <div className="p-3 bg-zinc-50 rounded-xl text-zinc-950">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">5S Sahanlık Skoru</span>
            <h4 className="text-xl font-bold text-gray-900 mt-0.5">{currentFivesScore > 0 ? `${currentFivesScore} / 100` : "Veri Yok"}</h4>
            <span className="text-[10px] text-gray-500 font-medium mt-1 block">
              {currentFivesScore > 0 ? (latestKpi ? `${latestKpi.year} Yıllık Verisi` : "Şirket Profili Verisi") : "Şirket Profili'nden veya bir KPI kaydından girin"}
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:shadow-xs transition-shadow">
          <div className="p-3 bg-zinc-50 rounded-xl text-zinc-950">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aktif Projeler</span>
            <h4 className="text-xl font-bold text-gray-900 mt-0.5">{activeProjectsCount} Proje</h4>
            <span className="text-[10px] text-zinc-600 font-medium mt-1 block">
              {completedProjectsCount} Proje Tamamlandı
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Graphical Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-5 border border-gray-100 rounded-xl lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Yıllık Gelişim Grafikleri</h4>
              <p className="text-[10px] text-gray-500 mt-1">OEE Artış ve Taşıma Kayıplarının Yıllara Göre İyileşme Trendi</p>
            </div>
            <button
              id="btn-toggle-kpi-form"
              onClick={() => setShowAddKpi(!showAddKpi)}
              className="px-3 py-1 text-xs text-zinc-900 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Veri Noktası Ekle
            </button>
          </div>

          {showAddKpi && (
            <form onSubmit={handleAddKpiPoint} className="bg-gray-50/50 p-4 border border-gray-100 rounded-xl mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3" id="kpi-input-form">
              <input
                id="input-kpi-year"
                type="text"
                placeholder="Yıl (Örn: 2027)"
                required
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden"
              />
              <input
                id="input-kpi-oee"
                type="number"
                placeholder="OEE %"
                required
                value={newOee}
                onChange={(e) => setNewOee(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden"
              />
              <input
                id="input-kpi-transport"
                type="number"
                placeholder="Taşıma (metre)"
                required
                value={newTransport}
                onChange={(e) => setNewTransport(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden"
              />
              <input
                id="input-kpi-fives"
                type="number"
                placeholder="5S (1-100)"
                required
                value={newFives}
                onChange={(e) => setNewFives(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden"
              />
              <div className="flex gap-1.5">
                <input
                  id="input-kpi-leadtime"
                  type="number"
                  placeholder="Teslim Süresi"
                  required
                  value={newLeadTime}
                  onChange={(e) => setNewLeadTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden"
                />
                <button
                  id="btn-submit-kpi"
                  type="submit"
                  className="px-3.5 py-1.5 bg-zinc-950 text-white rounded-lg hover:bg-zinc-800 text-xs transition-all"
                >
                  Ekle
                </button>
              </div>
            </form>
          )}

          <div className="h-64 w-full" id="trend-charts-container">
            {workspace.kpiHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                Grafik oluşturmak için en az bir yıllık veri ekleyin.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={workspace.kpiHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="year" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #f3f4f6" }} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Line type="monotone" name="OEE (%)" dataKey="oee" stroke="#18181b" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="5S Skoru" dataKey="fivesScore" stroke="#71717a" strokeWidth={2} />
                  <Line type="monotone" name="Teslim Süresi (Gün)" dataKey="leadTimeDays" stroke="#a1a1aa" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Historical Raw Table View */}
        <div className="bg-white p-5 border border-gray-100 rounded-xl flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">Yıllık Veri Günlükleri</h4>
            <div className="overflow-y-auto max-h-56 pr-1 scrollbar-thin">
              <table className="w-full text-left border-collapse" id="kpi-history-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Yıl</th>
                    <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">OEE</th>
                    <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">Taşıma</th>
                    <th className="py-2 text-[10px] font-bold text-gray-400 uppercase">5S</th>
                    <th className="py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {workspace.kpiHistory.map((kpi) => (
                    <tr key={kpi.year} className="text-xs hover:bg-gray-50/50">
                      <td className="py-2.5 font-bold text-gray-800">{kpi.year}</td>
                      <td className="py-2.5 text-zinc-900">%{kpi.oee}</td>
                      <td className="py-2.5 text-zinc-600">{kpi.transportationDistance}m</td>
                      <td className="py-2.5 text-zinc-600">{kpi.fivesScore}</td>
                      <td className="py-2.5 text-right">
                        <button
                          id={`btn-remove-kpi-${kpi.year}`}
                          onClick={() => handleRemoveKpiPoint(kpi.year)}
                          className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {workspace.kpiHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-[11px] text-gray-400 italic">
                        Kayıtlı geçmiş KPI bulunmamaktadır.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-xl mt-4">
            <p className="text-[10px] text-zinc-600 font-medium leading-relaxed">
              * Bu veriler, Yönetici Paneli'ndeki grafik ve göstergelerin kaynağıdır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
