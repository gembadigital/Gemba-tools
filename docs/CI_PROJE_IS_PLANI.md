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

## 7. Kullanıcı kararı gereken noktalar
1. **8 adım**: §4'teki Toyota 8 adımı uygun mu, yoksa kastedilen başka bir 8 adım mı (ör. 8D)?
2. **Kapı onayı**: hangi adımlarda, kim onaylar (sponsor / baş danışman / müşteri yöneticisi)?
3. **Customer User**: CI projelerini görür mü, düzenler mi, siler mi?
4. **Finans onayı**: gerçekleşen kazancı kim doğrular?
5. **Ürün biçimi**: Kaizen + CI tek program mı, ayrı modüller mi (C10–C11 kapsamı)?
6. **Canlı kayıt taşıması** (C2): mevcut projelerin yeni modele dönüştürülmesi — yedek alınıp onayla yapılır.
