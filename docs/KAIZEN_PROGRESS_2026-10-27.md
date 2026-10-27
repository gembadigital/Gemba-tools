# Kaizen Öneri Sistemi — İlerleme ve Öneriler (2026-10-27)

## Yapılanlar
- **Faz 0 (güvenlik)**: Kaizen API rol kısıtları, çok kiracılı (factory) kapsam, girdi doğrulama. Dosya: src/server/app.ts. Commitler 380fd28, 92ddcf6, 7f3b7da.
- **Yeniden tasarım**: Tam ekran, Gemba Tools diline uyumlu arayüz. Commit 5173cb7. Ana bileşen KaizenSuggestionSystem.
- **Faz 2-A (Uygulama Takibi)**: Yeni koleksiyon kaizen_implementations (db.ts KAIZEN_COLLECTIONS).
  - Rotalar: GET /api/business/kaizen/implementations; POST /suggestions/:id/implementation; POST /implementations/:id/verify (yalnızca Kurul); POST /implementations/:id/followup (kalıcılık kontrolü: Sürüyor/Bozuldu; günler Faz 2-B'den beri müşteri ayarı).
  - Arayüz: KaizenImplementation (liste+detay, KPI kartları, eylem planı, önce/sonra ölçüt ve fotoğraf, getiri açıklaması, Kurul doğrulaması, kalıcılık takibi), "Kurul onaylı" etiketi.
  - Raporlar: KaizenReports — Doğrulanmış Gerçek Kazanç, Kontrol Tarihi, Tahmini/Gerçek Getiri.
  - SOP bağlantısı yerine **CI formatında yatay A4 Öncesi/Sonrası tek sayfa** (KaizenOnePager), CI Proje Yönetimi'ndeki Kaizen Öncesi Sonrası formundan türetildi.
  - Commitler fa2b9cc, e942cf5, 620d3a8, 82ff1b7, 11195b5, bf640b4.
- Teslimat notu: bulut oturumundan git push yapılamadı (depo oturum kaynaklarında yok); dosyalar GitHub web arayüzünden main'e yüklendi. Yerel oturumdan (gh, `gembadigital` hesabı) push çalışıyor.
- **Faz 2-B (müşteri bazında yapılandırılabilirlik)** — yerel oturum, 2026-10-27. Canlıda denenmedi.
  - Altyapı: yeni koleksiyon `kaizen_settings`, müşteri (factory_id) başına tek kayıt, id `kaizen_settings_<factoryId>`. Tip, varsayılanlar ve tüm kurallar tek ortak dosyada: `src/utils/kaizenSettings.ts` (istemci + sunucu; sunucu `../utils/kaizenSettings.js` ile import eder). Kayıt yoksa ya da eksikse `normalizeKaizenSettings()` varsayılanları doldurur; varsayılanlar Faz 2-B öncesi davranışın aynısıdır, veri taşıma gerekmez.
  - Rotalar: `GET /api/business/kaizen/settings` (kapsamdaki herkes), `POST /api/business/kaizen/settings` (yalnızca Admin/Consultant; gövde sunucuda normalize edilir). Arayüz: Kurulum → **Ayarlar** sekmesi (`KaizenSetup.tsx` → `SettingsTab`).
  - **2-B.1 — para birimi ve eşikler** (977c3e3): ana para birimi (varsayılan TL), formlarda seçilebilen para birimleri (TL/USD/EUR/GBP/CHF/Eş Değer Ürün), raporlar için sabit çevrim kurları (`fxRates`, 1 birim = n ana para birimi). Raporlar ana para biriminde toplar; kur girilmemiş tutarlar ve "Eş Değer Ürün" toplama katılmaz, "N kayıt dahil değil" olarak sayılır. Sunucu bilinen her para birimini kabul eder (liste yalnızca form seçeneklerini daraltır), eksik değerde ana para birimine düşer. Onay kuyruğu uyarı/gecikme günleri (3/7) ve kalıcılık kontrol günleri (30/90; ikincisi kapatılabilir) ayarlanabilir; kontrol günleri uygulama tamamlanırken kayda sabitlenir. Kurul formundaki kademe önerisi kurla çevrilmiş getiriyle çalışır; kriter gelir aralıkları ana para birimindedir.
  - **2-B.2 — seçenek listeleri ve ödül** (76aa031): Öneri Sınıfı, Öneri Aşaması (PDCA) ve Kazanç Süresi listeleri müşteri bazında (ekle/kaldır/sırala, varsayılana dön; en fazla 30 seçenek, 60 karakter). Kaldırılan değerler eski kayıtlarda ve rapor filtrelerinde görünmeye devam eder (`optionChoices`). Puan başına ödül (`rewardPerPoint`, ana para biriminde): tutar Kurul onayında değerlendirmeye `rewardAmount/rewardCurrency` olarak sabitlenir; oran yokken onaylanmış olanlar "Ödendi" işaretlenince o günkü oranla sabitlenir (o zamana kadar Ödül Takibi'nde `*` ile güncel orana göre gösterilir).
  - **2-B.3 — onay akışı** (6a9def7): Amir aşaması aç/kapa, Kurul eşiği (`boardThreshold`, ana para biriminde; altındaki tahminlerde — kazanç girilmemişler dahil — Amir onayı son karardır; çevrilemeyen para birimi her zaman Kurul'a gider), Kurul onayında puan zorunluluğu. Amir kapalıysa eşik devre dışıdır, Kurul her öneriye karar verir (aşamasız öneri olmaz). Gereken aşamalar öneri gönderilirken ve redden sonra yeniden gönderilirken `requiredStages` olarak kayda sabitlenir (`requiredStagesFor`); `requiredStages` olmayan eski kayıtlar iki aşamalı sayılır (`stagesOf`). Durum değerleri değişmedi: Amir yoksa öneri doğrudan `First Approval`'da başlar, eşik altında Amir onayı `Second Approval` yazar (Kurul değerlendirme kaydı oluşmaz; raporda tahmini getiri önerinin kendi tahmininden gelir). Etiketler: `First Approval` → "Kurul Bekliyor" (eskiden "Amir Onayladı"), Kurul'suz `Second Approval` → "Amir Onayladı" (`statusLabel`). Geri çekme: henüz karar verilmemiş her öneri (`awaitingFirstDecision`).
  - Doğrulama: `tsc --noEmit`, `npm run build`, sunucunun dosya-bazlı ESM yüklemesi ve `kaizenSettings` mantık testleri (normalize, kur çevrimi, eşikler, listeler, ödül, aşama yönlendirmesi). Uçtan uca gerçek oturumda **denenmedi**.

## Öneriler / Sıradaki işler
- **Faz 2-B canlı doğrulama** (Amir / Kurul / Personel hesaplarıyla):
  1. Ayar girilmemiş müşteride akış eskisi gibi Amir → Kurul mu?
  2. Eşik altı öneri Amir onayıyla "Amir Onayladı" olup Uygulama listesine düşüyor mu?
  3. Amir kapalıyken öneri doğrudan Kurul kuyruğuna gidiyor, Kurul'a e-posta ulaşıyor mu?
  4. Puan zorunluluğu kapalıyken Kurul kriter seçmeden onaylayabiliyor mu?
  5. Ayarlar sekmesinde para birimi/kur/eşik/liste/ödül kaydedilip yeniden yüklenince korunuyor mu?
- Ana para birimi sonradan değiştirilirse kriter gelir aralıkları ve Kurul eşiği aynı rakamlarla yeni para biriminde okunur — değişiklikle birlikte güncellenmeli.
- **Tam dinamik onay akışı** (N aşama, aşama başına onaycı listesi, ör. Genel Müdür) Faz 2-B kapsamı dışında bırakıldı; gerçek müşteri ihtiyacı çıkarsa ayrı alt faz (durum modeli yeniden yazımı + eski kayıt taşıma gerekir).
- **Faz 2-C**: Çok şirketli veri modeli.
- **Faz 1 kalanlar**: tasarım ince ayarı, koyu mod, tablet/mobil, erişilebilirlik, klavye kısayolları.
- **Faz 3–5**: ürün ve iş planındaki sonraki aşamalar; dil/i18n (TR/EN/DE, tarih-sayı biçimleri) en sona.
- Doğrulama: Faz 0 rol testleri Admin hesabıyla hata göstermez; Yönetici/Kurul/Personel hesaplarıyla ayrıca test edilmeli.
- Yerel klon: `/Users/atakanzehir/Claude/5SAudit/gemba-tools`, dal `main` (origin/main ile hizalı). Eski `kaizen-ui-redesign` dalının main'de olmayan içeriği yok.
- `graphify update .` bugünün tarihli klasörünü (`graphify-out/<tarih>/`) kök grafiğin eski kopyasıyla ezer; çalıştırmadan önce o klasörü yedekleyin, sonra güncel kök dosyaları içine kopyalayın.
