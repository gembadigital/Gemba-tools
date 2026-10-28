# CI Proje Yönetimi — Gereksinim Karşılaştırması ve İş Planı (2026-10-28)

Kaynaklar: kullanıcının gereksinim listesi (`Gemba Digital/CI proje yöneticisi .rtf`, 20 madde), bu tür
yazılımlarda beklenen standart fonksiyonlar ve kod okuması (`src/components/KaizenManager.tsx`,
`/api/business/kaizens`, `KaizenCard` — `main` @ fca9f84). Canlı veri okunmadı; kayıt sayısı bilinmiyor.

**Yol haritası kuralı (Kaizen ile aynı):** önce Gemba Tools içinde tamamlanır, her parça ileride ayrılabilecek
şekilde yazılır (ayrı klasör, kendi uçları, müşteri ayarları). Kaizen öneri sistemiyle tek program ya da Opx Suite
modülü olarak paketleme en son yapılır (Kaizen Faz 7 ile birlikte).

Durum: ✅ var · 🟡 kısmen / zayıf · ❌ yok

## 1. Kullanıcı gereksinimleri

### A. Temel fonksiyon
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| A1 | Projeler **aşama aşama kapanış tarihleri** ve **sorumlu performansı** ile takip edilmeli | 🟡 | Tek bir `plannedFinishDate` var; aşama başına plan/gerçek tarih yok. Sorumlu performansı (zamanında kapatma oranı, gecikme, kazanç) hiçbir yerde hesaplanmıyor. Gecikme yalnızca "termin geçti mi". |
| A2 | Modül kendi dashboard'uyla açılmalı | ❌ | Açılış sekmesi kanban (`useState<TabType>("kanban")`). Dashboard 4. sekme. |
| A3 | Projeler **8 adımlı** iyileştirme modeline dayanmalı | 🟡 | 7 adım var: Tanımlama, Analiz, Planlama, Uygulama, Kontrol, Standardizasyon, Kapatıldı. Bunlar `status` ve `kanbanStatus` ile paralel tutuluyor (3 alan), ve kanbanda sürükleme adımı atlayabiliyor. |
| A4 | Devam eden projeler öncelikli olarak PDCA kanbanında görülmeli | ✅ | PLAN/DO/CHECK/ACT kanbanı var. Ama ACT'ye sürüklemek projeyi doğrudan "Kapatıldı + Completed" yapıyor; Kontrol/kapanış kontrolü yok. |
| A5 | İstenirse liste ya da zaman çizelgesi görünümü | ✅ | Liste ve timeline var. Timeline ay bazlı (`YYYY-MM`); Master Plan hafta bazlı, uyumsuz. |
| A6 | Finansal dashboard fikir aşamasında, geliştirilmeli | 🟡 | 3 kart (faaliyet karı, COPQ, ROI) + grafikler var; ama para birimleri karışık toplanıyor, `expectedGain` / `targetCostReduction` / 17 kalemli `financialsInput` / `currentLoss` / `estimatedCost` ayrı ayrı ve birbirine bağlı değil. Executive Dashboard beklenen kazancı `estimatedCost || expectedGain` ile topluyor (maliyeti kazanç sayıyor). |
| A7 | Önce-sonra galerisi: Kaizen öneri sistemi varsa oraya da gönderebilmeli, kendi içinde de sergilemeli | 🟡 | Proje içinde önce-sonra formu ve galeri sekmesi var. Kaizen öneri sistemine gönderme yok (Kaizen tarafında `photosBefore/After`, `beforeMetric/afterMetric`, `benefits` alanları hazır). |
| A8 | Temel göstergeler çok fazla, sadeleştirilmeli | ❌ | Üst şeritte ~10 gösterge (Do/Check, Tamamlanan, Bekleyen, Geciken, Beklenen Kazanç, Gerçekleşen, COPQ, Faaliyet Karı, Başarı Oranı, Önce-Sonra) + dashboard'da ~10 kart/grafik. |

