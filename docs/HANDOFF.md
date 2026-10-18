# Handoff — Master Plan / PTR / Ticket / Document Vault session

Bu dosya, yeni bir Claude Code konuşmasının "önceki konuşmada ne yapıldı, nereye bağlıyız" sorusunu
buradan okuyarak cevaplayabilmesi için yazıldı. Kod haritası için `graphify-out/GRAPH_REPORT.md` ve
`graphify-out/graph.json` (graphify bilgi grafiği) bu dosyayla birlikte okunmalı.
Altyapı ayrıntısı için ayrıca [DEPLOYMENT.md](DEPLOYMENT.md).

> **Güvenlik notu:** Bu dosyada yalnızca ortam değişkeni *adları* ve URL'ler vardır. Hiçbir secret /
> bağlantı dizesi / token değeri yazılmamalı; `.env*` dosyaları git'e ve graphify'a dahil edilmez.

## 1. Bağlantı haritası (nereye bağlıyız)

| Katman | Nerede | Not |
|---|---|---|
| Kaynak kod | GitHub `gembadigital/Gemba-tools`, branch `main` | Yerel kopya: `/Users/atakanzehir/Claude/5SAudit/gemba-tools`. Push sırasında "repository moved" uyarısı normal (büyük/küçük harf yönlendirmesi). |
| Hosting | Vercel, team `gemba-digital`, proje `gemba-tools` — https://vercel.com/gemba-digital/gemba-tools | `main`'e push → otomatik deploy. |
| Canlı URL | **https://gemba-tools.vercel.app** | Production korumasız (Standard Protection yalnızca preview'leri kapatır). `...-1cu79ota8-...vercel.app` belirli bir deployment URL'sidir, paylaşmayın. |
| Veritabanı | Neon Postgres — https://console.neon.tech/app/projects/wandering-truth-24635321 | Vercel–Neon storage entegrasyonu `DATABASE_URL`'i otomatik enjekte eder; elle yapıştırılmış değil. Tüm veri tek genel `records` tablosunda (`id, collection, organization_id, factory_id, data jsonb, created_at, updated_at`). Şema: `supabase/schema.sql`. |
| Giden e-posta | Microsoft Graph, OAuth2 client-credentials (app-only) | Env adları: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `MAIL_FROM`. SMTP/nodemailer **yok**, geri eklemeyin. Kod: `sendMail()`/`getGraphAccessToken()` — `src/server/app.ts`. |
| Cron | Vercel Cron (`vercel.json` → `crons`) | `/api/cron/weekly-consultant-digest`, Pazartesi 05:00 UTC; `CRON_SECRET` gerektirir. |
| Diğer env adları | `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `APP_URL`, `PTR_EXCEL_TEMPLATE_PATH`, `CRON_SECRET` | Değerler yalnızca Vercel'de. Yerel `.env`'de `DATABASE_URL` **yok**. |
| Vercel MCP | Yanlış Vercel hesabına bağlı | `gemba-tools` projesini göremez (404). Deploy durumunu kullanıcıya dashboard'dan baktırın. |

**Güncelleme (2026-10-17):** yerel `.env` artık bir `DATABASE_URL` içeriyor ve canlı Neon veritabanını
(`…-pooler…us-east-1.aws.neon.tech/neondb`) gösteriyor — yerelden okunan/yazılan her şey **canlı veridir**.
Canlı veriye yazmadan önce kullanıcı onayı alın ve kaydın yedeğini alın. Supabase'deki "gembadigital's Project"
bu uygulamanın veritabanı değildir (başka bir CRM). Vercel MCP hâlâ yalnızca `gemba-iq` projesini görür.

**Yerel doğrulama sınırı:** yerelde `DATABASE_URL` olmadığından uygulamaya giriş yapılamıyor; dev
sunucu yalnızca login ekranına kadar açılıyor. Bu oturumdaki UI değişiklikleri `tsc --noEmit`,
`npm run build`, login ekranının hatasız açılması ve bağımsız mantık simülasyonlarıyla doğrulandı —
**gerçek oturumda uçtan uca denenmedi.** Canlıda kullanıcı doğrulaması gerekir.

## 2. Çalışma kuralları (kullanıcı tercihi)

- Kullanıcı Türkçe konuşur; yanıtlar Türkçe.
- İstenen her düzeltme/özellik commit edilip **hemen `origin/main`'e push edilir**, onay sorulmaz
  (destructive git işlemleri hariç).
- Dummy/demo veri istenmez: yeni müşteri tamamen boş başlamalı (yalnızca müşteri kartı elle girilir).
- Commit sonuna `Co-Authored-By: Claude ...` satırı eklenir.

## 3. Bu oturumda yapılanlar (commit sırasıyla)

| Commit | Özet |
|---|---|
| `21e652b` | Master Plan: Excel import düzeltmesi (`readAsArrayBuffer` + `type:"array"`), Yalın Sınıfı'na Saha Gözlemi/Süreç Analizi/Kick Off/Eğitim eklendi, "Müşteri Sahibi" kaldırıldı, Planlanan Adam-Gün 0 girilebilir, Paralel Faaliyet No, Alt Faaliyet (hiyerarşi, "alt ›"/"‹"), İlişkili Yalın Modül tüm araçları kapsıyor. |
| `4008392` | Faz No dropdown (F1…; "en yüksek kullanılan + 1", taban F1–F3). Spaghetti (`FlowImprovement.tsx`) sahte varsayılan fabrika yerleşimi silindi; Fiziksel Alan Ölçüleri (Genişlik/Uzunluk) 0 girilebilir. |
| `9aabcb2` | Excel import "0 satır" hatasının asıl kökü: export dosyasında başlık satırı 1. satırda değil + faaliyet başına 2 satır (PLANLANAN/GERÇEKLEŞEN). Başlık satırı otomatik bulunuyor, GERÇEKLEŞEN satırı atlanıyor, "W24" biçimi okunuyor. |
| `d335b72` | Timeline/Kanban'a X (sil) butonu; Faaliyet Ekle modalı kaydırılabilir (Kaydet/Vazgeç artık erişilebilir). |
| `8f0481c` | Satırlar `activityNo`'ya göre sıralanıyor (Yukarı/Aşağı artık satırı gerçekten taşıyor); filtre aktifken yanlış faaliyeti taşıma hatası; alt faaliyetler ebeveynin altında gruplanıyor. |
| `453cbdb` | Gerçekleşen tarih kaydırması PTR senkronu tarafından geri alınıyordu → `manualActualOverride` bayrağı. |
| `22833db` | Timeline Plan/Gerçekleşen barlarında sürükle-taşı / kenardan boyutlandır. |
| `317f6a2` | PTR başlığından "Aksiyon Kütüğü" kaldırıldı; Haftalık OPEX Faaliyet Raporu'na **Danışman Faaliyet Özeti** (danışman başına/hafta not, isimle, kalıcı) eklendi; notlar PTR "Mail Gönder" e-posta gövdesine yazılıyor. |
| `3e137d9` | **Ticket** sekmesi (Admin+Consultant) + Customer User'ın profil/şifre ile sınırlanması; **Doküman Kasası gerçek dosya depolama** (base64, 3 MB sınır, indirme butonu). |

| `7dab826` | Kontrol turu: Yamazumi'deki "Örnek Üretim Verilerini Yükle" (sabit demo veri seti) → "Tabloyu Temizle"; Şirket Profili kişi listesindeki sabit Arçelik yönetici isim/e-posta fallback'i kaldırıldı; 5S seviyesi 0 girilebilir. |
| `14404e7` | Uygulama kabuğu `h-screen`: sol menü sabit (yalnızca ekran kısaysa kendi içinde kayar), sayfa içeriği çerçeveli (`#app-main-scroll`) alanda kendi kaydırmasıyla. Pencereyi kaydıran kod artık `#app-main-scroll`'u kaydırmalı. |
| `8c1686d` | **OpEx Assessment çok denetçili akış:** Admin denetimi açar ve bölümleri (A-D → X, E-G → Y) atar; denetçi yalnızca kendi bölümlerini puanlar/yorumlar; Admin "Bölümleri Birleştir ve Kilitle" + Excel indirir. Sunucu kaydı bölüm bazında birleştirir (`src/server/opexMerge.ts`, istemci `_editedCategories` gönderir), skorları kendisi hesaplar (`src/utils/opexScoring.ts`). Simülasyon seçicisi ve özet-PDF kaldırıldı; rapor yalnızca Excel. |
| `bf0e1db` | OpEx Rapor sekmesine tek sayfalık özet "PDF Rapor" (Admin) geri geldi. |
| `6e69fd5` | **OpEx Yönetici Raporu (PDF)** — çok sayfalı şablon rapor (`src/server/opexReport/`), ayrı Vercel fonksiyonu `api/opex-report.ts` (Chromium). Puan formülü normalize edildi, N/A ağırlığı eşit dağıtılıyor, 5 seviye her yerde, kilitlemede cevapsız → Kapsam dışı, 5S ağırlık düzeltmesi, soru başına best practice, Admin rapor metinleri (özet + yol haritası). |

