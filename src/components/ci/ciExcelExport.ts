// CI project Excel exports (project card, before-after form). Moved out of KaizenManager (plan step
// C1); output unchanged. Both build an HTML table saved as .xls, which Excel opens with the styling.
import type { KaizenCard, BeforeAfterKaizenStudy } from "../../types";

// Export CI Improvement Project Card to Excel (.xls) formatted with styled tables and borders
export const exportKaizenCardToExcel = (proj: KaizenCard, projNo: string, customerName?: string, currencySymbol: string = "₺") => {
  const fileName = `${projNo}_CI_Proje_Karti.xls`;

  const tasksRows = (proj.tasks && proj.tasks.length > 0)
    ? proj.tasks.map((t, idx) => `
      <tr style="height: 24px;">
        <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; font-weight: bold; font-size: 10pt; font-family: Calibri, sans-serif; padding-left: 6px;">${t.name || '-'}</td>
        <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.responsible || '-'}</td>
        <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.deadline || '-'}</td>
        <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 10pt; font-family: Calibri, sans-serif;">%${t.progressPercent ?? 0}</td>
        <td style="border: 1px solid #cbd5e1; text-align: center; font-size: 10pt; font-family: Calibri, sans-serif;">${t.status || 'Açık'}</td>
      </tr>
    `).join('')
    : `<tr style="height: 24px;"><td colspan="6" style="border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-style: italic; font-size: 10pt; font-family: Calibri, sans-serif;">Tanımlanmış alt faaliyet bulunmuyor.</td></tr>`;

  const impactAnalysisItems = proj.impactAnalysis 
    ? Object.entries(proj.impactAnalysis).map(([key, val]) => `${key}: ${val}`).join(' | ')
    : 'Belirtilmedi';

  const html = `
    <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>CI Proje Kartı</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        td { vertical-align: middle; }
      </style>
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; width: 100%;">
        
        <!-- BRAND & HEADER ROW -->
        <tr style="height: 40px; background-color: #1e1b4b;">
          <td colspan="6" style="text-align: center; color: #ffffff; font-size: 15pt; font-weight: bold; font-family: Arial, sans-serif; background-color: #1e1b4b;">
            SÜREKLİ İYİLEŞTİRME (CI) PROJE KARTI & AKSİYON TAKİP FORMU
          </td>
        </tr>

        <!-- META ROW 1 -->
        <tr style="height: 26px; background-color: #f8fafc;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Müşteri / Fabrika:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1e1b4b; padding-left: 8px;">${customerName || 'Varsayılan Müşteri'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Numarası:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #4338ca; font-family: monospace; padding-left: 8px;">${projNo}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Durumu:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; padding-left: 8px;">${proj.status === 'Completed' ? 'Tamamlandı (ACT)' : (proj.kanbanStatus || 'PLAN')}</td>
        </tr>

        <!-- 1. PROJE KİMLİĞİ & SORUMLULAR -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            1. PROJE KİMLİĞİ VE TEMEL BİLGİLER
          </td>
        </tr>
        <tr style="height: 28px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Adı / Konusu:</td>
          <td colspan="5" style="border: 1px solid #cbd5e1; font-weight: bold; font-size: 12pt; color: #0f172a; padding-left: 8px;">${proj.title || '-'}</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Departman:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.department || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Fazı:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.phase || 'Phase 1'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">İlerleme Aşaması:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px; color: #4338ca;">${proj.progressStep || 'Planlama'}</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Lideri:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${proj.projectLeader || proj.originator || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Proje Sponsoru:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.projectSponsor || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Etki Seviyesi:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.impactLevel || 'Medium'} Impact</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Teklif Tarihi:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.dateProposed || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Planlanan Bitiş:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.plannedFinishDate || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Gerçekleşen Bitiş:</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.realizedFinishDate || '-'}</td>
        </tr>

        <!-- 2. PROBLEM TANIMI & MEVCUT DURUM -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            2. PROBLEM TANIMI VE MEVCUT DURUM (GEMBA İNCELEMESİ)
          </td>
        </tr>
        <tr style="height: 36px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Problem Tanımı:</td>
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px; color: #0f172a;">${proj.problemDefinition || proj.descriptionBefore || proj.description || '-'}</td>
        </tr>
        <tr style="height: 36px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Mevcut Durum Detayı:</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.problemDetail || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Mevcut Yıllık Kayıp:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #b91c1c; padding-left: 8px;">${currencySymbol}${(proj.currentLoss || 0).toLocaleString()}</td>
        </tr>

        <!-- 3. ETKİ ANALİZİ & KÖK NEDEN -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            3. ETKİ ANALİZİ VE KÖK NEDEN ANALİZİ (5 NEDEN / BALIK KILÇIĞI)
          </td>
        </tr>
        <tr style="height: 28px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Etki Alanları:</td>
          <td colspan="5" style="border: 1px solid #cbd5e1; padding-left: 8px; font-weight: bold; color: #334155;">${impactAnalysisItems}</td>
        </tr>
        <tr style="height: 36px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kök Neden Analizi:</td>
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.rootCause || '-'}</td>
        </tr>

        <!-- 4. HEDEFLER VE FİNANSAL KAZANIMLAR -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            4. HEDEFLER VE BÜTÇE / NET FİNANSAL KAZANIMLAR
          </td>
        </tr>
        <tr style="height: 28px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedeflenen Durum:</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; padding-left: 8px;">${proj.targetObjective || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef KPI:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px; color: #1e1b4b;">${proj.targetKpi || '-'}</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef İyileştirme %:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">%${proj.targetRatio || 0}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Hedef Tasarruf:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${currencySymbol}${(proj.targetCostReduction || 0).toLocaleString()}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Tahmini Bütçe:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${currencySymbol}${(proj.estimatedCost || 0).toLocaleString()}</td>
        </tr>
        <tr style="height: 28px; background-color: #f0fdf4;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #e2e8f0; color: #334155; padding-left: 8px;">Beklenen Kazanım:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1d4ed8; padding-left: 8px;">${proj.expectedGainCurrency || currencySymbol}${(proj.expectedGain || 0).toLocaleString()}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #dcfce7; color: #14532d; padding-left: 8px;">Gerçekleşen Tasarruf:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; font-size: 11pt; padding-left: 8px; background-color: #dcfce7;">${proj.realizedGainCurrency || currencySymbol}${(proj.realizedGain || proj.actualSavings || 0).toLocaleString()}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #dcfce7; color: #14532d; padding-left: 8px;">Gerçekleşen İyileştirme:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; font-size: 11pt; padding-left: 8px; background-color: #dcfce7;">%${proj.realizedImprovementPct || 0}</td>
        </tr>

        <!-- 5. UYGULAMA PLANI (6. ADIM AKSİYON LİSTESİ) -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            5. UYGULAMA PLANI VE AKSİYON TAKİP TABLOSU (6. UYGULAMA ADIMI)
          </td>
        </tr>
        <tr style="height: 26px; background-color: #e2e8f0;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 6%;">#</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: left; padding-left: 8px; width: 44%;">Alt Faaliyet / Aksiyon Adı</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 18%;">Sorumlu</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 12%;">Termin Tarihi</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 10%;">Tamamlanma %</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; width: 10%;">Durum</td>
        </tr>
        ${tasksRows}

        <!-- 6. STANDARTLAŞTIRMA VE SÜRDÜRÜLEBİLİRLİK -->
        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="6" style="border: 1px solid #1e1b4b; font-weight: bold; color: #ffffff; font-size: 11pt; padding-left: 10px; background-color: #312e81;">
            6. STANDARTLAŞTIRMA VE YAYGINLAŞTIRMA ADIMLARI (7. & 8. ADIM)
          </td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Standart İş Güncellendi:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.stdWorkUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.stdWorkUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Talimat Revize Edildi:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.instructionRevised ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.instructionRevised ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Eğitim Verildi:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.trainingGiven ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.trainingGiven ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kontrol Planı Güncellendi:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.controlPlanUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.controlPlanUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Denetim Listesi Güncellendi:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: ${proj.auditListUpdated ? '#16a34a' : '#64748b'}; padding-left: 8px;">${proj.auditListUpdated ? 'EVET [✓]' : 'HAYIR [ ]'}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kapanış Sonucu:</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #15803d; padding-left: 8px;">${proj.projectResult || 'Başarılı'}</td>
        </tr>
        <tr style="height: 36px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">Kapanış Açıklaması:</td>
          <td colspan="5" style="border: 1px solid #cbd5e1; padding: 6px 8px;">${proj.resultDescription || 'Proje başarıyla tamamlanmış ve finansal tasarruf tescil edilmiştir.'}</td>
        </tr>

      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Recreates the real "Kaizen Öncesi Sonrası" (Before-After Kaizen) one-pager the firm already
// uses on paper/in a standalone Excel template — same HTML-table-to-.xls technique as
// exportKaizenCardToExcel above, but embeds the before/after photos directly (they're already
// persisted as base64 data URLs, same as problem/result photos elsewhere on the card).
export const exportBeforeAfterKaizenToExcel = (study: BeforeAfterKaizenStudy, customerName?: string, currencySymbol: string = "₺") => {
  const fileName = `Once_Sonra_Kaizen_${study.subject.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+/g, "_").slice(0, 40)}.xls`;
  const b = study.benefits || {};
  const checkbox = (checked: boolean) => checked ? "☑" : "☐";

  const html = `
    <html xmlns:o="urn:schemas-microsoft-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Once-Sonra Kaizen</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>td { vertical-align: middle; }</style>
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; font-family: Calibri, sans-serif; width: 100%;">

        <tr style="height: 46px; background-color: #1e1b4b;">
          <td colspan="4" style="text-align: center; color: #ffffff; font-size: 16pt; font-weight: bold; font-family: Arial, sans-serif; background-color: #1e1b4b;">
            ÖNCESİ SONRASI İYİLEŞTİRME ÇALIŞMALARI
          </td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">TARİH</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #1e1b4b; padding-left: 8px;">${study.date || "-"}</td>
        </tr>
        <tr style="height: 26px;">
          <td colspan="4" rowspan="2"></td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">ÇALIŞMAYI YAPAN</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.doneBy || "-"}</td>
        </tr>
        <tr style="height: 26px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">BÖLÜMÜ</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.department || "-"}</td>
        </tr>

        <tr style="height: 32px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">KONU :</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; padding-left: 8px;">${study.subject || "-"}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">KATEGORİ</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">
            ${checkbox(study.category === "Verimlilik")} Verimlilik &nbsp; ${checkbox(study.category === "Kalite")} Kalite &nbsp; ${checkbox(study.category === "Güvenlik")} Güvenlik
          </td>
        </tr>
        <tr style="height: 32px;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">HEDEF :</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; padding-left: 8px;">${study.target || "-"}</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">ALAN</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 8px;">
            ${checkbox(study.area === "5S")} 5S &nbsp; ${checkbox(study.area === "Maliyet")} Maliyet
          </td>
        </tr>

        <tr style="height: 30px; background-color: #312e81;">
          <td colspan="3" style="border: 1px solid #1e1b4b; text-align: center; font-weight: bold; color: #ffffff; font-size: 11pt; background-color: #312e81;">İYİLEŞTİRME ÖNCESİ</td>
          <td colspan="3" style="border: 1px solid #1e1b4b; text-align: center; font-weight: bold; color: #ffffff; font-size: 11pt; background-color: #312e81;">İYİLEŞTİRME SONRASI</td>
        </tr>
        <tr style="height: 220px;">
          <td colspan="3" style="border: 1px solid #cbd5e1; text-align: center; background-color: #f8fafc;">
            ${study.beforeImage ? `<img src="${study.beforeImage}" style="max-width: 320px; max-height: 220px;" />` : `<span style="color:#94a3b8; font-style: italic;">Görsel eklenmedi</span>`}
          </td>
          <td colspan="3" style="border: 1px solid #cbd5e1; text-align: center; background-color: #f8fafc;">
            ${study.afterImage ? `<img src="${study.afterImage}" style="max-width: 320px; max-height: 220px;" />` : `<span style="color:#94a3b8; font-style: italic;">Görsel eklenmedi</span>`}
          </td>
        </tr>

        <tr style="height: 24px;">
          <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">AÇIKLAMA:</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">AÇIKLAMA:</td>
        </tr>
        <tr style="height: 70px;">
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.descriptionBefore || "-"}</td>
          <td colspan="3" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.descriptionAfter || "-"}</td>
        </tr>

        <tr style="height: 24px;">
          <td colspan="6" style="border: 1px solid #cbd5e1; font-weight: bold; background-color: #f1f5f9; color: #334155; padding-left: 8px;">
            GETİRİ AÇIKLAMASI : (Parasal veya Oran bazında getirinin rakamsal ifadesi)
          </td>
        </tr>
        <tr style="height: 50px;">
          <td colspan="6" style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top;">${study.benefitDescription || "-"}</td>
        </tr>

        <tr style="height: 26px; background-color: #f8fafc;">
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Maliyet</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Verimlilik</td>
          <td style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Kalite</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; font-weight: bold; text-align: center; background-color: #e0e7ff; color: #1e1b4b;">Güvenlik</td>
        </tr>
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Enerji: ${b.costEnergy || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Makine: ${b.productivityMachine || "-"}</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Ürün: ${b.qualityProduct || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Risk Derecesi: ${b.safetyRiskDegree || "-"}</td>
        </tr>
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">İş Gücü: ${b.costLabor || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Adam: ${b.productivityMan || "-"}</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.qualityMaterial || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">KSO: ${b.safetyKso || "-"}</td>
        </tr>
        <tr style="height: 24px;">
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.costMaterial || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px;">Malzeme: ${b.productivityMaterial || "-"}</td>
          <td style="border: 1px solid #cbd5e1; padding-left: 6px;">Fire: ${b.qualityScrap || "-"}</td>
          <td colspan="2" style="border: 1px solid #cbd5e1; padding-left: 6px; font-size: 9pt; color: #64748b;">(*Kaza Sıklık Oranı)</td>
        </tr>

        <tr style="height: 20px;">
          <td colspan="6" style="border: 1px solid #cbd5e1; font-size: 8pt; color: #94a3b8; padding-left: 6px;">
            ${customerName || ""} — Gemba Partner CI Proje Yönetimi
          </td>
        </tr>

      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