### B. Proje başlatma ve proje kartı
| # | Gereksinim | Durum | Bugün kodda olan |
|---|---|---|---|
| B1/B3 | Başlatma ekranı yeniden ve güncel tasarlanmalı, ekran büyümeli | 🟡 | Sihirbaz `max-w-5xl` modal; fırsat listesi + "boş proje" + ekip atama ara adımı. Yoğun ve küçük yazılı. |
| B2 | Diğer modüllerin analizlerindeki iyileşme noktaları projeye aktarılabilmeli; panelden seçilebilmeli; ya da boş proje | 🟡 | Yalnızca Loss Capacity (tarayıcının `localStorage`'ından — cihaza bağlı) ve maliyet tablosu. SMED, VSM, Yamazumi, 5S, OpEx Assessment, Kaizen önerisi, PTR aksiyonu kaynak değil. Aynı fırsat birden çok kez projeye dönüştürülebiliyor. Sabit demo ürün aileleri (Isıtıcı/Soğutucu/Pişirici) ve uydurma oranlar (%15 maliyet, %60 kazanç) var. |
| B4 | Tanımlamalar ve kutular bölüm bölüm incelenmeli; birbiriyle konuşmayan alanlar | ❌ | Bkz. §3. |
| B5 | Para birimi alanlarında sayılar binlik ayraçla gösterilmeli | ❌ | 41 sayısal giriş `type="number"`; girişte ayraç yok. Gösterimde de tutarlı biçim yok (bazı yerlerde `toLocaleString`, bazılarında ham sayı). |
| B6 | Kök neden: 5 Neden + isteğe bağlı **balık kılçığı** | 🟡 | Yapılandırılmış 5 Neden var. Balık kılçığı (6M) yok. |
| B7 | Uygulama planı Master Plan gibi çalışmalı: görev atama, ekrandan takip | 🟡 | Tablo var (faaliyet, sorumlu, termin, durum). Başlangıç tarihi, ilerleme %, Gantt, bağımlılık, kişiye göre görev listesi, hatırlatma yok. Ayrıca ikinci bir görev sistemi (`tasks`, kanban kartında) ve serbest metin alanları (`improvementActions`, `responsibles`, `actionsTaken`) aynı bilgiyi tutuyor. |
| B8 | Alt adımlar birden fazla iyileştirme içerebilir; faaliyetler önce-sonra iyileştirmesine atanabilmeli | ❌ | Önce-sonra formu projeye bağlı, aksiyon satırına bağlanamıyor. |
| B9 | Proje bitiminde tek sayfa sunum kartı (sol: problem, kayıp boyutu, hedef; sağ: kök neden, aksiyonlar, sonuçlar) | 🟡 | Excel "proje kartı" çıktısı var; tek sayfa A3 düzeninde sunum kartı yok. |
| B10 | Sunum kartı PDF + Excel, grafiksel, executive formatta | 🟡 | Excel (stilli) ve portföy PDF'i (tablo) var; grafiksel tek sayfa PDF yok. OpEx'te kullanılan sunucu tarafı PDF altyapısı (`api/opex-report.ts`, Chromium) yeniden kullanılabilir. |
| B11 | Alt bölümde isteğe bağlı önce-sonra formatı | ❌ | Sunum kartına önce-sonra eklenemiyor. |
| B12 | Proje aşamaları — Kontrol ve Kapatma kısımları kontrol edilmeli | ❌ | Bkz. §3: Kontrol adımının kendine ait alanı yok; kapanış hiçbir şart aramıyor. |

## 2. Bu tür programlarda beklenen, listede olmayan fonksiyonlar
| # | Fonksiyon | Durum | Not |
|---|---|---|---|
| S1 | **Aşama kapısı (tollgate) onayı**: her adım sonunda sponsor/lider onayı | ❌ | Sponsor alanı var ama hiçbir yetkisi yok. |
| S2 | **Baz çizgisi ve ölçüm**: KPI'nın başlangıç, hedef, gerçekleşen değeri ve birimi; trend | 🟡 | Hedef % ve gerçekleşen % var; mevcut değer, birim ve zaman içinde ölçüm yok. |
| S3 | **Sürdürülebilirlik takibi** (30/60/90 gün sonra KPI hâlâ tutuyor mu) | ❌ | Kaizen'de var (`followUps`); CI'da yok. |
| S4 | **Kazancın finans onayı** (beklenen → doğrulanmış) | ❌ | Gerçekleşen kazanç serbest giriş. |
| S5 | **Portföy önceliklendirme** (etki/efor matrisi, puanlama) | 🟡 | Etki analizi (Yüksek/Orta/Düşük) var, hesaba girmiyor. |
| S6 | **Yaygınlaştırma / öğrenilen dersler** (yatay yayılım) | 🟡 | "Standardizasyon ve Yaygınlaştırma" check listesi var; yayılacak alan/hat ve ders kaydı yok. |
| S7 | **Bildirim**: görev atandı, termin yaklaştı/geçti, onay bekliyor | ❌ | "Hatırlatma" butonu e-posta göndermiyor, yalnızca sayaç artırıyor. Graph e-posta altyapısı ve Kaizen bildirim katmanı mevcut. |
| S8 | **Yetki ve görünürlük** (rol, müşteri izolasyonu) | ❌ | Sunucu rol kontrolü yok; gövdedeki `factory_id` sorgusuz kabul ediliyor. |
| S9 | **Değişiklik geçmişi / yorumlar** | ❌ | Kim neyi ne zaman değiştirdi bilinmiyor; iki kişi aynı anda kaydederse son yazan kazanır. |
| S10 | **Kalıcı proje numarası** | ❌ | `CIPyyaa-nn` her açılışta sıradan yeniden hesaplanıyor; silme/eski tarihli ekleme numaraları kaydırır. |
| S11 | **Müşteri ayarları** (adımlar, departmanlar, KPI listesi, kur, ürün aileleri) | ❌ | Hepsi kodda sabit. |

## 3. Bölüm bölüm alan incelemesi (B4, B12)
| Bölüm | Sorun |
|---|---|
| Numaralandırma | Proje kartında 1-Problem Tanımı'ndan sonra **2 yok** (3-Etki Analizi'ne atlıyor). |
| 1 Künye ↔ Master Plan | `phase` "Faz 1 (1 Ay)" metni; Master Plan fazı `F1/F2…`. İki faz kavramı bağlı değil. |
| 1 Problem ↔ kayıp | `currentLoss` (kayıp boyutu) başlatmada dolduruluyor ama problem bölümünde düzenlenmiyor/gösterilmiyor; sunum kartının sol tarafı için gerekli. |
| 3 Etki Analizi | Yüksek/Orta/Düşük seçimi hiçbir hesaba, önceliğe, dashboard'a girmiyor. |
| 4 Hedef ↔ 7 Sonuç | Hedef: `targetRatio` %, `targetCostReduction`. Sonuç: `realizedImprovementPct`, `realizedGain`. Hedef ile sonuç yan yana karşılaştırılmıyor; KPI'nın birimi ve başlangıç değeri yok. |
| 4 Hedef ↔ Finansal | `targetCostReduction`, `expectedGain`, 17 kalemli `financialsInput` ve `estimatedCost` aynı şeyin farklı ifadeleri; hangisinin dashboard'a gittiği tutarsız. |
| 5 Kök neden | Başlatmada "Kök neden 5 Neden analizi yapılması bekleniyor." metni **veri olarak** kaydediliyor. |
| 6 Uygulama planı | Tablo + kanban kartındaki `tasks` + serbest metin `improvementActions/responsibles/actionsTaken` → aynı bilgi 3 yerde. İlerleme % görevlerden mi, adımdan mı geliyor belirsiz (Master Plan senkronu ikisini karıştırıyor). |
| Kontrol | Kendine ait hiçbir alan yok: ölçüm, doğrulama tarihi, hedefe ulaşıldı mı kararı yok. |
| 7 Kapanış | "Kapatıldı" seçmek ya da ACT'ye sürüklemek yeterli; gerçekleşen kazanç, standardizasyon listesi, sonuç kararı zorunlu değil. `projectResult` (Başarılı/İptal…) ile `status` bağımsız: "İptal" seçilmiş proje "Completed" sayılabilir. |
| 9 Önce-Sonra | Projeye bağlı, aksiyon satırına bağlı değil; Kaizen sistemine gönderilemiyor. |
| Başlatma | Yeni proje doğrudan "In Progress"; yer tutucu açıklamalar ("Aksiyon planı uygulanıyor…") veri olarak yazılıyor; termin varsayılanı +90 gün. |

## 4. Önerilen 8 adım (A3)
Toyota "8 adımda problem çözme" modeline göre; PDCA ile eşleşir ve her adımın kendi alanları, plan/gerçek kapanış
tarihi ve (isteğe bağlı) kapı onayı olur:

