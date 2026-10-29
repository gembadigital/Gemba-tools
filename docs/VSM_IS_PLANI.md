# VSM (Değer Akış Haritalama) — Gereksinim Karşılaştırması ve İş Planı (2026-10-29)

Kaynaklar: kod okuması (`main` @ dccc73f) — `src/components/VsmPage.tsx` (5.348 satır, modülün tamamı tek
dosyada), `src/server/app.ts:4016-4054` (uçlar), `src/server/db.ts:1645-1669` (kayıt), `src/types.ts:37`
(`ProcessRecord`), bağlı modüller (`LossAnalysis.tsx`, `MasterPlanGantt.tsx`, `workspace/ProjectPortfolioTab.tsx`,
`src/utils/ciOpportunityPool.ts`). `graphify-out/GRAPH_REPORT.md` 6a9def7'den üretilmiş, **55 commit eski**; VSM
dosyası o tarihten beri değişmediği için VSM bölümü (topluluk 41) hâlâ geçerli. Canlı veri okunmadı; canlıdaki VSM
proje sayısı bilinmiyor.

**Yol haritası kuralı (Kaizen ve CI ile aynı):** önce Gemba Tools içinde tamamlanır, ayrılabilir yazılır (ayrı klasör
`src/components/vsm/`, kendi sunucu modülü, müşteri ayarları, Kaizen/CI tasarım dili `kaizenUi.tsx` / `ciUi.tsx`).
Opx Suite'e ayırma Kaizen, CI ve diğer modüllerle **birlikte, en sonda** tek çalışmada yapılır (CI planı C11).

Durum: ✅ var · 🟡 kısmen / zayıf · ❌ yok

## 0. Özet — en önemli 6 bulgu

1. **Sahte / uydurma veri her yerde.** Yeni proje, kod içindeki 6 istasyonluk örnek hatla (KESME & PRE-FORM,
   PRES, ROBOTİK KAYNAK, BOYAHANE, MONTAJ, KALİTE KONTROL — `VsmPage.tsx:702-835`) **canlı veritabanına kaydedilir**
   (`:414`). Tedarikçi kutusu "Ereğli Demir Çelik / Rulo Sac / 3000 Kg / Milk-Run" (`:3830-3853`), müşteri
   "Beko Global / Isıtıcı Grubu" (`:3749`, `:3756`), planlama kutusu "Yarı-Haftalık / FIFO & Kanban / 5 Gün - 2 Vardiya"
   (`:3796-3810`) sabit yazı. Haftalık talep = **çalışan sayısı × 12** (`:421`, `:886`). Proje portalındaki
   "Kümülatif mali kazanım" proje başına sabit 85.000 / 45.000 / 15.000 (`:2120`), "Lead time iyileşme %41,2 /
   WIP %38,5 / kapasite %18,7" sabit metin (`:2217-2225`).
2. **Uydurma hesaplar.** "Taşıma mesafesi 480 m", "alan kullanımı %55" (`:1588`, `:1596`), CO₂ = lead time azalışı
   × 0,4 (`:1400`), "işçilik verimi" = CT farkı × 15 (`:1399`), maliyet tablosuna giden hurda maliyeti
   `hurda ?? 10` × birim maliyet × 250 (`:567-576`). CI'ye aktarımda sabit "tahmini maliyet 12.000 / kazanç 45.000"
   (`:1197-1279`). "AI Yönetici Özeti" yapay zekâ değil, şablon cümle; "uygulanan aksiyonlar sonucunda … kâr artışı"
   gibi **gerçekleşmemiş sonucu gerçekleşmiş gibi** yazıyor (`:2003-2021`, `:4924`).
3. **Müşteri izolasyon açığı (sunucu).** `POST /api/business/vsm-projects` gövdedeki `id` ve `factory_id`'ye
   güveniyor; mevcut kaydın hangi müşteriye ait olduğunu kontrol etmiyor (`app.ts:4027-4040`, `db.ts:218-228`
   `upsertMerged`). Customer User başka bir müşterinin VSM projesinin id'sini gönderirse kaydı kendi müşterisine
   taşıyıp üzerine yazabilir. Rol kontrolü yok, gövde doğrulaması yok.
4. **Gelecek durum yalnızca "aynı proseslerin sayısını değiştirmek".** Proses eklenip çıkarılamıyor (hücre kurma,
   birleştirme yok — kod da bunu söylüyor, `:1639-1641`), kaizen patlaması yok, uygulama planı yok, versiyon yok.
   "⚡ Yalın Gelecek Durum Şablonu" tek tıkla tüm proseslere %50 stok, %50 SMED, %65 duruş, CT ×0,88 uyguluyor
   (`:1309-1327`) — saha çalışması yerine sabit oran.
5. **VSM haritası standart sembol dili değil.** Bilgi akışı kutusu sabit yazı; push / pull / FIFO şeridi / süpermarket
   / elektronik-manuel bilgi akışı ayrımı yok; tedarikçi hammadde stoku ve mamul stok ayrı değil; C/O ve parti
   büyüklüğü kartta yok; zaman çizgisi var ama yalnızca doğrusal akışta.
6. **Kod yapısı:** tek dosya 5.348 satır, aynı OEE hesabı 3 kez kopyalanmış (`:948-1012`, `:1413-1461`,
   `:1463-1513`), 122 adet `|| <sayı>` geri dönüşü (0 değeri yutuluyor: örn. OEE 0 → 75, arıza 0 → 15, CT 0 → 60),
   sabit 2200 px tuval ve yalnızca fare ile kaydırma (mobilde kullanılamaz), kaydetmede proses başına ayrı
   `POST /processes` (ateşle-unut, hata görünmez).

## 1. İyi bir VSM modülünde olması gerekenler — kıyas

### A. Kapsam ve çerçeve
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| A1 | **Ürün ailesi seçimi** (ürün–proses matrisi / PQ analizi, ailenin hacim payı) | 🟡 | Projede serbest metin `productGroup` ve `productVolumeShare` (%30 varsayılan, `:329`). Matris, ürün listesi, hacim analizi yok. |
| A2 | Proje künyesi: kapsam (kapıdan kapıya), ekip, lider, tarih, durum | 🟡 | Ad, ürün grubu/kodu, hat, bölüm, lider (serbest metin), tarih, durum var (`:302-313`). Ekip üyeleri, kapsam sınırı, harita tarihi (gözlem günü) yok; lider kullanıcıya bağlı değil. |
| A3 | Müşteri talebi ve **takt süresi** (net süre ÷ talep) | 🟡 | Takt hesaplanıyor (`:1037-1040`) ama net süre **ilk prosesin vardiya sayısından** alınıyor (`:1029`); talep çalışan×12 ile uyduruluyor; aylık talep sabit 22 gün (`:1024`). Talep dalgalanması, sipariş tipi (MTO/MTS) yok. |
| A4 | Pitch (paketleme miktarı × takt) | ❌ | Yok. |

### B. Proses kutusu ve veri kutusu
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| B1 | C/T (çevrim süresi) | ✅ | `cycleTime`, kartta görünür. |
| B2 | C/O (ürün değişim süresi) ve sıklığı | 🟡 | `changeoverTime`, `changeoverFrequency` girilir; kartta görünmez. İki ayrı alan (`changeoverTime` / `changeoverMinutes`) karışık kullanılıyor — CI aktarımı hiç doldurulmayan `changeoverMinutes`'ı okuyor (`:1205`). |
| B3 | Uptime / kullanılabilirlik | ✅ | Hesaplanıyor (`:970-974`). |
| B4 | Vardiya sayısı, vardiya süresi, operatör, makine | ✅ | Var; vardiya başına saat dizisi de var. |
| B5 | OEE (A × P × Q) | 🟡 | Hesaplanıyor; ancak eksik veri 75/85/90/98 gibi uydurma değerlere düşüyor (`:957-980`). Performans, girilmemiş "gerçekleşen adet" yerine sahte ilk değerle hesaplanıyor (`:898-899`: planlanan = kapasite × 1,1). |
| B6 | Hurda / rework / FPY | 🟡 | Girilir; ilk değerler uydurma (rework = adet × %5, `:915`). |
| B7 | Parti büyüklüğü, EPEI (her parçayı her … sürede) | ❌ | Yok. |
| B8 | Ürün çeşidi sayısı, paylaşımlı kaynak | ❌ | Yok. |
| B9 | Proses tipi / üretim modeli | ✅ | Manuel/yarı/tam otomatik; hücre/hat/parti. |