> Not: `3dd420a`, `f972afa`, `658995a`, `549cc48` (Danışman Faaliyet Özeti zengin metin/arşiv filtresi)
> ve Kaizen/5S/OpEx commit'leri (`383dabd`, `0898645`, `6426898`, …) başka oturumlarda yapıldı;
> bu oturumun kapsamı dışında ama güncel `main`'de mevcut.

## 4. Önemli mimari bilgiler

### Roller
Yalnızca üç sabit rol vardır (DB check constraint): `Admin`, `Consultant`, `Customer User`.
**"Misafir" adlı bir rol yoktur.** Kullanıcı "Misafir" dediğinde bu oturumda **`Customer User`**
anlaşıldı (profil modalında yalnızca *Profil Bilgileri* + *Şifre Değiştir*; Dil & Bölge de gizlendi).
Gerçekten ayrı 4. rol isteniyorsa `supabase/schema.sql` (iki check constraint), `src/server/db.ts`
tipleri, `PlatformAdminConsole.tsx` ve `App.tsx` menü mantığı değişmeli.

### Yeni / değişen API uçları (`src/server/app.ts`)
- `GET|POST /api/business/weekly-consultant-notes`, `DELETE /api/business/weekly-consultant-notes/:id`
  — danışman başına haftalık özet notu (`week`,`year` query/body; `x-factory-id` başlığı).