| Adım | İçerik | PDCA |
|---|---|---|
| 1 Problemi tanımla | Problem, kapsam, kayıp boyutu (para + KPI başlangıç değeri), ekip, sponsor | P |
| 2 Problemi parçala / mevcut durum | Veri, gemba gözlemi, öncelikli alt problem; diğer modüllerden gelen analiz bağlantısı | P |
| 3 Hedef belirle | KPI, birim, başlangıç → hedef, hedef kazanç, hedef tarih | P |
| 4 Kök neden analizi | 5 Neden ve/veya balık kılçığı (6M); seçilen kök neden(ler) | P |
| 5 Karşı önlemler / uygulama planı | Görevler (sorumlu, başlangıç, termin, ilerleme), Gantt | P |
| 6 Uygula | Görev takibi, önce-sonra kayıtları (aksiyona bağlı) | D |
| 7 Sonuçları değerlendir (Kontrol) | Gerçekleşen KPI ölçümleri, hedefe ulaşıldı mı, gerçekleşen kazanç (finans onayı) | C |
| 8 Standartlaştır ve yaygınlaştır (Kapanış) | Standart iş / talimat / eğitim / kontrol planı, yaygınlaştırma, öğrenilen dersler, sunum kartı, 30/60/90 gün takibi | A |

Adım adları ve hangi adımın onay gerektirdiği müşteri ayarından değiştirilebilir.

## 5. İş planı
Boyut: S (≤ yarım gün) · M (1–2 gün) · L (3+ gün). Her adım ayrı commit + push; canlı veri taşıması gereken adımlarda
önce yedek ve kullanıcı onayı.

### C0 — Güvenlik ve veri bütünlüğü (S) — S8, S10, A6 hatası
| İş | Kabul ölçütü |
|---|---|
| Sunucuda müşteri zorlaması: gövdedeki `factory_id` yok sayılır, mevcut kaydın müşterisi kontrol edilir; rol kuralları (Customer User kararına göre) | Başka müşterinin proje id'siyle yazma/silme 403 döner. |
| Kalıcı proje numarası (sunucuda, oluşturma anında; mevcut kayıtlara bugünkü sıralarıyla bir kerelik atanır) | Silme/ekleme sonrası numaralar değişmez. |
| Executive Dashboard beklenen kazanç toplamı düzeltmesi; tutarlar para birimine göre ana para birimine çevrilir (Kaizen `toBaseCurrency`) | Maliyet kazanç sayılmaz; TL/₺ karışmaz. |

### C1 — Modül iskeleti (M) — ayrılabilirlik
| İş | Kabul ölçütü |
|---|---|
| `src/components/ci/` (sekme başına dosya, `ciTypes.ts`, `ciCalc.ts`); sunucu `src/server/ci/` (router + servis), `/api/business/kaizens` geriye uyumlu | Ekran davranışı değişmez; `KaizenManager.tsx` ince bir kabuk olur. |
| `ci_settings` (müşteri başına): adımlar, kapı onayı, departmanlar, KPI listesi, ürün aileleri, kur, varsayılan süreler | Kodda sabit liste/oran kalmaz (demo ürün aileleri, %15, %60, +90 gün kaldırılır). |

### C2 — Veri modeli ve 8 adımlı yaşam döngüsü (M–L) — A1, A3, A4, B4, B12, S1, S9
| İş | Kabul ölçütü |
|---|---|
| Tek `stage` alanı (1–8); `kanbanStatus` ve `status` ondan türetilir; aşama başına plan/gerçek kapanış tarihi | Kanban, liste, timeline, Master Plan aynı durumu gösterir. |
| Aşama geçiş kuralları: kanbanda adım atlanamaz; Kontrol için KPI ölçümü, Kapanış için gerçekleşen kazanç + standardizasyon listesi + sonuç kararı zorunlu; `projectResult` "İptal/Askıda" ise proje tamamlanmış sayılmaz | ACT'ye sürükleme eksik şartları listeler. |
| İsteğe bağlı kapı onayı (sponsor/lider) | Onay bekleyen projeler listelenir. |
| Alan birleştirme: tek KPI bloğu (birim, başlangıç, hedef, gerçekleşen ölçümler); tek finansal model (beklenen ↔ gerçekleşen, kalem kırılımı isteğe bağlı); tek görev listesi (serbest metin alanları görev listesine taşınır) | §3'teki çift/kopuk alanlar kalmaz; eski kayıtlar okunurken dönüştürülür (yedekli). |
| Değişiklik geçmişi + alan bazında kaydetme (PATCH) | Eşzamanlı düzenlemede veri kaybolmaz; kim/ne/ne zaman görünür. |

### C3 — Uygulama planı = mini Master Plan (M) — B7, B8
| İş | Kabul ölçütü |
|---|---|
| Görev: sorumlu (ekip listesinden), başlangıç, termin, ilerleme %, durum; proje içi Gantt; "Görevlerim" görünümü | Sorumlu kendi açık görevlerini tek listede görür. |
| Görevi önce-sonra kaydına bağlama (bir projede birden çok önce-sonra) | Sunum kartında aksiyon ↔ önce-sonra eşleşmesi görünür. |
| Master Plan bağı tek mekanizma (`linkedItemId`, hafta bazlı), istemci çift yazması kaldırılır | Master Plan'da CI projesi doğru haftalarda ve doğru ilerlemeyle görünür. |

### C4 — Kök neden: balık kılçığı (S–M) — B6
| İş | Kabul ölçütü |
|---|---|
| 6M balık kılçığı (Makine, Metot, Malzeme, İnsan, Ölçüm, Çevre; başlıklar ayarlanabilir), nedenleri 5 Neden'e taşıma, seçilen kök neden(ler) | Kullanıcı 5 Neden, balık kılçığı ya da ikisini birlikte kullanır; seçilen kök neden sunum kartına gider. |

### C5 — Başlatma ekranı ve fırsat havuzu (M–L) — B1, B2, B3
| İş | Kabul ölçütü |
|---|---|
| Tam ekran, adımlı yeni başlatma akışı: kaynak seç (fırsat havuzu / boş proje) → tanım → ekip & tarih → özet | Mobil/tablette de rahat kullanılır. |
| Sunucu tarafı **fırsat havuzu**: Loss Capacity (localStorage yerine sunucu), maliyet tablosu, OpEx Assessment kritik boşlukları, SMED/VSM/Yamazumi/5S bulguları, Kaizen önerileri, PTR aksiyonları; her fırsatın kaynağı ve "projeye dönüştü" bağı | Bir fırsat iki kez projeye dönüşmez; projeden kaynak analize gidilir. Kaynak modüller tek tek eklenir (önce Loss Capacity + OpEx + Kaizen). |