### C. Stok ve bekleme
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| C1 | Prosesler arası WIP ve **gün karşılığı** (stok ÷ günlük talep) | ✅ | `inventoryDays` (`:1048`). |
| C2 | Hammadde stoku (tedarikçi sonrası) ve mamul stoku (sevk öncesi) ayrı | ❌ | Tedarikçi→ilk proses ve son proses→müşteri oku var, stok üçgeni ve miktar yok. |
| C3 | Stok tipi: serbest yığın / FIFO şeridi (maks.) / süpermarket | 🟡 | `isSupermarket`, `isKanbanEnabled` bayrakları; FIFO şeridi ve maksimum miktar yok. |
| C4 | Taşıma / bekleme süresi ayrı kalem | 🟡 | `waitingTime` girilir ama lead time'a katılmaz. |

### D. Bilgi akışı ve malzeme akışı
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| D1 | Üretim planlama kutusu (MRP/ERP, planlama sıklığı) — **girilebilir** | ❌ | Kutu sabit metin (`:3784-3813`). Proses bazında `planningFrequency` var ama haritada görünmez. |
| D2 | Müşteri → planlama → tedarikçi sipariş/tahmin akışı (sıklık, elektronik/manuel) | 🟡 | Kesikli oklar çiziliyor, sıklık ve tip girilemiyor; hepsi aynı ok. |
| D3 | Planlama → proseslere çizelge (push) ya da tek noktaya çizelge (pacemaker) | 🟡 | Planlamadan **her** prosese ok çiziliyor (`:3637-3650`); pacemaker seçimi yok. |
| D4 | Malzeme akışı: push oku / pull (kanban, süpermarket) / FIFO | 🟡 | Bağlantı tipi listesi veri modelinde var (`:36-44`, Kanban/Supermarket kesikli çiziliyor) ama push oku sembolü, kanban kartı, FIFO şeridi, sıralama/harmanlama (heijunka) yok. |
| D5 | Paralel / dallanan akış | ✅ | Grafik düzeni, kritik yol (`:113-281`) — iyi yazılmış. |
| D6 | Tedarikçi ve müşteri kutuları **girilebilir** (ad, malzeme, sevk sıklığı, parti, temin süresi) | ❌ | Sabit/uydurma metin (`:3818-3856`, `:3736-3779`). |

### E. Zaman çizgisi ve göstergeler
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| E1 | Merdiven zaman çizgisi (üst: bekleme gün, alt: VA sn) | 🟡 | Doğrusal akışta var; dallanan akışta şerit özetine dönüşüyor. |
| E2 | Toplam lead time, toplam VA, **PCE** (VA ÷ LT) | 🟡 | Var (`:1109-1128`) ama VA = Σ C/T (tüm C/T değerli kabul ediliyor; ayrı "değer katan süre" alanı yok); dashboard'daki lead time kritik yol yerine düz toplam (`:1518`) — iki ekran farklı sayı gösterebilir. |
| E3 | Darboğaz: C/T > takt, en yüksek C/T, takt'a göre çubuk grafik (operatör dengesi) | 🟡 | En yüksek C/T kırmızı; C/T–takt grafiği yok; "C/T > takt" yalnızca CI aktarımında kullanılıyor. |
| E4 | Takt'a göre gerekli operatör (norm kadro) | ✅ | İş Gücü Analizi (`:1718-1749`) — gerçek veriden, iki yöntem. |
| E5 | Finansal etki (stok taşıma, hurda, duruş) | 🟡 | Var ama 250 gün sabit, birim maliyet varsayılanları uydurma (`|| 150/450/2500`), müşteri para birimi karışık (₺ simgesi önek). |
| E6 | Uydurma gösterge olmaması | ❌ | Bkz. §0 madde 1–2. |

