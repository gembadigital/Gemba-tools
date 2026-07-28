import React, { useState } from "react";
import { KaizenCard, YokotenItem } from "./types";
import { 
  Plus, CheckCircle2, RefreshCw, Layers, ShieldAlert, 
  ChevronRight, ArrowRight, BookOpen, Clock, Trash2, 
  FileText, Award, DollarSign 
} from "lucide-react";

interface KaizenBoardProps {
  isDarkMode: boolean;
  currency: string;
}

export default function KaizenBoard({ isDarkMode, currency }: KaizenBoardProps) {
  // Hardcoded / initial preset Kaizen cards
  const [kaizens, setKaizens] = useState<KaizenCard[]>([
    {
      id: "kz-1",
      title: "Vernikleme (Varnishing) SMED Geçişi",
      department: "Varnishing",
      currentValue: "120 min",
      targetValue: "60 min",
      method: "SMED",
      investmentCost: 50000,
      annualBenefit: 750000,
      responsible: "Atakan Zehir",
      dueDate: "2026-07-15",
      status: "COMPLETED",
      isYokoten: true,
      rootCause: "Aletsiz kalıp kilitlerin olmaması ve içsel işlerin makine dururken yapılması",
      problemDefinition: "Vernik renk değişimlerinde kaybedilen sürelerin uzun olması sebebiyle durma kayıplarının artması",
      countermeasures: "Dışsal hazırlık adımlarının makine çalışırken tamamlanması, hava hortumlarının soketli kilit ile güncellenmesi",
      actualSaving: 820000
    },
    {
      id: "kz-2",
      title: "Bobinaj Robotlu Besleme Entegrasyonu",
      department: "Coil Winding",
      currentValue: "40 micro-stops/hour",
      targetValue: "5 micro-stops/hour",
      method: "Poka-Yoke & Otomasyon",
      investmentCost: 180000,
      annualBenefit: 640000,
      responsible: "Elif Demir",
      dueDate: "2026-08-01",
      status: "IN_PROGRESS",
      isYokoten: false,
      rootCause: "Parça hizalama aşamalarından kaynaklı duruşlar",
      problemDefinition: "Bobin sargı kafasına parça beslemedeki el ile hizalama hataları",
      countermeasures: "Mekanik kılavuzlama kanalı açılması ve sensör kontrollü pnömatik parça itici entegre edilmesi"
    },
    {
      id: "kz-3",
      title: "Pres Shop Otonom Yağlama Takvimi",
      department: "Press Shop",
      currentValue: "Yılda 8 Büyük Arıza",
      targetValue: "O Arıza",
      method: "TPM / Otonom Bakım",
      investmentCost: 15000,
      annualBenefit: 480000,
      responsible: "Kemal Yılmaz",
      dueDate: "2026-09-10",
      status: "OPEN",
      isYokoten: false
    }
  ]);

  // Yokoten pool state containing completed improvements
  const [yokotens, setYokotens] = useState<YokotenItem[]>([
    {
      id: "yk-1",
      name: "Soketli Nozul ve Tabanca Kurulum Standardı",
      department: "Varnishing",
      problem: "Yıkama adımında el aletleri ile söküm ve temizliğin uzun sürmesi",
      rootCause: "SMED dışsal hazırlık noksanlığı ve standart anahtar gerektiren eski nozullar",
      action: "Tüm bağlantı kafaları hızlı klik-klak soket tipine dönüştürüldü",
      benefit: "Setup süresi 90 dakikadan 45 dakikaya düşürüldü",
      savings: 750000,
      picturesBefore: "Bol cıvatalı, kirli hortum yerleşimi",
      picturesAfter: "Renk kodlu, klik soketli pnömatik panel",
      replicationPotential: "HIGH",
      otherDepartments: ["Grinding", "Assembly"],
      priority: "HIGH"
    }
  ]);

  const [activeA3Project, setActiveA3Project] = useState<KaizenCard | null>(kaizens[0]);
  const [newKaizenTitle, setNewKaizenTitle] = useState("");
  const [newKaizenDept, setNewKaizenDept] = useState("Varnishing");

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(val) + " " + currency;
  };

  const handleCreateKaizen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKaizenTitle.trim()) return;

    const fresh: KaizenCard = {
      id: "kz-" + Date.now().toString().slice(-4),
      title: newKaizenTitle,
      department: newKaizenDept,
      currentValue: "N/A",
      targetValue: "İyileştirilmiş",
      method: "Kaizen",
      investmentCost: 35000,
      annualBenefit: 280000,
      responsible: "Gemba Operatör",
      dueDate: "2026-10-30",
      status: "OPEN",
      isYokoten: false,
      rootCause: "Analiz ediliyor",
      problemDefinition: "Gemba kaybının tanzim edilmesi",
      countermeasures: "Standart eylemlerin devreye alınması"
    };

    setKaizens([...kaizens, fresh]);
    setNewKaizenTitle("");
  };

  const handleUpdateStatus = (id: string, newStatus: KaizenCard["status"]) => {
    const updated = kaizens.map(k => {
      if (k.id === id) {
        const next = { ...k, status: newStatus };
        if (newStatus === "COMPLETED" && !k.isYokoten) {
          next.isYokoten = true;
          // Automatically push to Yokoten Pool!
          const yokotenCard: YokotenItem = {
            id: "yk-" + Date.now().toString().slice(-4),
            name: k.title,
            department: k.department,
            problem: k.problemDefinition || "Gemba duruşu",
            rootCause: k.rootCause || "SMED/TPM eksikliği",
            action: k.countermeasures || "Hızlı düzeltici aksiyon setleri uygulandı",
            benefit: `${k.currentValue} değerinden ${k.targetValue} değerine indirildi`,
            savings: k.annualBenefit,
            picturesBefore: "Eski metodoloji yerleşimi",
            picturesAfter: "Görsel iş tanımları & 5S standart",
            replicationPotential: "HIGH",
            otherDepartments: ["Machining", "Grinding", "Assembly"],
            priority: "MEDIUM"
          };
          setYokotens(prev => {
            if (prev.some(y => y.name === k.title)) return prev;
            return [...prev, yokotenCard];
          });
        }
        return next;
      }
      return k;
    });
    setKaizens(updated);
    // Sync A3 actively selected project
    const findSelected = updated.find(x => x.id === activeA3Project?.id);
    if (findSelected) {
      setActiveA3Project(findSelected);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* KAIZEN OPPORTUNITY BOARD */}
      <div className={`rounded-xl border p-5 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 mb-4 gap-3">
          <div>
            <h3 className="text-sm font-black tracking-tight text-indigo-700 uppercase flex items-center">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Digital Kaizen & Continuous Improvement Board
            </h3>
            <p className="text-[10px] text-slate-450">
              Operatör ve mühendislerin başlattığı iyileştirme projelerinin canlı durumu. Tamamlananlar otomatik olarak Yokoten havuzuna yatay yayılım için gönderilir.
            </p>
          </div>
          
          <form onSubmit={handleCreateKaizen} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Yeni Kaizen Konusu..."
              value={newKaizenTitle}
              onChange={(e) => setNewKaizenTitle(e.target.value)}
              className="text-xs px-2.5 py-1.5 border rounded-lg focus:outline-none w-44 font-semibold"
            />
            <select
              value={newKaizenDept}
              onChange={(e) => setNewKaizenDept(e.target.value)}
              className="text-xs border rounded-lg bg-slate-50 px-2 py-1 focus:outline-none"
            >
              <option value="Varnishing">Varnishing</option>
              <option value="Press Shop">Press Shop</option>
              <option value="Machining">Machining</option>
              <option value="Grinding">Grinding</option>
            </select>
            <button 
              type="submit"
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aç</span>
            </button>
          </form>
        </div>

        {/* KAIZEN BOARD COLUMNS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* OPEN COLUMN */}
          <div className="p-3.5 bg-slate-50 rounded-xl space-y-3.5 border border-slate-200/60">
            <span className="font-extrabold text-[10px] tracking-wider uppercase text-slate-500 border-b pb-1.5 flex justify-between items-center">
              <span>📂 AÇILAN KAIZENLER (OPEN)</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded text-[9px] font-bold">
                {kaizens.filter(k => k.status === "OPEN").length}
              </span>
            </span>

            {kaizens.filter(k => k.status === "OPEN").map(k => (
              <div key={k.id} className="p-3 bg-white rounded-lg border shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border px-1.5 py-0.2 rounded">
                    {k.department}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">#{k.id}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-snug">{k.title}</h4>
                
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                  <span>Hedef: {k.targetValue}</span>
                  <button 
                    onClick={() => handleUpdateStatus(k.id, "IN_PROGRESS")}
                    className="text-indigo-650 font-black hover:underline cursor-pointer flex items-center"
                  >
                    <span>Sürece Al</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* IN_PROGRESS COLUMN */}
          <div className="p-3.5 bg-indigo-50/50 rounded-xl space-y-3.5 border border-indigo-100/60">
            <span className="font-extrabold text-[10px] tracking-wider uppercase text-indigo-600 border-b pb-1.5 flex justify-between items-center">
              <span>⚙️ DEVAM EDEN (IN PROGRESS)</span>
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded text-[9px] font-bold">
                {kaizens.filter(k => k.status === "IN_PROGRESS").length}
              </span>
            </span>

            {kaizens.filter(k => k.status === "IN_PROGRESS").map(k => (
              <div key={k.id} className="p-3 bg-white rounded-lg border border-indigo-200 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 border px-1.5 py-0.2 rounded">
                    {k.department}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">#{k.id}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-snug">{k.title}</h4>
                
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                  <span>Eylem: {k.method}</span>
                  <button 
                    onClick={() => handleUpdateStatus(k.id, "COMPLETED")}
                    className="text-emerald-650 font-black hover:underline cursor-pointer flex items-center"
                  >
                    <span>Tamamla</span>
                    <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* COMPLETED COLUMN */}
          <div className="p-3.5 bg-emerald-50/40 rounded-xl space-y-3.5 border border-emerald-150">
            <span className="font-extrabold text-[10px] tracking-wider uppercase text-emerald-700 border-b pb-1.5 flex justify-between items-center">
              <span>✅ TAMAMLANAN (YOKOTEN YAYILIM)</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[9px] font-bold">
                {kaizens.filter(k => k.status === "COMPLETED").length}
              </span>
            </span>

            {kaizens.filter(k => k.status === "COMPLETED").map(k => (
              <div key={k.id} className="p-3 bg-white rounded-lg border border-emerald-250 shadow-xs space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border px-1.5 py-0.2 rounded">
                    {k.department}
                  </span>
                  <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 border px-1 py-0.2 rounded">YOKOTEN POOL</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 leading-snug">{k.title}</h4>
                
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9.5px] text-slate-500">
                  <span className="font-bold text-emerald-700 font-mono">+{formatMoney(k.annualBenefit)} / Yıl</span>
                  <span className="text-emerald-600 font-bold flex items-center">
                    <Award className="w-3.5 h-3.5 mr-0.5" /> Yokoten Hazır
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* YOKOTEN MANAGEMENT SYSTEM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* REPLICABLE YOKOTEN SYSTEM */}
        <div className={`rounded-xl border p-5 lg:col-span-2 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black tracking-tight text-orange-700 uppercase flex items-center">
                <Award className="w-4 h-4 mr-1.5 text-orange-600" />
                Yokoten Management: Yatay Yayılım Havuzu (Best Practices Replication)
              </h3>
              <p className="text-[10px] text-slate-450">
                Tamamlanmış kaizen projelerinden tüm fabrikaya hızla kopyalanabilecek kilit derslerin ve aksiyonların yönetimi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {yokotens.map((yk) => (
              <div key={yk.id} className="p-4 border rounded-xl hover:border-orange-300 transition-colors space-y-3 bg-white">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b pb-2 gap-2">
                  <div>
                    <span className="text-[9px] font-black bg-orange-50 text-orange-700 border px-1.5 py-0.5 rounded mr-1.5">{yk.department}</span>
                    <span className="text-xs font-black text-slate-900">{yk.name}</span>
                  </div>
                  <div className="flex space-x-1.5 text-[9.5px] font-bold shrink-0">
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 border rounded">Tasarruf: {formatMoney(yk.savings)}/Yıl</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 border rounded">Yayılım: {yk.replicationPotential}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Gemba Problemi:</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed mt-0.5">{yk.problem}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Standart Değişim Aksiyonu:</span>
                    <p className="text-[11px] text-slate-700 leading-relaxed mt-0.5">{yk.action}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase block">Görsel Önce/Sonra Durum:</span>
                    <p className="text-[10px] text-indigo-600 hover:underline leading-relaxed font-semibold mt-0.5">
                      📸 {yk.picturesBefore} → 📸 {yk.picturesAfter}
                    </p>
                  </div>
                </div>

                {/* Yokoten AI Intelligent Recommendation box */}
                <div className="p-3 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors rounded-lg border border-indigo-150 flex items-start gap-2.5 text-xs">
                  <span className="p-1 bg-indigo-650 rounded text-white font-sans shrink-0 font-black text-[9px] uppercase tracking-wide">AI Recommendation</span>
                  <div className="space-y-1">
                    <p className="font-extrabold text-indigo-900 leading-snug">
                      "This improvement performed in <span className="underline">{yk.department}</span> can also be applied to <span className="underline font-black">{yk.otherDepartments.join(" and ")}</span>."
                    </p>
                    <p className="text-[10px] text-slate-450 leading-relaxed">
                      Vernik nozul ve soket adaptör sistemi montaj dairesindeki makine hortumları ve taşlama soğutucu sıvısı renk değişimlerinde de aynı verimlilik kazancını (%45 duruş düşüşü) yakalayacaktır.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button 
                    onClick={() => {
                      alert(`${yk.otherDepartments.join(", ")} departmanlarına yokoten yayılım görevi atandı! İlgili şeflere A3 taslağı otomatik iletildi.`);
                    }} 
                    className="bg-gray-950 hover:bg-gray-800 text-white font-black text-[10px] uppercase tracking-tight px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Yokoten'i Diğer İstasyonlara Uygula (Apply)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* A3 PROJECT PROBLEM SOLVING REPORT GENERATOR */}
        <div className={`rounded-xl border p-5 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black tracking-tight text-emerald-800 uppercase flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-emerald-600" />
                A3 Project Management
              </h3>
              <p className="text-[10px] text-slate-450">
                Devreye alınan ve tamamlanan kaizen projelerinin standartlaştırılmış 1 sayfalık (A3) Yalın Raporu.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs font-sans">
            <div>
              <span className="text-[9.5px] text-slate-400 font-extrabold uppercase">Raporlanacak Proje Seçin</span>
              <select
                value={activeA3Project?.id}
                onChange={(e) => {
                  const sc = kaizens.find(k => k.id === e.target.value);
                  if (sc) setActiveA3Project(sc);
                }}
                className="w-full text-xs font-bold border rounded-lg bg-slate-50 px-2 py-1.5 focus:outline-none mt-1"
              >
                {kaizens.map(k => (
                  <option key={k.id} value={k.id}>{k.title}</option>
                ))}
              </select>
            </div>

            {activeA3Project && (
              <div className="p-4 rounded-xl border border-dashed bg-slate-50 space-y-3">
                <div className="text-center border-b pb-1.5">
                  <span className="text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border px-2 py-0.2 rounded">A3 METODOLOJİ RAPORU</span>
                  <h4 className="text-sm font-black text-slate-900 tracking-tight mt-1">{activeA3Project.title}</h4>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2 border-b">
                  <div>
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase">DEPARTMAN</span>
                    <p className="font-bold text-slate-700">{activeA3Project.department}</p>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase">SORUMLU</span>
                    <p className="font-bold text-slate-700">{activeA3Project.responsible}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[8.5px] text-rose-500 font-extrabold uppercase block">[1] PROBLEM DEFINITION (Problem Tanımı)</span>
                    <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                      {activeA3Project.problemDefinition || "İstasyonda oluşan plansız durma süreleri nedeniyle parça kayıplarının olması."}
                    </p>
                  </div>

                  <div>
                    <span className="text-[8.5px] text-indigo-500 font-extrabold uppercase block">[2] ROOT CAUSE (Kök Neden)</span>
                    <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                      {activeA3Project.rootCause || "TPM yetersizliği ve yağ sızıntıları."}
                    </p>
                  </div>

                  <div>
                    <span className="text-[8.5px] text-emerald-600 font-extrabold uppercase block">[3] COUNTERMEASURES & PLAN (Aksiyon Planı)</span>
                    <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                      {activeA3Project.countermeasures || "Kaba temizlik, sensör ve nozül yenileme aksiyonu, tork anahtarı standardı."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="bg-emerald-500/10 p-1.5 rounded text-center">
                    <span className="text-[8.5px] text-emerald-800 font-black block">HEDEFLENEN</span>
                    <span className="text-xs font-black text-slate-900">{formatMoney(activeA3Project.annualBenefit)} / Yıl</span>
                  </div>
                  <div className="bg-indigo-500/10 p-1.5 rounded text-center">
                    <span className="text-[8.5px] text-indigo-800 font-black block">GERÇEKLEŞEN</span>
                    <span className="text-xs font-black text-slate-900">
                      {activeA3Project.actualSaving ? formatMoney(activeA3Project.actualSaving) : formatMoney(activeA3Project.annualBenefit * 1.05)} / Yıl
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t text-[9.5px]">
                  <span className="text-slate-450">Bitiş Tarihi: {activeA3Project.dueDate}</span>
                  <span className={`px-2 py-0.5 rounded text-[8.5px] border font-black uppercase ${
                    activeA3Project.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300"
                  }`}>
                    {activeA3Project.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
