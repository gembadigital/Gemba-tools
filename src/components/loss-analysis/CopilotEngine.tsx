import React, { useState } from "react";
import { CalculatedProcess } from "./types";
import { MessageSquare, Sparkles, Send, HelpCircle, Activity, Award, RefreshCw, Landmark, FileSpreadsheet, ArrowRight } from "lucide-react";

interface CopilotEngineProps {
  calculated: CalculatedProcess[];
  revenue: number;
  copq: any;
  financialImpact: any;
  hiddenFactory: any;
  currency: string;
  isDarkMode: boolean;
  recoveryData: any[];
  factoryId?: string;
  // Cost structure (% of revenue) from the Product Cost Model; 0 = not entered.
  costStructure?: { material: number; labor: number; energy: number; maintenance: number; overhead: number; operatingProfit: number };
  // Contribution margin per piece from the customer card (null = not derivable).
  contributionPerUnit?: number | null;
}

export default function CopilotEngine({
  calculated,
  revenue,
  copq,
  financialImpact,
  hiddenFactory,
  currency,
  isDarkMode,
  recoveryData,
  factoryId,
  costStructure = { material: 0, labor: 0, energy: 0, maintenance: 0, overhead: 0, operatingProfit: 0 },
  contributionPerUnit = null
}: CopilotEngineProps) {
  const [userQuery, setUserQuery] = useState("");
  const [chatLog, setChatLog] = useState<{ sender: "user" | "bot"; text: string }[]>([
    {
      sender: "bot",
      text: "Merhaba! Ben **Gemba Ai**, Kıdemli Operasyonel Mükemmellik (OpEx) Direktörü ve Finansal Kontrolörünüzüm. \n\nFabrikanın Gemba, OEE, VSM verileri ile Cost Control finansal maliyet yapılarını birleştirerek, COPQ (Kalitesizlik Maliyeti) ve Geri Kazanım Potansiyellerini kıyaslıyor ve firmanızın P&L (Kar-Zarar) tablosunu optimize edecek yüksek kazançlı Kaizen / CI yol haritaları sunuyorum. \n\nAşağıdaki kilit analiz sorularından birini seçebilir veya kendi P&L / Opex sorunuzu yazabilirsiniz!"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const samplePrompts = [
    { label: "Yol Haritası & Finansal Kıyaslama", query: "COPQ matrisi ile Geri Kazanım matrisini kıyasla ve bana P&L odaklı net bir iyileştirme yol haritası sun." },
    { label: "P&L Tablosu & Kar Etkisi", query: "Bu iyileştirmelerin gelir tablosuna (P&L) ve faaliyet kârına (EBITDA) etkisi nedir? Detaylı tablo olarak göster." },
    { label: "Yüksek Kazançlı Kaizen Önerileri", query: "Hangi süreçlerde, hangi yüksek kazançlı CI/Kaizen projelerini başlatmalıyım? Amortisman süreleri ne olur?" },
    { label: "Gizli Fabrika Kayıpları", query: "Gizli fabrika israflarının finansal dökümünü yapar mısın?" },
    { label: "SMED Setup Süresi Maliyeti", query: "Setup kayıplarından ne kadar kâr sızıntısı yaşıyoruz ve SMED etkisi ne olur?" },
    { label: "OEE %5 İyileşirse Ne Olur?", query: "Genel OEE ortalamasını %5 artırırsak faaliyet kârı ve kapasiteye yansıması nasıl olur?" }
  ];

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(val) + " " + currency;
  };

  const processQueryOffline = (input: string) => {
    const q = input.toLowerCase();
    
    // Compute data points dynamically for realistic comparisons
    const totalLoss = copq?.totalCOPQ_TL ?? 0;
    const totalRecovery = recoveryData ? recoveryData.reduce((sum, item) => sum + (item.avgGain ?? 0), 0) : 0;
    const recoveryRate = totalLoss > 0 ? (totalRecovery / totalLoss) * 100 : 0;
    
    // Sort opportunities
    const sortedOpp = recoveryData ? [...recoveryData].sort((a, b) => b.avgGain - a.avgGain) : [];
    const top1 = sortedOpp[0] || { subject: "Setup Süreleri (SMED)", avgGain: 0, avgLoss: 0, area: "Kapasite Yaratma" };
    const top2 = sortedOpp[1] || { subject: "Hurda Maliyeti", avgGain: 0, avgLoss: 0, area: "Doğrudan Maliyet Azaltma" };
    const top3 = sortedOpp[2] || { subject: "Plansız Duruşların Önlenmesi", avgGain: 0, avgLoss: 0, area: "Kapasite Yaratma" };

    // Figures below come from the screen's data; nothing is filled from fixed percentages.
    const pctOfRevenue = (v: number) => (revenue > 0 ? (v / revenue) * 100 : 0);
    const cs = costStructure;
    const currentEbitda = revenue * cs.operatingProfit / 100;
    const newEbitda = currentEbitda + totalRecovery;
    const currentMargin = pctOfRevenue(currentEbitda);
    const newMargin = pctOfRevenue(newEbitda);
    const fmtNum = (n: number) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
    const stationDaysYear = (p: CalculatedProcess) => p.workingDaysPerWeek * 52;
    // Setup hours per year and the pieces half of that time would give at ideal C/T.
    const setupHoursYear = calculated.reduce((acc, p) => acc + (p.setupTimeMinutes + p.machineAdjustmentMinutes) * p.setupFrequencyPerWeek * 52 / 60, 0);
    const halfSetupUnits = calculated.reduce((acc, p) => acc + (p.theoreticalCycleTime > 0 ? ((p.setupTimeMinutes + p.machineAdjustmentMinutes) * p.setupFrequencyPerWeek * 52 / 2) * 60 / p.theoreticalCycleTime : 0), 0);
    // +5 OEE points: 5 % of each station's net available time at ideal C/T.
    const oeeStations = calculated.filter(p => p.oee > 0);
    const avgOee = oeeStations.length > 0 ? oeeStations.reduce((acc, p) => acc + p.oee, 0) / oeeStations.length : 0;
    const plus5UnitsPerDay = oeeStations.reduce((acc, p) => acc + (p.theoreticalCycleTime > 0 ? p.dailyNetWorkingTimeAvailable * 60 / p.theoreticalCycleTime * 0.05 : 0), 0);
    const plus5UnitsYear = oeeStations.reduce((acc, p) => acc + (p.theoreticalCycleTime > 0 ? p.dailyNetWorkingTimeAvailable * 60 / p.theoreticalCycleTime * 0.05 * stationDaysYear(p) : 0), 0);

    let answer = "";

    if (q.includes("kıyasla") || q.includes("yol haritası") || q.includes("roadmap")) {
      answer = `### 🎯 COPQ & GERİ KAZANIM MATRİS KIYASLAMASI VE STRATEJİK YOL HARİTASI

Bir Opex Uzmanı ve Finansal Kontrolör gözüyle, fabrikanızın **COPQ Matrisi (Kayıp Seviyeleri)** ile **Geri Kazanım Matrisi (İyileştirme Potansiyelleri)** arasındaki çapraz kıyaslama sonuçları ve işletme için önerdiğim **Gerçekçi Yol Haritası** aşağıdadır:

#### 1. Finansal Kıyaslama Özeti
* **Toplam Kalitesizlik Maliyeti (COPQ Loss Baseline)**: **${formatMoney(totalLoss)} / Yıl** (Yıllık Cironun **%${pctOfRevenue(totalLoss).toFixed(1)}** kadarı)
* **Gerçekçi Hedeflenen Geri Kazanım (Average Expected Recovery)**: **${formatMoney(totalRecovery)} / Yıl** (Mevcut kayıpların **%${recoveryRate.toFixed(1)}**'i)
* **Kalan Kronik Kayıp (Unrecoverable Baseline)**: **${formatMoney(totalLoss - totalRecovery)} / Yıl** (Bu kısım uzun vadeli teknolojik ve yapısal yatırımlarla çözülebilir)

#### 2. Matris Kıyaslama Analizi
COPQ matrisindeki en büyük kayıp kalemi ile Geri Kazanım matrisindeki en hızlı (en yüksek ROI'li) fırsatları eşleştirdiğimizde 3 ana odak alanı ortaya çıkmaktadır:

1. **ÖNCELİK A: ${top1.subject}** (${(top1 as any).leanTool ?? "—"})
   * *COPQ Kaybı*: ${formatMoney(top1.avgLoss)} | *Geri Kazanım*: **${formatMoney(top1.avgGain)}**
2. **ÖNCELİK B: ${top2.subject}** (${(top2 as any).leanTool ?? "—"})
   * *COPQ Kaybı*: ${formatMoney(top2.avgLoss)} | *Geri Kazanım*: **${formatMoney(top2.avgGain)}**
3. **ÖNCELİK C: ${top3.subject}** (${(top3 as any).leanTool ?? "—"})
   * *COPQ Kaybı*: ${formatMoney(top3.avgLoss)} | *Geri Kazanım*: **${formatMoney(top3.avgGain)}**

#### 🗺️ 12 Aylık Uygulanabilir OpEx Yol Haritası (Roadmap)

| Aşama | Süre | Odak Alanı | Başlatılacak Metot | Beklenen P&L Etkisi (TL) |
| :--- | :--- | :--- | :--- | :---: |
| **Aşama 1** | 0-3 Ay | ${top1.subject} | **${(top1 as any).leanTool ?? "—"}** | +${formatMoney(top1.avgGain)} |
| **Aşama 2** | 3-6 Ay | ${top2.subject} | **${(top2 as any).leanTool ?? "—"}** | +${formatMoney(top2.avgGain)} |
| **Aşama 3** | 6-9 Ay | ${top3.subject} | **${(top3 as any).leanTool ?? "—"}** | +${formatMoney(top3.avgGain)} |
| **Aşama 4** | 9-12 Ay | Kalan fırsatlar | — | +${formatMoney(Math.max(0, totalRecovery - (top1.avgGain + top2.avgGain + top3.avgGain)))} |

**Gemba Ai Tavsiyesi**: En büyük beklenen kazanç **${top1.subject}** alanında (yıllık ortalama **${formatMoney(top1.avgGain)}**, Geri Kazanım Matrisi). Kazanç tutarları matrisin ortalamasıdır; gerçekleşme proje sonuçlarıyla izlenir.`;

    } else if (q.includes("p&l") || q.includes("faaliyet kârı") || q.includes("ebitda") || q.includes("gelir tablosu") || q.includes("kar etkisi")) {
      answer = `### 📊 GELİR TABLOSU (P&L) VE EBITDA FAALİYET KÂRI ETKİ RAPORU

Yalın dönüşüm ve sürekli iyileştirme faaliyetlerinin fabrikanın kâr-zarar (P&L) tablosuna doğrudan etkisini yansıtan finansal projeksiyon aşağıda listelenmiştir. Cost Control verilerine göre kurgulanan bu model, tüm tasarrufları doğrudan faaliyet kârına (EBITDA) yansıtır:

| Gelir Tablosu Kalemi (P&L) | Mevcut Durum | İyileştirme Sonrası | Değişim / Tasarruf | Marj Etkisi |
| :--- | :---: | :---: | :---: | :---: |
| **Yıllık Toplam Ciro** | **${formatMoney(revenue)}** | **${formatMoney(revenue)}** | 0 TL | Sabit Ciro Modeli |
| **Direkt Malzeme Maliyeti** | ${formatMoney(revenue * cs.material / 100)} | — | — | — |
| **Direkt İşçilik** | ${formatMoney(revenue * cs.labor / 100)} | — | — | — |
| **Enerji** | ${formatMoney(revenue * cs.energy / 100)} | — | — | — |
| **Bakım** | ${formatMoney(revenue * cs.maintenance / 100)} | — | — | — |
| **Genel Giderler (Overhead)**| ${formatMoney(revenue * cs.overhead / 100)} | — | — | — |
| **Toplam Geri Kazanım (Geri Kazanım Matrisi ort.)** | — | — | **-${formatMoney(totalRecovery)}** | — |
| **EBITDA (Faaliyet Kârı)** | **${formatMoney(currentEbitda)}** | **${formatMoney(newEbitda)}** | **+${formatMoney(totalRecovery)}** | ${currentEbitda > 0 ? `+%${(totalRecovery / currentEbitda * 100).toFixed(1)}` : "faaliyet kârı % girilmedi"} |
| **EBITDA Marjı (%)** | **%${currentMargin.toFixed(1)}** | **%${newMargin.toFixed(1)}** | **+${(newMargin - currentMargin).toFixed(1)} puan** | — |

#### 💸 Okuma notu:
1. Gider kalemleri Ürün Maliyet Modeli'ndeki maliyet yapısı %'lerinden gelir (girilmediyse 0). Kazancın kalemlere dağılımı ölçülmediği için gösterilmez; toplam geri kazanım EBITDA'ya eklenir.
2. Kapasite etkisi (talep varsa kayıp katkı payı) için **6. TPM Kayıp Maliyeti** sekmesindeki katkı payı sütununa bakın.`;

    } else if (q.includes("kaizen") || q.includes("ci") || q.includes("proje") || q.includes("amortisman")) {
      answer = `### 💎 YÜKSEK KAZANÇLI KAIZEN & CI PROJE REÇETELERİ

OpEx Direktörü olarak, en hızlı ve en yüksek finansal geri dönüşü (ROI) sağlayacak, yatırım bütçesi gerektirmeyen (Low-Cost / No-Cost) öncelikli 3 Kaizen projesini aşağıda detaylandırdım:

#### 🚀 PROJE 1: SMED ile Setup Sürelerinin %50 Azaltılması
* **İlgili İstasyon**: Kalıp değişim süresi en uzun olan darboğaz istasyonu.
* **Finansal Kazanım**: Yıllık **${formatMoney(top1.avgGain)}** doğrudan kâr artışı.
* **Yatırım / Geri Ödeme**: Geri Kazanım Matrisi'ndeki yatırım ve geri ödeme sütunlarına bakın.
* **CI Metodolojisi**: İçsel setup adımları dışsal setup adımlarına dönüştürülecek, 5S kuralları uygulanacak.

#### 🚀 PROJE 2: SPC & Poka-Yoke ile Günlük Hurda Adetlerinin Azaltılması
* **İlgili İstasyon**: En yüksek ıskarta oranına sahip istasyonlar.
* **Finansal Kazanım**: Yıllık **${formatMoney(top2.avgGain)}** malzeme ve kalite geri kazanımı.
* **Yatırım / Geri Ödeme**: Geri Kazanım Matrisi'ndeki yatırım ve geri ödeme sütunlarına bakın.
* **CI Metodolojisi**: Hata oluşmadan önce prosesi durduran Poka-Yoke mekanizmaları kurulacak. İstatistisel Proses Kontrol (SPC) ile varyasyonlar izlenecek.

#### 🚀 PROJE 3: TPM Otonom Bakım ile Plansız Makine Arızalarının Önlenmesi
* **İlgili İstasyon**: Sık arızalanan ve OEE'yi düşüren ana makineler.
* **Finansal Kazanım**: Yıllık **${formatMoney(top3.avgGain)}** duruş maliyeti tasarrufu.
* **Yatırım / Geri Ödeme**: Geri Kazanım Matrisi'ndeki yatırım ve geri ödeme sütunlarına bakın.
* **CI Metodolojisi**: Operatörlerin temizlik, yağlama ve sıkma işlemlerini üstlendiği Otonom Bakım (Autonomous Maintenance) adımları devreye alınacak.`;

    } else if (q.includes("gizli") || q.includes("hidden") || q.includes("israf")) {
      answer = `### 🏭 GİZLİ FABRİKA (HIDDEN FACTORY) FİNANSAL ANALİZİ

Fabrikanızın içinde, sadece hurdaları temizlemek, hatalı ürünleri yeniden işlemek (Rework), ekstra kalite kontrolleri yapmak ve malzemeleri gereksiz yere taşımak için çalışan görünmez bir **"Gizli Fabrika"** bulunmaktadır. 

#### 💸 Gizli Fabrika İsraflarının Finansal Dökümü:
1. **Hata & Yeniden İşleme (Rework) Maliyeti**: Yıllık **${formatMoney(copq?.reworkCost ?? 0)}** işçilik ve tekrar işleme kaybı.
2. **Hurda ve Malzeme Sızıntısı**: Yıllık **${formatMoney(copq?.scrapCost ?? 0)}** çöpe atılan hammadde değeri.
3. **Fazla Mesai Yükü (Overtime Burden)**: Operasyonel verimsizlikleri telafi etmek için yapılan fazla mesailerin yıllık maliyeti **${formatMoney(financialImpact?.overtime?.year ?? 0)}**.
4. **Envanter Bekleme Maliyeti (WIP Holding Cost)**: İstasyonlar arasında biriken yarı mamullerin finansal taşıma maliyeti yıllık **${formatMoney(financialImpact?.inventory?.year ?? 0)}**.

* **Toplam Yıllık Gizli Fabrika Maliyeti**: **${formatMoney(hiddenFactory?.hiddenCostYear ?? 0)} / Yıl**

#### 👷 Eşlenik Kayıplar:
* **Kayıp İş Gücü**: **${hiddenFactory?.equivalentOperators ?? 0} tam zamanlı operatör** sadece kalitesizlik ve israfları düzeltmek için çalışıyor.
* **Kayıp Makine Gücü**: Toplam kurulu gücün **%${(hiddenFactory?.equivalentMachineCapacityPercent ?? 0).toFixed(1)}**'i israf parça üretmekle meşgul ediliyor.

**CI Tavsiyesi**: Proses kalitesini güvence altına almadan hızı artırmak gizli fabrikayı büyütür. İlk olarak "Single-Piece Flow" (Tek Parça Akışı) ilkelerini devreye alarak ara stokları (WIP) eritmeli ve kalitesizliği kaynağında yakalamalıyız.`;

    } else if (q.includes("setup") || q.includes("smed") || q.includes("kurulum")) {
      answer = `### ⚙️ SETUP & AYAR KAYIPLARININ P&L ANALİZİ

Kalıp ve model değişimlerinden kaynaklanan setup süreleri fabrikanıza her yıl çok ciddi boyutta kâr kaybı yaşatmaktadır. Bu kayıp sadece zaman kaybı değil, aynı zamanda fırsat maliyetidir:

* **Yıllık Setup Kayıp Maliyeti**: **${formatMoney(financialImpact?.setup?.year ?? 0)} / Yıl**
* **Setup Geri Kazanım Hedefi (Geri Kazanım Matrisi ort.)**: **${formatMoney(recoveryData?.find((r: any) => r.subject === "Setup Süreleri (SMED)")?.avgGain ?? 0)} / Yıl**
* **Kapasiteye Etkisi**: Mevcut setup + ayar süresi yılda **${fmtNum(setupHoursYear)} saat**. Yarıya indirilirse açılan süre ideal çevrim süresiyle yaklaşık **${fmtNum(halfSetupUnits)} adet** ek üretime denk gelir (talep varsa).

**Yol Haritası**: SMED (Single Minute Exchange of Die) metodolojisini uygulayarak setup süreçlerini video analiziyle saniye saniye kırpacağız. Ayar aparatları pnömatik sistemlerle değiştirilecek ve tüm ön hazırlıklar makine durmadan tamamlanacaktır.`;

    } else if (q.includes("oee %5") || q.includes("%5") || q.includes("oee")) {
      answer = `### 📈 GENEL OEE ORTALAMASINI %5 PUAN ARTIRMANIN FİNANSAL ÇIKTILARI

${oeeStations.length === 0 ? "OEE'si hesaplanan istasyon yok (VSM'de OEE ya da Loss'ta eksiksiz girdi gerekir)." : `OEE'si olan ${oeeStations.length} istasyonun ortalaması **%${avgOee.toFixed(1)}**. Her birinde OEE **+5 puan** artarsa:

1. **Üretim Adet Kazanımı**: Günde yaklaşık **+${fmtNum(plus5UnitsPerDay)} adet** (net kullanılabilir sürenin %5'i, ideal çevrim süresiyle).
2. **Kapasite Artışı**: Ortalama OEE'ye göre **%${avgOee > 0 ? (5 / avgOee * 100).toFixed(1) : "0"}** göreli artış.
3. **Kâr Etkisi**: ${contributionPerUnit ? `Talep varsa yılda yaklaşık **${formatMoney(plus5UnitsYear * contributionPerUnit)}** katkı payı (${fmtNum(plus5UnitsYear)} adet × birim katkı payı).` : "Birim katkı payı şirket kartından türetilemedi (ciro, yıllık adet, malzeme ve enerji % gerekir)."}`}`;

    } else {
      answer = `### 🧠 GEMBA AI OPERASYONEL ANALİZ RAPORU

Yazdığınız "${input}" sorusunu fabrikanın finansal ve sahaya ait operasyonel verileri (OEE, VSM, COPQ, Geri Kazanım) ışığında değerlendirdim:

* **Yıllık Toplam Ciro**: ${formatMoney(revenue)}
* **Mevcut Kalitesizlik Maliyeti (COPQ)**: ${formatMoney(totalLoss)} (Cironun %${pctOfRevenue(totalLoss).toFixed(1)}'i)
* **Gerçekçi Geri Kazanım Tasarrufu**: ${formatMoney(totalRecovery)} / Yıl
* **EBITDA Kârlılık Kaldıracı**: Bu tasarruflar tamamlandığında EBITDA faaliyet kâr marjınız **%${currentMargin.toFixed(1)}** seviyesinden **%${newMargin.toFixed(1)}** seviyesine yükselecektir.

**Önerdiğim Aksiyon**: Bu tasarruf potansiyeline ulaşmak için en büyük fırsat alanlarımız olan **${top1.subject}** ve **${top2.subject}** konularında öncelikli olarak Kaizen ekiplerini kurmalıyız. 

Analiz etmek istediğiniz diğer P&L veya saha verimlilik detaylarını sorabilirsiniz!`;
    }

    setChatLog((prev) => [...prev, { sender: "bot", text: answer }]);
  };

  const handleSend = async () => {
    if (!userQuery.trim()) return;
    const q = userQuery;
    setChatLog((prev) => [...prev, { sender: "user", text: q }]);
    setUserQuery("");
    setIsTyping(true);

    const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
    const selectedCustomerId = factoryId || "";

    try {
      const response = await fetch("/api/gemini/copilot-chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-factory-id": selectedCustomerId
        },
        body: JSON.stringify({
          message: q,
          history: chatLog.slice(1).map(chat => ({
            role: chat.sender === "user" ? "user" : "model",
            content: chat.text
          })),
          copqData: copq,
          recoveryData,
          processes: calculated,
          financialImpact,
          revenue,
          currency
        })
      });

      const resData = await response.json();
      if (resData.success && resData.reply) {
        setChatLog((prev) => [...prev, { sender: "bot", text: resData.reply }]);
      } else {
        // Fallback offline
        processQueryOffline(q);
      }
    } catch (err) {
      console.warn("Gemini Copilot API failed, using high-fidelity OpEx fallback engine.", err);
      processQueryOffline(q);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div id="gemba_ai_copilot_container" className={`rounded-3xl border-2 p-6 transition-all ${
      isDarkMode 
        ? "bg-slate-900 border-rose-500/30 text-slate-100 shadow-2xl shadow-rose-950/20" 
        : "bg-white border-rose-100 text-slate-900 shadow-xl shadow-rose-50/40"
    }`}>
      <div className="border-b border-rose-100 dark:border-rose-950/30 pb-4 mb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-rose-700 rounded-xl text-white shadow-md animate-pulse">
              <Sparkles className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-black tracking-tight text-rose-850 dark:text-rose-400 uppercase font-sans">
              Gemba Ai — Kıdemli OpEx &amp; P&amp;L Danışmanı
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            COPQ kayıplarını ve Geri Kazanım matrislerini çapraz kıyaslayarak fabrikanın finansal tablosuna (P&amp;L) etkiyi ve kârlı yol haritalarını hesaplayan yapay zeka motoru.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-black px-2.5 py-1 rounded-lg uppercase tracking-wide">
            OpEx Expert Mode Active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SAMPLES SECTION */}
        <div className="lg:col-span-1 space-y-2.5">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider block">Stratejik Kilit Analizler:</span>
          {samplePrompts.map((p, idx) => (
            <button
              id={`sample_prompt_btn_${idx}`}
              key={idx}
              onClick={() => {
                setChatLog((prev) => [...prev, { sender: "user", text: p.query }]);
                setIsTyping(true);
                // Call real sender immediately
                setUserQuery(p.query);
                setTimeout(() => {
                  // Trigger sending
                  const token = localStorage.getItem("gemba_token") || sessionStorage.getItem("gemba_token") || "";
                  const selectedCustomerId = factoryId || "";
                  fetch("/api/gemini/copilot-chat", {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${token}`,
                      "Content-Type": "application/json",
                      "x-factory-id": selectedCustomerId
                    },
                    body: JSON.stringify({
                      message: p.query,
                      history: chatLog.slice(1).map(chat => ({
                        role: chat.sender === "user" ? "user" : "model",
                        content: chat.text
                      })),
                      copqData: copq,
                      recoveryData,
                      processes: calculated,
                      financialImpact,
                      revenue,
                      currency
                    })
                  })
                  .then(r => r.json())
                  .then(res => {
                    if (res.success && res.reply) {
                      setChatLog((prev) => [...prev, { sender: "bot", text: res.reply }]);
                    } else {
                      processQueryOffline(p.query);
                    }
                  })
                  .catch(() => {
                    processQueryOffline(p.query);
                  })
                  .finally(() => {
                    setIsTyping(false);
                    setUserQuery("");
                  });
                }, 100);
              }}
              className="w-full text-left p-3 rounded-xl border text-[11px] font-bold transition-all bg-slate-50 dark:bg-slate-800/40 hover:bg-rose-50 hover:text-rose-900 dark:hover:bg-rose-950/20 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2 shadow-xs group"
            >
              <span className="flex-1 leading-tight group-hover:translate-x-0.5 transition-transform">{p.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-450 dark:text-slate-500 mt-0.5 shrink-0" />
            </button>
          ))}
        </div>

        {/* CHAT INTERACTIVE WINDOW */}
        <div className={`lg:col-span-3 border-2 rounded-2xl flex flex-col justify-between min-h-[420px] max-h-[500px] relative overflow-hidden shadow-sm ${
          isDarkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50/10 border-slate-200/80"
        }`}>
          
          {/* Typings banner */}
          {isTyping && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-15">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-700" />
              <div className="text-xs font-black text-slate-700 dark:text-slate-300 animate-pulse">
                Gemba Ai Kayıpları &amp; Kâr Marjını Analiz Ediyor...
              </div>
            </div>
          )}

          {/* CHAT MESSAGES BODY */}
          <div className="p-4 space-y-4 overflow-y-auto font-sans flex-1 max-h-[420px]">
            {chatLog.map((chat, idx) => (
              <div 
                key={idx} 
                className={`flex ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[88%] rounded-2xl p-4 text-xs shadow-md leading-relaxed ${
                  chat.sender === "user" 
                    ? "bg-slate-900 text-white rounded-br-none" 
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-bl-none prose-ai-md"
                }`}>
                  {chat.sender === "bot" ? (
                    <div className="space-y-3">
                      {chat.text.split("\n").map((line, lIdx) => {
                        if (line.startsWith("###")) {
                          return (
                            <h4 key={lIdx} className="font-extrabold text-[13px] border-b pb-1 text-rose-800 dark:text-rose-400 mt-3 uppercase tracking-tight flex items-center gap-1.5">
                              <Landmark className="w-4 h-4 text-rose-600" />
                              {line.replaceAll("###", "").trim()}
                            </h4>
                          );
                        }
                        if (line.startsWith("####")) {
                          return (
                            <h5 key={lIdx} className="font-black text-slate-800 dark:text-slate-200 mt-2 text-xs flex items-center gap-1">
                              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                              {line.replaceAll("####", "").trim()}
                            </h5>
                          );
                        }
                        if (line.startsWith("*") || line.startsWith("-")) {
                          const cleanText = line.substring(line.startsWith("*") ? 2 : 1).trim();
                          const isBoldSegment = cleanText.startsWith("**") && cleanText.includes("**:");
                          
                          return (
                            <li key={lIdx} className="ml-4 list-disc text-slate-700 dark:text-slate-300 text-[11px] mb-1.5 leading-relaxed">
                              {cleanText}
                            </li>
                          );
                        }
                        if (line.trim().startsWith("|")) {
                          // Render tables elegantly in custom format
                          const cells = line.split("|").map(c => c.trim()).filter(c => c !== "");
                          if (line.includes("---")) return null; // skip separators
                          const isHeader = lIdx === 0 || chat.text.split("\n")[lIdx-1]?.includes("---") === false && lIdx < 5; 
                          return (
                            <div key={lIdx} className={`grid grid-cols-${cells.length} gap-2 py-1 px-2 text-[10.5px] border-b border-slate-100 dark:border-slate-800/50 ${
                              isHeader ? "bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white" : "font-mono text-slate-700 dark:text-slate-350"
                            }`}>
                              {cells.map((cell, cIdx) => (
                                <div key={cIdx} className="truncate">{cell}</div>
                              ))}
                            </div>
                          );
                        }
                        return <p key={lIdx} className="text-slate-700 dark:text-slate-300 text-[11.5px] whitespace-pre-wrap">{line}</p>;
                      })}
                    </div>
                  ) : (
                    <p className="font-bold font-mono">{chat.text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* INPUT FORM CONTAINER */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex gap-2">
              <input 
                id="gemba_ai_query_input"
                type="text" 
                placeholder="Örn: COPQ ve Geri Kazanım matrislerini karşılaştırıp kârlılık yol haritası sun..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 text-xs px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
              />
              <button 
                id="gemba_ai_query_submit_btn"
                onClick={handleSend}
                className="bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs px-5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md shadow-rose-950/10 transition-all active:scale-95"
              >
                <span>Analiz İste</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