### F. Gelecek durum ve uygulama
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| F1 | Mevcut durum / gelecek durum ayrı haritalar | 🟡 | Gelecek = mevcut proseslerin üzerine alan düzeltmeleri (`simulationEdits`). Proses ekleme/çıkarma/birleştirme, akış değiştirme (push→pull) yapılamaz. |
| F2 | Gelecek durum tasarım soruları (takt, süpermarket mi sürekli akış mı, pacemaker, harmanlama, pitch) | ❌ | Yok. |
| F3 | **Kaizen patlamaları** (haritada sembol, proses/akışa bağlı, sorumlu, hedef) | ❌ | Proses başına serbest metin `kaizenOpp` (drawer'da), haritada yok. |
| F4 | Gelecek durum **uygulama planı** (döngüler/loop, aksiyon, sorumlu, termin, durum) | ❌ | Yok. Master Plan'da VSM bağlantısı yalnızca referans (`MasterPlanGantt.tsx:3237`). |
| F5 | CI projesine / fırsat havuzuna aktarım | 🟡 | Eski `/api/business/kaizens` ucuna uydurma tutarlı toplu kayıt yazıyor (`:1182-1306`); tekrar basınca **mükerrer** kayıt; CI fırsat havuzunda (`ciOpportunityPool.ts`) VSM kaynağı yok. |
| F6 | İdeal durum (opsiyonel) | ❌ | Yok. |

### G. Kayıt, çıktı, kullanım
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| G1 | Versiyonlama (harita tarihi, mevcut v1/v2…, karşılaştırma) | ❌ | Tek kayıt, üzerine yazılır. |
| G2 | Kaydedilmemiş değişiklik uyarısı / otomatik kayıt | ❌ | Yalnızca "Kaydet" butonu (`:2628`); sekme/proje değişiminde kayıp. |
| G3 | PNG / PDF çıktı | 🟡 | Tuvalin ekran görüntüsü (PNG, tek sayfa PDF) (`:1877-1930`); veri kutuları, zaman çizgisi tablosu, KPI'lar, gelecek durum karşılaştırması rapor olarak yok. |
| G4 | Excel çıktı | 🟡 | "Excel" butonu 10 sütunlu **CSV** üretiyor (`:1901-1913`); gelecek durum, talep, takt, stok yok. |
| G5 | Excel'den içe aktarma (saha veri toplama formu) | ❌ | Yok. |
| G6 | Mobil / tablet kullanım (sahada veri toplama) | ❌ | Sabit 2200 px tuval, yalnızca fare ile kaydırma; dokunmatik/pinch yok; veri giriş tabloları geniş. |
| G7 | Yetki: rol bazlı yazma/silme, Customer User sınırı | ❌ | İstemcide rol kontrolü yok; sunucuda yalnızca müşteri kapsamı, o da POST'ta delik (bkz. §0 madde 3). |
| G8 | Müşteri izolasyonu | 🟡 | GET/DELETE kapsamlı; POST açık. Eski kayıtlarda `factory_id` yoksa `"arcelik_bolu"` (`db.ts:1650`). |
| G9 | Çok dillilik | 🟡 | Menü etiketi TR/EN/DE; sayfa içi tamamen TR+EN karışık sabit metin. |
| G10 | Modül adı | 🟡 | Menüde "VSM Kapasite Analizi" (`sidebarModules.ts:14`); içerik değer akışı haritası. |

### H. Diğer modüllerle bağlar
| Modül | Bugün | Not |
|---|---|---|
| Loss Capacity | VSM kaydında prosesler `processes` koleksiyonuna yazılır (`syncVsmProcessesToCostTable`, `:552-609`), `vsmProjectId` ile ürün grubu filtresi (`LossAnalysis.tsx:683`). | Gönderilen maliyetler uydurma çarpanlarla; Loss tarafında da `setupTimeMinutes` sabit 90/60/30 (`LossAnalysis.tsx:484`). VSM silinince maliyet tablosu satırları kalır. |
| CI Proje Yönetimi | Eski `kaizens` ucuna doğrudan yazar. | C5 fırsat havuzuna "vsm" kaynağı olarak bağlanmalı (kaizen patlamaları). |
| Master Plan | `vsm-projects` listesi okunur, ilişki yalnızca referans; AI yol haritasına proje adı + proses sayısı gider. | Uygulama planı (F4) Master Plan'a faaliyet olarak aktarılabilir. |
| Yamazumi / Time Study / SMED | Doğrudan bağ yok; App `processes` (maliyet tablosu) dizisini `vsmProcesses` adıyla geçiriyor (`App.tsx:1140,1146`). | Yamazumi'den C/T, SMED'den C/O, Time Study'den VA süresi VSM'e "kaynaktan al" ile çekilebilir. |
| Proje Portföyü | VSM projeleri listelenir (`ProjectPortfolioTab.tsx:159`). | Yönetici adı yoksa "VSM Ekip Lideri" yazar (kozmetik). |

## 2. Kod kalitesi zayıf noktaları

| # | Konu | Kanıt | Etki |
|---|---|---|---|
| K1 | Tek dosya, 5.348 satır, ~60 `useState`, tüm sekmeler + harita + dashboard + drawer + modal bir arada | `VsmPage.tsx` | Değişiklik riski, ayrılabilirlik yok, yavaş render |
| K2 | OEE/kapasite hesabı 3 kopya; lead time 3 farklı yerde 2 farklı yöntemle | `:948`, `:1413`, `:1463`; `:1080` vs `:1518` vs `:1366` | Ekranlar arası tutarsız sayılar |
| K3 | `||` ile 0 yutma (122 yer) ve uydurma varsayılanlar | örn. `:957`, `:967`, `:1031`, `:1331-1333` | Gerçek 0 girilemez / sahte değer gösterilir |
| K4 | Sunucu doğrulaması yok (tip, aralık, boyut), rol yok, POST'ta id/factory_id sahipliği kontrol edilmiyor | `app.ts:4027-4040` | Güvenlik ve veri bütünlüğü |
| K5 | Kayıt yarışı: `defaultVsmProcesses` değişince `useEffect` `vsmProcesses`'ı ezer | `:892-943` | Proje açıkken maliyet tablosu yeniden yüklenirse kullanıcının verisi örnek/uydurma veriyle değişebilir |
| K6 | Kaydetmede N adet ateşle-unut `POST /processes`; hata kullanıcıya görünmez; proses silinince karşı satır silinmez | `:595-604` | Loss Capacity'de yetim / yanlış satırlar |
| K7 | CI aktarımı mükerrer kayıt üretir, `alert()` ile bildirir | `:1286-1302` | Veri kirliliği |
| K8 | Sabit piksel yerleşim (2200×700, `top-[265px]`, X = 310 + idx×280) | `:3598`, `:3638`, `:3654` | 7+ proseste kesilme, mobil yok |
| K9 | `any` tipli proje nesnesi, tip `src/types.ts`'de değil bileşen içinde | `:46`, `:292` | Sunucu/istemci ortak tip yok |
| K10 | ESM `.js` kuralı | VSM'in sunucu kodu `app.ts`/`db.ts` içinde, yeni göreli import yok | Yeni sunucu modülünde (`src/server/vsm/…`) kurala uyulmalı |

## 3. İş planı

Büyüklük: S (≤ yarım gün) · M (~1 gün) · L (2+ gün). Her adım sonunda `npx tsc --noEmit`, `npm run build`, commit +
push ve `docs/VSM_CANLI_TEST.md`'ye canlı test satırları.

### V0 — Güvenlik ve sahte veri temizliği (S–M) — G7, G8, K4, §0 madde 1–3
- Sunucu: VSM uçları `src/server/vsm/` modülüne taşınır (`.js` importlar). POST'ta mevcut kaydın `factory_id`'si
  kapsamla karşılaştırılır; `factory_id` her zaman kapsamdan yazılır; gövde normalize edilir (sayılar ≥ 0, metin
  uzunluğu, proses sayısı/gövde boyutu sınırı). Rol kuralı (karar §5-1).
- Yeni proje **boş** başlar (proses yok); örnek hat listesi ve maliyet-tablosundan uydurma eşleme kaldırılır.
- Tedarikçi / müşteri / planlama kutularındaki sabit metinler, "Beko Global", "Ereğli", "çalışan × 12" talebi,
  portaldaki sabit kazanç ve yüzdeler, taşıma mesafesi / alan / CO₂ / "işçilik verimi" uydurmaları kaldırılır;
  veri yoksa "—" ve "girilmedi" gösterilir.
- "AI Yönetici Özeti" → "Otomatik özet (hesaplanan)"; cümleler "simülasyona göre … öngörülür" kipine; veri
  yoksa gösterilmez.
- K5 yarışı giderilir (açık proje varken maliyet tablosu yüklemesi `vsmProcesses`'a dokunmaz).
- Canlıdaki mevcut VSM projeleri **dönüştürülmez**; açıldıklarında kayıtlı veri olduğu gibi gösterilir.

### V1 — Modül iskeleti ve tek hesap motoru (M) — K1, K2, K3, K9
- `src/components/vsm/` klasörü: `VsmModule.tsx` (kabuk), `vsmTypes.ts` (istemci+sunucu ortak tip),
  `vsmCalc.ts` (saf fonksiyonlar: OEE, kapasite, takt, stok günü, lead time, PCE, darboğaz, norm kadro, finansal
  etki), `vsmGraph.ts` (mevcut grafik yardımcıları), `vsmUi.tsx` (Kaizen/CI tasarım dili).
- Tek hesap motoru: mevcut, gelecek ve dashboard aynı fonksiyonu kullanır; `||` yerine `??`/`Number.isFinite`;
  eksik veri **boş** kalır, hesap "veri eksik" döner.
- `VsmPage.tsx` sekmelere bölünür (Proje listesi, Kurulum, Prosesler, Harita, Gelecek durum, Dashboard).
- Davranış değişmez (V0 sonrası); sayılar V0 ile aynı çıkmalı (saf fonksiyon testleri `scripts/`).

### V2 — Veri modeli: standart VSM alanları (M) — A2–A4, B2, B5–B8, C2–C4, D1, D2, D6
- Proje: ekip (kullanıcı/kişi), kapsam (başlangıç–bitiş noktası), harita/gözlem tarihi, talep (dönem, adet, gün
  sayısı, sipariş tipi), net çalışma süresi **proje düzeyinde** (vardiya, mola, planlı duruş), pitch paketi.
- Tedarikçi(ler) ve müşteri kutusu: ad, malzeme, sevk sıklığı, parti, temin süresi, taşıma şekli.
- Planlama kutusu: sistem (MRP/ERP/Excel/manuel), müşteri→planlama, planlama→tedarikçi sipariş/tahmin sıklığı ve
  tipi (elektronik/manuel), çizelge noktası (her proses / pacemaker).
- Proses: C/O tek alan, parti büyüklüğü, EPEI, çeşit sayısı, VA süresi (C/T'den ayrı, isteğe bağlı), bekleme/taşıma.
- Stok noktaları: hammadde, prosesler arası, mamul; tip (yığın / FIFO + maks / süpermarket), miktar.
- Eski kayıtlar okurken `normalizeVsmProject` ile yeni şemaya çevrilir (yazmadan).

### V3 — Harita: standart sembol dili ve esnek yerleşim (L) — D3, D4, E1, K8, G6
- SVG tabanlı harita: proses kutusu + veri kutusu (C/T, C/O, uptime, OEE, vardiya, operatör, parti, FPY), stok
  üçgeni, FIFO şeridi, süpermarket, push oku (çizgili), kanban/çekme kartı, kamyon (sevk), elektronik/manuel bilgi
  oku, pacemaker işareti; açıklama (lejant).
- Yerleşim proses sayısına göre büyür (sabit 2200 px kalkar); merdiven zaman çizgisi dallanan akışta kritik yol
  üzerinden.
- Dokunmatik: pinch/zoom ve sürükleme (pointer olayları), "sığdır"; telefonda harita salt okunur, veri girişi
  form/kart görünümünde.

### V4 — Göstergeler ve analiz (M) — A3, E2–E5
- Tek kaynaklı: toplam lead time (kritik yol), VA, PCE, toplam WIP (gün ve adet), takt, pitch.
- **C/T – takt çubuk grafiği** (operatör dengesi), darboğaz = C/T > takt olan ve en yüksek C/T; kapasite ÷ talep.
- Finansal etki yalnızca müşteri birim maliyetleri girildiyse; yıllık gün sayısı proje ayarı; para birimi müşteri
  kartından ve `toLocaleString` ile (CI'deki `ciMoney` yaklaşımı).
- Dashboard sadeleştirme: mevcut / gelecek yan yana 6–8 gösterge; uydurma kartlar yok.

### V5 — Gelecek durum haritası ve kaizen patlamaları (L) — F1–F3, F6
- Gelecek durum, mevcut durumun **kopyası** olarak ayrı harita: proses ekle/çıkar/birleştir (hücre), bağlantı tipi
  değiştir (push → süpermarket/FIFO), pacemaker seç.
- Gelecek durum tasarım soruları paneli (takt, sürekli akış nerede, süpermarket nerede, pacemaker, harmanlama, pitch,
  gerekli iyileştirmeler) — cevaplar raporda.
- Kaizen patlaması: haritada proses/akış/stoğa iliştirilen sembol; başlık, açıklama, beklenen etki (alan + değer),
  sorumlu, termin, döngü (loop). "Yalın şablon" butonu kaldırılır ya da "öneri taslağı" olarak işaretlenir (karar §5-4).

### V6 — Uygulama planı ve CI / Master Plan köprüsü (M) — F4, F5
- Gelecek durum uygulama planı: döngüler (pacemaker, ek, tedarikçi) → kaizen patlamaları → aksiyon, sorumlu,
  başlangıç/termin, durum, ilerleme (CI C3 mini plan bileşeni yeniden kullanılır).
- Kaizen patlamaları CI fırsat havuzuna **`vsm` kaynağı** olarak eklenir (`ciOpportunityPool.ts`), tutar yalnızca
  kullanıcı girdiyse; CI projesi açılınca patlamaya bağlanır (mükerrer yok). Eski `/api/business/kaizens` toplu
  aktarımı kaldırılır.
- İsteğe bağlı: uygulama planı satırları Master Plan'a faaliyet olarak aktarılır (Master Plan'da VSM bağlantısı
  "referans"tan "kaynak"a).

### V7 — Versiyonlama ve karşılaştırma (M) — G1, G2
- Proje içinde harita versiyonları: Mevcut v1 (tarih), Gelecek v1, sonraki "gerçekleşen" mevcut durum v2…; salt
  okunur arşiv, iki versiyon karşılaştırma (lead time, WIP, PCE, OEE, operatör).
- Kaydedilmemiş değişiklik uyarısı + otomatik taslak kaydı (gecikmeli).

### V8 — Çıktılar (M–L) — G3–G5
- Sunucu tarafı PDF (OpEx/CI raporundaki Chromium altyapısı): kapak, mevcut harita, veri tablosu, zaman çizgisi,
  göstergeler, gelecek harita, tasarım soruları, kaizen patlamaları, uygulama planı.
- Gerçek `.xlsx` (SheetJS): proje, prosesler, stoklar, göstergeler, gelecek durum, uygulama planı sayfaları.
- Excel saha veri toplama şablonu indir / doldur / içe aktar (proses ve stok tabloları).
- PNG çıktı SVG'den (ekran görüntüsü değil).

### V9 — Bağlı modüller (M) — §1-H
- Loss Capacity senkronu: uydurma çarpanlar kalkar; yalnızca ölçülen alanlar (C/T, OEE, kapasite, operatör,
  vardiya) gönderilir, maliyet alanları Loss ekranında kalır; tek toplu uç, hata gösterimi; VSM proses/proje
  silinince bağlı satırlar için kullanıcıya sorulur.
- "Kaynaktan al": Yamazumi çalışmasından C/T, SMED'den C/O, Time Study'den VA süresi (seçimli, değerin kaynağı
  gösterilir).

### V10 — Müşteri ayarları, dil, ad (S–M) — G9, G10
- `vsm_settings` (müşteri başına): yıllık çalışma günü, varsayılan vardiya/mola, birim maliyetler, eşikler
  (WIP gün uyarısı, OEE hedefi), sembol tercihleri — Kaizen/CI ayarlarıyla aynı desen.
- Menü adı "Değer Akış Haritalama (VSM)"; sayfa metinleri tek dilde (TR) ve i18n'e hazır.

### V11 — Ayırma / Opx Suite (L)
- Kaizen, CI ve diğer modüllerle **birlikte, en sonda** (CI C11 kararı). Bu planda yalnızca ayrılabilir yazılır.

### V12 — AI VSM analizi ve yönlendirme (M) — kullanıcı kararı 6
- Sunucuda Gemini (`GEMINI_API_KEY`): girdi = VSM projesinin tüm verisi (talep/takt, prosesler, stoklar, zaman
  çizgisi, darboğaz, gelecek durum, kaizen patlamaları, uygulama planı durumu) + müşterinin diğer modül özetleri
  (Loss Capacity, SMED, Yamazumi, OEE, OpEx). Çıktı: bulgular, VSM özelinde yönlendirme (sürekli akış / süpermarket
  / FIFO nerede, pacemaker, harmanlama, pitch, öncelikli kaizenler ve gerekçesi), açık sorular.
- Uydurma sayı yok: yalnızca girdideki sayılar kullanılır; sonuç projeye kaydedilir (tarih + veri özeti), "yenile"
  ile yeniden üretilir; üretilemezse kısa hata gösterilir.

## 4. Sıra (kullanıcı kararıyla, 2026-10-29)

**V0 → V1 (+ veri kaynağı katmanı) → V2 (+ ürün–proses matrisi) → V8 (çıktılar, mevcut içerikle; sonraki adımlarda
genişler) → V3 → V4 → V5 → örnek proje → V6 → V12 (AI) → V7 → V9 → V10.** V11 (ayırma) en sonda, diğer modüllerle.

## 5. Kullanıcı kararları (2026-10-29)

1. **Yetki:** Customer User veri girebilir (proje açma, proses/stok verisi) ve **yalnızca kendi girdiği veriyi**
   (kendi açtığı proje, kendi eklediği proses) silebilir. Admin/Consultant her şeyi. Sunucuda zorlanır (V0):
   proses ve projelerde `createdBy` sunucu tarafından yazılır; başkasının prosesini çıkaran kayıt 403 alır.
2. **Canlı örnek veri:** silinir (yedek alınarak). Canlıda yalnızca 1 VSM projesi vardı: ACME demo
   (`cust_acmedemo1`, `vsm_proj_71re5yz5r`, 4 örnek proses) + ona bağlı 4 maliyet tablosu satırı (`vsm_p1…p4`).
   Yedek: `~/Claude/5SAudit/yedekler/vsm_projects_backup_2026-10-29.json`, `processes_backup_2026-10-29.json`.
3. **Yeni örnek proje (kullanıcı isteği):** ACME demo müşterisinde **8 prosesli mevcut durum**; ideal/gelecek durumda
   iş birleştirme ile **6 prosese** inen ve **çekme (süpermarket/kanban/FIFO)** modeliyle çizilmiş harita. Gelecek
   durumda proses birleştirme V5 ile geldiği için örnek V5'ten hemen sonra hazırlanır (mevcut durum kısmı V2'den
   sonra girilebilir). Gerçek müşteri verisi değildir; proje adında "Örnek" yazar.
4. **Gelecek durum:** ayrı harita kopyası (V5).
5. **"Yalın Gelecek Durum Şablonu":** kaldırılır (V0).
6. **AI:** gerçek analiz — VSM'in tüm verilerini (proje, talep/takt, prosesler, stoklar, zaman çizgisi, gelecek durum,
   kaizen patlamaları) ve müşterinin diğer modül özetlerini alıp yorumlar, **VSM özelinde yönlendirme** yapar
   (darboğaz, nerede sürekli akış / süpermarket / FIFO, pacemaker, harmanlama, hangi kaizen önce). Yeni adım **V12**
   (OpEx Danışman Özet Sunumu deseni: sunucuda Gemini, sonuç projeye kaydedilir, yenileme butonu). V0'da şablon
   metin "hesaplanan özet" olarak yeniden adlandırılır, gerçekleşmiş sonuç dili kaldırılır.
7. **Ürün–proses matrisi:** önemli → V2 kapsamına alındı (ürün listesi × proses matrisi, hacim payı, aile gruplama
   önerisi, seçilen aile projeye bağlanır).
8. **Mobil ve tablet:** telefonda veri girişi (kart/form) + harita görüntüleme; tablette harita düzenleme de (V3).
9. **Çıktılar (V8):** öne alındı.
10. **Harita tasarımı:** genel tasarım ve çizim başarılı bulundu — **genel akış değiştirilmez**, V3 mevcut görünümü
    koruyarak sembolleri ekler. **Varsayılan görünüm açık (light) mod** (V0).

### Veri kaynağı mimarisi (kullanıcı kararı 10; V1'de iskelet, V2'de manuel kaynak, Opx Suite bağlayıcısı ayırma sırasında)

VSM hesap motoru verinin nereden geldiğini bilmez; prosesler bir **veri kaynağı bağdaştırıcısı** üzerinden gelir:

| Kaynak | Nerede | Ne verir |
|---|---|---|
| `manual` | Gemba Tools (bugün) ve tek başına uygulama | Elle girilen proses/stok verisi (bugünkü sekmeler). |
| `import` | Tek başına uygulama / Gemba Tools | Excel saha formu ya da başka bir panelden aktarım (V8 şablonu). |
| `opxSuite` | Opx Suite içinde | Hat → makine/proses kartı (C/T, makine, operatör, vardiya), iş emri kapamaları (toplam adet, hurda, süre), makine OEE/duruş. **Hat + tarih aralığı + ürün** seçilir; kaynak bu filtreyle proses verisini hesaplar (ortalama C/T, gerçekleşen adet, hurda, kullanılabilirlik, C/O). |

Tasarım: `src/components/vsm/dataSources/` altında ortak arayüz —
`listLines()`, `listProducts(lineId, from, to)`, `loadProcessSnapshot({ lineId, productId, from, to }) →
VsmProcessInput[]` (her alan için kaynak etiketi: `manual` / `opxSuite:<kayıt>` ve tarih aralığı). Proje kaydı hangi
kaynaktan, hangi filtreyle ve hangi tarihte çekildiğini saklar (`dataSource: { kind, lineId, productId, from, to,
pulledAt }`); çekilen değerler **anlık görüntü** olarak versiyona yazılır (V7), kaynak verisi değişse de harita
değişmez, "yeniden çek" ile yeni versiyon oluşur. Gemba Tools'ta yalnızca `manual` etkin; `opxSuite` bağlayıcısı
arayüzüyle birlikte boş iskelet olarak yazılır ve Opx Suite'e ayırma (V11) sırasında Opx Suite veri tabanına bağlanır.

## 6. İlerleme

| Adım | Durum | Commit |
|---|---|---|
| Plan | ✅ yazıldı, kararlar alındı (§5) | bef4074 |
| V0 | ✅ kod; canlıda denenmedi ([VSM_CANLI_TEST.md](VSM_CANLI_TEST.md) §V0) | 42f5bc6 |
| V1 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V1) | 01ae3d8 |
| V2 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V2) | 1b5d35a |
| V8 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V8) | 39edc79 |
| V3 | ✅ kod; yerel önizlemede (sahte API) masaüstü/telefon denendi, canlıda denenmedi (§V3) | 289bebb |
| V4 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V4) | 1a3335a |
| V5 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V5) | f7abf84 |
| Örnek | ✅ canlıya yazıldı (ACME demo, kullanıcı onayıyla) | bkz. git log |
| V6 | ✅ kod; canlıda denenmedi (§V6) | 88538db |
| V12 | ✅ kod; yerelde gerçek Gemini ile denendi (örnek proje, kayıt yok), canlıda denenmedi (§V12) | 170dd73 |
| V7 | ✅ kod; yerel önizlemede (sahte API) denendi, canlıda denenmedi (§V7) | bkz. git log |

