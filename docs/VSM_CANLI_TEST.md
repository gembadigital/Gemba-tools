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
