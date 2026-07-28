import React, { useState } from "react";
import { FiveSAudit, Customer } from "../types";
import { 
  CheckCircle, Plus, Star, Award, TrendingUp, Filter, AlertTriangle, 
  Trash2, Clipboard, ShieldCheck, RefreshCw, BarChart3
} from "lucide-react";

interface FiveSImprovementsProps {
  audits: FiveSAudit[];
  onAddAudit: (audit: FiveSAudit) => void;
  onDeleteAudit: (id: string) => void;
  selectedCustomer: Customer | null;
}

export default function FiveSImprovements({
  audits,
  onAddAudit,
  onDeleteAudit,
  selectedCustomer
}: FiveSImprovementsProps) {
  const [activeAreaFilter, setActiveAreaFilter] = useState("all");
  const [isAuditing, setIsAuditing] = useState(false);

  // Form Audit parameters
  const [formArea, setFormArea] = useState("Montaj Hattı A");
  const [formSort, setFormSort] = useState(4); // 1-5
  const [formSet, setFormSet] = useState(3);
  const [formShine, setFormShine] = useState(4);
  const [formStandardize, setFormStandardize] = useState(2);
  const [formSustain, setFormSustain] = useState(3);
  const [formFindings, setFormFindings] = useState("");

  const areas = ["all", ...new Set(audits.map(a => a.area))];

  const handleSaveAudit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate final score: (sum / 25) * 100
    const sum = formSort + formSet + formShine + formStandardize + formSustain;
    const finalScore = Math.round((sum / 25) * 100);

    const newAudit: FiveSAudit = {
      id: Math.random().toString(36).substring(2, 9),
      area: formArea,
      date: new Date().toISOString().split('T')[0],
      sortScore: formSort,
      setInOrderScore: formSet,
      shineScore: formShine,
      standardizeScore: formStandardize,
      sustainScore: formSustain,
      overallScore: finalScore,
      notes: formFindings || "Gözlemler yapıldı."
    };

    onAddAudit(newAudit);
    setIsAuditing(false);

    // reset
    setFormFindings("");
  };

  const filteredAudits = audits.filter(a => 
    activeAreaFilter === "all" || a.area === activeAreaFilter
  );

  // High-fidelity calculations
  const averageMaturityScore = filteredAudits.length > 0 
    ? Math.round(filteredAudits.reduce((acc, a) => acc + a.overallScore, 0) / filteredAudits.length)
    : 0;

  // Star color utility
  const renderStars = (score: number) => {
    return (
      <div className="flex space-x-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star} 
            className={`w-3.5 h-3.5 ${
              star <= score ? "text-yellow-500 fill-yellow-500" : "text-gray-200"
            }`} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">

      {/* TOP METRICS BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Overall 5s Score Average */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Yalın 5S Genel Skoru (Maturity)</span>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-mono font-bold text-gray-950">%{averageMaturityScore}</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
              averageMaturityScore >= 80 ? "bg-emerald-100 text-emerald-800" :
              averageMaturityScore >= 60 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-805 text-amber-900"
            }`}>
              {averageMaturityScore >= 80 ? "Sürdürülebilir Derece" : "Geliştirilmesi Gerekli"}
            </span>
          </div>
          <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gray-800 h-1.5 rounded-full" style={{ width: `${averageMaturityScore}%` }}></div>
          </div>
        </div>

        {/* Total audits tracking */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Yapılan Toplam Denetleme</span>
          <div className="text-2xl font-mono font-bold text-gray-955">{audits.length} Alan</div>
          <span className="text-[10px] text-gray-400 block">Saha temizlik ve disiplin periyodik tescili</span>
        </div>

        {/* Red Alert areas (<60%) */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">Kritik 5S Alanı (Alarms)</span>
          <div className="text-2xl font-mono font-bold text-red-650">
            {audits.filter(a => a.overallScore < 60).length} Lokasyon
          </div>
          <span className="text-[10px] text-gray-450 block">60 puan altında kalan disiplinsiz bölgeler</span>
        </div>

        {/* Target 5s value */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Yıllık 5S Hedefi</span>
          <div className="text-2xl font-mono font-bold text-emerald-600">%90 Skoru</div>
          <span className="text-[10px] text-emerald-600 block">Sustain (Sürdür) disiplin standardı</span>
        </div>

      </div>

      {/* FILTER & CONTROL TOOLBAR */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center space-x-2">
          <Clipboard className="w-5 h-5 text-gray-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Periyodik 5S Denetim Kayıt Matrisi</h3>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Area select */}
          <select
            value={activeAreaFilter}
            onChange={(e) => setActiveAreaFilter(e.target.value)}
            className="text-xs bg-white border border-gray-350 rounded px-2.5 py-1.5 focus:outline-none text-gray-700"
          >
            <option value="all">Tüm Bölgeler</option>
            {areas.filter(a => a !== "all").map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {isAuditing ? null : (
            <button
              onClick={() => setIsAuditing(true)}
              className="bg-gray-900 hover:bg-gray-850 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni 5S Denetimi Başlat</span>
            </button>
          )}
        </div>
      </div>

      {/* DETAILED 5S TABLE & SCORECARD MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Audit lists table */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-55 border-b border-gray-200 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Denetim Bölgesi / Tarih</th>
                  <th className="py-2.5 px-3 text-center">S1 (Sort)</th>
                  <th className="py-2.5 px-3 text-center">S2 (Set In)</th>
                  <th className="py-2.5 px-3 text-center">S3 (Shine)</th>
                  <th className="py-2.5 px-3 text-center">S4 (Stand.)</th>
                  <th className="py-2.5 px-3 text-center">S5 (Sust.)</th>
                  <th className="py-2.5 px-3 text-center">Toplam Puan</th>
                  <th className="py-2.5 px-3 text-right">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredAudits.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-450">
                      Bu bölgede değerlendirilmiş 5S denetimi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredAudits.map(a => {
                    const isCritical = a.overallScore < 60;
                    return (
                      <tr key={a.id} className={`hover:bg-gray-50/50 ${isCritical ? "bg-red-50/10" : ""}`}>
                        <td className="py-3 px-3 font-semibold text-gray-950">
                          <div>{a.area}</div>
                          <div className="text-[10px] text-gray-450 mt-0.5 font-normal">Tarih: {a.date}</div>
                        </td>
                        <td className="py-3 px-3 text-center">{renderStars(a.sortScore)}</td>
                        <td className="py-3 px-3 text-center">{renderStars(a.setInOrderScore)}</td>
                        <td className="py-3 px-3 text-center">{renderStars(a.shineScore)}</td>
                        <td className="py-3 px-3 text-center">{renderStars(a.standardizeScore)}</td>
                        <td className="py-3 px-3 text-center">{renderStars(a.sustainScore)}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={`${
                            a.overallScore >= 80 ? "text-emerald-600" :
                            a.overallScore >= 60 ? "text-blue-700" : "text-red-650"
                          }`}>
                            {a.overallScore}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => onDeleteAudit(a.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Audit kaydını sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5S Guide and Audit Instructions */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl p-4.5 shadow-xs space-y-4">
          <div className="flex items-center space-x-1.5 border-b border-gray-100 pb-2">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <h4 className="text-xs font-bold text-gray-950 uppercase">Şantiye 5S Değerlendirme Esasları</h4>
          </div>

          <div className="space-y-3 text-xs text-gray-600">
            <div className="space-y-1">
              <span className="font-bold text-gray-900 block">S1 - Seiri (Ayıkla / Sort)</span>
              <p className="text-[11px] leading-relaxed text-gray-450">Saka alanındaki gereksiz tüm malzemelerin (Hurda parça, kullanılmayan kablo vs.) kırmızı etiket (red tag) ile sahadan tahliyesi.</p>
            </div>
            
            <div className="space-y-1">
              <span className="font-bold text-gray-900 block">S2 - Seiton (Düzenle / Set in Order)</span>
              <p className="text-[11px] leading-relaxed text-gray-450">"Her şeye bir yer ve her şey yerli yerinde" kuralı. İş aletleri, taşıma kasaları için zemin çizgileri ve gölge panosu standartları.</p>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-gray-900 block">S3 - Seiso (Temizle / Shine)</span>
              <p className="text-[11px] leading-relaxed text-gray-455">Makine gövdelerinin, zemin ve ekipmanın sürekli temiz tutulması ve bir kirlilik kaynağı (yağ akıntısı vb) halinde alarm verilmesi.</p>
            </div>

            <p className="text-[10px] text-gray-400 italic">
              *5S denetimi doğrudan kalite firelerini azaltıp, iş emniyet katsayısını artırmak üzere dizayn edilmiştir.
            </p>
          </div>
        </div>

      </div>

      {/* QUICK 5S AUDITOR DIALOG MODAL */}
      {isAuditing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-205">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center text-xs">
              <h3 className="font-bold text-gray-900 uppercase">Saha 5S Olgunluk Audit Formu</h3>
              <button onClick={() => setIsAuditing(false)} className="text-gray-400 hover:text-gray-650 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveAudit} className="p-4.5 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-gray-500 font-semibold mb-1">Denetlenen Bölge / Lokasyon *</label>
                <input
                  type="text"
                  required
                  placeholder="Montaj Hücresi 3, Preshane Kalıphane vb."
                  className="w-full bg-white border border-gray-300 rounded p-1.5 focus:outline-none"
                  value={formArea}
                  onChange={(e) => setFormArea(e.target.value)}
                />
              </div>

              {/* 1 to 5 sliders for each element */}
              <div className="space-y-3 bg-gray-55 p-3 rounded-lg border border-gray-150">
                <span className="text-[10px] uppercase font-bold text-gray-400 block mb-2">5 Element Derecelendirme (1 - 5)</span>
                
                {/* Seiri */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] text-gray-750 shrink-0">S1 - Ayıkla (Sort):</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-24 accent-gray-800"
                      value={formSort}
                      onChange={(e) => setFormSort(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-gray-800 w-4">{formSort} Star</span>
                  </div>
                </div>

                {/* Seiton */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] text-gray-750 shrink-0">S2 - Düzenle (Set):</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-24 accent-gray-800"
                      value={formSet}
                      onChange={(e) => setFormSet(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-gray-800 w-4">{formSet} Star</span>
                  </div>
                </div>

                {/* Seiso */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] text-gray-750 shrink-0">S3 - Temizle (Shine):</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-24 accent-gray-800"
                      value={formShine}
                      onChange={(e) => setFormShine(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-gray-800 w-4">{formShine} Star</span>
                  </div>
                </div>

                {/* Seiketsu */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] text-gray-750 shrink-0">S4 - Standartlaştır:</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-24 accent-gray-800"
                      value={formStandardize}
                      onChange={(e) => setFormStandardize(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-gray-800 w-4">{formStandardize} Star</span>
                  </div>
                </div>

                {/* Shitsuke */}
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium text-[11px] text-gray-750 shrink-0">S5 - Sürdür (Sustain):</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-24 accent-gray-800"
                      value={formSustain}
                      onChange={(e) => setFormSustain(Number(e.target.value))}
                    />
                    <span className="font-mono font-bold text-gray-800 w-4">{formSustain} Star</span>
                  </div>
                </div>

              </div>

              <div>
                <label className="block text-gray-500 font-semibold mb-1">Önemli Bulgular / Düzeltici Aksiyon Önerisi</label>
                <textarea
                  placeholder="Kutu istiflerinde aşırı düzensizlik var, kırmızı etiket gerekiyor..."
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded p-1.5 focus:outline-none text-gray-800"
                  value={formFindings}
                  onChange={(e) => setFormFindings(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAuditing(false)}
                  className="bg-gray-100 text-gray-600 px-3.5 py-1.5 rounded"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="bg-gray-900 text-white font-bold px-4.5 py-1.5 rounded"
                >
                  Saha Skoru Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