### V0 — yapılanlar
- Sunucu: `src/server/vsm/vsmRoutes.ts` (uçlar `app.ts`'den taşındı), kurallar `src/utils/vsmAccess.ts` (istemci+sunucu
  ortak). POST gövdedeki `factory_id`/`created_by` gibi sunucu alanlarını yok sayar; var olan proje müşteri
  değiştiremez ve yalnızca o müşterinin kullanıcıları yazabilir; bilinmeyen id → 404 (istemci id uyduramaz). Sayılar
  ≥ 0 değilse düşer, gerçek 0 korunur; en fazla 60 proses; proje adı zorunlu. Kaizen sicil oturumları VSM'e erişemez.
- Sahiplik: proses `createdBy` sunucuda yazılır (istemci başkasının prosesini sahiplenemez). Customer User başkasının
  prosesini çıkaran kaydı 403 alır, yalnızca kendi açtığı projeyi silebilir. Arayüz izinsiz sil düğmelerini gizler.
  Test: `npx tsx scripts/vsm-access-test.ts`.
- Sahte veri kaldırıldı: örnek 6 proses listesi ve maliyet tablosundan uydurma eşleme (WIP 1200/1500/250, kanban
  her 2. proses…), yeni projeye yazılan örnek hat, "çalışan × 12" talep, Beko/Isıtıcı/Ereğli/Rulo Sac/Milk-Run/FIFO
  sabit metinleri, portaldaki sabit kazanç ve yüzdeler, taşıma mesafesi / alan kullanımı / CO₂ / "işçilik verimi",
  maliyet senkronundaki `hurda ?? 10`, `rework ?? 5` ve birim maliyet yoksa 800/350/2500/50 çarpanları, CI aktarımındaki
  sabit maliyet/kazançlar, hesap motorundaki 900/98/85/90/1000/75 geri dönüşleri. Yıllık gün sayısı sabit 250 yerine
  çalışma günü × 52; aylık talep haftalık × 52/12.
