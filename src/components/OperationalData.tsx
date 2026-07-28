import React, { useState } from "react";
import { ProcessRecord, Customer } from "../types";
import { 
  BarChart4, Clipboard, Plus, ShieldAlert, CheckCircle, Percent, Settings, 
  HelpCircle, Sparkles, Upload, Download, Trash2, Edit2, Play, DollarSign, Calculator
} from "lucide-react";

interface OperationalDataProps {
  processes: ProcessRecord[];
  onAddProcess: (process: ProcessRecord) => void;
  onUpdateProcess: (process: ProcessRecord) => void;
  onDeleteProcess: (id: string) => void;
  selectedCustomer: Customer | null;
}

export default function OperationalData({
  processes,
  onAddProcess,
  onUpdateProcess,
  onDeleteProcess,
  selectedCustomer
}: OperationalDataProps) {
  const [targetProfitPercent, setTargetProfitPercent] = useState(10);
  const [isAdding, setIsAdding] = useState(false);

  // Edit/Add Form State
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Partial<ProcessRecord>>({
    name: "",
    operatorCount: 4,
    machineCount: 2,
    cycleTime: 45,
    shiftCount: 2,
    workingHours: 8,
    oee: 75,
    utilizationRate: 85,
    overtimeRatio: 15,
    excessLabor: 1,
    scrapCost: 45000,
    reworkCost: 25000,
    downtimeCost: 80000,
    laborCost: 150000,
    indirectLaborCost: 45000,
    waitingLoss: 30000,
    transportationLoss: 20000,
    motionLoss: 15000,
    overproductionLoss: 40000
  });

  const handleOpenAdd = () => {
    setEditingProcessId(null);
    setFormState({
      name: "",
      operatorCount: 4,
      machineCount: 2,
      cycleTime: 45,
      shiftCount: 2,
      workingHours: 8,
      oee: 75,
      utilizationRate: 85,
      overtimeRatio: 15,
      excessLabor: 1,
      scrapCost: 45000,
      reworkCost: 25000,
      downtimeCost: 80000,
      laborCost: 150000,
      indirectLaborCost: 45000,
      waitingLoss: 30000,
      transportationLoss: 20000,
      motionLoss: 15000,
      overproductionLoss: 40000
    });
    setIsAdding(true);
  };

  const handleEdit = (p: ProcessRecord) => {
    setEditingProcessId(p.id);
    setFormState(p);
    setIsAdding(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name) return;

    const capacity = Math.round(
      ((formState.shiftCount! * formState.workingHours! * 3600) / formState.cycleTime!) * 
      (formState.oee! / 100) * 
      (formState.utilizationRate! / 100)
    );

    if (editingProcessId) {
      onUpdateProcess({
        ...formState,
        id: editingProcessId,
        capacity
      } as ProcessRecord);
    } else {
      onAddProcess({
        ...formState,
        id: Math.random().toString(36).substring(2, 9),
        capacity
      } as ProcessRecord);
    }
    setIsAdding(false);
  };

  // ANALYTICAL CALCULATIONS
  // Exact Bottleneck is Process with Maximum Cycle Time
  const bottleneckProcess = [...processes].sort((a,b) => b.cycleTime - a.cycleTime)[0];

  // Annual waste cost sum
  const getProcessWaste = (p: ProcessRecord) => {
    return p.scrapCost + p.reworkCost + p.downtimeCost + p.waitingLoss + p.transportationLoss + p.motionLoss + p.overproductionLoss;
  };

  // Total annual waste across all processes
  const totalAnnualWaste = processes.reduce((acc, p) => acc + getProcessWaste(p), 0);

  // Default cost structure estimate
  const companyRevenue = selectedCustomer?.annualRevenue || 10000000;
  const targetProfitAmount = (companyRevenue * targetProfitPercent) / 100;
  const currencySign = selectedCustomer?.currency || "₺";

  // Priority Rank by Waste cost
  const sortedByWaste = [...processes].sort((a,b) => getProcessWaste(b) - getProcessWaste(a));

  const handleImportCSVExample = () => {
    // Inject mock Excel data
    alert("Excel / CSV Import Mock: Veriler başarıyla analiz edildi ve sisteme entegre edildi.");
  };

  const handleExportCSV = () => {
    const headerStr = "Proses Adi,Operator Sayisi,Cevrim Suresi (sn),Vardiya,OEE (%),Kapasite (Adet/Gun),Yillik Hurda Maliyeti,Durus Kaybi Maliyeti,Yillik Toplam Israf\n";
    const rows = processes.map(p => 
      `"${p.name}",${p.operatorCount},${p.cycleTime},${p.shiftCount},${p.oee},${p.capacity},${p.scrapCost},${p.downtimeCost},${getProcessWaste(p)}`
    );
    const blob = new Blob([headerStr + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Gemba_Operational_Data.csv");
    link.click();
  };

  return (
    <div className="space-y-6">

      {/* TOP SUMMARY FLAGS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Core OpEx Financial Engine */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-2.5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Yıllık Kayıp Havuzu (OpEx Pool)</span>
          <div className="text-2xl font-mono font-bold text-gray-900">
            {currencySign}{totalAnnualWaste.toLocaleString()}
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (totalAnnualWaste / companyRevenue) * 100)}%` }}></div>
          </div>
          <span className="text-[10px] text-gray-400 block">Cironun <span className="text-red-600 font-bold">%{((totalAnnualWaste / companyRevenue) * 100).toFixed(1)}</span> kadarı israf erozyonu</span>
        </div>

        {/* Bottleneck identification */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-2">
          <span className="text-[10px] text-gray-450 font-bold uppercase tracking-wider block">Tespit Edilen Darboğaz (Bottleneck)</span>
          {bottleneckProcess ? (
            <div>
              <div className="text-base font-semibold text-gray-900 truncate">{bottleneckProcess.name}</div>
              <div className="flex items-center space-x-1.5 text-xs text-red-600 font-mono font-bold mt-1">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                <span>Çevrim Hızı: {bottleneckProcess.cycleTime} saniye</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Proses kaydı bulunamadı.</span>
          )}
          <span className="text-[9px] text-gray-400 block pt-1 border-t border-gray-100">Kapasite limiti bu istasyona bağlıdır.</span>
        </div>

        {/* Operating Profit Target Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-450 font-bold uppercase tracking-wider">Hedef Faaliyet Kârı</span>
            <span className="text-xs font-mono font-bold text-emerald-600">{targetProfitPercent}%</span>
          </div>
          <input
            type="range"
            min="3"
            max="30"
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-800"
            value={targetProfitPercent}
            onChange={(e) => setTargetProfitPercent(Number(e.target.value))}
          />
          <div className="text-[11px] font-mono text-gray-600">
            Target: {currencySign}{targetProfitAmount.toLocaleString()}
          </div>
        </div>

        {/* Savings Strategy Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-1.5">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Yalın Hedef (ROI) Potansiyeli</span>
          <div className="text-xl font-mono font-bold text-emerald-600 block">
            {currencySign}{(totalAnnualWaste * 0.45).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[9px] text-gray-400 leading-relaxed">
            Kayıpların %45'i Kaizen çalışmalarıyla orta vadede elenebilir, bu kâr hanesine doğrudan eklenir.
          </p>
        </div>

      </div>

      {/* DETAILED PROCESS SPREADSHEET CARD */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        
        {/* Card Header Actions */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <BarChart4 className="w-5 h-5 text-gray-600" />
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Proses Operasyon & Kayıp Matrisi (Spreadsheet)</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImportCSVExample}
              className="px-2.5 py-1.5 border border-gray-300 rounded text-gray-600 bg-white hover:bg-gray-50 text-[11px] font-semibold flex items-center space-x-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Excel Import</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 border border-gray-300 rounded text-gray-600 bg-white hover:bg-gray-50 text-[11px] font-semibold flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV Export</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 bg-gray-900 border border-gray-900 rounded text-white hover:bg-gray-850 text-[11px] font-bold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Proses Ekle</span>
            </button>
          </div>
        </div>

        {/* Table data matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 text-gray-500 font-bold border-b border-gray-200 text-[11px]">
                <th className="py-2.5 px-3">Proses Adı</th>
                <th className="py-2.5 px-3 text-center">İşgücü / Makine</th>
                <th className="py-2.5 px-3 text-center">Çevrim (sn)</th>
                <th className="py-2.5 px-3 text-center">OEE</th>
                <th className="py-2.5 px-3 text-center">Vardiya</th>
                <th className="py-2.5 px-3 text-center">Kapasite (Gün)</th>
                <th className="py-2.5 px-3 text-right">Duruş & Hata Kaybı</th>
                <th className="py-2.5 px-3 text-right">Lojistik/Hareket Kaybı</th>
                <th className="py-2.5 px-3 text-right">Toplam Yıllık İsraf</th>
                <th className="py-2.5 px-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {processes.map(p => {
                const isBottleneck = p.id === bottleneckProcess?.id;
                const totalWaste = getProcessWaste(p);
                const qualityAndDowntime = p.scrapCost + p.reworkCost + p.downtimeCost;
                const flowAndMotion = p.waitingLoss + p.transportationLoss + p.motionLoss;
                
                return (
                  <tr key={p.id} className={`hover:bg-gray-50/50 ${isBottleneck ? "bg-red-50/10" : ""}`}>
                    <td className="py-3 px-3 font-semibold text-gray-950 flex items-center space-x-1.5">
                      <span className={`w-2 h-2 rounded-full ${isBottleneck ? "bg-red-500 animate-pulse" : "bg-gray-400"}`}></span>
                      <span>{p.name}</span>
                      {isBottleneck && (
                        <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 font-bold rounded px-1 uppercase tracking-wide">DARBOĞAZ</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {p.operatorCount} Op / {p.machineCount} Mak
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium">
                      {p.cycleTime} sn
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <Percent className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold">{p.oee}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {p.shiftCount} Vardiya
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold">
                      {p.capacity.toLocaleString()} ad
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700">
                      {currencySign}{qualityAndDowntime.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-700">
                      {currencySign}{flowAndMotion.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-red-600">
                      {currencySign}{totalWaste.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-gray-500 hover:text-gray-900 font-bold p-1 mr-1"
                        title="Hızlı Düzenle"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => onDeleteProcess(p.id)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM LEAN IMPACT RECOMMENDATION MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Prioritized Project Rankings (Waste Pareto) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
            <Calculator className="w-4.5 h-4.5 text-gray-650" />
            <h4 className="text-xs font-bold text-gray-900 uppercase">Kayıp Kaynaklı Kaizen Önceliklendirmesi (Pareto Rank)</h4>
          </div>

          <div className="space-y-2.5">
            {sortedByWaste.map((p, idx) => {
              const wasteCost = getProcessWaste(p);
              const percentageOfTotal = (wasteCost / (totalAnnualWaste || 1)) * 100;
              
              return (
                <div key={p.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg flex justify-between items-center text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-gray-800">#{idx + 1} {p.name} Kaizeni</span>
                    <p className="text-[10px] text-gray-400">Yıllık Kayıp Payı: <span className="font-bold">%{percentageOfTotal.toFixed(0)}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-gray-900 block">{currencySign}{wasteCost.toLocaleString()}</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-1.5 py-0.2 rounded uppercase tracking-wide">Yüksek Öncelik</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROI Potential and Default Cost Breakdown Structure info */}
        <div className="bg-white border border-gray-205 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
            <Sparkles className="w-4.5 h-4.5 text-yellow-500" />
            <h4 className="text-xs font-bold text-gray-900 uppercase">Yalın Gelişim Dönüşüm ROI Modeli</h4>
          </div>

          <div className="space-y-3.5 text-xs text-gray-600">
            <p className="leading-relaxed">
              Önerilen default maliyet yapısı modeli {selectedCustomer?.industry || "sektörünüz"} dikkate alınarak kurgulanmıştır. Faaliyet kâr hedefi olan <span className="font-bold text-slate-800">%{targetProfitPercent}</span> marja ulaşmak için israf havuzunun elenmesi şarttır.
            </p>

            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div className="bg-gray-50 p-2 border border-gray-100 rounded-lg">
                <span className="text-gray-400 block text-[9px] uppercase">Gereksiz Fazla Mesai</span>
                <span className="font-bold text-gray-800 block mt-0.5">{currencySign}{processes.reduce((acc, p) => acc + (p.overtimeRatio * 1500), 0).toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 p-2 border border-gray-100 rounded-lg">
                <span className="text-gray-400 block text-[9px] uppercase">Kalıp Ayar Beklemeleri</span>
                <span className="font-bold text-gray-800 block mt-0.5">{currencySign}{processes.reduce((acc, p) => acc + p.downtimeCost, 0).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 italic">
              *Tüm hesaplamalar shop-floor Gemba standart zaman etütlerine ve OEE verilerine dayanmaktadır.
            </p>
          </div>
        </div>

      </div>

      {/* QUICK ADD/EDIT DIALOG MODAL */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-205">
            <div className="bg-gray-55 px-4.5 py-3.5 border-b border-gray-200 flex justify-between items-center text-xs">
              <h3 className="font-bold text-gray-900 uppercase">
                {editingProcessId ? `Proses Düzenle: ${formState.name}` : "Yeni Operasyon Tanımla"}
              </h3>
              <button 
                onClick={() => setIsAdding(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4.5 max-h-[460px] overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                
                <div className="col-span-2">
                  <label className="block text-gray-500 font-semibold mb-1">Proses / Hat Adı *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white border border-gray-300 rounded p-1.5 text-gray-800"
                    value={formState.name}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Örn: 270 Ton Arburg Enjeksiyon Hattı"
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Operatör Sayısı (HC)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.operatorCount}
                    onChange={(e) => setFormState(prev => ({ ...prev, operatorCount: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Çevrim Süresi (Cycle Time - sn)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.cycleTime}
                    onChange={(e) => setFormState(prev => ({ ...prev, cycleTime: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">OEE (%)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.oee}
                    onChange={(e) => setFormState(prev => ({ ...prev, oee: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Verimlilik Oranı (%)</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.utilizationRate}
                    onChange={(e) => setFormState(prev => ({ ...prev, utilizationRate: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Yıllık Iskarta / Hurda Maliyeti ({currencySign})</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.scrapCost}
                    onChange={(e) => setFormState(prev => ({ ...prev, scrapCost: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Yıllık Duruş / Kayıp Maliyeti ({currencySign})</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.downtimeCost}
                    onChange={(e) => setFormState(prev => ({ ...prev, downtimeCost: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Hat İçi Bekleme Kaybı ({currencySign})</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.waitingLoss}
                    onChange={(e) => setFormState(prev => ({ ...prev, waitingLoss: Number(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Gereksiz Taşıma Kaybı ({currencySign})</label>
                  <input
                    type="number"
                    className="w-full bg-white border border-gray-300 rounded p-1.5"
                    value={formState.transportationLoss}
                    onChange={(e) => setFormState(prev => ({ ...prev, transportationLoss: Number(e.target.value) }))}
                  />
                </div>

              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="bg-gray-100 text-gray-700 px-3.5 py-1.5 rounded"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bg-gray-900 text-white font-bold px-4.5 py-1.5 rounded"
                >
                  Hesapla & Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
