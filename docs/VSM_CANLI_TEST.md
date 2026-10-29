# VSM — Canlı Test Listesi

Her VSM adımında (V0, V1, …) yapılan değişikliklerin canlıda (https://gemba-tools.vercel.app) uçtan uca denenmesi
için. Her satır: **ne yapılır → ne görülmeli**. Ayrıntılar: [VSM_IS_PLANI.md](VSM_IS_PLANI.md).

> **Önemli:** Canlı veritabanı gerçek müşterilerle ortaktır. Testi **yalnızca test müşterisinde** yapın; gerçek
> müşteride VSM projesi oluşturmayın, değiştirmeyin.

Test kullanıcıları: **A** — Admin · **D** — Consultant (müşteriye atanmış) · **U1**, **U2** — test müşterisinin iki
Customer User'ı.

## V0 — Güvenlik, sahiplik, sahte veri temizliği (commit 42f5bc6)

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 0.1 | ACME demo müşterisinde VSM'i açın. | Proje listesi boş (eski örnek proje silindi). Portalda yalnızca Toplam / Aktif / Tamamlanan sayıları; "Kümülatif mali kazanım" ve %41,2 / %38,5 / %18,7 şeridi yok. |
| 0.2 | U1 ile "Yeni VSM Projesi" açın, kaydedin, projeyi açın. | Proje **boş** açılır: proses yok, örnek hat (KESME & PRE-FORM…) yok. Kurulumda haftalık talep 0, birim maliyetler 0, tedarikçi/planlama alanları boş. |
| 0.3 | Harita sekmesine bakın. | Açık (light) tema varsayılan. Müşteri kutusunda müşteri adı, tedarikçi ve planlama kutularında "—" (Beko / Ereğli / Rulo Sac / Milk-Run / FIFO & Kanban yazmaz). Takt "—". |
| 0.4 | Kurulum → "Harita Kutuları" alanlarını doldurun, Kaydet, haritaya dönün. | Tedarikçi ve Üretim Planlama kutularında girilen metinler görünür; sayfa yenilenince de kalır. |
| 0.5 | U1 iki proses ekleyip kaydetsin. U2 aynı projeyi açsın. | U2 projeyi görür, veri girebilir; U1'in proseslerinde **sil** düğmesi görünmez. U2 kendi eklediği prosesi silebilir. |
| 0.6 | U2 projeyi silmeyi denesin. | Sil düğmesi görünmez (proje U1'in). U1 kendi projesini silebilir; A ve D her projeyi/prosesi silebilir. |
| 0.7 | Gelecek Simülasyon moduna geçin. | "⚡ Yalın Gelecek Durum Şablonu" düğmesi yok. Üst şeritte "İşçilik Verimi" ve "CO₂" yok. |
| 0.8 | Dashboard'a bakın. | "İç lojistik taşıma mesafesi" ve "Fabrika alanı yerleşim verimi" kartları yok. Özet başlığı "Hesaplanan Özet"; cümleler "simülasyona göre …" kipinde, birim maliyet girilmediyse "hesaplanamadı" yazar. |
| 0.9 | Gelecek modda "CI Proje Yönetimine Aktar"ı iki kez basın. | İlk basışta kartlar oluşur (tahmini maliyet/kazanç **boş**); ikincide "zaten aktarılmıştı, tekrar eklenmedi". |
| 0.10 | Prosese hurda/rework girip birim maliyet girmeden kaydedin; Loss Capacity'de bu VSM projesini seçin. | Prosesler maliyet tablosunda görünür; hurda/duruş maliyeti **uydurulmaz** (birim maliyet girilince hesaplanır). |

## V1 — Modül yapısı ve tek hesap motoru

Görünüm değişmedi; aşağıdakiler hesap tutarlılığı ve düzeltilen hatalar içindir.

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 1.1 | VSM'i açın, bir projeye girin, 6 sekmeyi ve proses çekmecesini tek tek açın. | Hepsi V0'daki gibi açılır, konsol hatası / boş ekran yok. |
| 1.2 | Kalite & Envanter'de bir prosesin WIP'ini değiştirin, haritaya geçin. | Proses önündeki stok adedi ve gün değeri değişir; toplam lead time güncellenir. |
| 1.3 | Haritada bir prosese tıklayın. | Çekmecede OEE kutusu salt okunur ("hesaplanan"); arıza süresini değiştirince kullanılabilirlik ve OEE değişir. |
| 1.4 | Gelecek moda geçip bir prosesin WIP'ini azaltın; üst şerit ve Dashboard'u karşılaştırın. | Lead time azalışı, stok azalışı ve yıllık tasarruf iki yerde **aynı** sayılar. |
| 1.5 | Üretim sekmesinde "Gerçekleşen" adedi silip kaydedin, sayfayı yenileyin. | Alan boş kalır (0 yazmaz); OEE performans girdisi yok sayılır. |
| 1.6 | Yeni proje açın. | Kaydedilen projede veri kaynağı "manual" (ekranda henüz gösterilmiyor; V2). |

## V2 — Standart VSM veri modeli ve ürün ailesi

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 2.1 | Eski bir VSM projesini açın (V2'den önce kaydedilmiş). | Değerler aynı; Kurulum'da "Günlük vardiya sayısı" ilk prosesin vardiyasıyla dolu, C/O değerleri yerinde. |
| 2.2 | Ürün Ailesi → "Haritadaki prosesleri ekle", 3 ürün girin (iki tanesi aynı rotada), adet/hafta yazın. | Pay sütunu hesaplanır; "Önerilen Aileler"de aynı rotalı ürünler tek aile. Benzerlik yüzdesini değiştirince öneriler değişir. |
| 2.3 | Bir aileyi seçip "Kuruluma aktar". | Kurulum'da haftalık talep = ailenin haftalık adedi, ürün ailesi = ürün adları, hacim payı = ailenin payı. Talep doluysa önce onay sorar. |
| 2.4 | Kurulum → Kapsam, Ekip (2 kişi), Talep/Vardiya/Pitch (paket 20), Müşteri, Bilgi Akışı, Hammadde & Mamul doldurun, Kaydet, sayfayı yenileyin. | Hepsi kalır. Pitch ipucunda "takt × paket" sonucu görünür. |
| 2.5 | Haritaya bakın. | Müşteri→Planlama ve Planlama→Tedarikçi oklarında "sıklık · kanal" yazısı; müşteri kutusunda sipariş tipi, sevk partisi, pitch. |
| 2.6 | Bilgi Akışı'nda "Tek noktaya — pacemaker" seçip bir proses seçin. | Planlamadan yalnızca o prosese kesikli ok iner. |
| 2.7 | Hammadde ve mamul stok adedi girin. | Zaman çizgisinin başında "hammadde", sonunda "mamul" gün kutuları; toplam lead time bunları içerir. |
| 2.8 | Üretim & Kapasite → Veri Kutusu: bir prosese katma değer süresi (C/T'den küçük) girin. | Zaman çizgisinde o proses "sn (VA)" gösterir; katma değer oranı (PCE) değişir. |
| 2.9 | Kalite & Envanter → bir prosesin stok tipini FIFO yapıp maksimum girin; başka birini süpermarket yapın. | Seçim kalır; süpermarket seçilen proseste haritadaki süpermarket simgesi görünür. |
| 2.10 | Customer User ile 2.2–2.4'ü yapın. | Kaydedilir (veri girişi serbest). |

## V8 — Çıktılar ve saha formu

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 8.1 | Dolu bir projede "VSM Rapor Export" → PDF Raporu. | A4 yatay PDF iner: özet, mevcut harita, (gelecek simülasyonda değişiklik varsa) gelecek harita, proses tablosu, göstergeler + norm kadro, (matris doluysa) ürün ailesi. Türkçe karakterler doğru. |
| 8.2 | Excel Çalışma Kitabı. | .xlsx: Proje, Mevcut Durum, (varsa) Gelecek Durum, Zaman Çizelgesi, Göstergeler, Norm Kadro, (varsa) Ürün Matrisi sayfaları; başlıklar koyu, sütunlar okunur. Sayılar ekrandakiyle aynı. |
| 8.3 | Harita PNG (mevcut ve gelecek modda ayrı ayrı). | Dosya adında "Mevcut" / "Gelecek"; görüntü ekrandaki harita. |
| 8.4 | "Formu indir", Excel'de bir prosesin C/T'sini değiştirip yeni bir satır ekleyin (ID boş), Kurulum sayfasında haftalık talebi değiştirin, kaydedip "Doldurulmuş formu yükle". | Özet onayı: "1 güncellenecek, 1 eklenecek, 1 kurulum değeri". Onaydan sonra değerler ekranda; Kaydet → sayfa yenile → kalıcı. |
| 8.5 | Formdan bir satırı silip yükleyin. | O proses projede kalır (içe aktarma silmez). |
| 8.6 | Bir sayı hücresine metin yazıp yükleyin. | Onay penceresinde "Satır n: … sayı değil" uyarısı; o hücre uygulanmaz. |
| 8.7 | Telefonda Dışa Aktar penceresini açın. | Pencere ekrana sığar, seçenekler alt alta. |

## V3 — Harita sembolleri, esnek yerleşim, mobil

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 3.1 | 8+ prosesli bir projenin haritasını açın. | Tüm prosesler sığar (kesilmez); müşteri kutusu en sağda; harita otomatik ekrana sığdırılır. |
| 3.2 | Kalite & Envanter'de stok tiplerini yığın / FIFO (maks) / süpermarket + kanban yapın. | Proses önlerinde: üçgen + çizgili push oku / "FIFO ≤maks" şeridi / süpermarket rafı + çekme oku; kanban etiketi. Stok adedi ve gün ilgili prosesin önünde. |
| 3.3 | Bilgi akışında kanalları Elektronik ve Manuel yapın. | Elektronik ok zikzaklı düz çizgi, manuel kesikli. |
| 3.4 | Hammadde / mamul stoku girin, tedarikçi ve müşteri sevk sıklığı yazın. | Başta ve sonda üçgenler (adet + gün), kamyonlarda sevk sıklığı. |
| 3.5 | Zaman çizgisine bakın. | Bekleme günleri stok bölgelerinin üstünde, katma değer süreleri kartların altında; sağda lead time / katma değer / PCE. |
| 3.6 | Tablette iki parmakla yakınlaştırın, tek parmakla kaydırın; masaüstünde Ctrl + tekerlek. | Akıcı yakınlaştırma; FİT tekrar sığdırır. |
| 3.7 | Telefonda Proses Tanımlama'yı açın, bir prosese dokunun, değer değiştirip Tamam → Kaydet. | Kart listesi; alt sayfada tüm alanlar; değer haritaya ve kayda yansır. |
| 3.8 | Telefonda haritayı açın. | Harita yüksekliğe sığar, yatay kaydırılır, okunur. |
| 3.9 | PDF / PNG alın. | Haritanın tamamı, önceki sürümden daha büyük ve kesilmeden. |

## V4 — Göstergeler

| # | Ne yapılır | Ne görülmeli |
|---|---|---|
| 4.1 | Dolu bir projede Dashboard'u açın. | Üstte 8 gösterge; sahte/sabit değer yok. Harita altındaki lead time ve PCE ile aynı sayılar. |
| 4.2 | Gelecek simülasyonda bir prosesin C/T ve WIP'ini düşürün, Dashboard'a dönün. | Göstergelerde "→ yeni değer" (yeşil); altında "simülasyondur" notu. |
| 4.3 | Haftalık talebi, bir prosesin C/T'si takt'ı aşacak kadar artırın. | Operatör dengesi grafiğinde o proses kırmızı, takt çizgisi görünür, "1 proses takt'ın üstünde". Kapasite tablosunda %100 altı kırmızı. |
| 4.4 | Kurulum'da tüm birim maliyetleri 0 yapın. | Yıllık kayıp "—", not: "birim maliyet girilmedi". |
| 4.5 | Proses karşılaştırma grafiğinde metrikleri değiştirin. | Grafik seçilen metriği gösterir (birimiyle). |