- Yalın şablon düğmesi kaldırıldı; "AI Yönetici Özeti" → "Hesaplanan Özet" (gerçekleşmiş sonuç dili yok).
- Tedarikçi / Üretim Planlama kutuları Kurulum'daki yeni alanlardan geliyor (V2'de yapılandırılmış alanlara dönüşecek).
- Harita varsayılanı açık tema. CI aktarımı tekrar basıldığında mükerrer kayıt oluşturmuyor (V6'da fırsat havuzuna
  taşınacak).
- K5 yarışı kalktı: maliyet tablosu yüklemesi artık açık projenin proseslerine dokunmuyor.
- Canlı veri (kullanıcı onayıyla, 2026-10-29): ACME demo'daki tek VSM projesi `vsm_proj_71re5yz5r` ve ona bağlı 4
  maliyet tablosu satırı (`vsm_p1…p4`) tek işlemde silindi. Yedek: `~/Claude/5SAudit/yedekler/`.
- **Doğrulama sınırı:** `tsc`, `npm run build`, kural testi geçti. Arayüz giriş gerektirdiği için yerelde ekranda
  denenmedi; canlı test listesi §V0.
- Bilinen kalanlar (V1'e): hesap motoru hâlâ 3 kopya; boş sayı alanı 0 olarak kaydediliyor ("girilmedi" ayrımı yok);
  yeni prosesin vardiya saati 8 varsayılır (Kurulum'daki vardiya süresinden).

### V1 — yapılanlar
- `src/components/VsmPage.tsx` (≈4.800 satır) kaldırıldı; modül `src/components/vsm/` altında:
  | Dosya | İçerik |
  |---|---|
  | `VsmModule.tsx` | Giriş noktası (App bunu kullanır): portal ya da çalışma alanı başlığı + sekmeler |
  | `useVsmWorkspace.tsx` | Tüm durum, kayıt/silme/senkron işleyicileri, hesap motorundan türetilen değerler |
  | `VsmContext.tsx` | Tek workspace örneğini sekmelere paylaştırır (`useVsm()`) |
  | `VsmProjectPortal`, `VsmSetupTab`, `VsmDefinitionTab`, `VsmProductionTab`, `VsmQualityTab`, `VsmMapTab`, `VsmDashboardTab`, `VsmProcessDrawer`, `VsmExportModal` | Ekranlar (görünüm değişmedi) |
  | `vsmTypes.ts` | `VsmProcess`, `VsmFactorySetup`, `VsmProject`, `VsmDataSourceRef` |
  | `vsmGraph.ts` | Akış grafiği, şerit yerleşimi, kritik yol |
  | `vsmCalc.ts` | **Tek hesap motoru**: proses OEE/kapasite, talep/takt, stok günü, lead time (kritik yol), PCE, darboğaz, yıllık kayıp, mevcut↔gelecek karşılaştırma, norm kadro |
  | `dataSources/` | Veri kaynağı katmanı: `types.ts` (arayüz), `manual.ts`, `opxSuite.ts` (bağlantısız iskelet), `index.ts` |
- Aynı OEE hesabının 3 kopyası ve 3 farklı lead time hesabı tek fonksiyona indi. Sonuç: harita, üst şerit ve
  dashboard aynı sayıyı gösterir (dashboard artık lead time'ı kritik yoldan hesaplar; tek zincirde değişiklik yok,
  dallanan akışta paralel kollar toplanmaz). Üst şeritteki maliyet tasarrufu da dashboard ile aynı hesaptan gelir
  (önceden mevcut durum hesaplanmamış ham değerlerle hesaplanıyordu).
- Düzeltilen hatalar: (1) WIP düzenlemesi, eski projelerde taşınan `wipQuantity` kopyası yüzünden haritaya yansımıyordu —
  artık tek kaynak `inventoryBefore`. (2) Çekmecedeki OEE kutusuna yazılan değer her zaman ezilirdi — OEE artık salt
  okunur ve hesaplanan değeri gösterir. (3) Çekmecedeki arıza süresi, kullanılabilirliği belirleyen `breakdownTime`'a da
  yazılıyor.
- Boşaltılan isteğe bağlı sayı alanları (planlanan/gerçekleşen adet, ideal C/T, C/O, arıza, sağlam, hurda, rework)
  0 değil "girilmedi" olarak kalır; ekranda boş görünür (rework için gösterilen sahte 5 de kalktı).
- Yeni projeler `dataSource: { kind: "manual" }` ile kaydedilir. Opx Suite bağdaştırıcısı arayüzüyle yazıldı,
  Gemba Tools'ta `available: false` (V11'de Opx Suite veritabanına bağlanacak).
- Testler: `npx tsx scripts/vsm-calc-test.ts` (OEE, takt, kritik yol, kayıp, karşılaştırma, norm kadro),
  `npx tsx scripts/vsm-access-test.ts`.
- Yerel önizleme (Vite, tarayıcıda sahte API — veri kaydedilmez): portal, 6 sekme, harita (açık tema), çekmece,
  kaydetme, Customer User'ın başkasının prosesinde sil düğmesi görmemesi denendi; hesaplanan OEE/kapasite elle
  hesapla aynı.

### V2 — yapılanlar
- **Veri modeli** (`vsmTypes.ts`): proje düzeyinde kapsam (başlangıç/bitiş), gözlem tarihi, günlük vardiya sayısı,
  sipariş tipi (MTS/MTO/ATO), paket miktarı (pitch), müşteri sevk partisi ve taşıma, bilgi akışı (müşteri→planlama ve
  planlama→tedarikçi sıklık + kanal: elektronik/manuel), çizelge noktası (her proses / pacemaker + pacemaker proses),
  hammadde ve mamul stoku (adet + tip). Ekip listesi (ad, görev). Proses: parti büyüklüğü, EPEI, çeşit sayısı, katma
  değer süresi, taşıma süresi, stok tipi (serbest yığın / FIFO + maks. / süpermarket).
- **Eski kayıtlar** (`vsmNormalize.ts`, okurken, geri yazmadan): `changeoverMinutes` → `changeoverTime`; süpermarket
  bayrağı → stok tipi; günlük vardiya yoksa ilk prosesin vardiyası.
- **Hesap motoru:** net süre proje vardiyasıyla (yoksa ilk proses); pitch = takt × paket; lead time = hammadde günü +
  en uzun WIP yolu + mamul günü; PCE katma değer süresi girilen proseste onu, girilmeyende C/T'yi kullanır.
- **Ürün Ailesi sekmesi** (`VsmProductMatrixTab.tsx`, `vsmProductMatrix.ts`): adımlar (haritadaki proseslerden ya da
  elle), ürünler (kod, haftalık adet, pay), rota işaretleme; rota benzerliği (Jaccard, varsayılan %80, ayarlanabilir)
  ile aile önerisi; seçilen aile "Kuruluma aktar" ile haftalık talep, aile adı ve hacim payını yazar (talep doluysa
  onay sorar).
- **Kurulum** (`VsmSetupDetails.tsx`): Kapsam & Gözlem, Ekip, Talep/Vardiya/Pitch, Müşteri, Bilgi Akışı,
  Hammadde & Mamul Stoku bölümleri. **Üretim & Kapasite** altında veri kutusu tablosu; **Kalite & Envanter**'de stok tipi
  seçimi (FIFO'da maksimum).
- **Harita** (genel tasarım aynı): bilgi akışı oklarında sıklık · kanal etiketi; pacemaker seçiliyse çizelge oku
  yalnızca o prosese; müşteri kutusunda sipariş tipi, sevk partisi, pitch; zaman çizgisinde baştaki hammadde ve
  sondaki mamul günleri, VA girilen proseste VA süresi.
- **Sunucu** (`vsmAccess.ts`): yeni proses sayıları, stok tipi beyaz listesi, ekip (≤40) ve matris (≤300 ürün, rota
  yalnızca tanımlı adımlara) temizlenir.
- Testler genişletildi (`vsm-calc-test.ts`, `vsm-access-test.ts`). Yerel önizlemede: aile önerisi (X+Y %80, Z ayrı) ve
  Kuruluma aktarım (800 adet/hafta, %80), ok etiketleri, pacemaker oku, hammadde/mamul segmentleri, kayıt gövdesi
  (matris, ekip, `changeoverTime`, stok tipi) denendi.
- Kalanlar: birden fazla tedarikçi (tek tedarikçi kutusu korunuyor); elektronik bilgi akışı için şimşek ok sembolü,
  FIFO şeridi / push oku çizimi ve kartta C/O–parti gösterimi V3'te; gelecek durumda hammadde/mamul değişimi V5'te.

### V8 — yapılanlar
- **Excel çalışma kitabı** (`vsmExport.ts`, ExcelJS, ihtiyaç anında yüklenir): Proje (künye, kapsam, ekip, talep/takt/
  pitch, müşteri–tedarikçi–bilgi akışı, uç stoklar), Mevcut Durum (girilen + hesaplanan 31 sütun), Gelecek Durum
  (simülasyon varsa), Zaman Çizelgesi (hammadde → prosesler → mamul, lead time, PCE), Göstergeler (mevcut ↔ gelecek),
  Norm Kadro, Ürün Matrisi (ürünler, rota, seçili aile, öneriler). Eski 10 sütunlu CSV kaldırıldı.
- **Saha veri formu** (`vsmExcel.ts`): "Formu indir" mevcut prosesleri ve Kurulum değerlerini içeren .xlsx verir
  (Prosesler / Kurulum / Açıklama sayfaları); "Doldurulmuş formu yükle" sütunları başlık metniyle eşler, ID (yoksa ad)
  ile günceller, yeni satırları proses olarak ekler (sahibi yükleyen kullanıcı), **hiçbir prosesi silmez**, boş hücre
  değeri değiştirmez, okunamayan sayı/tip satır numarasıyla uyarı olarak listelenir; uygulamadan önce özet + onay sorar,
  sonra Kaydet gerekir. İçe aktarma mevcut durum verisine yazar.
- **PDF raporu** (`VsmReportPages.tsx`): A4 yatay çok sayfa — özet (talep, takt, pitch, lead time, PCE, WIP, darboğaz,
  operatör/norm kadro, yıllık kayıp, kapsam & ekip, bilgi ve malzeme akışı), mevcut durum haritası, gelecek durum
  haritası (simülasyon değişikliği varsa), proses veri tablosu (16 satırda bir yeni sayfa), göstergeler + norm kadro,
  ürün ailesi matrisi. Sayfalar görüntü olarak üretilir (Türkçe karakterler korunur, metin seçilemez).
  **Plandan sapma:** sunucu tarafı Chromium PDF yerine tarayıcıda üretim seçildi — harita tarayıcıda çizildiği için
  sunucunun haritayı görmesi ek bir görüntü yüklemesi gerektiriyordu; CI A3 kartıyla aynı yöntem.
- PNG dosya adı müşteri/proje ve mevcut/gelecek bilgisini taşıyor.
- PCE artık 3 ondalıkla (çok küçük değer "%0" görünüyordu).
- Test: `npx tsx scripts/vsm-excel-test.ts` (form gidiş-dönüş, güncelle/ekle/uyar, silmeme, çalışma kitabı sayfaları).
  Yerel önizlemede üç çıktı üretildi (xlsx 15 KB, form 10 KB, PDF 6 sayfa) ve PDF sayfaları görsel olarak kontrol
  edildi; form yükleme (1 güncelleme, 1 ekleme, 1 kurulum değeri) denendi.
- Kalanlar: harita görseli sabit 2200 px tuvalden geldiği için PDF'te küçük (V3'te esnek yerleşimle düzelir); kaizen
  patlamaları ve uygulama planı sayfaları V5/V6 ile eklenecek.

### V3 — yapılanlar
- **Esnek yerleşim** (`vsmMapLayout.ts`): tuval genişliği proses (ya da grafik sütunu) sayısıyla büyür; tedarikçi solda,
  müşteri en sağda, üretim planlama ikisinin ortasında. Grafik (dallanan akış) yerleşimi aynı ölçüleri kullanır.
  PNG/PDF görüntüsü haritanın gerçek boyutunda alınır.
- **Semboller** (`VsmMapCanvas.tsx`, genel görünüm ve akış korunarak): proses önündeki stok bölgesi — serbest yığın =
  stok üçgeni + çizgili push oku, FIFO = şerit + "FIFO ≤maks", süpermarket = raf + çekme oku; kanban etiketi; elektronik
  bilgi akışı zikzak düz çizgi, manuel kesikli; tedarikçi ve müşteri kamyonları (sevk sıklığıyla); hammadde ve mamul
  üçgenleri (adet + gün); pacemaker rozeti; çizelge oku pacemaker seçildiyse tek prosese. Lejant güncellendi.
- **Düzeltme:** stok, ait olduğu prosesin **önünde** gösteriliyor (eskiden önceki prosesin stoğu sonraki boşlukta
  görünüyordu).
- **Proses kartı:** C/O · Parti ve Uptime satırı eklendi (Mak/Op, C/T, OEE, Kapasite, C/O·Parti, Uptime, Vardiya, Duruş,
  FPY).
- **Zaman çizgisi:** merdiven artık stok bölgeleri (bekleme, üst) ve proses kartları (katma değer, alt) ile hizalı; sonda
  Lead time / Katma değer / PCE kutusu. Dallanan akışta hat özeti (kritik yol) korunur.
- **Dokunmatik:** tek parmakla kaydırma, iki parmakla yakınlaştırma (parmak ortası sabit), Ctrl/⌘ + tekerlek,
  "FİT" ekrana sığdırır; harita açılınca otomatik sığdırılır (telefonda yüksekliğe, yatay kaydırma).
- **Telefon:** Proses Tanımlama / Üretim / Kalite sekmelerinde tablolar yerine proses kartları; dokununca tüm alanlarla
  (Excel saha formuyla aynı alan listesi) alt sayfa formu; proses ekleme ve izinli silme. Sekme çubuğu yatay kayar.
  Tablet (≥768 px) masaüstü tablolarını ve harita düzenlemeyi kullanır.
- Yerel önizlemede 1440 px ve 375 px görünümler kontrol edildi.

### V4 — yapılanlar
- **Dashboard sadeleşti** (`VsmIndicatorPanel.tsx`): 4 büyük kart + 2 ölçer + 4 ayrı grafik + 6 ek kart yerine
  **8 gösterge** (lead time, PCE, toplam WIP + gün karşılığı, takt / pitch, darboğaz + takt'a göre durumu, ortalama OEE,
  operatör / norm kadro, yıllık kayıp). Simülasyonda değişiklik varsa gelecek değer "→" ile yanında (iyileşme yeşil,
  kötüleşme kırmızı) ve "simülasyondur" notu.
- **Operatör dengesi grafiği:** proses C/T çubukları + kırmızı takt çizgisi; takt'ı aşan proses kırmızı, sayısı yazılır;
  mevcut / gelecek arasında geçiş. Takt yoksa nedeni yazılır.
- **Kapasite ↔ günlük talep tablosu:** proses başına kapasite ve talebi karşılama yüzdesi (%100 altı kırmızı).
- **Proses karşılaştırma grafiği:** tek grafik, metrik seçimi (C/T, C/O, stok günü, OEE, hurda, hata oranı).
- **Para:** yıllık kayıp yalnızca Kurulum'da en az bir birim maliyet girildiyse gösterilir; biçim "391.350 ₺"
  (`formatMoney`). Yıllık gün = çalışma günü × 52 (V0).
- Motor: `taktCheck` (takt'ı aşan / talebi karşılamayan proses sayısı, darboğaz), `costsEntered`, `formatMoney` — testli.
- Dashboard'da norm kadro bölümü ve hesaplanan özet aynen duruyor (özet V12'de yapay zekâ analizine dönüşecek).

### V5 — yapılanlar
- **Gelecek durum = ayrı kopya** (`vsmFuture.ts`, proje `futureState`): "Gelecek durum haritası oluştur" mevcut
  prosesleri (aynı kimliklerle) kopyalar; gelecek moddaki her düzenleme kopyaya yazılır, mevcut durum değişmez. Eski
  projelerdeki "simülasyon düzeltmeleri" okunurken kopyaya çevrilir (kayıtta `simulationEdits` boşaltılır).
- **Yeni sekme "Gelecek Durum"** (`VsmFutureTab.tsx`): adım tablosu (ad, C/T, operatör, makine, önündeki stok, stok tipi,
  kanban), **art arda adımları birleştirme** (sürekli akış: C/T / ideal C/T / VA / kadro toplanır, aradaki stok kalkar,
  çıkış adetleri son adımdan; birleşik adım haritada "AKIŞ" rozetiyle), adım ekle / çıkar, "mevcuttan yeniden başlat".
  Gelecek değerleri: hammadde / mamul stoku ve tipi, paket miktarı (pitch), çizelge noktası / pacemaker (boş = mevcut).
- **Tasarım soruları:** 8 standart gelecek durum sorusu (takt, mamul süpermarketi, sürekli akış, çekme noktaları,
  pacemaker, harmanlama, pitch, iyileştirmeler) — veriden ipucuyla, cevaplar projeye kaydedilir.
- **Kaizen patlamaları:** başlık, harita (mevcut/gelecek), adım, etki alanı, hedef, döngü, sorumlu, termin, durum,
  açıklama; haritada ilgili adımın üstünde yıldız sembolü "K1…" ve başlık. Birleştirilen adımlardaki patlamalar yeni adıma
  taşınır. Sahiplik: Customer User yalnızca kendi eklediği patlamayı silebilir (sunucuda zorlanır).
- **Karşılaştırma kimlik tabanlı:** gelecek adım sayısı farklı olabildiği için proses karşılaştırmaları kimliğe (ve
  birleşik adımın `mergedFrom` listesine) göre yapılır; gelecek lead time / kayıp gelecek stoklarıyla hesaplanır.
- **Çıktılar:** PDF'e "Gelecek Durum Tasarımı ve Kaizen Patlamaları" sayfası, Excel'e "Kaizen Patlamaları" sayfası.
- **"Yalın şablon" kaldırılmış olarak kaldı** (V0). Gelecek kopyadaki adım silme/birleştirme sahiplik kuralına tabi
  değildir: kopya bir tasarım senaryosudur, girilmiş veri silinmez.
- Testler: birleştirme (komşuluk, mergedFrom, bağlantıların yeni adıma yönlenmesi), kopya, sunucu temizliği ve patlama
  sahipliği. Yerel önizlemede 5 → 4 adım birleştirme, patlama ekleme, kayıt gövdesi ve gelecek harita kontrol edildi.

### Örnek proje (kullanıcı isteği, 2026-10-29) — canlıya yazıldı
- `scripts/vsm-example-project.ts` (`--write` olmadan yalnızca doğrular). ACME demo müşterisinde (`cust_acmedemo1`)
  **"ÖRNEK — Panel Hattı VSM (8 → 6 adım, çekme sistemi)"** (`vsm_proj_ornek_panel`), açıklamasında örnek olduğu ve
  değerlerin ölçülmediği yazılı.
- Mevcut durum 8 adım (lazer kesme, zımbalama, abkant büküm, kaynak, çapak alma, toz boya, montaj, test & paketleme), her
  yerde push ve büyük partiler; montaj C/T 120 sn > takt 110 sn.
- Gelecek durum 6 adım: **kaynak + çapak** ve **montaj + test** hücreleri (sürekli akış), kesme–zımba–büküm ve boya önünde
  FIFO şeritleri, kaynak ve montaj hücresi önünde süpermarket + kanban, mamul süpermarketi, **montaj + test hücresi
  pacemaker**, heijunka, 20 adet pitch, tedarikçiye günlük milk-run / kanban.
- Hesap (motorla): lead time 31,5 → 7,5 gün, WIP 7.900 → 720 adet, PCE %0,012 → %0,05, darboğaz takt'ın altına iner.
  7 kaizen patlaması (SMED ×3, iki hücre, süpermarket/kanban, milk-run), 8 tasarım sorusunun cevabı, ürün matrisi
  (P1–P3 aile, P9 ayrı), ekip rolleri. Sorumlular rol adıdır (gerçek kişi adı yok).

### V6 — yapılanlar
- **Uygulama planı** (`VsmImplementationPlan.tsx`, `vsmPlan.ts`), Gelecek Durum sekmesinin sonunda: kaizen patlamaları
  döngülere göre (pacemaker, ek, tedarikçi, müşteri, seçilmemiş) gruplanır; satırda sorumlu, başlangıç, termin, ilerleme %,
  durum düzenlenir; zaman çubuğu (planlandı / sürüyor / gecikti / tamamlandı renkleri).
- **CI fırsat havuzu:** yeni kaynak **"VSM kaizen"** (`vsmOpportunities`): müşterinin VSM projelerindeki tamamlanmamış
  patlamalar (adım, hedef, açıklama; tutar uydurulmaz; etki alanından yalın araç önerisi: C/O → SMED vb.). CI'de projeye
  çevrilen fırsat, VSM planında "CI projesi" sütununda proje numarasıyla görünür.
- **Eski "CI Proje Yönetimine Aktar"** (doğrudan toplu kayıt) kaldırıldı; yerine havuz açıklaması.
- **Master Plan'a aktar:** tarihli her madde için bir faaliyet (`vsm_plan_<proje>_<patlama>`, ilgili modül "VSM Projects",
  hafta, ilerleme, durum, öncelik); tekrar aktarmada Master Plan'da elle değiştirilen alanlar (adam-gün, notlar, kategori,
  öncelik, danışman) korunur. Aktarmadan önce onay sorulur.
