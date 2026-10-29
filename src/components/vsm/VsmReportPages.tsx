// VSM PDF report pages (plan step V8). Rendered off-screen only while a PDF is being produced; each
// `.vsm-report-page` (A4 landscape, 1123 × 794 px) is captured as an image and placed on its own PDF page.
// Images keep Turkish characters intact (jsPDF's built-in fonts cannot); the text is therefore not
// selectable in the PDF. All figures come from the same engine as the screens.
import React from "react";
import { useVsm } from "./VsmContext";
import { suggestFamilies } from "./vsmProductMatrix";
import { VSM_DESIGN_QUESTIONS } from "./vsmFuture";

const PAGE_W = 1123;
const PAGE_H = 794;
const ROWS_PER_PAGE = 16;

const stockLabel = (t?: string) => ({ pile: "Yığın", fifo: "FIFO", supermarket: "Süpermarket" } as Record<string, string>)[t || ""] || "—";
const dash = (v: any) => (v === undefined || v === null || v === "" ? "—" : v);
const fmt = (n: number | undefined, digits = 0) =>
  n === undefined || n === null || !Number.isFinite(n) ? "—" : n.toLocaleString("tr-TR", { maximumFractionDigits: digits });

function Page({ title, subtitle, no, total, projectName, children }: {
  title: string; subtitle?: string; no: number; total: number; projectName: string; children: React.ReactNode;
}) {
  return (
    <div className="vsm-report-page bg-white text-slate-900 font-sans flex flex-col" style={{ width: PAGE_W, height: PAGE_H, padding: "36px 44px" }}>
      <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2 mb-4">
        <div className="min-w-0 flex-1 pr-6">
          <div className="text-[11px] font-bold tracking-widest text-slate-500 uppercase whitespace-nowrap">Değer Akış Haritası</div>
          <div className="text-xl font-black whitespace-nowrap">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 whitespace-nowrap">{subtitle}</div>}
        </div>
        <div className="text-right text-[11px] text-slate-500 whitespace-nowrap shrink-0">{projectName}</div>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
      <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-200 pt-2 mt-3">
        <span className="whitespace-nowrap">Gemba Tools · VSM</span>
        <span className="whitespace-nowrap">Sayfa {no} / {total}</span>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) => (
  <div className="border border-slate-200 rounded-xl p-3">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-2xl font-black mt-1">{value}</div>
    {note && <div className="text-[10px] text-slate-500 mt-0.5">{note}</div>}
  </div>
);

const th = "border border-slate-300 bg-slate-900 text-white px-1.5 py-1 text-[10px] font-bold text-left";
const td = "border border-slate-200 px-1.5 py-1 text-[10px]";

export default function VsmReportPages() {
  const {
    reportImages, selectedProject, selectedCustomer, factorySetup, team, taktTime, pitchTime, dailyDemand,
    currentProcessesCalculated, dashboardData, simulationComparison, workforceAnalysis, workforceMethod,
    productMatrix, companyCurrency, endStocks, vsmProcesses, kaizenBursts, designAnswers, futureProcessesCalculated
  } = useVsm();
  if (!reportImages || !selectedProject) return null;

  const s = factorySetup;
  const c = dashboardData;
  const hasFuture = simulationComparison.hasEdits && !!reportImages.future;
  const rows = currentProcessesCalculated.map(p => ({ ...p, days: dailyDemand > 0 ? Math.round((p.inventoryBefore / dailyDemand) * 100) / 100 : 0 }));
  const chunks: typeof rows[] = [];
  for (let i = 0; i < Math.max(1, rows.length); i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
  const families = productMatrix.products.length > 0 ? suggestFamilies(productMatrix) : [];
  const pacemaker = vsmProcesses.find(p => p.id === s.pacemakerProcessId)?.name;
  const projectName = `${selectedCustomer?.companyName || ""} · ${selectedProject.name}`;

  const pages: { title: string; subtitle?: string; body: React.ReactNode }[] = [];

  pages.push({
    title: selectedProject.name,
    subtitle: [s.productFamily && `Ürün ailesi: ${s.productFamily}`, s.observationDate && `Gözlem: ${s.observationDate}`].filter(Boolean).join(" · "),
    body: (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Kpi label="Günlük talep" value={fmt(dailyDemand)} note={`haftalık ${fmt(s.weeklyDemand)} adet`} />
          <Kpi label="Takt" value={taktTime > 0 ? `${fmt(taktTime, 1)} sn` : "—"} note={pitchTime > 0 ? `pitch ${fmt(pitchTime / 60, 1)} dk` : undefined} />
          <Kpi label="Lead time" value={`${fmt(c.currentLeadTime, 1)} gün`} note={hasFuture ? `gelecek: ${fmt(c.futureLeadTime, 1)} gün` : "kritik yol"} />
          <Kpi label="Katma değer oranı (PCE)" value={`%${fmt(c.currentVaRatio, 3)}`} />
          <Kpi label="Toplam WIP" value={fmt(c.currentWip)} note="prosesler arası, adet" />
          <Kpi label="Darboğaz" value={<span className="text-lg">{c.currentBottleneckName}</span>} note={`OEE %${fmt(c.currentBottleneckOee, 1)}`} />
          <Kpi label="Operatör" value={fmt(c.currentBlueCollar)} note={`norm kadro: ${fmt(workforceAnalysis.totalGerekli)}`} />
          <Kpi label="Yıllık kayıp" value={`${fmt(c.currentWasteCost)} ${companyCurrency}`} note="girilen birim maliyetlerle" />
        </div>
        <div className="grid grid-cols-3 gap-4 text-[11px]">
          <div className="border border-slate-200 rounded-xl p-3 space-y-1">
            <div className="font-black text-xs mb-1">Kapsam & Ekip</div>
            <div>Kapsam: {[s.scopeStart, s.scopeEnd].filter(Boolean).join(" → ") || "—"}</div>
            <div>Hat: {dash(selectedProject.productionLine)} · Lider: {dash(selectedProject.leader)}</div>
            {team.length > 0 ? team.map((m, i) => <div key={i}>• {m.name}{m.role ? ` — ${m.role}` : ""}</div>) : <div>Ekip girilmedi.</div>}
          </div>
          <div className="border border-slate-200 rounded-xl p-3 space-y-1">
            <div className="font-black text-xs mb-1">Bilgi Akışı</div>
            <div>Müşteri → Planlama: {[s.customerOrderFrequency, s.customerOrderChannel].filter(Boolean).join(" · ") || "—"}</div>
            <div>Planlama → Tedarikçi: {[s.supplierOrderFrequency, s.supplierOrderChannel].filter(Boolean).join(" · ") || "—"}</div>
            <div>Çizelge: {s.scheduleMode === "pacemaker" ? `pacemaker (${dash(pacemaker)})` : "her prosese"}</div>
            <div>Planlama sistemi: {dash(s.planningSystem)} · Sipariş tipi: {dash(s.orderType)}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 space-y-1">
            <div className="font-black text-xs mb-1">Malzeme Akışı</div>
            <div>Tedarikçi: {dash(s.supplierName)} · {dash(s.supplierDelivery)}</div>
            <div>Hammadde: {fmt(s.rawMaterialQty)} adet ({endStocks.rawDays > 0 ? `${endStocks.rawDays} gün` : "—"}) · {stockLabel(s.rawMaterialType)}</div>
            <div>Mamul: {fmt(s.finishedGoodsQty)} adet ({endStocks.fgDays > 0 ? `${endStocks.fgDays} gün` : "—"}) · {stockLabel(s.finishedGoodsType)}</div>
            <div>Müşteriye sevk: {dash(s.shippingFrequency)} · {dash(s.customerShipmentBatch)}</div>
          </div>
        </div>
      </div>
    )
  });

  const mapPage = (src: string) => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl overflow-hidden">
      <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
    </div>
  );
  pages.push({ title: "Mevcut Durum Haritası", body: mapPage(reportImages.current) });
  if (hasFuture) pages.push({ title: "Gelecek Durum Haritası (simülasyon)", subtitle: "Simülasyondur; gerçekleşmiş sonuç değildir.", body: mapPage(reportImages.future!) });

  chunks.forEach((chunk, ci) => pages.push({
    title: "Proses Verileri — Mevcut Durum",
    subtitle: chunks.length > 1 ? `${ci + 1}. bölüm` : undefined,
    body: (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["#", "Proses", "M / O", "Vardiya", "C/T sn", "VA sn", "C/O dk", "Kullanılabilirlik", "OEE", "FPY", "Kapasite/gün", "WIP", "Gün", "Stok tipi", "Parti", "EPEI"].map(h => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {chunk.map((p, i) => (
            <tr key={p.id}>
              <td className={td}>{ci * ROWS_PER_PAGE + i + 1}</td>
              <td className={`${td} font-bold`}>{p.name}</td>
              <td className={td}>{p.machineCount} / {p.operatorCount}</td>
              <td className={td}>{p.shifts} × {fmt(p.workingHours / Math.max(1, p.shifts), 1)} sa</td>
              <td className={td}>{fmt(p.cycleTime, 1)}</td>
              <td className={td}>{fmt(p.valueAddedTime, 1)}</td>
              <td className={td}>{fmt(p.changeoverTime)}</td>
              <td className={td}>%{fmt(p.availability, 1)}</td>
              <td className={td}>%{fmt(p.oee, 1)}</td>
              <td className={td}>%{fmt(p.quality, 1)}</td>
              <td className={td}>{fmt(p.capacity)}</td>
              <td className={td}>{fmt(p.inventoryBefore)}</td>
              <td className={td}>{fmt(p.days, 2)}</td>
              <td className={td}>{stockLabel(p.inventoryType)}{p.inventoryType === "fifo" && p.fifoMax ? ` (maks ${p.fifoMax})` : ""}</td>
              <td className={td}>{fmt(p.batchSize)}</td>
              <td className={td}>{dash(p.epei)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td className={td} colSpan={16}>Proses girilmedi.</td></tr>}
        </tbody>
      </table>
    )
  }));

  pages.push({
    title: hasFuture ? "Göstergeler: Mevcut ↔ Gelecek" : "Göstergeler ve Norm Kadro",
    body: (
      <div className="grid grid-cols-2 gap-6">
        <table className="w-full border-collapse self-start">
          <thead><tr><th className={th}>Gösterge</th><th className={th}>Mevcut</th>{hasFuture && <th className={th}>Gelecek</th>}</tr></thead>
          <tbody>
            {([
              ["Lead time (gün)", fmt(c.currentLeadTime, 1), fmt(c.futureLeadTime, 1)],
              ["Toplam WIP (adet)", fmt(c.currentWip), fmt(c.futureWip)],
              ["PCE", `%${fmt(c.currentVaRatio, 3)}`, `%${fmt(c.futureVaRatio, 3)}`],
              ["Ortalama OEE", `%${fmt(c.currentAvgOee, 1)}`, `%${fmt(c.futureAvgOee, 1)}`],
              ["Darboğaz", c.currentBottleneckName, c.futureBottleneckName],
              ["Operatör", fmt(c.currentBlueCollar), fmt(c.futureBlueCollar)],
              ["Hat dengesi (C/T)", `%${fmt(c.currentCtBalance)}`, `%${fmt(c.futureCtBalance)}`],
              [`Yıllık kayıp (${companyCurrency})`, fmt(c.currentWasteCost), fmt(c.futureWasteCost)]
            ] as string[][]).map(r => (
              <tr key={r[0]}><td className={`${td} font-bold`}>{r[0]}</td><td className={td}>{r[1]}</td>{hasFuture && <td className={td}>{r[2]}</td>}</tr>
            ))}
            {hasFuture && <tr><td className={`${td} font-bold`}>Yıllık kayıp azalışı</td><td className={td} colSpan={2}>{fmt(c.annualSavings)} {companyCurrency} (simülasyon)</td></tr>}
          </tbody>
        </table>
        <div>
          <div className="text-xs font-black mb-2">Norm kadro ({workforceMethod === "takt" ? "takt bazlı" : "kapasite bazlı"})</div>
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>Proses</th><th className={th}>Mevcut</th><th className={th}>Gerekli</th><th className={th}>Fark</th></tr></thead>
            <tbody>
              {workforceAnalysis.perProcess.slice(0, 18).map(p => (
                <tr key={p.id}><td className={td}>{p.name}</td><td className={td}>{p.mevcut}</td><td className={td}>{p.gerekli}</td><td className={td}>{p.fark}</td></tr>
              ))}
              <tr><td className={`${td} font-bold`}>Toplam</td><td className={td}>{workforceAnalysis.totalMevcut}</td><td className={td}>{workforceAnalysis.totalGerekli}</td><td className={td}>{workforceAnalysis.surplus}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  });

  const answered = VSM_DESIGN_QUESTIONS.filter(q => (designAnswers[q.key] || "").trim());
  if (kaizenBursts.length > 0 || answered.length > 0) {
    const nameOf = (map: string, id?: string) => (map === "future" ? futureProcessesCalculated : vsmProcesses).find(p => p.id === id)?.name ?? "—";
    pages.push({
      title: "Gelecek Durum Tasarımı ve Kaizen Patlamaları",
      body: (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2 text-[11px]">
            <div className="text-xs font-black">Tasarım soruları</div>
            {answered.length === 0 && <div className="text-slate-500">Cevaplanmadı.</div>}
            {answered.map(q => (
              <div key={q.key}><div className="font-bold">{q.question}</div><div className="text-slate-700 whitespace-pre-wrap">{designAnswers[q.key]}</div></div>
            ))}
          </div>
          <table className="w-full border-collapse self-start">
            <thead><tr>{["#", "Kaizen", "Adım", "Hedef", "Sorumlu", "Termin", "Durum"].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {kaizenBursts.slice(0, 22).map((b, i) => (
                <tr key={b.id}>
                  <td className={td}>K{i + 1}</td><td className={`${td} font-bold`}>{b.title}</td><td className={td}>{nameOf(b.map, b.processId)}</td>
                  <td className={td}>{dash(b.target)}</td><td className={td}>{dash(b.owner)}</td><td className={td}>{dash(b.dueDate)}</td><td className={td}>{b.status || "Açık"}</td>
                </tr>
              ))}
              {kaizenBursts.length === 0 && <tr><td className={td} colSpan={7}>Kaizen patlaması yok.</td></tr>}
            </tbody>
          </table>
        </div>
      )
    });
  }

  if (productMatrix.products.length > 0) {
    const chosen = new Set(productMatrix.familyProductIds || []);
    pages.push({
      title: "Ürün Ailesi (Ürün–Proses Matrisi)",
      subtitle: `Rota benzerliği ≥ %${productMatrix.similarityPct ?? 80}`,
      body: (
        <div className="space-y-4">
          <table className="w-full border-collapse">
            <thead><tr><th className={th}>Ürün</th><th className={th}>Adet/hafta</th>{productMatrix.steps.map(x => <th key={x.id} className={th}>{x.name}</th>)}</tr></thead>
            <tbody>
              {productMatrix.products.slice(0, 14).map(p => (
                <tr key={p.id} className={chosen.has(p.id) ? "bg-indigo-50" : ""}>
                  <td className={`${td} font-bold`}>{p.name}{chosen.has(p.id) ? " ✓" : ""}</td>
                  <td className={td}>{fmt(p.weeklyVolume)}</td>
                  {productMatrix.steps.map(x => <td key={x.id} className={`${td} text-center`}>{p.stepIds.includes(x.id) ? "●" : ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            {families.slice(0, 6).map((f, i) => (
              <div key={f.key} className="border border-slate-200 rounded-xl p-2">
                <div className="font-black">Aile {i + 1} · %{f.sharePct}</div>
                <div>{f.names.join(", ")}</div>
              </div>
            ))}
          </div>
        </div>
      )
    });
  }

  return (
    <div id="vsm_report_pages" style={{ position: "fixed", left: -20000, top: 0, zIndex: -1 }} aria-hidden="true">
      {pages.map((p, i) => (
        <Page key={i} title={p.title} subtitle={p.subtitle} no={i + 1} total={pages.length} projectName={projectName}>{p.body}</Page>
      ))}
    </div>
  );
}