### C6 — Sayı biçimi ve finansal dashboard (M) — B5, A6
| İş | Kabul ölçütü |
|---|---|
| Ortak para/sayı giriş bileşeni (binlik ayraçlı, tr-TR) ve gösterim biçimi; tüm tutar alanlarında | Girişte ve gösterimde `1.250.000 ₺` biçimi. |
| Finansal dashboard: beklenen → doğrulanmış → gerçekleşen hunisi, aylık kümülatif kazanç, kategori/departman kırılımı, yatırım geri dönüşü; finans onayı | Rakamlar proje kartlarındaki tek finansal modelden gelir. |

### C7 — Dashboard açılışı ve sadeleştirme (S–M) — A2, A8, A1
| İş | Kabul ölçütü |
|---|---|
| Modül dashboard ile açılır; üst şerit 4–5 göstergeye iner (aktif proje, geciken, beklenen/gerçekleşen kazanç, kapanış oranı); ayrıntı dashboard'da | Tek bakışta okunur. |
| **Sorumlu performansı**: lider başına aktif/kapanan, aşama zamanında kapanma oranı, ortalama gecikme, gerçekleşen kazanç | A1 karşılanır. |

### C8 — Sunum kartı (A3) (M) — B9, B10, B11
| İş | Kabul ölçütü |
|---|---|
| Tek sayfa A3: sol — problem, kayıp boyutu, hedef (KPI başlangıç→hedef grafiği); sağ — seçilen kök neden, aksiyon listesi, sonuçlar (KPI önce/sonra grafiği, kazanç); alt — isteğe bağlı önce-sonra | Ekranda önizleme. |
| PDF (sunucu, OpEx rapor altyapısı) ve Excel çıktısı | İki çıktı aynı içeriği taşır. |

### C9 — Kontrol sonrası: sürdürülebilirlik, yaygınlaştırma, bildirim (M) — S3, S6, S7
| İş | Kabul ölçütü |
|---|---|
| 30/60/90 gün sürdürülebilirlik ölçümleri (Kaizen `followUps` mantığı) | Hedef tutmazsa uyarı. |
| Yaygınlaştırma listesi (hat/alan) ve öğrenilen dersler | Kapanışta doldurulur, raporlanır. |
| Gerçek bildirim (Kaizen bildirim katmanı): görev atandı, termin yaklaştı/geçti, onay bekliyor; haftalık gecikme özeti (cron) | "Hatırlatma" gerçekten e-posta gönderir. |

### C10 — Kaizen ↔ CI köprüsü (M) — A7
| İş | Kabul ölçütü |
|---|---|
| CI önce-sonra kaydını Kaizen önce-sonra galerisine gönder (Kaizen modülü açıksa); Kaizen önerisini CI projesine yükselt | Aynı iyileştirme iki yerde tekrar girilmez. |

### C11 — Ayırma / Opx Suite (L)
Kaizen Faz 7 ile birlikte: tek "İyileştirme" programı (Kaizen öneri + CI proje) ya da ayrı modüller; ortak personel, ayar, bildirim, giriş adaptörleri.

## 6. Önerilen sıra
C0 → C1 → C2 → C3 → C6 → C7 → C4 → C8 → C5 → C9 → C10 → C11.
Gerekçe: C0 güvenlik; C1–C2 veri modeli oturmadan ekran işleri iki kez yapılır; C3/C6/C7 günlük kullanımı en çok
değiştirenler; C8 sunum kartı C2'nin tek KPI/finans modeline dayanır; C5 fırsat havuzu her kaynak modül için ayrı iş
olduğundan parça parça ilerler.

## 7. Kullanıcı kararları (2026-10-28)
1. **8 adım:** Toyota 8 adım A3 (§4).
2. **Onay:** her projede bir **proje lideri** seçilir; aşama onaylarını proje lideri verir.
3. **Yetkiler:** Customer User projeyi **silemez**. Proje lideriyse proje açar, düzenler, içindeki maddeleri siler;
   yalnızca proje üyesiyse görür, düzenler ve hatalı veriyi (madde) silebilir; projeyi silemez.
   Proje silme yalnızca Admin / Danışman.
4. **Kazanç doğrulama:** sistem raporlar → **danışman** gerçek değeri teyit eder → **proje lideri** teyit edilen veriyi onaylar.
5. **Ürün biçimi:** Kaizen ve CI **ayrı modüller**; gerekirse ortak bir program adı altında birleşir (C10–C11 buna göre).
6. **Canlı kayıt taşıması** (C2): yedek alınıp onayla yapılır — açık.

Bu kararların plana etkisi: C2'de proje lideri ve üyeler serbest metin yerine **kullanıcı kimliği** olur (yetki ve
görünürlük buna dayanır: lider/üye olmayan Customer User projeyi görmez); kapı onayı = proje lideri onayı;
C6'da kazanç akışı "sistem → danışman teyidi → lider onayı".

## 8. İlerleme
| Adım | Durum | Not |
|---|---|---|
| C0 | ✅ kod (canlıda doğrulanmadı) | Ayrıntı aşağıda. |
| C1 | ✅ kod (canlıda doğrulanmadı) | Ayrıntı aşağıda. Sekme bileşenlerinin bölünmesi C2/C3/C6/C7'ye bırakıldı (gerekçe aşağıda). |
| C2 | ✅ kod (canlıda doğrulanmadı) | 8 adımlı A3 kartı, lider onayı, lider/üye yetkileri, geçmiş. Ayrıntı aşağıda. |
| C3 | ✅ kod (canlıda doğrulanmadı) | Uygulama planı (Gantt, başlangıç/ilerleme, önce-sonra bağı), Görevlerim, tek hafta bazlı Master Plan bağı. Ayrıntı aşağıda. |
| C6 | ✅ kod (canlıda doğrulanmadı) | Tek finans modeli, yeni finansal dashboard, kazanç kırılımı penceresi, binlik ayraç. Ayrıntı aşağıda. |
| C7 | ✅ kod (canlıda doğrulanmadı) | Genel Bakış açılış panosu, sade başlık/sekmeler, sorumlu performansı. Ayrıntı aşağıda. |

