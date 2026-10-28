# CI Proje Yönetimi — Canlı Test Listesi (2026-10-28)

C0–C10'da yapılan her şeyin canlıda (https://gemba-tools.vercel.app) uçtan uca denenmesi için. Hiçbiri canlıda
denenmedi; kod tarafı `tsc`, `npm run build`, sunucu testleri (sahte veritabanı) ve yerel önizleme (sahte veri) ile
doğrulandı. Her satır: **ne yapılır → ne görülmeli**. Sorun çıkan satırın numarasını, ekran görüntüsünü ve
cihaz/tarayıcıyı not edin. Ayrıntılar: [CI_PROJE_IS_PLANI.md](CI_PROJE_IS_PLANI.md) §8.

> **Önemli:** Canlı veritabanı gerçek müşterilerle ortaktır. Testi **yalnızca test müşterisinde** yapın (örn. Kaizen
> testindeki "Test Fabrika"); gerçek müşteride proje, ayar ya da kayıt değiştirmeyin. Bu sürümler canlı veriyi toplu
> dönüştürmez; eski projeler açıldığında yeni alanlar yalnızca ilk kayıtta/işlemde yazılır.

## 0. Hazırlık

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 0.1 | Vercel → Environment Variables: `CRON_SECRET` ve `APP_URL` tanımlı mı bakın (Kaizen ile aynı). | İkisi de var. (Yoksa haftalık CI özeti çalışmaz / e-postadaki bağlantı yanlış olur.) |
| 0.2 | Vercel → Settings → Cron Jobs: `/api/cron/ci-reminders` (Pazartesi 06:00 UTC) listede mi? | Var (C9 deploy'u ile gelir). |
| 0.3 | Test müşterisinin kartında aşağıdaki kullanıcıları atayın (gerçek, erişebildiğiniz e-postalarla). | Hepsi müşteri ekibinde. |
| 0.4 | Müşteri kartında para birimi ₺ ve yıllık ciro girili olsun. | — |

Test kullanıcıları:

| Kişi | Rol | Kullanım |
|---|---|---|
| **A — Admin** | Admin | Ayarlar, silme, her şey |
| **D — Danışman** | Consultant (müşteriye atanmış) | Kazanç teyidi, hatırlatma, ayarlar |
| **L — Lider** | Customer User | Proje lideri, adım onayı |
| **U — Üye** | Customer User | Proje ekip üyesi |
| **S — Sorumlu** | Customer User | Yalnızca bir aksiyonun sorumlusu (ekipte değil) |
| **X — Dışarıdaki** | Customer User | Hiçbir projede değil |

Cihazlar: bilgisayar + telefon. Masaüstü testleri en az bir kez 1440 px genişlikte yapın (balık kılçığı diyagramı).

## 1. C0 — Güvenlik, proje no, para birimi

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 1.1 | U ile bir projede silme düğmesi arayın (kanban / liste). | Silme düğmesi yok. |
| 1.2 | D ile bir test projesini silin. | Silinir; Master Plan'daki `[CI]` satırı da kalkar. |
| 1.3 | Yeni bir proje açın, proje no'ya bakın; sonra daha eski tarihli bir test projesini silin. | Yeni projenin no'su (CIPyyaa-nn) değişmez. |
| 1.4 | Bir projede beklenen kazancı USD girin (kur girmeden). Finans / Genel Bakış'a bakın. | Toplamlara girmez, "n proje … dahil değil" uyarısı çıkar. |
| 1.5 | Executive Dashboard'da beklenen kazanca bakın. | Yatırım bütçesi kazanç olarak sayılmıyor. |

## 2. C1 — CI Ayarları

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 2.1 | U ile CI modülünde "Ayarlar" sekmesini arayın. | Görünmez. |
| 2.2 | D ile Ayarlar: USD işaretleyip kur 40 girin, kaydedin. 1.4'teki projeye bakın. | USD tutar ₺'ye çevrilip toplamlara girer, uyarı kalkar. |
| 2.3 | Departman listesine yeni bir departman, ürün ailelerine "Isıtıcı %30" ekleyip kaydedin. | Yeni proje ekranında departman önerisi ve ürün ailesi seçeneği gelir. |
| 2.4 | Faz filtresinde "Faz 2"yi seçin. | Yalnızca faz 2 projeleri (eski "Phase 2" etiketliler dahil) kalır. |

## 3. C2 — 8 adım A3, lider onayı, yetkiler

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 3.1 | L lider, U üye, S'ye bir aksiyon atanmış bir proje hazırlayın. X ile girin. | X projeyi listede görmez. |
| 3.2 | S ile girin. | S projeyi görür ve düzenleyebilir; lider/ekibi değiştiremez. |
| 3.3 | U ile 1. adımın şartlarını doldurup "Proje liderinin onayına gönder". | Kartta "Adım 1 onay bekliyor"; L'ye e-posta (bkz. 9.x). |
| 3.4 | L ile "Geri gönder" (not yazarak), sonra U tekrar gönderir, L "Onayla". | Geri göndermede U'ya not içeren e-posta; onayla proje 2. adıma geçer, adım 1 onay tarihi yazılır. |
| 3.5 | Şartı eksik bir adımda onay düğmesine bakın. | Pasif; eksikler listelenir. |
| 3.6 | Kanbanda kartı iki sütun ileri sürükleyin. | Reddedilir, "adım adım ilerler" uyarısı. |
| 3.7 | 7. adımda gerçekleşen kazanç girin; L ile onaylamayı deneyin; D ile "Kazancı teyit et", sonra L onaylar. | Teyitsiz onay olmaz; teyitten sonra 8. adıma geçer. Teyitten sonra tutar değişirse teyit düşer. |
| 3.8 | 8. adımı tamamlayıp L onaylasın. | Proje "Kapandı"; Genel Bakış kapanış oranı artar. |
| 3.9 | Aynı projeyi iki tarayıcıda açıp farklı bölümleri düzenleyip kaydedin. | İki değişiklik de kalır. |
| 3.10 | Geçmiş sekmesi. | Onay, geri gönderme, kayıtlar kim / ne zaman ile görünür. |
| 3.11 | Telefonda proje kartını açın. | Adımlar yatay şerit; başlık iki satır; yatay kaydırma yok. |
| 3.12 | Bir eski (C2 öncesi) projeyi açın. | Adımı eski durumundan türetilmiş görünür; lider isimle kayıtlıysa onayı D verebilir. |

## 4. C3 — Uygulama planı, Görevlerim, Master Plan

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 4.1 | 5. adımda 3 aksiyon: başlangıç/termin/sorumlu/ilerleme girin. | Gantt çubukları, bugün çizgisi, hedef bitiş işareti; geciken kırmızı. |
| 4.2 | 6. adımda bir aksiyon için "Bu aksiyon için önce-sonra" ile kayıt oluşturun. | Kayıt aksiyona bağlı görünür; silinince bağ da kalkar. |
| 4.3 | U ile "Görevlerim" sekmesi; durum/ilerleme değiştirin. | Kendi aksiyonları gruplu; değişiklik projeye yansır; sekme rozeti doğru. |
| 4.4 | Master Plan'da `[CI]` satırlarına bakın. | Doğru haftalarda (eskiden 24–32. hafta); ilerleme CI ile aynı; adam-gün toplamına 0 ekler. |

## 5. C4 — Balık kılçığı

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 5.1 | 4. adımda "Balık Kılçığı" seçip birkaç neden girin, birini ★ işaretleyin (1440 px). | Diyagram (omurga, problem başı); 4. adım şartı sağlanır. |
| 5.2 | Bir nedende "5 Neden ile derinleştir". | Neden 5 Neden'in ilk halkasına gelir, görünüm 5 Neden'e geçer. |
| 5.3 | Ayarlar'dan bir kategoriyi kaldırın. | O kategorideki nedenler "Diğer kategoriler" altında kalır. |
| 5.4 | Proje kartı Excel'i. | 5 Neden zinciri ve balık kılçığı satırları (★) var. |

## 6. C5 — Yeni proje ekranı, fırsat havuzu

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 6.1 | D ile Loss Analysis ekranını açıp hesaplamayı yapın, ~5 sn bekleyin; CI → Yeni CI projesi. | Fırsat havuzunda Loss Capacity fırsatları (başka cihazda da). |
| 6.2 | Havuzda kaynak filtrelerini deneyin (maliyet tablosu, OpEx, Kaizen, PTR). | Kaynağı olan fırsatlar; olmayanlarda açıklayıcı boş durum. |
| 6.3 | Ürün ailesi "Isıtıcı %30" seçip bir Loss fırsatı seçin. | Kayıp / potansiyel tutarları %30 ölçekli dolar. |
| 6.4 | Projeyi oluşturun; havuzu yenileyip aynı fırsata bakın. | "CIP… projesine dönüştü" kilitli; ikinci kez seçilemez. |
| 6.5 | Adım planı dağıtılmış mı (Künye & Ekip). | 8 adımın planlanan tarihleri hedef tarihe eşit dağılmış. |
| 6.6 | U ile yeni proje: başka birini lider seçip kendini eklemeden ilerleyin. | İlerleyemez, uyarı. |
| 6.7 | Telefonda yeni proje ekranı. | Tek sütun, yatay kaydırma yok. |

## 7. C6–C7 — Finans ve Genel Bakış

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 7.1 | 7. adımda "Kazanç kırılımı" ile 2 kalem girin. | Gerçekleşen kazanç toplamla güncellenir (para birimiyle). |
| 7.2 | Finans sekmesi. | KPI'lar, huni, aylık kümülatif grafik, kategori/departman, proje tablosu proje kartlarıyla tutarlı. |
| 7.3 | Modülü açın. | Genel Bakış ile açılır; eski 10 kartlık şerit yok. |
| 7.4 | L ile girin (onay bekleyen bir adım varken). | "Onayınızı bekleyen adımlar" listesinde. |
| 7.5 | Adım planı geçmiş bir proje / termini geçmiş aksiyon. | "Dikkat gerektirenler"de gün sayısıyla. |
| 7.6 | Sorumlu performansı tablosu. | Zamanında adım oranı plan tarihlerine göre; plansızda "—". |

## 8. C8 — A3 sunum kartı

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 8.1 | Kapanmış bir projede "A3 sunum kartı" → PDF. | Tek sayfa A4 yatay PDF; tüm bölümler, grafikler. |
| 8.2 | Önce-sonra bölümünü açıp kaynak değiştirin, tekrar PDF. | Alt şeritte seçilen kayıt / fotoğraflar. |
| 8.3 | Excel. | Aynı bölümler, ölçümler ve aksiyonlar tablo halinde. |
| 8.4 | Uzun metinli bir projede A3. | Taşma yok (metin kısaltılır). |

## 9. C9 — E-posta, haftalık özet, sürdürülebilirlik

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 9.1 | 3.3 / 3.4 adımlarında gelen kutularına bakın. | L'ye "Onayınız bekleniyor", U'ya "geri gönderildi" (not) / "onaylandı" e-postaları. |
| 9.2 | S'ye yeni aksiyon atayın. | S'ye "CI aksiyonu atandı" e-postası; atayan kişiye gitmez. |
| 9.3 | Proje kartında "Hatırlat" → tüm ekip. | Ekip + sorumlulara durum özetli e-posta; geçmişte kayıt. |
| 9.4 | Kanbandaki hatırlatma düğmesi. | Lidere gerçek e-posta. |
| 9.5 | Ayarlar → "Bu haftanın özetini önizle", sonra "Şimdi gönder". | Kişi başına konular listelenir; e-postalar gelir. |
| 9.6 | Ayarlar'da e-postaları kapatıp 9.3'ü deneyin. | "CI e-postaları kapalı" uyarısı, e-posta gitmez. |
| 9.7 | 3.8'de kapanan projede "Sürdürülebilirlik takibi". | 30/60/90 gün kontrolleri listelenir. |
| 9.8 | Bir kontrolü "Sürmüyor" kaydedin. | Lider + ekibe uyarı e-postası; Genel Bakış'ta "iyileştirme sürmüyor". |
| 9.9 | Pazartesi sonrası Vercel → Cron Jobs → ci-reminders kaydına bakın. | Başarılı çalışma; ilgili kişilere haftalık özet. |

## 10. C10 — Kaizen ↔ CI köprüsü

Ön koşul: test müşterisinde Kaizen öneri sistemi kurulu (personel listesi var).

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 10.1 | CI proje kartı → 6. adım önce-sonra kaydında "Kaizen sergisine gönder". | "Kaizen sergisinde" etiketi; geçmişte kayıt. |
| 10.2 | Kaizen Öneri → "Önce-Sonra" sekmesi. | Paylaşılan CI kaydı (fotoğraflarıyla) ve tamamlanmış Kaizen uygulamaları; ayrıntı penceresi açılır. |
| 10.3 | CI'da "Kaizen sergisinde" etiketine basıp kaldırın; ya da önce-sonra kaydını silin. | Sergiden kalkar. |
| 10.4 | Kurul onaylı bir Kaizen önerisinden (fırsat havuzu → Kaizen önerisi) CI projesi açın. | Kaizen "Önerilerim" ve "Uygulama" listesinde "CI projesi CIP…" etiketi. |
| 10.5 | Kaizen kurulu olmayan bir müşteride CI önce-sonra kaydına bakın. | "Kaizen sergisine gönder" düğmesi yok. |

## Sonuç

| Bölüm | Durum | Not |
|---|---|---|
| 1. C0 | | |
| 2. C1 | | |
| 3. C2 | | |
| 4. C3 | | |
| 5. C4 | | |
| 6. C5 | | |
| 7. C6–C7 | | |
| 8. C8 | | |
| 9. C9 | | |
| 10. C10 | | |