- `GET|POST /api/business/tickets`, `DELETE /api/business/tickets/:id` — org geneli, **yalnızca
  Admin/Consultant** (sunucuda zorlanır).
- `POST /api/business/ptr-records/send-weekly-report` — gövdeye artık `year` alır ve o haftanın
  danışman özetlerini e-posta metnine ekler.
- Mevcut, Master Plan'ın kendisi çektiği uçlar: `/api/business/{smed-projects,vsm-projects,
  time-studies,yamazumi-studies,opex-assessments,ptr-records,master-plan-state}`.

### Yeni veri koleksiyonları (`records` tablosunda `collection` değeri)
`weekly_consultant_notes`, `tickets`. (`db.ts`: `getWeeklyConsultantNotes/saveWeeklyConsultantNote/
getWeeklyConsultantNoteById/deleteWeeklyConsultantNote`, `getTickets/saveTicket/deleteTicket`.)
Doküman Kasası içeriği `company_workspaces` koleksiyonundaki workspace JSON'unun `documents[].url`
alanında (base64 data URI) tutulur.

### Önemli dosyalar
- `src/components/MasterPlanGantt.tsx` — Timeline/Tablo/Kanban, sürükleme (`beginBarDrag`,
  `onBarDragMove/End`), `manualActualOverride`, Faz No (`availablePhases`), alt faaliyet
  (`parentActivityId`, `collapsedParents`), paralel faaliyet (`parallelWith`), Excel import/export.
- `src/components/PtrTimeStudy.tsx` — PTR; Haftalık sekme, `prevWeekNum/prevYear`, Danışman Faaliyet Özeti.
- `src/components/TicketBoard.tsx`, `src/components/UserProfileModal.tsx` — Ticket sekmesi ve rol kapıları.
- `src/components/workspace/DocumentVaultTab.tsx` — gerçek dosya yükleme/indirme.
- `src/components/FlowImprovement.tsx` — Spaghetti; `sc_current`/`sc_future` sabit ID'ler (kaldırılamaz).
- `src/components/OpexProjectDashboard.tsx` — toplam adam-gün (paralel faaliyet hariç tutulur).

### Master Plan veri alanları (faaliyet nesnesi, sunucuda serbest JSON)
`activityNo`, `phase`, `parallelWith` (aktivite no; adam-gün toplamına eklenmez), `parentActivityId`,
`manualActualOverride` (true ise PTR senkronu atlanır), `actualWeeks`, `plannedManDays` (0 geçerli).
`owner` artık her zaman `responsibleConsultant`'a eşittir (ExecutiveDashboard/OpexProjectDashboard
`.owner`'ı "danışman" olarak okur).

### OpEx Yönetici Raporu (PDF)
- **Tetik:** OpEx → Rapor sekmesi → "Yönetici Raporu (PDF)" (indir) / "Yazdır" (yeni sekme + yazdır → PDF).
  API: `GET /api/opex-report/:id?format=pdf|html` (ayrı fonksiyon, `vercel.json` rewrite + `maxDuration 60`).
  Yedek (Chromium'suz, ölçümsüz): `GET /api/business/opex-assessments/:id/executive-report.html`.
- **Yetki** (`opexReport/load.ts`): Admin her zaman; Consultant yalnız denetim tamamlanınca ve müşteri kartı ekibinde
  ya da bu denetimde denetçiyse; Customer User asla.
- **Sabit içerik (logo, unvan, adres, telefon, gizlilik, ölçek, hedef kuralı, yönetim kararları, kısa alan adları):**
  `src/server/opexReport/config.ts`, logo `logo.ts` (base64), stil `styles.ts`. Seviye adları/renkleri: `src/utils/opexScoring.ts` (`OPEX_LEVELS`).
- **Puan:** `computeOpexScores` (`src/utils/opexScoring.ts`) — alan = Σpuan×w' ÷ (5×Σw') ×100, w' = ağırlık + alanın N/A ağırlığının eşit payı; genel = Σ alan skorları ÷ alan sayısı (18); puanlanmamış alan 0 sayılır, tamamı N/A olan alan sayıya katılmaz. İstemci, sunucu, Excel ve rapor aynı fonksiyonu kullanır.
- **Sayfalama:** satır yükseklik tahmini (`render.ts` `detailRowMm`, `DETAIL_BODY_MM`) + Chromium ölçüm döngüsü (`pdf.ts` `renderReportPdf`) taşan sayfayı bölüp yeniden üretir. Sayfa sınırı yok.
- **Test:** `scripts/opex-report-test.ts` (FUGA fixture `scripts/fixtures/opex-report-fuga.json`, ACME ≈22, yüksek skor). Çalıştırma komutu dosya başında; yerel Chrome gerekir.

## 5. Bilinen sınırlar / açık noktalar

1. **Doküman Kasası** dosya başına 3 MB: ayrı blob depolama yok; içerik workspace JSON'unda, Vercel
   serverless gövde sınırı (~4,5 MB) altında kalmak için. Eski (yalnızca meta veri) belgeler "içerik
   yok" gösterir. Daha büyük dosya için gerçek nesne depolama (S3/Vercel Blob) gerekir.
2. **Gerçekleşen bar sürükleme**: PTR'den gelen bitişik olmayan çok-bloklu gerçekleşen haftalarda
   yalnızca ok butonları var, sürükleme yok.
3. **Öncüller** alanı yalnızca not; tarih kaydırma/bağımlılık oku yok. "İlişkili Kayıt" otomatik
   tamamlama senkronu yalnızca 5S / Kaizen / OEE-Kapasite için; SMED, Yamazumi, VSM, Time Study,
   OpEx için bağlantı yalnızca referanstır.
4. Filtre aktifken Yukarı/Aşağı yeniden numaralandırma, gizli faaliyetlerle numara çakışması
   üretebilir (eski davranışın devamı).
5. Danışman özeti e-posta gövdesine yazılır; ayrıca txt/doc ek yolu **kurulmadı** (gerek kalmadı).
10. Yönetici raporu PDF fonksiyonu Vercel'de **canlıda denenmedi** (yerelde Chrome ile test edildi). `@sparticuz/chromium@143` Node ≥ 20.11 ister. Fontlar Google Fonts'tan (Inter) yüklenir; erişilemezse sistem fontuna düşer.
13. Canlıdaki ACME demo kaydı (`cust_acmedemo1` / denetim `opex_ass_c55amzcmy`) 2026-10-17'de kullanıcı onayıyla test verisiyle yeniden dolduruldu (genel 18,13, 3 best practice, 18 bölüm değerlendirmesi, kilitli). Önceki hali: `~/Claude/fuga-executive-report/gemba-tools-cikti/ACME-canli-kayit-yedek-oncesi.json`.
12. **Kilitleme kuralı:** OpEx denetimi, tüm sorular 0–5 ya da N/A olarak işaretlenmeden kilitlenemez (sunucu 409 + `unanswered` listesi döner, ekran kalan soruları bölüm bazında listeler). Cevapsız sorular skora katılmadığı için kısmi cevaplanmış taslakta genel skor yüksek görünebilir (örn. 50/165 soru 3 puanla ≈ 60).
11. Puan formülü değişikliği sonrası Admin OpEx ekranını açınca eski denetimlerin skorları otomatik yeniden hesaplanıp kaydedilir (5S gibi ağırlık toplamı 20 olmayan alanlarda skor değişebilir). Müşteri kartındaki `copexScore` bu yeniden hesaplamada güncellenmez.
9. **Sunucu import kuralı:** `src/server/**` ve onun import ettiği dosyalarda göreli importlar **`.js` uzantılı** olmalı (`"../utils/x.js"`). Vercel API'yi native ESM olarak çalıştırır; uzantısız import tüm fonksiyonu çökertir ve giriş dahil her istek "A server error…" (JSON değil) döner (`59347f5`). `npm run build` bunu yakalamaz (esbuild paketler); şüphede sunucuyu dosya-bazlı transpile edip `node -e "import('./api/index.js')"` ile yükleyerek test edin.
8. OpEx denetçi listesi = giriş yapan kullanıcı + müşterinin birincil/ikincil danışmanları (`/customers/:id/team`). Müşteriye atanmamış danışman listede görünmez. OpEx "AI Yönetici Özeti" çağrısı hâlâ sabit örnek istatistik + sabit danışman adı gönderiyor (`OpexAssessment.tsx` executive-insights).
7. Eski kayıtlarda `factory_id` boşsa `db.ts`/`app.ts` hâlâ `"arcelik_bolu"` varsayılanına düşüyor (gerçek müşteri id'si değil; kayıt görünmez olur). Zararsız eski kalıntı, temizlenmedi.
6. Tekrarlayan hata sınıfı: sayısal form alanlarında **`||` fallback'i gerçek `0`'ı sahte değere
   çevirir** (adam-gün, fabrika ölçüsü, import). `??` veya `isNaN` kontrolü kullanın; başka yerlerde
   de olabilir — `grep` ile taranmalı.

## 6. Yeni konuşmada nasıl devam edilir

1. Bu dosyayı ve `docs/DEPLOYMENT.md`'yi okuyun.
2. Kod sorusu için: `graphify query "<soru>"` (repo kökünde `graphify-out/graph.json` var) ya da
   `graphify-out/GRAPH_REPORT.md`.
3. Değişiklikten sonra: `npx tsc --noEmit` ve `npm run build`, ardından commit + `git push origin main`.
4. Canlı doğrulama yapılamadıysa bunu kullanıcıya açıkça söyleyin.