### C0 — yapılanlar
- **Sunucu (`/api/business/kaizens`):** müşteri gövdeden değil `x-factory-id` kapsamından alınır; güncellemede mevcut
  kaydın müşterisine erişim kontrol edilir ve proje başka müşteriye taşınamaz (403). `projectNo`, `projectSeq`,
  `created_*` sunucu alanıdır, istemci değiştiremez. **Proje silme yalnızca Admin/Danışman** (Customer User → 403);
  ekranda sil butonları da yalnızca bu rollere görünür, proje içi madde silme herkese açık.
- **Kalıcı proje no:** yeni projelere oluşturmada `CIP<yy><mm>-<seq>` atanır (`db.nextKaizenProjectNo`; müşteri başına
  sıra). Numarası olmayan eski projeler ekranda eskisi gibi tarih sırasıyla numaralanır; yeni numaralar onların üstünden
  başlar, çakışmaz ve onları kaydırmaz. **Açık:** eski projelere numaranın kalıcı yazılması (bir kerelik, canlı veri
  yazımı — yedek + onay gerekir); eski bir proje silinirse ondan sonraki eski projelerin numarası hâlâ kayar.
  Aynı anda iki proje açılırsa aynı numara alabilirdi → C1'de çözüldü (işlem kilidi).
- **Silme sırası:** Master Plan satırı yalnızca sunucu projeyi gerçekten sildikten sonra kaldırılır (önce koşulsuz
  siliniyordu). Yeni proje detay penceresi sunucudan dönen kayıtla (numarasıyla) açılır.