- Testler: plan satırı (hafta, durum, korunan alanlar), döngü gruplama, havuz kaydı.

### V12 — yapılanlar
- **Sunucu** (`src/server/vsm/vsmAnalysis.ts`, uç `POST /api/business/vsm-projects/:id/ai-analysis`): kayıtlı projeden
  ekranlarla aynı motorla veri özeti çıkarılır (talep, takt, pitch, bilgi akışı, uç stoklar, proses tablosu, darboğaz,
  takt'ı aşan / talebi karşılamayan adım sayısı, gelecek durum, tasarım cevapları, kaizen patlamaları) + müşterinin diğer
  modülleri (Loss Capacity ilk 5 kayıp konusu, son OpEx genel puanı, açık CI proje sayısı). Gemini (`gemini-3.5-flash`,
  OpEx ile aynı yardımcı) **yalnızca bu sayıları** kullanması istenerek çağrılır; çıktı: özet, bulgular, VSM yönlendirmesi
  (darboğaz, sürekli akış, süpermarket, FIFO, pacemaker, harmanlama, pitch, bilgi akışı, stok), kaizen öncelikleri (K no),
  sahada doğrulanacak sorular, eksik veriler. Sonuç temizlenip projeye `aiAnalysis` olarak kaydedilir (herkes aynı metni
  görür; "yenile" ile yeniden üretilir). `aiAnalysis` istemciden yazılamaz (sunucu alanı).
- **Ekran:** Dashboard'daki "Hesaplanan Özet" yerine **Yapay Zekâ VSM Analizi** paneli (üret / yenile, tarih, kim, "yapay
  zekâ önerisidir" notu, kaydedilmemiş değişikliklerin dahil olmadığı uyarısı). PDF'e analiz sayfası eklendi.
- Paylaşılan VSM modüllerinin göreli importları `.js` uzantılı yapıldı (sunucu native ESM kuralı); sunucu zinciri tarandı.
- Test: `npx tsx scripts/vsm-ai-test.ts` (veri özeti, yanıt temizleme). Yerelde örnek projeyle gerçek çağrı ~27 sn, beklenen
  biçimde yanıt (Vercel fonksiyon süresi 60 sn).

### V7 — yapılanlar
- **Versiyonlar** (`vsmVersions.ts`, `VsmVersionsModal.tsx`, başlıkta "Versiyonlar" düğmesi): ekrandaki mevcut (ve varsa
  gelecek) durum adlandırılmış, salt okunur kopya olarak eklenir (göstergeleriyle: lead time, WIP, PCE, OEE, operatör,
  adım, takt, darboğaz, yıllık kayıp); en fazla 12, projeyle birlikte Kaydet'te saklanır. İki seçenek (versiyonların
  mevcut/gelecek haritaları ya da ekrandaki durum) yan yana karşılaştırılır; fark iyileşmeyse yeşil, kötüleşmeyse kırmızı.
  Bir versiyon ekrana geri yüklenebilir (Kaydet'e basınca kalıcı). Customer User yalnızca kendi kaydettiği versiyonu
  silebilir (sunucuda zorlanır); sunucu versiyon içeriğini de temizler.
- **Kaydedilmemiş değişiklik:** Kaydet'in yanında "Kaydedilmemiş değişiklik" etiketi ve "Kaydet •"; sayfadan çıkarken
  tarayıcı uyarısı; proje listesine dönerken ya da başka projeye geçerken onay.
- **Otomatik taslak:** kaydedilmemiş değişiklikler 1,5 sn sonra bu tarayıcıda taslak olarak tutulur; proje yeniden
  açıldığında taslak kayıttan yeniyse geri yükleme sorulur; Kaydet taslağı siler. (Taslak cihaza özeldir.)
- V6 ekran kontrolü de yapıldı (plan satırında CI proje no, Master Plan satırlarının haftaları).
