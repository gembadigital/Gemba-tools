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

## 4. Önerilen sıra

V0 → V1 → V2 → V3 → V4 → V5 → V6 → V7 → V8 → V9 → V10 (V11 en sonda, diğer modüllerle).
Gerekçe: V0 canlıdaki güvenlik açığını ve müşteriye gösterilen uydurma sayıları hemen kapatır; V1 olmadan sonraki
adımlar 5.348 satırlık dosyada yapılmak zorunda kalır; V2 veri modeli V3–V8'in temelidir. V8 (çıktılar) müşteri
sunumu için öne alınabilir ama V3–V5 bitmeden rapor içeriği eksik kalır.

## 5. Kullanıcı kararı gereken noktalar

1. **Yetki:** Customer User VSM'de ne yapabilsin? (a) yalnızca görüntüle, (b) veri girişi yapsın ama silemesin,
   (c) her şey. Öneri: (b) — proses/stok verisini müşteri ekibi sahada girebilsin; proje oluşturma/silme ve gelecek
   durum Admin/Consultant.
2. **Mevcut canlı VSM projeleri:** içlerindeki örnek hat verisi (KESME & PRE-FORM … KALİTE KONTROL) ve uydurma
   değerler olduğu gibi mi kalsın, yoksa yedek alınıp kullanıcı onayıyla temizlensin mi? (Önce sayıyı salt okunur
   sorguyla çıkarabilirim.)
3. **Gelecek durum modeli:** ayrı harita kopyası (öneri, V5) mi, yoksa bugünkü "aynı proseslere düzeltme katmanı"
   korunsun mu?
4. **"Yalın Gelecek Durum Şablonu"** (tek tıkla %50/%65/%12 iyileştirme): kaldırılsın mı (öneri), yoksa "öneri
   taslağı" etiketiyle kalsın mı?
5. **Yapay zekâ:** dashboard'daki özet gerçek Gemini analizine çevrilsin mi (OpEx Danışman Özet Sunumu gibi), yoksa
   yalnızca hesaplanan metin mi kalsın?
6. **Ürün ailesi seçimi (A1):** ürün–proses matrisi isteniyor mu, yoksa proje başına tek ürün ailesi metni yeterli mi?
7. **Mobil kapsam:** telefonda yalnızca veri girişi + harita görüntüleme mi (öneri), yoksa harita düzenleme de mi?
8. **Sıra:** V8 (PDF/Excel çıktı) müşteri sunumu için öne alınsın mı?

## 6. İlerleme

| Adım | Durum | Commit |
|---|---|---|
| Plan | ✅ yazıldı, onay bekliyor | — |