- **Para birimi:** `src/components/ci/ciMoney.ts` — "₺/TL/TRY", "$/USD", "€/EUR" aynı sayılır; toplamlara yalnızca
  müşterinin para birimindeki tutarlar girer, diğerleri "n proje hariç" notuyla belirtilir (kur ayarı C1'de).
  KaizenManager, Executive Dashboard ve Opex Proje Dashboard bunu kullanır.
- **Hatalı/uydurma rakamlar kaldırıldı:** Executive Dashboard beklenen kazancı `estimatedCost`'tan (maliyet) okuyordu
  → `expectedGain`. CI dashboard'da COPQ azalışı "gerçekleşen kazancın %72'si" → kalite/hurda kategorisindeki
  projelerin gerçekleşen kazancı; ciro yoksa sabit 12.000.000 faaliyet karı, maliyet tablosu yoksa sabit 4.500.000
  COPQ varsayımı → "—" ve açıklama; beklenen kazançta "gerçekleşen × 1,2" tahmini kaldırıldı.
- Not: PTR ekranı da CI projesi açıyor (`PtrTimeStudy.tsx`) → C5 fırsat havuzunda kaynak olarak ele alınmalı.

### C1 — yapılanlar
- **Sunucu modülü** `src/server/ci/ciRoutes.ts` (`registerCiRoutes`): CI uçları `app.ts`'ten ayrıldı; ana uygulamaya
  yalnızca `authenticateToken`, `resolveFactoryScope`, `canAccessFactory` ile bağlı (ayırma için adaptör noktası).
  Yollar değişmedi (`/api/business/kaizens`, CI projeleri tarihsel olarak `kaizens` koleksiyonunda — Kaizen öneri
  sisteminin koleksiyonlarından bağımsız).
- **Numara kilidi:** yeni proje `db.createKaizenWithNumber` ile tek işlemde (transaction) ve müşteri başına
  `pg_advisory_xact_lock` altında numaralanıp yazılır → eşzamanlı iki proje aynı numarayı alamaz. Pool tek
  bağlantılı ve pgbouncer kullanıldığı için oturum kilidi değil işlem kilidi; işlem içinde tüm sorgular aynı
  bağlantıdan. Oluşturan/oluşturma zamanı artık kaydediliyor (istemci kendi id'sini gönderdiği için önce yazılmıyordu).
- **Ortak kod** (istemci + sunucu): `src/utils/ciProject.ts` (numara), `src/utils/ciSettings.ts` (ayar modeli,
  normalizasyon, `phaseNumber`, `choicesWith`).
- **CI ayarları** (`ci_settings`, müşteri başına tek kayıt `ci_settings_<factoryId>`): `GET|POST /api/business/ci/settings`;
  okuma müşteriye erişimi olan herkes, yazma Admin/Danışman. KaizenManager → **Ayarlar** sekmesi (yalnızca
  Admin/Danışman): para birimleri + kurlar, departmanlar (öneri listesi, serbest yazım serbest), proje fazları,
  ürün aileleri (ad + hacim payı), varsayılan proje süresi. Varsayılanlar eski sabitlerle aynı; **demo ürün aileleri
  (Isıtıcı/Soğutucu/Pişirici) kaldırıldı** — liste boşsa yalnızca "Tüm fabrika".
- **Kur dönüşümü:** `ciMoney` toplamları müşteri para birimine ayarlardaki kurla çevirir; kuru olmayan para birimi
  toplama girmez ve ekranda "n proje hariç" yazar. CI ekranı, Executive Dashboard ve Opex Proje Dashboard aynı kuralı
  kullanır. Kazanç alanlarındaki para birimi seçenekleri: müşteri para birimi + ayarlardakiler (kayıttaki eski değer
  korunur).
- **Faz hatası düzeltildi:** faz filtresi "Phase 1: Quick Win" değerini arıyor, kart "Faz 1 (1 Ay)" kaydediyordu →
  filtre ve dashboard faz grafikleri düzenlenmiş projeleri hiç saymıyordu. Artık faz numarasıyla gruplanıyor
  (`phaseNumber`), her iki eski etiket de doğru sayılıyor.
- **İstemci modülü** `src/components/ci/`: `ciTypes.ts`, `ciCategory.ts`, `ciOpportunities.ts` (fırsat üretimi),
  `ciExcelExport.ts` (proje kartı + önce-sonra Excel), `ciMoney.ts`, `useCiSettings.ts`, `CiSettingsPanel.tsx`.
  KaizenManager 5.584 → 5.056 satır.
- **Bölünmeyen kısım ve gerekçe:** kanban/liste/timeline/dashboard/proje kartı JSX'i KaizenManager'da kaldı; bu
  ekranlar C2 (8 adım, tek durum), C3 (uygulama planı), C6 (finans), C7 (dashboard) ile yeniden yazılacak — şimdi
  bölmek aynı kodu iki kez taşımak olur. Yeni ekranlar doğrudan `ci/` altında yazılacak.
- **Doğrulama:** `tsc`, `npm run build`, sunucunun native ESM yüklenmesi (dosya bazlı esbuild + `import('./api/index.js')`),
  ayar/numara/kur mantık simülasyonu (17 kontrol). Canlıda denenmedi.

### C2 — yapılanlar
- **Kurallar tek yerde:** `src/utils/ciLifecycle.ts` (istemci + sunucu): Toyota 8 adım A3 (`CI_STEPS`), adım şartları
  (`stageRequirements`), yetkiler (`canViewProject`, `canEditProject`, `canApproveStage`, `canManageHold`), işlemler
  (`applyStageAction`: onaya gönder, onayla, geri gönder, önceki adıma dön, yeniden aç, askıya al, iptal, devam,
  kazanç teyidi) ve geçmiş kaydı. `status` / `kanbanStatus` / `progressStep` artık adımdan türetilen kopyalardır
  (dashboard, Master Plan senkronu, Excel değişmeden çalışır; "On Hold" / "Cancelled" durumları eklendi).
- **Adım şartları:** 1 ad + problem + lider + (kayıp tutarı ya da KPI başlangıcı) · 2 mevcut durum · 3 KPI, başlangıç,
  hedef, hedef tarih · 4 kök neden · 5 en az bir aksiyon, hepsinde sorumlu + termin · 6 tüm aksiyonlar bitti/iptal ·
  7 en az bir KPI ölçümü + "hedefe ulaşıldı mı" kararı + (kazanç varsa) danışman teyidi · 8 en az bir standartlaştırma
  + sonuç (Başarılı / Revizyon Gerekli) + sonuç açıklaması. Adım 8'in onayı projeyi kapatır.
- **Onay:** proje lideri (kullanıcı hesabı) onaylar; Admin her zaman. Lideri yalnızca isim olarak kayıtlı eski
  projelerde Admin/Danışman onaylar. Lider olmayan kişi "onaya gönder"ir, lider onaylar ya da geri gönderir.
- **Kazanç:** gerçekleşen kazanç girilir → danışman "Kazancı teyit et" → lider 7. adımı onaylar. Teyitten sonra kazanç
  tutarı/para birimi değişirse teyit sunucuda düşer.
- **Yetkiler (sunucuda):** Customer User yalnızca lideri ya da üyesi olduğu projeleri görür/düzenler (listeden
  filtrelenir); proje açarken kendini lider ya da üye seçmek zorunda; lider/ekibi yalnızca lider ya da danışman
  değiştirir; projeyi silemez. Kaizen sicil-no oturumları CI uçlarına erişemez. Adım, onay, kapanış, geçmiş, kazanç
  teyidi ve adım onay damgaları yalnızca `POST /api/business/kaizens/:id/stage` ile değişir; normal kayıt bunları
  yok sayar (adımların yalnızca *planlanan* tarihi düzenlenebilir). Yeni proje her zaman 1. adımdan başlar.
- **Kayıt:** kart yalnızca değişen alanları gönderir (sunucu birleştirir) → aynı projede farklı bölümleri düzenleyen
  iki kişi birbirinin verisini ezmez. Her kayıt ve işlem geçmişe yazılır (kim, ne zaman, not); en fazla 300 kayıt.
- **Yeni proje kartı** `src/components/ci/CiProjectCard.tsx` (eski detay modalının yerine), Kaizen modülüyle aynı
  tasarım dili (`ci/ciUi.tsx` Kaizen UI kitini yeniden kullanır): solda 8 adım (telefonda yatay şerit) ve adım
  tarihleri, sağda adım içeriği, altta şart listesi + onay düğmeleri; "Künye & Ekip" (lider/üyeler hesaplardan, adım
  planlanan tarihleri), "Ekler", "Geçmiş" sekmeleri. Yeni alanlar: KPI bloğu (`kpi`: ad, birim, iyi yön, başlangıç,
  hedef, ölçümler), `kpiTargetMet`, `horizontalDeployment` (yaygınlaştırma), `lessonsLearned`, `projectLeaderId`,
  `projectTeamIds`, aksiyon sorumlusu için `responsibleId`. Tutar alanları binlik ayraçlı (`AmountInput`, B5'in
  kart içindeki kısmı). Fotoğraflar yüklenirken küçültülür; ek dosya sınırı 8 MB → **3 MB** (Vercel ~4,5 MB gövde sınırı).
- **Kanban:** kart sürüklemek adım atlatmaz — yalnızca bir sonraki PDCA sütununa, o adımın şartları sağlanmışsa
  (onaya gönder / onayla) taşınır; aksi halde neden söylenir. Kartlarda "Adım n/8" rozeti ve "onay" işareti.
- **Canlı veri:** toplu taşıma yapılmadı. Eski projelerin adımı okurken türetilir (Tanımlama→1, Analiz→4, Planlama→5,
  Uygulama→6, Kontrol→7, Standardizasyon/Kapatıldı→8; yoksa kanban sütunu); ilk işlemde açık alanlar yazılır. Eski
  `targetKpi` KPI adı olarak okunur; eski serbest metin aksiyon alanları 5. adımda salt okunur gösterilir.
- **Davranış değişikliği (canlıda dikkat):** Customer User artık müşterisinin tüm CI projelerini değil, yalnızca lideri
  ya da üyesi olduğu projeleri görür. Eski kayıtlarda eşleşme isimle yapılır ("Ad Soyad (rol)" ekleri yok sayılır).
- **Açık kalanlar:** etki analizi kartta salt okunur (düzenleyici yok); "Kazanç kırılımı" (17 kalem) modalı hâlâ yalnızca
  `actualSavings` yazar → tek finans modeli C6; yeni proje sihirbazı ve önce-sonra formu eski tasarımda (C5 / C10);
  `targetRatio` / `realizedImprovementPct` eski yüzde alanları KPI bloğuyla birleştirilmedi (gösterim C6/C7);
  "Hatırlatma" hâlâ yalnızca sayaç (C9).
- **Doğrulama:** `tsc`, `npm run build`, native ESM yükleme; yaşam döngüsü + gerçek Express rotaları bellek içi sahte
  veritabanıyla 37 kontrol (görünürlük, düzenleme, lider değiştirme, adım şartları, onay, iptal, kiosk oturumu, kazanç
  teyidinin düşmesi, damga koruması, silme) — test yeni projenin istemcinin gönderdiği adımda açılabildiği bir açığı
  yakaladı, düzeltildi. Kart yerel önizlemede (sahte veri) masaüstü ve telefon genişliğinde denendi; aksiyon satırı
  ve telefon başlığı düzeltildi. Canlıda denenmedi.

### C3 — yapılanlar
- **Aksiyon modeli** (`ci/ciTypes.ts` `CITask`): `startDate`, `progressPercent` (0/25/50/75/100), `status`,
  `responsibleId`, `beforeAfterIds`. Durum ile ilerleme birbirini günceller (100 → Yapıldı; >0 → Devam Ediyor).
- **Uygulama planı (A3 adım 5–6):** proje içi Gantt (`ci/CiTaskGantt.tsx`: başlangıç→termin çubuğu, ilerleme dolgusu,
  bugün çizgisi, hedef bitiş işareti, geciken kırmızı; başlangıcı olmayan eski aksiyonlar termine kadar 1 hafta),
  genel ilerleme çubuğu, satırda sorumlu (hesaplardan) / başlangıç / termin / durum / ilerleme; "başlangıç terminden
  sonra" ve "termin geçti" uyarıları.
- **Önce-sonra ↔ aksiyon (B8):** 6. adımda her aksiyon projedeki önce-sonra kayıtlarına bağlanabilir (çoklu) ya da
  "Bu aksiyon için önce-sonra" ile o aksiyona bağlı yeni kayıt açılır (form aksiyon adıyla dolar). Kayıt listesinde
  hangi aksiyondan geldiği yazar; kayıt silinince aksiyonlardaki bağ da silinir. Önce-sonra kaydetme/silme artık
  yalnızca değişen alanları gönderir.
- **Görevlerim** sekmesi (`ci/CiMyTasks.tsx`): müşterinin tüm projelerindeki aksiyonlar kişiye göre — termini geçmiş /
  bu hafta / sonra / terminsiz / tamamlanan; durum ve ilerleme buradan da değişir (yalnızca `tasks` gönderilir).
  Admin/Danışman kişi seçebilir ya da tüm aksiyonları görebilir. Sekmede açık görev sayısı rozeti. Askıdaki/iptal
  projeler gösterilmez.
- **Yetki:** aksiyon sorumlusu da proje katılımcısıdır — ekipte olmasa da projeyi görür ve düzenler (lider/ekip
  değiştiremez). Önceden ekip dışı bir müşteri kullanıcısına aksiyon atanırsa projeyi hiç göremiyordu.
- **Master Plan tek bağ (hafta bazlı):** CI satırı (`gantt_sync_<projeId>`) artık `utils/ciPlan.ts`
  `ciMasterPlanRow` ile yazılır: ISO hafta (`plannedStartWeek` = açılış, `plannedFinishWeek` = hedef bitiş; yıl
  geçişinde 52'de kesilir), `relatedModule: "Kaizen Projects"` + `linkedItemId`, lider, ilerleme ve durum; Master
  Plan'da elle düzenlenen alanlar (faaliyet no, faz, alt faaliyet, gerçekleşen haftalar, adam-gün) korunur; satır
  yalnızca gösterdiği bir şey değiştiyse yazılır. Master Plan'ın bağlı satır senkronu CI için aynı fonksiyonları
  (`ciProjectProgress`, `ciPlanStatus`) kullanır → iki taraf artık farklı ilerleme yazıp birbirini ezmez.
- **Düzeltilen hatalar:** (1) eski CI satırları yalnızca ay taşıyordu ve Master Plan ay→hafta çevirisi yalnızca
  Haziran–Ağustos'u tanıdığından tüm CI projeleri 24.–32. haftalarda görünüyordu → eski satırlar ekranda projenin
  gerçek tarihlerinden haftaya çevrilir (veri yazılmaz; proje bir sonraki kayıtta satırı yeniden yazar).
  (2) Her CI satırı Master Plan'ın varsayılan 5 adam-gününü alıp toplamları şişiriyordu → CI satırları varsayılan 0
  (Master Plan ve Opex Proje Dashboard). (3) Kart açıkken proje güncellenince (ör. önce-sonra eklenince) kaydedilmemiş
  değişiklikler siliniyordu → artık korunur.
- **Proje ilerlemesi:** kapalı → %100; aksiyon varsa iptal edilmeyenlerin ortalaması; yoksa tamamlanan adım oranı.
  Plan durumu: kapalı → Completed; hedef bitiş geçtiyse → Delayed; başladıysa → In Progress; değilse Planned.
- **Açık kalanlar:** kanban kartındaki eski "görevler" penceresi ve portföy "Timeline (Gantt)" sekmesi eski tasarımda
  (aynı `tasks` alanını kullanırlar, uyumlu); görev bağımlılıkları yok; aksiyon atama/termin bildirimi C9'da.
- **Doğrulama:** `tsc`, `npm run build`, native ESM yükleme; C3 testleri 16 kontrol (ISO hafta, yıl geçişi, ilerleme,
  plan durumu, Master Plan satırı ve korunan alanlar, aksiyon sorumlusu erişimi) + C2'nin 37 kontrolü yeniden geçti.
  Test, paylaşılan `ciPlan.ts`'teki uzantısız göreli importu yakaladı (sunucu kuralı) → düzeltildi. Kart ve
  Görevlerim yerel önizlemede (sahte veri) denendi; dar ekranda aksiyon satırı yerleşimi düzeltildi. Canlıda denenmedi.

### C6 — yapılanlar
- **Tek finans modeli** (`ci/ciFinance.ts`): beklenen yıllık kazanç = `expectedGain` (+ para birimi; eski projelerde
  `targetCostReduction`, o da yoksa açıldığı fırsatın tahmini) · gerçekleşen yıllık kazanç = `realizedGain`
  (`actualSavings` kopyası, + para birimi) · teyit = `gainConfirmedAt` (danışman) · yatırım = `estimatedCost`.
  17 kalemli `financialsInput` artık gerçekleşen kazancın isteğe bağlı **kırılımı**dır: toplamı > 0 ise kaydedince
  gerçekleşen kazanç (müşteri para birimi) toplamla güncellenir; boşsa gerçekleşen kazanç değişmez. Executive ve
  Opex Proje dashboard'larının beklenen toplamı da aynı kuralı kullanır (`ciMoney.sumExpected`).
- **Kazanç kırılımı penceresi** (`ci/CiGainBreakdown.tsx`, eski "CIFinancials" penceresinin yerine): kalemler Kalite /
  Maliyet / Verimlilik / Teslimat / İSG / Diğer gruplarında, tutar ve % binlik ayraçlı, toplam ve kaydetmenin etkisi
  altta; kapalı projede ve yetkisiz kullanıcıda salt okunur. Önceden yalnızca `actualSavings` yazıyor, para birimini
  kaydetmiyor ve kartın okuduğu `realizedGain`'i güncellemiyordu.
- **Finansal dashboard** (`ci/CiFinanceDashboard.tsx`, eski "Finansal Dashboard" sekmesinin yerine; Kaizen tasarım
  dili): açılış yılı filtresi (sayfadaki departman/faz filtreleri de geçerli); KPI'lar — beklenen, teyitli, teyit
  bekleyen, yatırım + geri ödeme süresi (yatırım ÷ aylık gerçekleşen), gerçekleşme oranı; **kazanç hunisi** (beklenen →
  gerçekleşen → teyitli); **aylık kümülatif kazanç** (beklenen hedef bitiş ayında, gerçekleşen teyit / kapanış / 7. adım
  ayında, tarihi olmayan raporlanan kazanç bu ayda); kategoriye göre beklenen vs gerçekleşen; gerçekleşen kazanç
  kalemleri (kırılım girilmiş projelerden); departman tablosu; proje tablosu (beklenen, gerçekleşen, fark %, teyit
  durumu; satırdan kart açılır). İptal edilen projeler hariç; kuru olmayan para birimindeki projeler uyarıyla dışarıda.
- **Kaldırılan uydurma / ölü hesaplar:** eski dashboard'daki faz olgunluk kartları, "Improvement Funnel", ROI katsayısı
  ve ilişkili 24 kullanılmayan hesap silindi (KaizenManager 3.665 → 2.690 satır).
- **Binlik ayraç (B5):** CI ekranlarındaki ve Excel çıktılarındaki tüm tutar gösterimleri `tr-TR` (1.250.000);
  kart, kırılım ve ayarlardaki tutar girişleri `AmountInput` ile ayraçlı. KaizenManager'da `type="number"` tutar alanı
  kalmadı. (Executive Dashboard / Opex Proje Dashboard'un kendi gösterimleri bu adımın dışında.)
- **Açık kalanlar:** üst gösterge şeridi (COPQ, faaliyet karı vb.) hâlâ eski — sadeleştirme C7; kategori hâlâ ad/metin
  üzerinden türetiliyor (kategori alanı yok); kazanç kırılımının yüzde alanları yalnızca bilgi amaçlı.
- **Doğrulama:** `tsc`, `npm run build`, native ESM yükleme; finans modeli 13 kontrol (kur dönüşümü, eski alan
  geri dönüşleri, teyit/tarih, ay aralığı, geri ödeme) + C1/C2/C3 testleri yeniden geçti. Dashboard ve kırılım
  penceresi yerel önizlemede (sahte veri) denendi; KPI kartlarının daralması, tarihsiz raporlanan kazancın grafikte
  görünmemesi ve negatif fark biçimi düzeltildi. Canlıda denenmedi.

### C7 — yapılanlar
- **Modül kendi panosuyla açılır (A2):** yeni varsayılan sekme **Genel Bakış** (`ci/CiOverview.tsx`).
  - 4 gösterge: aktif proje (askıdakiler ayrı), geciken (aşama / hedef tarih / aksiyon termini geçen), teyitli kazanç
    (beklenenle birlikte; tıklayınca Finans), kapanış oranı.
  - **Onayınızı bekleyen adımlar:** oturumdaki kullanıcının proje lideri olarak onaylaması gereken adımlar.
  - **Dikkat gerektirenler:** aktif projelerde aşama planlanan tarihi geçti / hedef bitiş geçti / termini geçen aksiyon
    / 30 gündür değişiklik yok — gün sayısıyla, en ağırdan başlayarak; tıklayınca kart açılır.
  - **A3 adımlarında projeler:** aktif projelerin 8 adıma dağılımı + kapanan / askıda sayısı.
  - **Proje sorumlularının performansı (A1):** lider başına aktif, kapanan, **zamanında adım oranı** (planlanan tarihi
    olan onaylı adımların kaçı planlanan tarihte ya da önce onaylandı), geç onaylananlarda ortalama gecikme, şu an
    geciken proje, geciken aksiyon. Lider hesabıyla, eski projelerde isimle gruplanır; iptal edilenler hariç.
    Hesaplar `ci/ciPerformance.ts`'te, yalnızca A3 alanlarından (tahmin yok).
- **Sadeleştirme (A8):** üstteki 10 kartlık gösterge şeridi (COPQ, faaliyet karı, P&L katkısı, başarı oranı …),
  finans satırı ve "Weekly Alert Hub" kaldırıldı; yerine Kaizen tasarımında başlık (Excel / PDF / Yeni CI projesi),
  sekme çubuğu (Genel Bakış, Kanban, Liste, Zaman Çizelgesi, Görevlerim + sayı, Finans, Önce-Sonra, Ayarlar) ve sade
  filtre satırı (departman, faz, temizle, "n / m proje"). Kullanılmayan 7 hesap daha silindi (KaizenManager 2.374 satır).
- **Not:** eski uyarı panelindeki "hatırlatma kaydı" düğmesi kanban kartında duruyor; gerçek e-posta bildirimi C9.
- **Açık kalanlar:** Kanban, Liste ve Zaman Çizelgesi sekmelerinin içi hâlâ eski görsel dilde (işlevleri C2/C3 ile
  güncel); adım planı tarihleri girilmemiş projelerde zamanında oranı "—" görünür.
- **Doğrulama:** `tsc`, `npm run build`, native ESM yükleme; performans hesapları 9 kontrol + önceki adımların
  testleri yeniden geçti. Genel Bakış ve tüm sayfa (KaizenManager, sahte veri) yerel önizlemede masaüstü ve telefon
  genişliğinde denendi; adım etiketinin kesilmesi ve kısa tutarların ("₺1,1 Mn") satır kırması düzeltildi.
  Canlıda denenmedi.

