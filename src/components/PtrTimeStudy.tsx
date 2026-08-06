import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  FileSpreadsheet, Search, PlusCircle, Trash2, Edit, Download, Upload,
  Check, X, RefreshCw, Layers, TrendingUp, AlertCircle, HelpCircle,
  Calendar, CheckCircle, Clock, Percent, DollarSign, ArrowRight, Table, BarChart2,
  Flame, Zap, Maximize2, Minimize2, Flag,
  Filter, FilePlus, Sparkles, Mail
} from "lucide-react";
import { useFactory } from "../context/FactoryContext";
import OpexProjectDashboard from "./OpexProjectDashboard";

// CSV Data represented compactly as a single string to avoid token bloat
const RAW_EXCEL_CSV = `25;16.06.2026;A3;VERİMLİLİK ;A3 EĞİTİMİNE KATILAN ARKADAŞLAR KENDİ ALANLARINDAN KİŞİ BAŞI EN AZ BİR ADET PROJE KONUSU BELİRLEYECEK;VERİMLİLİK;Gözde Tohumci;Açık;22.06.2026;;ZAMANINDA;A3; ;;;;2026;1
25;16.06.2026;TPM ;VERİMLİLİK ;OPERATÖR MÜDAHALESİNE UYGUN DURUŞLAR İÇİN ARIZA AKIŞ DİAGAMI HAZIRLANACAK;VERİMLİLİK;Barış Avcı;Açık;22.06.2026;;ZAMANINDA;AKIŞ DİAGRAMI; ;;;;2026;2
25;16.06.2026;TPM ;VERİMLİLİK ;ARIZA MÜDAHELE İÇİN TEK NOKTA DERSİ ŞEKLİNDE EĞİTİM DÖKÜMANLARI HAZIRLANACAK;VERİMLİLİK;Barış Avcı;Açık;22.06.2026;;ZAMANINDA;AKIŞ DİAGRAMI; ;;;;2026;3
25;16.06.2026;5S;5S;26. HAFTAYA KAYAR HATTINDA 5s FAALİYETİ PLANLANACAK;ÜRETKENLİK;Gözde Tohumci;Açık;23.06.2026;;ZAMANINDA;5S; ;;;;2026;4
25;16.06.2026;SAHA YÖNETİMİ;GÜVENLİK ;SAFETY PATROL DEVRİYESİ YAPILDI;ÜRETKENLİK;Gözde Tohumci;Kapalı;16.06.2026;;GECİKME;; ;;;;2026;5
25;15.06.2026;EĞİTİM;VERİMLİLİK ;A3 EĞİTİMİ YAPILDI;VERİMLİLİK;Kemal Doğan;Kapalı;15.06.2026;15.06.2026;ZAMANINDA;A3; ;;;;2026;6
24;9.06.2026;SMED;VERİMLİLİK ;2. İŞ ADIMI İşlem sırasında takım çantası yanında taşınacak;ZAMAN;Ersan Sezgin;Açık;19.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;7
24;9.06.2026;SMED;VERİMLİLİK ;6. İŞ ADIMI Tekrar kullanılmayacak takım vb ürünlerin temizliği setup bittikten sonra yapılacak;ZAMAN;Ersan Sezgin;Açık;19.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;8
24;9.06.2026;SMED;VERİMLİLİK ;7. İŞ ADIMI Kirlilik sebebi basınçlı hava temizlenecek.;ZAMAN;Ersan Sezgin;Açık;24.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;9
24;9.06.2026;SMED;VERİMLİLİK ;12. İŞ ADIMI İş standartı oluşturulurken bu işlem eklenmeyecek.;ZAMAN;Ersan Sezgin;Açık;25.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;10
24;9.06.2026;SMED;VERİMLİLİK ;13. İŞ ADIMI İş standartı oluşturulurken bu işlem eklenmeyecek.;ZAMAN;Emre Soylu;Açık;26.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;11
24;9.06.2026;SMED;VERİMLİLİK ;14. İŞ ADIMI Arkadan yükleme yapılan tezgahlarda hava kanalı T ile ikiye ayrılacak ve tezgahın ön ve arka kısmına hava tabancası eklenecek.;ZAMAN;Emre Soylu;Açık;20.07.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;12
24;9.06.2026;SMED;VERİMLİLİK ;16. İŞ ADIMI Dayama civataları sökülüp dayama yatakdan çıkartıldıktan sonra hemen yeni dayama takılması için yatak temizligi yapılacak.;ZAMAN;Emre Soylu;Açık;19.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;13
24;9.06.2026;SMED;VERİMLİLİK ;18. İŞ ADIMI 16. Adımdaki işlem yapılacak.;ZAMAN;Emre Soylu;Açık;24.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;14
24;9.06.2026;SMED;VERİMLİLİK ;27. İŞ ADIMI Setup başlamadan önce kullanılacak ara kagıtlar tezgahın yanına getirilecek.;ZAMAN;Emre Soylu;Açık;25.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;15
24;9.06.2026;SMED;VERİMLİLİK ;34, 35, 36, 37. İŞ ADIMI Referans bazlı ara flans tasarımı ve üretimi yapılacak yapılan üretimden sonra ürünlerin temas yüzeyi olmayan kısımlarına referans numarası delık çapı ve boy bilgileri lazer ile işlenecek.;ZAMAN;Emre Soylu;Açık;17.06.2026;;GECİKME;PNSZ 07 SMED; ;;;;2026;16
24;9.06.2026;SMED;VERİMLİLİK ;39, 40. İŞ ADIMI Taş sökme ve takma eğitimi verilecek.;ZAMAN;Ersan Sezgin;Açık;18.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;17
24;9.06.2026;SMED;VERİMLİLİK ;63. İŞ ADIMI Su tavasının menteşeli sisteme geçirilmesi.;ZAMAN;Barış Avcı;Açık;30.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;18
24;9.06.2026;SMED;VERİMLİLİK ;70. İŞ ADIMI Mevcut sistemin yerine servo sisteme geçilmesi.;ZAMAN;Barış Avcı;Açık;30.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;19
24;9.06.2026;SMED;VERİMLİLİK ;71. İŞ ADIMI Balans alma eğitimi verilecek.;ZAMAN;Ersan Sezgin;Açık;29.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;20
24;9.06.2026;SMED;VERİMLİLİK ;77. İŞ ADIMI Bakım ekibi kontrol saglayacak.;ZAMAN;Barış Avcı;Açık;30.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;21
24;9.06.2026;SMED;VERİMLİLİK ;82. İŞ ADIMI Paperwork sisteminin telefon,tablet vb elde taşınabilir ekipmanlardan erişim sağlanması.;ZAMAN;Ersan Sezgin;Açık;29.06.2026;;ZAMANINDA;PNSZ 07 SMED; ;;;;2026;22
24;9.06.2026;KAİZEN ;VERİMLİLİK ;KAİZEN EĞİTİMLERİ YAPILDI;YETENEK;Kemal Doğan;Kapalı;9.06.2026;;GECİKME;KAİZEN EĞİTİM; ;;;;2026;23
23;2.06.2026;SAHA YÖNETİMİ;GÜVENLİK ;SAFETY LİDER UYGULAMASI START VERİLECEK.;KAZA RİSKİ;Gamze Öyekcin;Açık;9.06.2026;;GECİKME;SAFETY; ;;;;2026;24
23;2.06.2026;EĞİTİM;VERİMLİLİK ;OPERATÖR VE SAHA LİDERLERİNE KAİZEN EĞİTİMİ PLANLANACAK;ÜRETKENLİK;Gamze Öyekcin;Açık;9.06.2026;;GECİKME;EĞİTİM; ;;;;2026;25
23;2.06.2026;EĞİTİM;VERİMLİLİK ;BEYAZ YAKA A3 EĞİTİMİ PLANLANACAK;VERİMLİLİK;Gamze Öyekcin;Açık;9.06.2026;;GECİKME;EĞİTİM; ;;;;2026;26
23;2.06.2026;SMED;VERİMLİLİK ;PNSZ 7 SMED ANALİZİ YAPILDI, KARŞI ÖNLEMLER DANDORİ FORMATINA İŞLENECEK;ZAMAN;Emre Soylu;Açık;8.06.2026;;GECİKME;SMED; ;;;;2026;27
23;2.06.2026;GÖRSEL YÖNETİM ;MOTİVASYON ;ASAKAİ PANOSU BAŞLIK SAÇI PANOYA MONTE EDİLECEK;MOTIVASYON ;Barış Avcı;Açık;8.06.2026;;GECİKME;ASAKAİ PANO; ;;;;2026;28
21;18.05.2026;SAHA YÖNETİMİ;VERİMLİLİK ;AKSİYONLAR İZLENDİ;ÜRETKENLİK;Kemal Doğan;Kapalı;18.05.2026;18.05.2026;ZAMANINDA;AKSİYON TAKİP; ;;;;2026;29
20;12.05.2026;SAHA YÖNETİMİ;ÇEVRE;MAZSAN LAYOUT ÜZERİNDEN BAL PETEĞİ HÜCRE HARİTASI ÇIKARILACAK;ÜRETKENLİK;Gamze Öyekcin;Açık;18.05.2026;;GECİKME;BAL PETEĞİ; ;;;;2026;30
20;12.05.2026;SAHA YÖNETİMİ;ÇEVRE;BAL PETEĞİ HÜCRE HARİTASINA SORUMLU PERSONEL ATAMASI YAPILACAK;ÜRETKENLİK;Ersan Sezgin;Açık;18.05.2026;;GECİKME;BAL PETEĞİ; ;;;;2026;31
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ FRZ 12 FİKSTÜR TABLASI KAMA 13.90 KANAL GENİŞLİĞİ 14 0,1 BOŞLUK DÜZELTİLECEK.;KALİTE;Emre Soylu;Açık;18.05.2026;;GECİKME;FRZ 12; ;;;;2026;32
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ OPERATÖR KONTROL TALİMAT REVİZE EDİLECEK;KALİTE;Pınar Yılmaz;Açık;18.05.2026;;GECİKME;KONTROL TALİMATI; ;;;;2026;33
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ KKP REVİZE EDİLECEK;KALİTE;Pınar Yılmaz;Açık;18.05.2026;;GECİKME;KKP; ;;;;2026;34
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ SON KONTROL STANDARTI REVİZE EDİLECEK;KALİTE;Pınar Yılmaz;Açık;18.05.2026;;GECİKME;SON KONTROL; ;;;;2026;35
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ TND;KALİTE;Ersan Sezgin;Açık;18.05.2026;;GECİKME;TND; ;;;;2026;36
20;12.05.2026;KALİTE;KALİTE;BSH TM 6970 FREZE İZ DİĞER FREZELERİN KAMA KANAL ÖLÇÜLERİNİN KONTROLÜ VE GEREKİYORSA REVİZYON YAPILMASI;KALİTE;Emre Soylu;Açık;29.06.2026;;ZAMANINDA;FREZE FİKSTÜR KAMA KANAL ARALIĞI; ;;;;2026;37
18;28.04.2026;OEE;VERİMLİLİK ;ÜRETİM GÜNLÜK ÜRETİM RAKAMLARINI PLANLAMAYLA PAYLAŞACAK;VERİMLİLİK;Emre Soylu;Kapalı;5.05.2026;;GECİKME;PLANLAMA ÜRETİM VERİ FARKI; ;;;;2026;38
18;28.04.2026;OEE;VERİMLİLİK ;GÜN/VARDİYA BAZLI ÜRETİM PLANI AÇILACAK;VERİMLİLİK;Sanem Dokumacı;Kapalı;5.05.2026;;GECİKME;PLANLAMA ÜRETİM VERİ FARKI; ;;;;2026;39
18;28.04.2026;OEE;VERİMLİLİK ;ÖNCE ÇOK KOŞAN ÜRÜNLERDEN BAŞLAYARAK CT SÜRELERİ PLANLAMAYLA PAYLAŞILACAK;VERİMLİLİK;Emre Soylu;Devam Ediyor;12.05.2026;;GECİKME;PLANLAMA ÜRETİM VERİ FARKI; ;;;;2026;40
18;28.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;PFUS PERFORMANS TAKİBİ BAŞLATILACAK (ASAKAİ);VERİMLİLİK;Gözde Tohumci;Kapalı;5.05.2026;;GECİKME;; ;;;;2026;41
18;27.04.2026;KALİTE;KALİTE;TCNC DURUŞ SONRASI ISITMA PROGRAMI TASARIMI;KALİTE;Emre Soylu;Açık;12.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;42
18;27.04.2026;KALİTE;KALİTE;OTOMATİK OFSET TCNC;KALİTE;Emre Soylu;Açık;12.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;43
18;27.04.2026;KALİTE;KALİTE;TEZGAH BAŞINDAN AYRILMALARDA NOMİNALE ALINMA;KALİTE;Emre Soylu;Açık;12.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;44
18;27.04.2026;STANDART İŞ;KALİTE;TCNC İŞ STD. OLUŞTURMA;KALİTE;Emre Soylu;Açık;5.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;45
18;27.04.2026;STANDART İŞ;KALİTE;TCNC ZAMAN ETÜDÜ;KALİTE;Emre Soylu;Açık;5.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;46
18;27.04.2026;KALİTE;KALİTE;FARKLI MODEL TCNC LERDE MİN. MAX. OVALLİK ÇALIŞMASI;KALİTE;Pınar Yılmaz;Açık;5.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;47
18;27.04.2026;KALİTE;KALİTE;HAVALI GUAGE TASARIMI;KALİTE;Sezayi Parlakkılıç;Açık;5.05.2026;;GECİKME;ÇAP BÜYÜK HATASI; ;;;;2026;48
17;21.04.2026;KALİTE;KALİTE;A00154403 NUMARALI REFERANS DA PAS PROBLEMİ İÇİN KALICI KARŞI ÖNLEM ALINANA KADAR SON KONTROL GİRİŞİNDEKİ FKK ALANINDA FİFO TAKİBİ YAPILACAK.;KALİTE;Sanem Dokumacı;Kapalı;22.04.2026;;GECİKME;FİFO KONTROL; ;;;;2026;49
17;21.04.2026;KALİTE;KALİTE;A00154403 NUMARALI REFERANS DA PAS PROBLEMİ İÇİNOVALAMA YAGI SONRASI ÜRÜN TAKP;KALİTE;Doğukan Topçu;Devam Ediyor;11.05.2026;;GECİKME;OVALAMA YAĞI; ;;;;2026;50
17;21.04.2026;KALİTE;KALİTE;BLİSTER PNSZ ÜRETİM HATTI DENEMESİ;KALİTE;Doğukan Topçu;Devam Ediyor;27.04.2026;;GECİKME;BLİSTER DENEME; ;;;;2026;51
17;21.04.2026;KALİTE;KALİTE;FREZE BOR YAĞ STD. KONTROLÜ;KALİTE;Doğukan Topçu;Devam Ediyor;27.04.2026;;GECİKME;FREZE BOR YAĞ; ;;;;2026;52
17;21.04.2026;KALİTE;KALİTE;FRZ, TCNCBOR YAĞ ORANLARI KONTROLÜ;KALİTE;Doğukan Topçu;Devam Ediyor;27.04.2026;;GECİKME;YAĞ ORANI KONTROL; ;;;;2026;53
17;20.04.2026;KALİTE;KALİTE;A00154403 NUMARALI REFERANS DA PAS PROBLEMİ İÇİN SON KONTROL PAS PROBLEMİ OLAN KASALARIN KART BİLGİSİ VE HATA ORANI PROBLEM TAKİP EKİBİYLE PAYLAŞACAK.21,22,,24 NİSAN VERİLERİ PAYLAŞILACAK.;KALİTE;Sanem Dokumacı;Kapalı;24.04.2026;;GECİKME;VERİ PAYLAŞIMI; ;;;;2026;54
17;20.04.2026;KALİTE;KALİTE;A00154403 NUMARALI REFERANS DA PAS PROBLEMİ İÇİN TEDARİKÇİDEN GELEN ÜRETİM KASALARININ TEMİZLİK KONTROLU YAPILARAK ÜRETİME VERİLECEK. ( İÇİNDE SU, DÖKÜM TOXU, YABANCI MALZEME VS.) KONTROL STANDARTLARI OLUŞTURULUP İLGİLİ PERSONELE GÖREVLENDİRME YAPILACAK;KALİTE;Sanem Dokumacı;Kapalı;24.04.2026;;GECİKME;KASA KONTROL; ;;;;2026;55
17;20.04.2026;KALİTE;KALİTE;ÜRETİM PERSONELİ KULLANIM ÖNCESİ KASA İÇİNİ KONTROL EDECEK VE KİRLİLİK ORANLARI HAKKINDA VARDİYA AMİRİNE BİLGİ VERECEK.;KALİTE;Doğukan Topçu;Açık;24.04.2026;;GECİKME;PAS PROBLEMİ KASA KONTROL; ;;;;2026;56
17;20.04.2026;5S;5S;MAZSAN BAL PETEĞİ HÜCRE HARITASI ÇIKARILACAK...KİŞİ BAZLI ALAN ATAMALARI YAPILACAK. ;VERİMLİLİK;Gamze Öyekcin;Açık;30.04.2026;;GECİKME;SAFETY 5S; ;;;;2026;57
16;14.04.2026;5S;GÜVENLİK ;SAFETY PATROL & 5S DEVRİYE UYGULAMASINDA TESPİT EDİLEN TOPLAMDA 320 İYİLEŞTİRME MADDESİ İÇİN A0 FORMATINDA KESHİKOMİ LİSTESİ OLUŞTURULACAK.( İYİLEŞTİRME TAKİP SAYFASI) PROBLEM KİMİN, KARŞI ÖNLEM NEDİR KİM NEYİ NEZAMANA KADAR ÇÖZECEK BU TAKİP LİSTESİNDEN İLERLEME TAKİP EDİLECEK.;VERİMLİLİK;Gamze Öyekcin;Açık;21.04.2026;;GECİKME;SAFETY PATROL; ;;;;2026;58
16;14.04.2026;KALİTE;KALİTE;ÇİZİK HATASI İÇİN PPS FORMATINDA PROBLEM ÇÖZÜM METODU ÇALIŞILACAK VE ÖNÜMÜZDEKİ HAFTA ASAKAİ DE SUNUM YAPILACAK 20.04.2026;KALİTE;Emre Soylu;Açık;20.04.2026;;GECİKME;PPS ÇİZİK HATASI; ;;;;2026;59
16;14.04.2026;SMED;VERİMLİLİK ;BUGÜN VİDEOSU ÇEKİLEN SETUP İŞLEMİN PRIVATELY VİDEO ANALİZİ YAPILACAK 14.O4.2026;VERİMLİLİK;Emre Soylu;Devam Ediyor;23.04.2026;;GECİKME;SMED; ;;;;2026;60
16;14.04.2026;KALİTE;KALİTE;DARBE KAYNAKLI HURDA HATASI OLUŞUNUMUNU ENGELLEMEK ADINA FABRİKA İÇİ OLMASI GEREKEN KUTU MİN MAX SAYI STANDARTLARI OLUŞTURULACAK. VE TAKİP İÇİN METHOT BELİRLENECEK;KALİTE;Sanem Dokumacı;Kapalı;13.04.2026;;GECİKME;BOŞ KUTU STANDARTI; ;;;;2026;61
15;7.04.2026;TPM ;KALİTE;KUMLAMA TEZGAHI BASINÇ MANOMETRESİ TAKILACAK;KALİTE;Barış Avcı;Kapalı;13.04.2026;;GECİKME;KUMLAMA KALİTE; ;;;;2026;62
15;7.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ PFUS TAKİP LİSTESİNE KPI A OLUMSUZ ETKİ EDEN TÜM PROBLEMLER EKLENECEK;ÜRETKENLİK;Emre Soylu;Devam Ediyor;13.04.2026;;GECİKME;PFUS; ;;;;2026;63
15;7.04.2026;KALİTE;KALİTE;PEROSES VE KALİTE GRUBU SORUMLULUĞUNDAKİ TÜM KALİTE KONTROLLERİNİN TEYİT EDİLMESİ;KALİTE;Gülçin Başçiftci;Açık;13.04.2026;;GECİKME;KALİTE; ;;;;2026;64
15;7.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ ALANINDA PANOYA PPS PRATICE PROBLEM SOLVING FORMATI TASARLANMASI;VERİMLİLİK;Gözde Tohumci;Kapalı;13.04.2026;;GECİKME;PPS; ;;;;2026;65
15;7.04.2026;SMED;VERİMLİLİK ;PAKETLEME PROSESİ VİDEO ÇEKİMİ VE ANALİZİ;ÜRETKENLİK;Derya Gümüşoğlu;Kapalı;13.04.2026;;GECİKME;SMED; ;;;;2026;66
15;7.04.2026;SAHA YÖNETİMİ;VERİMLİLİK ;RETMES SİSTEMİNDE ÇALIŞMA SÜRESİNİN HATALI OLMASI SEBEBİYLE PLANLANAN GERÇEKLEŞEN ORANLARININ HATALI HESAPLANMASI;ÜRETKENLİK;Ersan Sezgin;Devam Ediyor;13.04.2026;;GECİKME;RETMES HATALI VERİ; ;;;;2026;67
15;6.04.2026;SMED;VERİMLİLİK ;SETUP ÖNCELİKLİ 5466 REFERANSI OLMAK ÜZERE BEYAZ EŞYA HATTINDA SETUP ÇALIŞMALARINDA VİDEO ÇEKİMLERİ YAPILACAK;VERİMLİLİK;Derya Gümüşoğlu;Devam Ediyor;13.04.2026;;GECİKME;SMED; ;;;;2026;68
14;1.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;SAATLİK ÜRETM PANOLARI VE ASAKAİ GRAFİKLERİ TÜM BİRİMLERDE DOLDURULMAYA BAŞLANACAK VE TAKİBİ YAPILACAK;VERİMLİLİK;Gözde Tohumci;Kapalı;6.04.2026;;GECİKME;ASAKAİ; ;;;;2026;69
14;1.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ UYGULAMA START VERİLMESİ;VERİMLİLİK;Gözde Tohumci;Kapalı;6.04.2026;6.04.2026;ZAMANINDA;ASAKAİ; ;;;;2026;70
14;1.04.2026;KALİTE;KALİTE;SON KONTROL KALİTE GRAFİKLERİ PAKETLENEN MİKTAR VE BULUNAN HATA SAYSI ORANI ALINARAK GRAFİK İŞARETLEMESİ YAPILACAK;KALİTE;Sezayi Parlakkılıç;Kapalı;6.04.2026;6.04.2026;ZAMANINDA;ASAKAİ; ;;;;2026;71
14;1.04.2026;TPM ;VERİMLİLİK ;MTTR-MTBF TAKİP KONUSUNDA BAKIM GRUBU İLE ÖRNEK DOKÜMAN PAYLAŞILDI. ASAKAİ DE BU FORMLAR YARDIMIYLE MTTR MTBF GRAFİKLERİ HAZIRLANACAK;ÜRETKENLİK;Barış Avcı;Kapalı;6.04.2026;6.04.2026;ZAMANINDA;ASAKAİ; ;;;;2026;72
14;1.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ SUNUM İÇİN 2 MİKROFONLU HOPERLÖR ALINACAK;ÜRETKENLİK;Gözde Tohumci;Kapalı;6.04.2026;7.04.2026;GECİKME;; ;;;;2026;73
14;1.04.2026;SMED;VERİMLİLİK ;HAFTA İÇİ 5466 REFERAN NUMARASI İÇİN SETUP YAPILAN TÜM ALANLARDAN VİDEO ÇEKİMİ YAPILACAK;ÜRETKENLİK;Derya Gümüşoğlu;Kapalı;6.04.2026;;GECİKME;SMED; ;;;;2026;74
14;1.04.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;06.04.2026 P.TESİ GÜNÜ İLK ASAKAİ DEMO SUNUMUNU YAPACAK ŞEKİLDE TÜM BİRİMLER HAZIRLIKLARINI TAMAMLAYACAK;ÜRETKENLİK;Gözde Tohumci;Kapalı;6.04.2026;6.04.2026;ZAMANINDA;ASAKAİ DEMO SUNUMU; ;;;;2026;75
14;30.03.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ GRAFİK VE SAATLİK ÜRETİM TAKİP FORMLARI HAZIRLANDI. PROSES TEYİDİ ALINDI VE PROSESLERE DAĞITILDI;VERİMLİLİK;Gözde Tohumci;Kapalı;1.04.2026;1.04.2026;ZAMANINDA;ASAKAİ; ;;;;2026;76
14;30.03.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;HAFTA BAZLI KÜMİLATİF TOPLAMDA PLANLANAN GERÇEKLEŞEN ÜRETİM ADETLERİ VE PLANLANAN GERÇEKLEŞEN SEVKİYAT ORANLARINI PLANLAMA GRUBU BİR FORMAT ÜZERİNDE ASSAKAİ ALANINDA SUNUMUMU YAPACAK;ÜRETKENLİK;Sanem Dokumacı;Kapalı;6.04.2026;;GECİKME;PALANLANA GERÇEKLEŞEN ÜRETİM VE SEVKİYAT TAKİP İ; ;;;;2026;77
13;24.03.2026;SMED;VERİMLİLİK ;TCNC-22 SMED ÇALIŞMASINDA Kİ AKSİYONLARIN PLANLANARAK KARŞI ÖNLEM FAALİYETLERİNİN BAŞLATILMASI - HEDEF 3454 sn. SETUP SÜRESİNİN 2158 sn DÜŞÜLMESİ %45 İyileştirme;ZAMAN;Emre Soylu;Devam Ediyor;28.04.2026;;GECİKME;SMED ÇALIŞMASI TCNC-22; ;;;;2026;78
13;23.03.2026;SMED;VERİMLİLİK ;takım sıfırlama (x+z) - X iptal, Z mevcut parça ile yeni parça arasında ki boy farkı hesaplanıp ofset değerine eklenecek;ZAMAN;Doğukan Topçu;Açık;28.04.2026;;GECİKME;TCNC-22 SMED; ;;;;2026;79
13;22.03.2026;SMED;VERİMLİLİK ;çene ayarı yapmak kumpas almak çene ayarına devam - modüler sert ayak sistemi adaptasyonu gerçekleştirilecek;ZAMAN;Emre Soylu;Açık;28.04.2026;;GECİKME;TCNC-22 SMED ÇALIŞMASI; ;;;;2026;80
13;22.03.2026;SMED;VERİMLİLİK ;takım sıfırlama (x+z) - X iptal, Z mevcut parça ile yeni parça arasında ki boy farkı hesaplanıp ofset değerine eklenecek;ZAMAN;Doğukan Topçu;Açık;23.03.2026;;GECİKME;TCNC-22 SMED ÇALIŞMASI; ;;;;2026;81
12;17.03.2026;VSM ;VERİMLİLİK ;HAT1-HAT2 ARASI ARA STOK MİKTARI TAKİP;STOK;Sanem Dokumacı;Kapalı;16.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;82
12;17.03.2026;VSM ;VERİMLİLİK ;Günlük saha fiziki stok kontrolü (kaç kere ve nerelere yapılacağı kararı alınacak);STOK;Sanem Dokumacı;Kapalı;15.04.2026;;GECİKME;VSM 5466; ;;;;2026;83
12;17.03.2026;VSM ;VERİMLİLİK ;Hat c/t22 hat216 Tact time Veri girişinin önemi anlatılacak standart çalışma talimatı OEE takibi;VERİMLİLİK;Emre Soylu;Açık;15.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;84
12;17.03.2026;VSM ;VERİMLİLİK ;Bitmiş ürün stoğu 6 günlük Bağ miktarlarının lot ağırlığı yarıya indirilebilir mi?;STOK;Uğur Yılmaz;Açık;15.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;85
12;17.03.2026;SMED;VERİMLİLİK ;SMED çalışmalarının başlatılması;VERİMLİLİK;Kemal Doğan;Devam Ediyor;23.03.2026;23.03.2026;ZAMANINDA;VSM ÇALIŞMASI 5466; ;;;;2026;86
11;17.03.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAİ GRAFİK EĞİTİMİ YAPILDI;VERİMLİLİK;Kemal Doğan;Kapalı;17.03.2026;17.03.2026;ZAMANINDA;ASAKAİ; ;;;;2026;87
12;16.03.2026;VSM ;VERİMLİLİK ;GÜNLÜK MÜŞTERİ SİPARİŞİ PARÇA BRÜT AĞIRLIĞI Tampon stok ham malzeme Güvenlik stoğu;STOK;Sanem Dokumacı;Kapalı;7.04.2026;;GECİKME;VSM İdeal durum 5466; ;;;;2026;88
12;16.03.2026;VSM ;VERİMLİLİK ;Caniastan 36lık ham malzeme geliş tarih ve adetlerine bakılacak;STOK;Gözde Tohumci;Kapalı;7.04.2026;;GECİKME;VSM çalışması 5466; ;;;;2026;89
12;16.03.2026;VSM ;VERİMLİLİK ;36lık Ham malzemenin geç gelmesi duruma istinaden 2 günlük 10 ton ham malzeme stoklarda stabil tutulacak;STOK;Uğur Yılmaz;Açık;7.04.2026;;GECİKME;VSM çalışması 5466; ;;;;2026;90
12;16.03.2026;VSM ;VERİMLİLİK ;DT-HAT1 ARASI ARA STOK MİKTARI Stok takip;STOK;Emine Doğru;Açık;7.04.2026;;GECİKME;VSM 5466; ;;;;2026;91
12;16.03.2026;VSM ;VERİMLİLİK ;İŞ EMİRLERİNİN GÜNLÜK AÇILMASI kararı;VERİMLİLİK;Sanem Dokumacı;Kapalı;7.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;92
12;16.03.2026;VSM ;VERİMLİLİK ;Son kontrol tampon stoğu oluşturulacak (min 30000- max 38000) Güvenlik stoğu %50;STOK;Sanem Dokumacı;Kapalı;16.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;93
12;16.03.2026;SMED;VERİMLİLİK ;Kardeş takım çağırma dış smed Capto heimer kombinasyonu Transferde;VERİMLİLİK;Emre Soylu;Açık;16.04.2026;;GECİKME;VSM Çalışması 5466; ;;;;2026;94
13;16.03.2026;GÖRSEL YÖNETİM ;VERİMLİLİK ;ASAKAI GRAFİKLERİ HAZIRLANACAK;VERİMLİLİK;Gözde Tohumci;Kapalı;6.04.2026;6.04.2026;ZAMANINDA;ASAKAİ; ;;;;2026;95
11;10.03.2026;VSM ;VERİMLİLİK ;VSM çalışması;ÜRETKENLİK;Kemal Doğan;Kapalı;10.03.2026;10.03.2026;ZAMANINDA;Beyaz eşya hattı VSM çalışması yapılacak; ;;;;2026;96
10;3.03.2026;AKIŞ İYİLEŞTİRME;VERİMLİLİK ;VSM veri analizi yapıldı;ÜRETKENLİK;Kemal Doğan;Kapalı;3.03.2026;3.03.2026;ZAMANINDA;VSM için saha çalışması yapıldı; ;;;;2026;97
10;3.03.2026;AKIŞ İYİLEŞTİRME;VERİMLİLİK ;VSM beyaz eşya hattı veri takibi;ÜRETKENLİK;Gözde Tohumci;Kapalı;9.03.2026;;GECİKME;VSM için Beyaz eşya verileri temize geçilecek; ;;;;2026;98
10;3.03.2026;AKIŞ İYİLEŞTİRME;VERİMLİLİK ;Beyaz eşya taşıma süreleri analiz;ÜRETKENLİK;Derya Gümüşoğlu;Kapalı;9.03.2026;;GECİKME;Beyaz eşya hattı malzeme taşıma süreleri analiz edilecek; ;;;;2026;99
10;3.03.2026;OEE;VERİMLİLİK ;Beyaz eşya son kontrol kalite dataları;KALİTE;Emre Soylu;Kapalı;9.03.2026;;GECİKME;Beyaz eşya hattı son kontrol kalite verileri çıkartılacak; ;;;;2026;100
10;3.03.2026;EĞİTİM;VERİMLİLİK ;VSM çalışması için malzeme temin edilmesi;ÜRETKENLİK;Doğukan Topçu;Kapalı;3.03.2026;3.03.2026;ZAMANINDA;A0 kağıt, renkli postit kağıtlar, kalem temini; ;;;;2026;101
10;2.03.2026;EĞİTİM;MOTİVASYON ;TPS Teknikleri eğitimi yapıldı;YETENEK;Kemal Doğan;Kapalı;2.03.2026;2.03.2026;ZAMANINDA;TPS Teknikleri eğitimi yapıldı; ;;;;2026;102
10;2.03.2026;SAHA YÖNETİMİ;VERİMLİLİK ;TPS Ekip oluşturuldu;YETENEK;Kemal Doğan;Kapalı;2.03.2026;2.03.2026;ZAMANINDA;TPS takımı kuruldu; ;;;;2026;103
9;26.02.2026;EĞİTİM;MOTİVASYON ;TPS Eğitim;YETENEK;Kemal Doğan;Kapalı;26.02.2026;26.02.2026;ZAMANINDA;TPS Giriş eğitimi yapıldı; ;;;;2026;104
9;24.02.2026;EĞİTİM;MOTİVASYON ;TPS Master plan hazırlama ve sunum;MOTIVASYON ;Kemal Doğan;Kapalı;24.02.2026;24.03.2026;GECİKME;TPS Master plan sunumu yapıldı; ;;;;2026;105
8;17.02.2026;EĞİTİM;MOTİVASYON ;TPS Assessment çalışması;MOTIVASYON ;Kemal Doğan;Kapalı;17.02.2026;17.02.2026;ZAMANINDA;TPS Asseessment yapıldı rapor sunumu yapıldı; ;;;;2026;106
8;16.02.2026;EĞİTİM;MOTİVASYON ;TPS Assessment çalışması yapıldı.;MOTIVASYON ;Kemal Doğan;Kapalı;16.02.2026;16.02.2026;ZAMANINDA;Assessment çalışması yapıldı; ;;;;2026;107`;

export interface ProjectRecord {
  id: number;
  visitedWeek: string;
  workDate: string;
  activitySubject: string;
  improvementSubject: string;
  workDone: string;
  output: string;
  responsible: string;
  status: string; // 'Açık' | 'Devam Ediyor' | 'Kapalı' | 'İptal'
  dueDate: string;
  actualDate: string;
  compliance: string; // 'ZAMANINDA' | 'GECİKME'
  notes: string;
  savingsAmount: string;
  savingsCurrency: string;
  kaizenSavings: string;
  equivalentProduct: string;
  year: number;
  orderNo: number;
  // Outlook-style follow-up flag: grey/inactive by default, red once toggled on. Marks the item
  // as critical — feeds the "Kritik Öneme Sahip Açık Maddeler" section of the weekly consultant
  // reminder email (see /api/cron/weekly-consultant-digest in server/app.ts).
  flagged?: boolean;
}

// Statuses that must NOT count toward project progress (cancelled).
export const EXCLUDED_STATUSES = ["İptal"];
export const STATUS_OPTIONS = ["Açık", "Devam Ediyor", "Kapalı", "İptal"];

// Initial data decoding function
const parseSeedData = (): ProjectRecord[] => {
  return RAW_EXCEL_CSV.trim().split("\n").map((line, idx) => {
    const parts = line.split(";");
    const status = parts[7]?.trim() || "Açık";
    const orderNo = parts[17] ? parseInt(parts[17].trim()) : (idx + 1);
    const savingsAmount = parts[12]?.trim() || "";
    const kaizenSavings = parts[14]?.trim() || "";

    return {
      visitedWeek: parts[0]?.trim() || "",
      workDate: parts[1]?.trim() || "",
      activitySubject: parts[2]?.trim() || "",
      improvementSubject: parts[3]?.trim() || "",
      workDone: parts[4]?.trim() || "",
      output: parts[5]?.trim() || "",
      responsible: parts[6]?.trim() || "",
      status: status,
      dueDate: parts[8]?.trim() || "",
      actualDate: parts[9]?.trim() || parts[1]?.trim() || "", // Use workDate as default actualDate if closed
      compliance: parts[10]?.trim() || "ZAMANINDA",
      notes: parts[11]?.trim() || "",
      savingsAmount: savingsAmount,
      savingsCurrency: parts[13]?.trim() || "₺",
      kaizenSavings: kaizenSavings,
      equivalentProduct: parts[15]?.trim() || "",
      year: parts[16] ? parseInt(parts[16].trim()) : 2026,
      orderNo: orderNo,
      id: orderNo
    };
  });
};

// Helper function to parse Turkish dates in formats like DD.MM.YYYY
const parseTurkishDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const parts = cleaned.split(".");
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  const partsSlash = cleaned.split("/");
  if (partsSlash.length === 3) {
    const day = parseInt(partsSlash[0], 10);
    const month = parseInt(partsSlash[1], 10) - 1;
    const year = parseInt(partsSlash[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Real termine-uyum calculation: ZAMANINDA if the actual completion date is on/before the due
// date, GECİKME if after. Falls back to the existing manual value when either date is missing
// (e.g. legacy imported rows), instead of forcing a value that can't be verified.
const computeCompliance = (dueDate: string, actualDate: string, fallback: string): string => {
  const due = parseTurkishDate(dueDate);
  const actual = parseTurkishDate(actualDate);
  if (!due || !actual) return fallback;
  return actual.getTime() <= due.getTime() ? "ZAMANINDA" : "GECİKME";
};

interface GanttActivity {
  id: string;
  name: string;
  owner: string;
  startDate: string;
  endDate: string;
  progressPercent: number;
  priority: "High" | "Medium" | "Low";
  status: "Planned" | "In Progress" | "Completed" | "Delayed";
  notes: string;
  [key: string]: any;
}

interface PtrTimeStudyProps {
  activities?: GanttActivity[];
  onAddActivity?: (activity: any) => Promise<void> | void;
  onUpdateActivity?: (activity: any) => Promise<void> | void;
  onAddKaizen?: (kaizen: any) => Promise<void> | void;
  kaizens?: any[];
}

export default function PtrTimeStudy({ activities, onAddActivity, onUpdateActivity, onAddKaizen, kaizens }: PtrTimeStudyProps) {
  const { selectedCustomer, globalState } = useFactory();
  const currentUser = globalState?.CurrentUser;
  const currency = selectedCustomer?.currency || "₺";

  const [records, setRecords] = useState<ProjectRecord[]>([]);

  // Function to calculate ISO week number and year from date string
  const getWeekAndYearFromDateString = (dateStr: string) => {
    const d = parseTurkishDate(dateStr);
    if (!d) return null;
    const year = d.getFullYear();
    
    // ISO 8601 week calculation
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return { week: week.toString(), year };
  };

  // Sync actuals (start/end weeks & discrete active weeks) to Master Plan Gantt Activities
  const syncActualsToMasterPlan = (updatedRecords: ProjectRecord[]) => {
    if (!activities || !onUpdateActivity) return;

    // 1. Group records by activitySubject & workDone. Adam-gün (man-day) is the count of DISTINCT
    // visit dates, not the count of action rows — one visit can legitimately produce many action
    // rows (e.g. 16 SMED actions logged on a single site visit is still 1 man-day, not 16).
    const recordsByActivitySubject: Record<string, { weeks: number[]; minWeek: number; maxWeek: number; visitDates: Set<string> }> = {};

    updatedRecords.forEach(r => {
      const subject = r.activitySubject?.trim();
      if (!subject) return;

      const weekNum = parseInt(r.visitedWeek, 10);
      if (isNaN(weekNum)) return;

      if (!recordsByActivitySubject[subject]) {
        recordsByActivitySubject[subject] = { weeks: [weekNum], minWeek: weekNum, maxWeek: weekNum, visitDates: new Set(r.workDate ? [r.workDate] : []) };
      } else {
        const group = recordsByActivitySubject[subject];
        if (!group.weeks.includes(weekNum)) {
          group.weeks.push(weekNum);
        }
        group.minWeek = Math.min(group.minWeek, weekNum);
        group.maxWeek = Math.max(group.maxWeek, weekNum);
        if (r.workDate) group.visitDates.add(r.workDate);
      }
    });

    // 2. Iterate through master plan activities and find matching subjects. Case-insensitive
    // EXACT match only — the previous bidirectional substring + category match (e.g. "5S", "TPM",
    // "OEE") could silently attach one activity's weeks/man-days to an unrelated activity whose
    // name or category happened to contain the same short fragment. The "Faaliyet Konusu" dropdown
    // already offers the real Master Plan activity names verbatim, so exact match is the correct
    // path for anything selected through it; free-text that doesn't match exactly simply won't sync
    // (safer than syncing to the wrong activity).
    activities.forEach(act => {
      const actNameUpper = act.name.toUpperCase().trim();

      let group = recordsByActivitySubject[act.name.trim()];
      if (!group) {
        const foundKey = Object.keys(recordsByActivitySubject).find(key => key.toUpperCase().trim() === actNameUpper);
        if (foundKey) {
          group = recordsByActivitySubject[foundKey];
        }
      }

      if (group) {
        const sortedWeeks = Array.from(new Set(group.weeks)).sort((a, b) => a - b);
        const consumedManDays = group.visitDates.size;
        const currentActualStart = (act as any).actualStartWeek;
        const currentActualFinish = (act as any).actualFinishWeek;
        const currentConsumed = (act as any).consumedManDays;
        const currentWeeks = (act as any).actualWeeks || [];

        const weeksEqual = currentWeeks.length === sortedWeeks.length && currentWeeks.every((w: number, i: number) => w === sortedWeeks[i]);

        if (
          currentActualStart !== group.minWeek ||
          currentActualFinish !== group.maxWeek ||
          currentConsumed !== consumedManDays ||
          !weeksEqual
        ) {
          const updatedAct = {
            ...act,
            actualStartWeek: group.minWeek,
            actualFinishWeek: group.maxWeek,
            actualWeeks: sortedWeeks,
            consumedManDays
          };
          onUpdateActivity(updatedAct);
        }
      }
    });
  };

  const ptrToken = localStorage.getItem("gemba_token") || "usr_arcelik_admin";
  const isInitialPtrLoad = useRef(true);

  // Load records for active customer from the backend. If none exist yet, show the illustrative
  // seed data locally (not persisted) so the module isn't empty on first use for a new customer.
  useEffect(() => {
    const customerId = selectedCustomer?.id || "default";
    isInitialPtrLoad.current = true;
    fetch("/api/business/ptr-records", {
      headers: {
        "Authorization": `Bearer ${ptrToken}`,
        "x-factory-id": customerId
      }
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setRecords(res.data && res.data.length > 0 ? res.data : parseSeedData());
        }
      })
      .catch((err) => console.error("Failed to load PTR records", err))
      .finally(() => {
        setTimeout(() => { isInitialPtrLoad.current = false; }, 0);
      });
  }, [selectedCustomer]);

  // Debounced bulk sync to the backend (a single request for the whole edited list, since this is
  // a spreadsheet-style table where many rows can change quickly), plus the existing Master Plan sync.
  useEffect(() => {
    const customerId = selectedCustomer?.id || "default";
    if (records.length === 0) return;
    syncActualsToMasterPlan(records);
    if (isInitialPtrLoad.current) return;
    const timer = setTimeout(() => {
      fetch("/api/business/ptr-records", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ptrToken}`,
          "x-factory-id": customerId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(records)
      }).catch((err) => console.error("Failed to save PTR records", err));
    }, 800);
    return () => clearTimeout(timer);
  }, [records, selectedCustomer]);
  
  // Navigation / Tab structure state
  const [activeTab, setActiveTab] = useState<"table" | "dashboard" | "weekly">("table");

  // Selected week for weekly report tab
  const [selectedReportWeek, setSelectedReportWeek] = useState<string>("");

  // Find all available weeks in the database
  const availableWeeks = useMemo<string[]>(() => {
    const weeks = Array.from(new Set(records.map(r => r.visitedWeek).filter(Boolean))) as string[];
    return weeks.sort((a, b) => parseInt(b) - parseInt(a));
  }, [records]);

  const activeReportWeek = selectedReportWeek || availableWeeks[0] || "25";

  // Sync selectedReportWeek if it's empty
  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedReportWeek) {
      setSelectedReportWeek(availableWeeks[0]);
    }
  }, [availableWeeks, selectedReportWeek]);

  // Filtering & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("ALL");

  // Expanded filter fields requested by user
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>("ALL");
  const [selectedWorkDateStart, setSelectedWorkDateStart] = useState<string>("");
  const [selectedWorkDateEnd, setSelectedWorkDateEnd] = useState<string>("");
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<string>("ALL");
  const [selectedImprovementFilter, setSelectedImprovementFilter] = useState<string>("");
  const [selectedOutputFilter, setSelectedOutputFilter] = useState<string>("");
  const [selectedDueDateStart, setSelectedDueDateStart] = useState<string>("");
  const [selectedDueDateEnd, setSelectedDueDateEnd] = useState<string>("");
  const [selectedComplianceFilter, setSelectedComplianceFilter] = useState<string>("ALL");

  // Inline / Row editing state
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProjectRecord>>({});
  const [isTableFullScreen, setIsTableFullScreen] = useState(false);

  // COLLAPSIBLE FILTERS STATE
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Other Activity Choice dialog state
  const [isOtherActivityModalOpen, setIsOtherActivityModalOpen] = useState(false);
  const [otherActivityTriggerContext, setOtherActivityTriggerContext] = useState<"new" | "edit">("new");
  const [otherActivityForm, setOtherActivityForm] = useState({
    customSubject: ""
  });

  // Excel/CSV import validation confirmation dialog state
  const [showImportValidationModal, setShowImportValidationModal] = useState(false);
  const [unrecognizedImportSubjects, setUnrecognizedImportSubjects] = useState<string[]>([]);
  const [pendingImportList, setPendingImportList] = useState<ProjectRecord[]>([]);

  // Action feedback notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // CI Project Conversion state
  const [isCIModalOpen, setIsCIModalOpen] = useState(false);
  const [ciCardForm, setCiCardForm] = useState({
    title: "",
    originator: "",
    department: "OPEX / Süreç İyileştirme",
    dateProposed: "",
    impactLevel: "Medium" as "High" | "Medium" | "Low",
    estimatedCost: 0,
    actualSavings: 0,
    problemDefinition: "",
    problemDetail: "",
    targetObjective: "",
    targetKpi: "Verimlilik / COPQ",
    targetRatio: 0,
    targetCostReduction: 0,
    rootCause: "",
    improvementActions: ""
  });
  const [sourceActionRecord, setSourceActionRecord] = useState<ProjectRecord | null>(null);

  const handleOpenCIWizard = (action: ProjectRecord) => {
    let rawSavings = 0;
    if (action.savingsAmount) {
      rawSavings = parseFloat(action.savingsAmount.replace(/[^\d.]/g, "")) || 0;
    } else if (action.kaizenSavings) {
      rawSavings = parseFloat(action.kaizenSavings.replace(/[^\d.]/g, "")) || 0;
    }

    const todayStr = new Date().toLocaleDateString("tr-TR");

    setSourceActionRecord(action);
    setCiCardForm({
      title: `${action.improvementSubject || action.activitySubject} İyileştirmesi`,
      originator: action.responsible || "Saha Ekibi",
      department: "OPEX / Süreç İyileştirme",
      dateProposed: todayStr,
      impactLevel: "Medium",
      estimatedCost: 0,
      actualSavings: rawSavings,
      problemDefinition: `Saha kütüğündeki aksiyon: "${action.workDone || ''}" kapsamında iyileştirme ihtiyacı tespit edilmiştir.`,
      problemDetail: action.notes ? `Ek notlar: ${action.notes}` : "",
      targetObjective: `Faaliyet çıktısı: "${action.output || 'Süreç standardizasyonu ve verimlilik artışı sağlamak.'}"`,
      targetKpi: action.activitySubject || "Verimlilik / COPQ",
      targetRatio: 15,
      targetCostReduction: rawSavings,
      rootCause: "Standart iş yöntemlerinin geliştirilmesi, ekipman optimizasyonu veya proses stabilizasyonu ihtiyacı.",
      improvementActions: "Aksiyon planındaki adımların tamamlanması ve standartlaştırılması."
    });
    setIsCIModalOpen(true);
  };

  const handleSaveCIProject = async () => {
    if (!ciCardForm.title.trim()) {
      showToast("Lütfen bir proje başlığı giriniz!");
      return;
    }

    const newK = {
      id: "KAI-" + Date.now(),
      title: ciCardForm.title,
      originator: ciCardForm.originator,
      department: ciCardForm.department,
      dateProposed: ciCardForm.dateProposed,
      impactLevel: ciCardForm.impactLevel,
      estimatedCost: Number(ciCardForm.estimatedCost) || 0,
      actualSavings: Number(ciCardForm.actualSavings) || 0,
      status: "In Progress",
      kanbanStatus: "PLAN", // P step on Kanban board is PLAN
      descriptionBefore: ciCardForm.problemDefinition,
      descriptionAfter: ciCardForm.targetObjective,
      problemDefinition: ciCardForm.problemDefinition,
      problemDetail: ciCardForm.problemDetail || "",
      targetObjective: ciCardForm.targetObjective,
      targetKpi: ciCardForm.targetKpi || "Verimlilik / COPQ",
      targetRatio: Number(ciCardForm.targetRatio) || 0,
      targetCostReduction: Number(ciCardForm.targetCostReduction) || 0,
      rootCause: ciCardForm.rootCause || "",
      improvementActions: ciCardForm.improvementActions || "",
      responsibles: ciCardForm.originator,
      actionsTaken: `OPEX Aksiyon kütüğünden (${sourceActionRecord?.id || ''}) aktarıldı. Kanban Planlandı (P) adımına eklendi.`
    };

    if (onAddKaizen) {
      try {
        await onAddKaizen(newK);
        showToast("CI Proje Kartı başarıyla oluşturuldu ve Kanban Board P Adımına (Planlandı) eklendi!");
        setIsCIModalOpen(false);
      } catch (err: any) {
        showToast("CI Proje kartı eklenirken bir hata oluştu.");
      }
    } else {
      showToast("CI Proje Kartı oluşturuldu! (Yerel simülasyon)");
      setIsCIModalOpen(false);
    }
  };

  // Collapsible sections
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");

  // Unique lists for filters
  const uniqueResponsibles = useMemo(() => {
    const list = new Set(records.map(r => r.responsible).filter(Boolean));
    return Array.from(list).sort();
  }, [records]);

  // Master Plan Gantt unique activity names
  const ganttActivityNames = useMemo<string[]>(() => {
    if (!activities || activities.length === 0) {
      return ["A3 Problem Çözme", "TPM / Otonom Bakım", "5S Tertip Düzen", "SMED Kalıp Azaltımı", "VSM Değer Akış Analizi", "Kaizen Faaliyeti"];
    }
    return Array.from(new Set(activities.map(a => a.name.trim()))).sort();
  }, [activities]);

  // Real team/assignee directory — was a hardcoded list of 14 fictional names disconnected from
  // the app's real consultant/customer-user system. Fetched from /api/business/customers/{id}/team
  // (same endpoint KaizenManager.tsx and ProjectTeamTab.tsx use). Falls back to a short
  // illustrative list only when the customer genuinely has no one assigned yet.
  const TEAM_FALLBACK_OPTIONS = ["Kemal Doğan (Danışman)"];
  const [workspaceTeamMembers, setWorkspaceTeamMembers] = useState<string[]>(TEAM_FALLBACK_OPTIONS);

  useEffect(() => {
    if (!selectedCustomer?.id) return;
    fetch(`/api/business/customers/${selectedCustomer.id}/team`, {
      headers: { "Authorization": `Bearer ${ptrToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) return;
        const { primaryConsultant, consultants, customerUsers } = data.data;
        const names: string[] = [];
        if (primaryConsultant) names.push(`${primaryConsultant.full_name} (Baş Danışman)`);
        (consultants || []).forEach((c: any) => names.push(`${c.full_name} (Danışman)`));
        (customerUsers || []).forEach((u: any) => names.push(`${u.full_name} (Müşteri Kullanıcısı)`));
        setWorkspaceTeamMembers(names.length > 0 ? names : TEAM_FALLBACK_OPTIONS);
      })
      .catch(err => console.error("Failed to load real team directory in PtrTimeStudy", err));
  }, [selectedCustomer?.id, ptrToken]);


  // Draft new item state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<Partial<ProjectRecord>>({
    visitedWeek: "25",
    workDate: new Date().toLocaleDateString("tr-TR"),
    activitySubject: "",
    improvementSubject: "KAIZEN",
    workDone: "",
    output: "VERİMLİLİK",
    responsible: "",
    status: "Açık",
    dueDate: new Date().toLocaleDateString("tr-TR"),
    compliance: "ZAMANINDA",
    year: 2026
  });

  // Dynamic workDate change handler for quick add form
  const handleWorkDateChange = (dateVal: string) => {
    const res = getWeekAndYearFromDateString(dateVal);
    if (res) {
      setNewItem(prev => ({
        ...prev,
        workDate: dateVal,
        visitedWeek: res.week,
        year: res.year
      }));
    } else {
      setNewItem(prev => ({
        ...prev,
        workDate: dateVal
      }));
    }
  };

  // Dynamic workDate change handler for inline editing
  const handleEditWorkDateChange = (dateVal: string) => {
    const res = getWeekAndYearFromDateString(dateVal);
    if (res) {
      setEditForm(prev => ({
        ...prev,
        workDate: dateVal,
        visitedWeek: res.week,
        year: res.year
      }));
    } else {
      setEditForm(prev => ({
        ...prev,
        workDate: dateVal
      }));
    }
  };

  // Handle updates directly inside spreadsheet
  const handleUpdateStatus = (id: number, val: string) => {
    setRecords(prev => prev.map(r => {
      if (r.id === id) {
        if (val === "Kapalı") {
          const actualDate = r.actualDate || new Date().toLocaleDateString("tr-TR");
          const compliance = computeCompliance(r.dueDate, actualDate, r.compliance);
          return { ...r, status: val, actualDate, compliance };
        }
        return { ...r, status: val };
      }
      return r;
    }));
  };

  const handleToggleFlag = (id: number) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, flagged: !r.flagged } : r));
  };

  const handleUpdateCompliance = (id: number, val: string) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, compliance: val } : r));
  };

  // Delete row
  const handleDeleteRow = (id: number) => {
    if (window.confirm(`Sıra No ${id} olan iyileştirme kaydını silmek istediğinizden emin misiniz?`)) {
      setRecords(prev => prev.filter(r => r.id !== id));
      const customerId = selectedCustomer?.id || "default";
      fetch(`/api/business/ptr-records/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${ptrToken}`,
          "x-factory-id": customerId
        }
      }).catch((err) => console.error("Failed to delete PTR record", err));
      showToast(`Sıra No ${id} olan proje satırı başarıyla silindi.`);
    }
  };

  // Open Edit Form
  const handleEditClick = (row: ProjectRecord) => {
    setEditingRowId(row.id);
    setEditForm({ ...row });
    showToast(`Sıra No ${row.id} düzenleniyor. Değişiklikleri yaptıktan sonra ✓ butonuna basabilirsiniz.`);
  };

  // Save full edit
  const handleSaveEdit = () => {
    if (!editForm.id) return;
    const finalForm = { ...editForm };
    if (finalForm.workDate) {
      const res = getWeekAndYearFromDateString(finalForm.workDate);
      if (res) {
        finalForm.visitedWeek = res.week;
        finalForm.year = res.year;
      }
    }
    if (finalForm.status === "Kapalı") {
      if (!finalForm.actualDate) finalForm.actualDate = new Date().toLocaleDateString("tr-TR");
      finalForm.compliance = computeCompliance(finalForm.dueDate || "", finalForm.actualDate, finalForm.compliance || "ZAMANINDA");
    }
    setRecords(prev => prev.map(r => r.id === finalForm.id ? (finalForm as ProjectRecord) : r));
    setEditingRowId(null);
    showToast(`Sıra No ${finalForm.id} satırı başarıyla güncellendi.`);
  };

  // Save new record
  // Hafta Atlama Uyarısı: yeni bir aksiyon kaydedilirken, en son kayıtlı haftadan sonra atlanan
  // hafta(lar) varsa danışmana sorar (örn. son kayıt 21. haftaysa ve 23. hafta giriliyorsa, 22.
  // hafta için ne olduğu sorulur) — sessizce boşluk bırakılmaz.
  const [pendingGapWeeks, setPendingGapWeeks] = useState<number[] | null>(null);
  const [gapReasons, setGapReasons] = useState<Record<number, string>>({});
  const GAP_REASON_OPTIONS = ["Ziyaret yapılmadı", "Ziyaret yapıldı, aksiyon girilmedi", "Sadece kontrol ziyareti yapıldı"];

  const getSkippedWeeks = (newWeek: number, newYear: number): number[] => {
    if (isNaN(newWeek)) return [];
    const priorWeeks = records
      .filter(r => r.year === newYear)
      .map(r => parseInt(r.visitedWeek, 10))
      .filter(w => !isNaN(w) && w < newWeek);
    if (priorWeeks.length === 0) return [];
    const lastWeek = Math.max(...priorWeeks);
    if (newWeek - lastWeek <= 1) return [];
    const skipped: number[] = [];
    for (let w = lastWeek + 1; w < newWeek; w++) skipped.push(w);
    return skipped;
  };

  const handleAttemptAddNewRecord = () => {
    const weekNum = parseInt(newItem.visitedWeek || "", 10);
    const yearNum = newItem.year || new Date().getFullYear();
    const skipped = getSkippedWeeks(weekNum, yearNum);
    if (skipped.length > 0) {
      setPendingGapWeeks(skipped);
      const initial: Record<number, string> = {};
      skipped.forEach(w => { initial[w] = GAP_REASON_OPTIONS[0]; });
      setGapReasons(initial);
    } else {
      handleAddNewRecord();
    }
  };

  const buildGapNoteRecords = (weeks: number[]): ProjectRecord[] => {
    const yearNum = newItem.year || new Date().getFullYear();
    return weeks.map((w, idx) => {
      const reason = gapReasons[w] || GAP_REASON_OPTIONS[0];
      // Kontrol ziyareti gerçek bir saha çalışmasıdır; diğer nedenler (ziyaret/aksiyon yok)
      // ilerleme hesabına dahil edilmemesi için "İptal" statüsüyle kaydedilir.
      const status = reason === GAP_REASON_OPTIONS[2] ? "Açık" : "İptal";
      return {
        id: Date.now() + idx,
        orderNo: Date.now() + idx,
        visitedWeek: w.toString(),
        workDate: "",
        activitySubject: "SAHA ZİYARET NOTU",
        improvementSubject: "",
        workDone: `[HAFTA ATLANDI] ${reason}`,
        output: "",
        responsible: newItem.responsible || "",
        status,
        dueDate: "",
        actualDate: "",
        compliance: "ZAMANINDA",
        notes: reason,
        savingsAmount: "",
        savingsCurrency: "",
        kaizenSavings: "",
        equivalentProduct: "",
        year: yearNum
      };
    });
  };

  const handleConfirmGapReasons = () => {
    if (!pendingGapWeeks) return;
    const gapRecords = buildGapNoteRecords(pendingGapWeeks);
    setPendingGapWeeks(null);
    handleAddNewRecord(gapRecords);
  };

  const handleSkipGapCheck = () => {
    setPendingGapWeeks(null);
    handleAddNewRecord();
  };

  const handleAddNewRecord = (extraRecords: ProjectRecord[] = []) => {
    const nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const finalRecord: ProjectRecord = {
      id: nextId,
      orderNo: nextId,
      visitedWeek: newItem.visitedWeek || "25",
      workDate: newItem.workDate || "",
      activitySubject: newItem.activitySubject || "",
      improvementSubject: newItem.improvementSubject || "",
      workDone: newItem.workDone || "Yeni İyileştirme",
      output: newItem.output || "",
      responsible: newItem.responsible || "Atanmadı",
      status: newItem.status || "Açık",
      dueDate: newItem.dueDate || "",
      actualDate: newItem.actualDate || "",
      compliance: newItem.compliance || "ZAMANINDA",
      notes: newItem.notes || "",
      savingsAmount: newItem.savingsAmount || "",
      savingsCurrency: newItem.savingsCurrency || "",
      kaizenSavings: newItem.kaizenSavings || "",
      equivalentProduct: newItem.equivalentProduct || "",
      year: newItem.year || 2026
    };

    if (finalRecord.workDate) {
      const res = getWeekAndYearFromDateString(finalRecord.workDate);
      if (res) {
        finalRecord.visitedWeek = res.week;
        finalRecord.year = res.year;
      }
    }

    if (finalRecord.status === "Kapalı") {
      if (!finalRecord.actualDate) finalRecord.actualDate = new Date().toLocaleDateString("tr-TR");
      finalRecord.compliance = computeCompliance(finalRecord.dueDate, finalRecord.actualDate, finalRecord.compliance);
    }

    setRecords([finalRecord, ...extraRecords, ...records]);
    setIsAddingNew(false);
    setNewItem({
      visitedWeek: "25",
      workDate: new Date().toLocaleDateString("tr-TR"),
      activitySubject: "",
      improvementSubject: "KAIZEN",
      workDone: "",
      output: "VERİMLİLİK",
      responsible: "",
      status: "Açık",
      dueDate: new Date().toLocaleDateString("tr-TR"),
      compliance: "ZAMANINDA",
      year: 2026,
      kaizenSavings: "",
      savingsAmount: ""
    });
    showToast(`Sıra No ${nextId} olan yeni kayıt başarıyla eklendi.`);
  };

  // Bulk CSV Semicolon split parse
  const handleBulkImport = () => {
    if (!importText.trim()) {
      setImportError("Lütfen CSV formatında veri girin.");
      return;
    }
    try {
      const lines = importText.trim().split("\n");
      const importedList: ProjectRecord[] = [];
      let successCount = 0;

      lines.forEach((line) => {
        // Skip header if matches text
        if (line.toLowerCase().includes("ziyaret haftası") || line.toLowerCase().includes("çalışma tarihi")) {
          return;
        }
        const parts = line.split(";");
        if (parts.length >= 8) {
          const rawDate = parts[1]?.trim() || "";
          let calculatedWeek = parts[0]?.trim() || "";
          let calculatedYear = parts[16] ? parseInt(parts[16].trim()) : 2026;

          // Auto-calculate week and year if date is provided
          if (rawDate) {
            const res = getWeekAndYearFromDateString(rawDate);
            if (res) {
              calculatedWeek = res.week;
              calculatedYear = res.year;
            }
          }

          const orderNo = records.length + successCount + 1;
          importedList.push({
            id: orderNo,
            orderNo: orderNo,
            visitedWeek: calculatedWeek,
            workDate: rawDate,
            activitySubject: parts[2]?.trim() || "",
            improvementSubject: parts[3]?.trim() || "",
            workDone: parts[4]?.trim() || "",
            output: parts[5]?.trim() || "",
            responsible: parts[6]?.trim() || "",
            status: parts[7]?.trim() || "Açık",
            dueDate: parts[8]?.trim() || "",
            actualDate: parts[9]?.trim() || "",
            compliance: parts[10]?.trim() || "ZAMANINDA",
            notes: parts[11]?.trim() || "",
            savingsAmount: parts[12]?.trim() || "",
            savingsCurrency: parts[13]?.trim() || "",
            kaizenSavings: parts[14]?.trim() || "",
            equivalentProduct: parts[15]?.trim() || "",
            year: calculatedYear
          });
          successCount++;
        }
      });

      if (importedList.length === 0) {
        setImportError("Veri ayrıştırılamadı. Doğru ayırıcı (;) kullanıldığından emin olun.");
        return;
      }

      // Check unrecognized activity subjects
      const unrecognizedSubjects = Array.from(new Set(
        importedList
          .map(r => r.activitySubject?.trim())
          .filter(subject => subject && !ganttActivityNames.includes(subject))
      ));

      if (unrecognizedSubjects.length > 0) {
        setUnrecognizedImportSubjects(unrecognizedSubjects);
        setPendingImportList(importedList);
        setShowImportValidationModal(true);
      } else {
        setRecords(prev => [...importedList, ...prev]);
        setImportText("");
        setImportError("");
        setIsImportOpen(false);
        showToast(`${importedList.length} adet yeni proje kaydı başarıyla içeri aktarıldı.`);
      }
    } catch (e: any) {
      setImportError(`Hata saptandı: ${e.message}`);
    }
  };

  const handleConfirmImportWithSync = (addSubjectsToGantt: boolean) => {
    if (addSubjectsToGantt && onAddActivity) {
      // Create the missing subjects as real Master Plan activities (backend-persisted),
      // so Proje Takip Raporu topics always resolve to an actual plan line item.
      const existingNames = new Set((activities || []).map(a => a.name.trim().toLowerCase()));
      unrecognizedImportSubjects.forEach(subject => {
        if (!existingNames.has(subject.trim().toLowerCase())) {
          const subjectUpper = subject.toUpperCase();
          const category = subjectUpper.includes("5S") ? "5S Audit" : subjectUpper.includes("SMED") ? "SMED" : "Kaizen";
          onAddActivity({
            id: "act_" + Math.random().toString(36).substring(2, 9),
            name: subject,
            owner: "OpEx Team",
            category,
            startDate: "2026-06",
            endDate: "2026-07",
            plannedStartWeek: 24,
            plannedFinishWeek: 28,
            actualStartWeek: 24,
            actualFinishWeek: 24,
            progressPercent: 10,
            priority: "Medium",
            status: "In Progress",
            notes: "İçeri aktarılan Excel verisinden otomatik eklenen faaliyet konusu."
          });
        }
      });
      showToast(`${unrecognizedImportSubjects.length} adet yeni faaliyet konusu Master Plan'a eklendi.`);
    }

    setRecords(prev => [...pendingImportList, ...prev]);
    setImportText("");
    setImportError("");
    setIsImportOpen(false);
    setShowImportValidationModal(false);
    showToast(`${pendingImportList.length} adet yeni proje kaydı başarıyla içeri aktarıldı.`);
  };

  // Confirm linking a manually-entered record to a brand new Master Plan activity
  // ("Diğer" / Yeni Faaliyet Bağla). Master Plan stays the single source of planning
  // truth — this just creates the missing line item there so the actual can match it.
  const handleConfirmOtherActivity = () => {
    const name = otherActivityForm.customSubject.trim();
    if (!name) return;

    const alreadyExists = (activities || []).some(a => a.name.trim().toLowerCase() === name.toLowerCase());
    if (!alreadyExists && onAddActivity) {
      const nameUpper = name.toUpperCase();
      const category = nameUpper.includes("5S") ? "5S Audit" : nameUpper.includes("SMED") ? "SMED" : "Kaizen";
      onAddActivity({
        id: "act_" + Math.random().toString(36).substring(2, 9),
        name,
        owner: "OpEx Team",
        category,
        startDate: "2026-06",
        endDate: "2026-07",
        plannedStartWeek: 24,
        plannedFinishWeek: 28,
        actualStartWeek: 24,
        actualFinishWeek: 24,
        progressPercent: 0,
        priority: "Medium",
        status: "Planned",
        notes: "Proje Takip Raporu üzerinden yeni faaliyet olarak eklendi."
      });
    }

    if (otherActivityTriggerContext === "new") {
      setNewItem({ ...newItem, activitySubject: name });
    } else {
      setEditForm({ ...editForm, activitySubject: name });
    }

    setIsOtherActivityModalOpen(false);
    showToast(`"${name}" Master Plan'a eklendi ve bu kayda bağlandı.`);
  };

  // Real firm-template export: server clones the actual "Proje Takip Raporu" Excel file (native
  // PivotTables + 8 charts intact) and injects live PTR data, so the Dashboard/Pivot sheets inside
  // the download are the real ones, not a from-scratch approximation.
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const handleDownloadTemplateExcel = async () => {
    setIsDownloadingTemplate(true);
    const customerId = selectedCustomer?.id || "default";
    try {
      const res = await fetch("/api/business/ptr-records/export-template-excel", {
        headers: {
          "Authorization": `Bearer ${ptrToken}`,
          "x-factory-id": customerId
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Rapor oluşturulamadı." }));
        throw new Error(err.error || "Rapor oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      link.download = `${selectedCustomer?.companyName || "Müşteri"}-${yyyy}${mm}-${dd}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Şablon Excel raporu indirildi.");
    } catch (e: any) {
      showToast(`Hata: ${e.message || "Rapor indirilemedi."}`);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // "Mail Gönder": sends that week's visit report (real template Excel attached) straight to the
  // customer from proje@gembapartner.com via the backend's send-weekly-report route. Recipient
  // defaults to the customer card's own contact emails but can be overridden freely.
  const [showMailPanel, setShowMailPanel] = useState(false);
  const [mailRecipient, setMailRecipient] = useState("");
  const [isSendingMail, setIsSendingMail] = useState(false);

  const mailRecipientOptions = useMemo(() => {
    const opts: { label: string; email: string }[] = [];
    if (selectedCustomer?.mainContactEmail) {
      opts.push({ label: `${selectedCustomer.mainContactPerson || "Ana İrtibat"} — ${selectedCustomer.mainContactEmail}`, email: selectedCustomer.mainContactEmail });
    }
    if (selectedCustomer?.factoryManagerEmail) {
      opts.push({ label: `${selectedCustomer.factoryManager || "Fabrika Müdürü"} — ${selectedCustomer.factoryManagerEmail}`, email: selectedCustomer.factoryManagerEmail });
    }
    if (selectedCustomer?.generalManagerEmail) {
      opts.push({ label: `${selectedCustomer.generalManager || "Genel Müdür"} — ${selectedCustomer.generalManagerEmail}`, email: selectedCustomer.generalManagerEmail });
    }
    return opts;
  }, [selectedCustomer]);

  const handleOpenMailPanel = () => {
    setMailRecipient(mailRecipientOptions[0]?.email || "");
    setShowMailPanel(true);
  };

  const handleSendWeeklyReportMail = async () => {
    if (!mailRecipient || !mailRecipient.includes("@")) {
      showToast("Lütfen geçerli bir alıcı e-posta adresi girin.");
      return;
    }
    setIsSendingMail(true);
    try {
      const res = await fetch("/api/business/ptr-records/send-weekly-report", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ptrToken}`,
          "x-factory-id": selectedCustomer?.id || "default",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          week: activeReportWeek,
          year: new Date().getFullYear(),
          recipientEmail: mailRecipient
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Rapor e-postası gönderilemedi.");
      }
      showToast(`${activeReportWeek}. Hafta ziyaret raporu ${mailRecipient} adresine gönderildi.`);
      setShowMailPanel(false);
    } catch (e: any) {
      showToast(`Hata: ${e.message || "Rapor e-postası gönderilemedi."}`);
    } finally {
      setIsSendingMail(false);
    }
  };

  // Apply filters to row list
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = !searchTerm ? true : (
        (r.workDone || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.responsible || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.activitySubject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.improvementSubject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.notes || "").toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesYear = selectedYear === "ALL" ? true : r.year.toString() === selectedYear;
      const matchesStatus = selectedStatus === "ALL" ? true : r.status === selectedStatus;
      const matchesResp = selectedResponsible === "ALL" ? true : r.responsible === selectedResponsible;

      // Expanded filters requested by user
      const matchesWeek = selectedWeekFilter === "ALL" ? true : r.visitedWeek === selectedWeekFilter;
      const matchesActivity = selectedActivityFilter === "ALL" ? true : r.activitySubject === selectedActivityFilter;
      const matchesImprovement = !selectedImprovementFilter ? true : (r.improvementSubject || "").toLowerCase().includes(selectedImprovementFilter.toLowerCase());
      const matchesOutput = !selectedOutputFilter ? true : (r.output || "").toLowerCase().includes(selectedOutputFilter.toLowerCase());
      const matchesCompliance = selectedComplianceFilter === "ALL" ? true : r.compliance === selectedComplianceFilter;

      // Date conversion helper
      const convertToISODate = (dateStr: string) => {
        if (!dateStr) return "";
        const parts = dateStr.split(".");
        if (parts.length !== 3) return "";
        const d = parts[0].padStart(2, "0");
        const m = parts[1].padStart(2, "0");
        const y = parts[2];
        return `${y}-${m}-${d}`;
      };

      let matchesWorkDate = true;
      if (selectedWorkDateStart || selectedWorkDateEnd) {
        const iso = convertToISODate(r.workDate);
        if (iso) {
          if (selectedWorkDateStart && iso < selectedWorkDateStart) matchesWorkDate = false;
          if (selectedWorkDateEnd && iso > selectedWorkDateEnd) matchesWorkDate = false;
        } else {
          matchesWorkDate = false;
        }
      }

      let matchesDueDate = true;
      if (selectedDueDateStart || selectedDueDateEnd) {
        const iso = convertToISODate(r.dueDate);
        if (iso) {
          if (selectedDueDateStart && iso < selectedDueDateStart) matchesDueDate = false;
          if (selectedDueDateEnd && iso > selectedDueDateEnd) matchesDueDate = false;
        } else {
          matchesDueDate = false;
        }
      }

      return matchesSearch && matchesYear && matchesStatus && matchesResp && matchesWeek && matchesActivity && matchesImprovement && matchesOutput && matchesCompliance && matchesWorkDate && matchesDueDate;
    });
  }, [
    records, 
    searchTerm, 
    selectedYear, 
    selectedStatus, 
    selectedResponsible,
    selectedWeekFilter,
    selectedWorkDateStart,
    selectedWorkDateEnd,
    selectedActivityFilter,
    selectedImprovementFilter,
    selectedOutputFilter,
    selectedDueDateStart,
    selectedDueDateEnd,
    selectedComplianceFilter
  ]);

  // Executive KPI Dashboard calculations (Row 1 & Row 2)
  const executiveKPIs = useMemo(() => {
    const total = filteredRecords.length;
    const open = filteredRecords.filter(r => r.status === "Açık").length;
    const inProgress = filteredRecords.filter(r => r.status === "Devam Ediyor").length;
    const completed = filteredRecords.filter(r => r.status === "Kapalı").length;
    const cancelled = filteredRecords.filter(r => EXCLUDED_STATUSES.includes(r.status)).length;

    // Devam Eden: Açık + Devam Ediyor
    const ongoing = open + inProgress;

    // Aksiyon Performansı: Kapalı / (Toplam - İptal) — iptal edilen işler ilerleme yüzdesine
    // dahil edilmez.
    const progressEligible = total - cancelled;
    const actionPerformance = progressEligible > 0 ? Math.round((completed / progressEligible) * 100) : 0;
    
    // Termine Uyum: Zamanında / Kapalı
    const completedOnTime = filteredRecords.filter(r => r.status === "Kapalı" && r.compliance === "ZAMANINDA").length;
    const complianceRate = completed > 0 ? Math.round((completedOnTime / completed) * 100) : 0;
    
    // Kaizen Kazancı: Sum of all verified completed improvement savings
    const savings = filteredRecords.reduce((sum, r) => {
      if (r.status === "Kapalı") {
        const val = parseFloat((r.kaizenSavings || r.savingsAmount || "0").toString().replace(/[^0-9.-]+/g, ""));
        return sum + (isNaN(val) ? 0 : val);
      }
      return sum;
    }, 0);
    
    // Ortalama Açık Kalma Süresi (Average project duration)
    let totalDays = 0;
    let countWithDates = 0;
    filteredRecords.forEach(r => {
      if (r.status === "Kapalı" && r.actualDate && r.workDate) {
        const actD = parseTurkishDate(r.actualDate);
        const workD = parseTurkishDate(r.workDate);
        if (actD && workD) {
          const diffTime = actD.getTime() - workD.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 180) { // filter out outliers/typos
            totalDays += diffDays;
            countWithDates++;
          }
        }
      }
    });
    const avgOpenDays = countWithDates > 0 ? Math.round(totalDays / countWithDates) : null;

    // Gecikmiş Aksiyon: henüz kapanmamış (Açık/Devam Ediyor) ve ziyaret tarihinden bu yana
    // 30 gün veya daha uzun süredir bekleyen aksiyon sayısı.
    const today = new Date();
    const staleOpenCount = filteredRecords.filter(r => {
      if (r.status !== "Açık" && r.status !== "Devam Ediyor") return false;
      const workD = parseTurkishDate(r.workDate);
      if (!workD) return false;
      const diffDays = Math.ceil((today.getTime() - workD.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 30;
    }).length;

    return {
      ongoing,
      open,
      completed,
      total,
      actionPerformance,
      complianceRate,
      savings,
      avgOpenDays,
      staleOpenCount
    };
  }, [filteredRecords]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* Dynamic Toast feedback panel */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[9999] bg-slate-900/95 backdrop-blur-md text-white font-semibold text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700/80 flex items-center space-x-2.5 outline-none animate-toast-in">
          <div className="w-2 h-2 rounded-full bg-emerald-450 animate-pulse" />
          <span>{toastMessage}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="hover:text-emerald-400 font-bold ml-1 text-[11px]"
          >
            [Kapat]
          </button>
        </div>
      )}
      
      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md shadow-slate-100">
            <FileSpreadsheet className="w-5 h-5 text-slate-100" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                OPEX PROJE TAKİP
              </span>
            </div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">
              Proje Takip Raporu & Aksiyon Kütüğü
            </h1>
          </div>
        </div>
      </div>

      {/* COMPACT INTERACTIVE BULK CSV IMPORT DRAWER */}
      {isImportOpen && (
        <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3.5 shadow-sm text-xs transition-all animate-down">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-extrabold text-slate-800 uppercase flex items-center">
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
              Saha Excel Dosyasından Toplu Veri Yapıştır (Semicolon ; Separated)
            </span>
            <button onClick={() => setIsImportOpen(false)} className="text-gray-400 hover:text-gray-650">Kapat X</button>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Excel ya da CSV dosyanızdaki sütunları kopyalayıp buraya yapıştırın. Formatın <b>Söz dizimi ; (Noktalı virgül) ayracı</b> ile ayrılmış olması gereklidir. Satır başlıkları otomatik olarak es geçilir.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full h-32 bg-slate-50 border border-gray-300 rounded-lg p-2.5 font-mono text-[10.5px] focus:ring-1 focus:ring-emerald-500"
            placeholder="Örn: 25;16.06.2026;A3;VERİMLİLİK ;OPERATÖR KONTROLLERİ;VERİMLİLİK;Gözde Tohumci;Açık;22.06.2026;;ZAMANINDA;A3;;;;;2026;1"
          />
          {importError && (
            <p className="text-red-600 font-bold">{importError}</p>
          )}
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsImportOpen(false)}
              className="px-3 py-1.5 border hover:bg-slate-50 font-bold rounded-lg cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              onClick={handleBulkImport}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
            >
              Verileri Ayrıştır ve Ekle
            </button>
          </div>
        </div>
      )}

      {/* UNRECOGNIZED IMPORT SUBJECTS VALIDATION MODAL */}
      {showImportValidationModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-900 uppercase flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Master Plan'da Bulunmayan Faaliyet Konuları</span>
              </h3>
              <button onClick={() => setShowImportValidationModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                İçeri aktarılan kayıtlardaki aşağıdaki <b>{unrecognizedImportSubjects.length}</b> faaliyet konusu Proje Master Planı'nda bulunamadı. Bunları Master Plan'a yeni faaliyet olarak eklemek ister misiniz? Eklenmezlerse kayıtlar içeri aktarılır ancak Master Plan ile eşleşmediği için "Gerçekleşen" verilerine yansımaz.
              </p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {unrecognizedImportSubjects.map((subject, idx) => (
                  <div key={idx} className="p-2 text-[11px] font-bold text-gray-700">{subject}</div>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end space-x-2">
              <button
                onClick={() => handleConfirmImportWithSync(false)}
                className="px-3 py-1.5 border hover:bg-slate-50 font-bold rounded-lg cursor-pointer"
              >
                Hayır, Sadece İçeri Aktar
              </button>
              <button
                onClick={() => handleConfirmImportWithSync(true)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
              >
                Evet, Master Plan'a Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LINK NEW ACTIVITY MODAL ("Diğer" option in Faaliyet Konusu dropdowns) */}
      {isOtherActivityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-900 uppercase flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Yeni Faaliyet Bağla</span>
              </h3>
              <button onClick={() => setIsOtherActivityModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Bu faaliyet konusu Proje Master Planı'nda henüz bulunmuyor. Aşağıya yazdığınız isimle Master Plan'a yeni bir faaliyet olarak eklenecek ve bu kayıt ona bağlanacaktır. Planlanan haftaları daha sonra Proje Master Planı'ndan revize edebilirsiniz.
              </p>
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[10px] block">Yeni Faaliyet Adı *</label>
                <input
                  type="text"
                  autoFocus
                  value={otherActivityForm.customSubject}
                  onChange={(e) => setOtherActivityForm({ ...otherActivityForm, customSubject: e.target.value })}
                  className="w-full p-2 border rounded bg-white text-slate-800 font-bold"
                  placeholder="Örn: Sevkiyat Alanı 5S Uygulaması"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end space-x-2">
              <button
                onClick={() => setIsOtherActivityModalOpen(false)}
                className="px-3 py-1.5 border hover:bg-slate-50 font-bold rounded-lg cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleConfirmOtherActivity}
                disabled={!otherActivityForm.customSubject.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg cursor-pointer"
              >
                Ekle ve Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABS NAVIGATION BAR (Power BI style) */}
      <div className="flex flex-wrap border-b border-gray-200 font-sans gap-2 mb-1.5 shrink-0 bg-slate-50 p-1.5 rounded-xl border">
        <button
          onClick={() => setActiveTab("table")}
          className={`py-2 px-4 rounded-lg font-black text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "table"
              ? "bg-slate-950 text-white shadow-sm font-black"
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-800 font-bold"
          }`}
        >
          <Table className="w-4 h-4" />
          <span>📊 Proje Takip Raporu</span>
        </button>
        <button
          onClick={() => setActiveTab("weekly")}
          className={`py-2 px-4 rounded-lg font-black text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "weekly"
              ? "bg-slate-950 text-white shadow-sm font-black"
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-800 font-bold"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📅 Haftalık OPEX Faaliyet Raporu</span>
        </button>
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`py-2 px-4 rounded-lg font-black text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "dashboard"
              ? "bg-slate-950 text-white shadow-sm font-black"
              : "text-slate-600 hover:bg-slate-200 hover:text-slate-800 font-bold"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📈 Yönetici KPI Dashboard (Power BI Görsel)</span>
        </button>
      </div>

      {/* FILTER CONTROLS GRID (Power BI Slicers style) - only relevant to the table/dashboard
          tabs; the weekly report tab is a fully automatic, unfiltered summary. */}
      {activeTab !== "weekly" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 text-xs font-sans shadow-xs">

          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Yapılan çalışmaları, sorumluları veya iyileştirme konularını anında süzün..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-2.5 font-bold text-[10px] text-slate-400 hover:text-slate-650 animate-fadeIn"
              >
                [Filtreyi Temizle]
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === "table" && (
        <>
          {/* MODERN EXECUTIVE KPI DASHBOARD */}
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Devam Eden Çalışmalar */}
              <div className="bg-white border border-amber-200 hover:border-amber-400 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4">
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                  <RefreshCw className="w-6 h-6 animate-spin-slow" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-amber-650 font-extrabold uppercase tracking-wider block">Devam Eden Çalışmalar</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.ongoing} <span className="text-xs text-slate-400 font-bold">Aksiyon</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Open Improvement Actions</span>
                </div>
              </div>

              {/* Card 2: Açık Projeler */}
              <div className="bg-white border border-rose-200 hover:border-rose-400 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-rose-650 font-extrabold uppercase tracking-wider block">Açık Projeler</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.open} <span className="text-xs text-slate-400 font-bold">Aksiyon</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Projects Waiting Completion</span>
                </div>
              </div>

              {/* Card 3: Tamamlanan Projeler */}
              <div className="bg-white border border-emerald-200 hover:border-emerald-400 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-emerald-650 font-extrabold uppercase tracking-wider block">Tamamlanan Projeler</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.completed} <span className="text-xs text-slate-400 font-bold">Aksiyon</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Closed Projects</span>
                </div>
              </div>

              {/* Card 4: Toplam Faaliyet */}
              <div className="bg-white border border-slate-200 hover:border-slate-450 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4">
                <div className="p-3 bg-slate-50 rounded-xl text-slate-600 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-650 font-extrabold uppercase tracking-wider block">Toplam Faaliyet</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.total} <span className="text-xs text-slate-400 font-bold">Kayıt</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Total Project Records</span>
                </div>
              </div>
            </div>

            {/* Row 2: Performance and Financial KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Card 5: Aksiyon Performansı */}
              <div className="bg-white border border-indigo-200 hover:border-indigo-450 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between h-[125px]">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
                    <Percent className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-indigo-650 font-extrabold uppercase tracking-wider block">Aksiyon Performansı</span>
                    <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                      %{executiveKPIs.actionPerformance}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                    <span className="font-medium">Kapalı/Toplam Aksiyon Oranı</span>
                    <span className="font-black font-mono">{executiveKPIs.completed}/{executiveKPIs.total}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${executiveKPIs.actionPerformance}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Card 6: Termine Uyum */}
              <div className="bg-white border border-teal-200 hover:border-teal-450 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between h-[125px]">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-teal-50 rounded-xl text-teal-600 shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-teal-650 font-extrabold uppercase tracking-wider block">Termine Uyum</span>
                    <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                      %{executiveKPIs.complianceRate}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
                    <span className="font-medium">Zamanında Kapanan / Kapalı</span>
                    <span className="font-black font-mono">Zamanında</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-teal-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${executiveKPIs.complianceRate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Card 7: Kaizen Kazancı */}
              <div className="bg-white border border-fuchsia-200 hover:border-fuchsia-450 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4 h-[125px]">
                <div className="p-3 bg-fuchsia-50 rounded-xl text-fuchsia-600 shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-fuchsia-650 font-extrabold uppercase tracking-wider block">Kaizen Kazancı (Savings)</span>
                  <div className="text-xl font-black text-slate-800 tracking-tight mt-0.5 font-sans truncate">
                    {currency} {executiveKPIs.savings.toLocaleString("tr-TR")}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Verified Improvement Savings</span>
                </div>
              </div>

              {/* Card 8: Ortalama Açık Kalma Süresi */}
              <div className="bg-white border border-sky-200 hover:border-sky-450 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4 h-[125px]">
                <div className="p-3 bg-sky-50 rounded-xl text-sky-600 shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-sky-650 font-extrabold uppercase tracking-wider block">Ort. Açık Kalma Süresi</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.avgOpenDays !== null ? (
                      <>{executiveKPIs.avgOpenDays} <span className="text-xs text-slate-400 font-bold">Gün</span></>
                    ) : (
                      <span className="text-base text-slate-400">Veri yok</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Average Project Lead Time</span>
                </div>
              </div>

              {/* Card 9: Gecikmiş Aksiyon (30+ gün açık bekleyen) */}
              <div className="bg-white border border-rose-200 hover:border-rose-450 rounded-2xl p-5 shadow-xs transition-all flex items-center space-x-4 h-[125px]">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-rose-650 font-extrabold uppercase tracking-wider block">Gecikmiş Aksiyon</span>
                  <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5 font-sans">
                    {executiveKPIs.staleOpenCount}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">30+ Gündür Açık Bekleyen</span>
                </div>
              </div>
            </div>
          </div>



      <div className={isTableFullScreen ? "fixed inset-0 z-[999] bg-slate-100 p-6 flex flex-col overflow-y-auto space-y-4" : "space-y-4 mt-6"}>
        {isTableFullScreen && (
          <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shrink-0 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Table className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-xs uppercase tracking-wider block">Geniş Ekran Çalışma Alanı</span>
                <span className="text-[10px] text-slate-300">Aksiyon kütüğünü geniş ekranda inceleyin, yeni aksiyonlar yazın ve hücreleri düzenleyin.</span>
              </div>
            </div>
            <button
              onClick={() => setIsTableFullScreen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition border border-slate-700"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Normal Ekrana Dön</span>
            </button>
          </div>
        )}

      {/* QUICK ADD NEW ITEM ROW FORM */}
      {isAddingNew && (
        <div className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-xl space-y-3.5 text-xs font-sans">
          <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
            <span className="font-extrabold text-emerald-950 uppercase flex items-center">
              <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-700" />
              Proje Takip Kütüğüne Yeni Satır Ekle
            </span>
            <button onClick={() => setIsAddingNew(false)} className="text-gray-400 hover:text-gray-650">Kapat X</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Çalışma Tarihi:</label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-white text-slate-800 font-bold"
                placeholder="Örn: 16.06.2026"
                value={newItem.workDate || ""}
                onChange={(e) => handleWorkDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px] block">Oto Hesaplanan Hafta / Sene:</label>
              <div className="p-2 border rounded bg-slate-100 text-slate-700 font-black text-xs h-[38px] flex items-center">
                <span>Hafta {newItem.visitedWeek || "-"} / Sene {newItem.year || "-"}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Faaliyet Konusu:</label>
              <select
                className="w-full p-2 border rounded bg-white text-slate-800 font-black"
                value={newItem.activitySubject || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "DIĞER") {
                    setOtherActivityTriggerContext("new");
                    setOtherActivityForm({ customSubject: "" });
                    setIsOtherActivityModalOpen(true);
                  } else {
                    setNewItem({ ...newItem, activitySubject: val });
                  }
                }}
              >
                <option value="">Seçiniz...</option>
                {ganttActivityNames.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
                <option value="DIĞER" className="font-extrabold text-blue-600">✨ Diğer (Yeni Faaliyet Bağla)...</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Yalın İyileştirme Konusu:</label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-white text-slate-800 font-semibold"
                placeholder="Örn: VERİMLİLİK, GÜVENLİK..."
                value={newItem.improvementSubject || ""}
                onChange={(e) => setNewItem({ ...newItem, improvementSubject: e.target.value })}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Yapılan Çalışmalar / Alınan Kararlar:</label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-white text-slate-800 font-medium"
                placeholder="Yapılan somut çalışma adımları silsilesini buraya tanımlayın..."
                value={newItem.workDone || ""}
                onChange={(e) => setNewItem({ ...newItem, workDone: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Sorumlu Mühendis / Lider:</label>
              <select
                className="w-full p-2 border rounded bg-white text-slate-800 font-bold"
                value={newItem.responsible || ""}
                onChange={(e) => setNewItem({ ...newItem, responsible: e.target.value })}
              >
                <option value="">Seçiniz...</option>
                {workspaceTeamMembers.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Takip Durumu:</label>
              <select
                className="w-full p-2 border rounded bg-white text-slate-800 font-extrabold"
                value={newItem.status}
                onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
              >
                <option value="Açık">Açık</option>
                <option value="Devam Ediyor">Devam Ediyor</option>
                <option value="Kapalı">Kapalı</option>
                <option value="İptal">İptal</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Hedef Termin Tarihi:</label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-white text-slate-800 font-semibold"
                placeholder="Örn: 22.06.2026"
                value={newItem.dueDate || ""}
                onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Termine Uyum:</label>
              <select
                className="w-full p-2 border rounded bg-white text-slate-800 font-extrabold"
                value={newItem.compliance}
                onChange={(e) => setNewItem({ ...newItem, compliance: e.target.value })}
              >
                <option value="ZAMANINDA">ZAMANINDA</option>
                <option value="GECİKME">GECİKME</option>
              </select>
            </div>

            <div className="md:col-span-1 space-y-1">
              <label className="font-extrabold text-slate-500 uppercase text-[11px]">Notlar / Detaylar:</label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-white text-slate-800 font-medium"
                placeholder="İlgili aksiyon planı notları..."
                value={newItem.notes || ""}
                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              />
            </div>

            <div className="md:col-span-1 space-y-1">
              <label className="font-extrabold text-emerald-800 uppercase text-[11px] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Kaizen Finansal Kazancı (₺):
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded bg-emerald-50 text-emerald-950 font-black focus:ring-1 focus:ring-emerald-500"
                placeholder="Örn: 150000 (Sadece sayı)"
                value={newItem.kaizenSavings || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewItem({ ...newItem, kaizenSavings: val, savingsAmount: val });
                }}
              />
            </div>

          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              onClick={() => setIsAddingNew(false)}
              className="px-3.5 py-2 border hover:bg-slate-50 font-extrabold rounded-lg cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              onClick={handleAttemptAddNewRecord}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg cursor-pointer"
            >
              Yeni Satır Olarak Ekle
            </button>
          </div>
        </div>
      )}

      {/* HAFTA ATLAMA UYARISI: son kayıtlı hafta ile yeni girilen hafta arasında boşluk varsa,
          danışmana atlanan her hafta için ne olduğunu sorar. */}
      {pendingGapWeeks && pendingGapWeeks.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-slate-800">Hafta Atlama Tespit Edildi</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  Son kayıtlı haftadan bu yana {pendingGapWeeks.length === 1 ? `${pendingGapWeeks[0]}. hafta` : `${pendingGapWeeks.join(", ")}. haftalar`} için hiç kayıt girilmemiş.
                  Devam etmeden önce bu hafta(lar)da ne olduğunu belirtin.
                </p>
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {pendingGapWeeks.map((w) => (
                <div key={w} className="border rounded-lg p-3 bg-slate-50">
                  <label className="text-[11px] font-black uppercase text-slate-500 block mb-1.5">{w}. Hafta</label>
                  <select
                    value={gapReasons[w] || GAP_REASON_OPTIONS[0]}
                    onChange={(e) => setGapReasons({ ...gapReasons, [w]: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold text-xs"
                  >
                    {GAP_REASON_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold">
              "Sadece kontrol ziyareti yapıldı" seçilen haftalar Açık olarak, diğer nedenler proje ilerlemesine dahil edilmeyecek şekilde "İptal" olarak kaydedilir.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                onClick={handleSkipGapCheck}
                className="px-3.5 py-2 border hover:bg-slate-50 font-extrabold rounded-lg cursor-pointer text-xs"
              >
                Atla, Not Ekleme
              </button>
              <button
                onClick={handleConfirmGapReasons}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg cursor-pointer text-xs"
              >
                Notları Kaydet ve Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL FIELD EXCEL-STYLE INTERACTIVE SPREADSHEET TABLE */}
      <div className="bg-white border rounded-xl shadow-xs overflow-hidden">
        
        {/* Table info */}
        <div className="bg-slate-50 border-b border-gray-200 p-3 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-extrabold text-slate-700 uppercase tracking-tight font-sans">
              Proje Aksiyon Listesi ({filteredRecords.length} Satır Gösteriliyor) {isTableFullScreen && " - GENİŞ GÖRÜNÜM"}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {/* Minimal Control Icons Bar */}
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1 shadow-2xs space-x-1 shrink-0">
              
              {/* Filtreleme İkonu */}
              <button
                onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                className={`p-1.5 rounded-md cursor-pointer transition-all ${
                  isFilterPanelOpen || selectedYear !== "ALL" || selectedStatus !== "ALL" || selectedResponsible !== "ALL"
                    ? "bg-blue-50 text-blue-700 font-black border border-blue-300"
                    : "text-slate-600 hover:text-blue-700 hover:bg-slate-100"
                }`}
                title="Sorumlu, Durum ve Sene Süzgeçlerini Aç/Kapat"
              >
                <Filter className="w-4 h-4" />
              </button>

              {/* Yeni Satır Ekle Dosya İkonu */}
              <button
                onClick={() => {
                  setIsAddingNew(true);
                  window.scrollTo({ top: 400, behavior: "smooth" });
                }}
                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md cursor-pointer transition-all"
                title="Yeni Aksiyon Satırı Ekle (Dosya İkonu)"
              >
                <FilePlus className="w-4 h-4 text-emerald-600" />
              </button>

              {/* Excel Veri Yükleme İkonu */}
              <button
                onClick={() => setIsImportOpen(!isImportOpen)}
                className={`p-1.5 rounded-md cursor-pointer transition-all ${
                  isImportOpen 
                    ? "bg-sky-50 text-sky-700 border border-sky-300" 
                    : "text-slate-600 hover:text-sky-700 hover:bg-slate-100"
                }`}
                title="Excel Veri Yükleme (CSV Yükle)"
              >
                <Upload className="w-4 h-4 text-sky-600" />
              </button>

              {/* Excel İndirme İkonu — firma rapor şablonu (native Dashboard/Pivot/Charts korunur) */}
              <button
                onClick={handleDownloadTemplateExcel}
                disabled={isDownloadingTemplate}
                className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-100 rounded-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-wait"
                title="Excel İndir (firma rapor şablonu, Dashboard/Pivot dahil)"
              >
                <Download className="w-4 h-4 text-indigo-600" />
              </button>

              {/* Mail Gönder İkonu */}
              <div className="relative">
                <button
                  onClick={() => (showMailPanel ? setShowMailPanel(false) : handleOpenMailPanel())}
                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md cursor-pointer transition-all"
                  title="Haftalık Ziyaret Raporunu Müşteriye Mail Olarak Gönder"
                >
                  <Mail className="w-4 h-4 text-emerald-600" />
                </button>
                {showMailPanel && (
                  <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-3 space-y-2.5">
                    <p className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">
                      Haftalık Ziyaret Raporunu Gönder
                    </p>
                    <p className="text-[10px] text-slate-500 leading-snug">
                      proje@gembapartner.com adresinden, şablon Excel raporu ek olarak, aşağıdaki alıcıya gönderilecek.
                    </p>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Hafta</label>
                      <select
                        value={activeReportWeek}
                        onChange={(e) => setSelectedReportWeek(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-slate-50 text-slate-800 font-bold text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {availableWeeks.map((wk) => (
                          <option key={wk} value={wk}>Hafta {wk}</option>
                        ))}
                      </select>
                    </div>
                    {mailRecipientOptions.length > 0 && (
                      <select
                        value={mailRecipientOptions.some(o => o.email === mailRecipient) ? mailRecipient : ""}
                        onChange={(e) => e.target.value && setMailRecipient(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg bg-slate-50 text-slate-800 font-bold text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      >
                        {mailRecipientOptions.map(o => (
                          <option key={o.email} value={o.email}>{o.label}</option>
                        ))}
                        <option value="">Diğer (aşağıya yazın)...</option>
                      </select>
                    )}
                    <input
                      type="email"
                      value={mailRecipient}
                      onChange={(e) => setMailRecipient(e.target.value)}
                      placeholder="ornek@musteri.com"
                      className="w-full p-2 border border-gray-200 rounded-lg bg-white text-slate-800 font-bold text-[11px] focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={() => setShowMailPanel(false)}
                        className="p-1 px-2.5 text-slate-500 hover:text-slate-700 font-extrabold rounded-lg text-[10px] cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        onClick={handleSendWeeklyReportMail}
                        disabled={isSendingMail}
                        className="p-1 px-3 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold rounded-lg flex items-center space-x-1 cursor-pointer text-[10px] disabled:opacity-50 disabled:cursor-wait"
                      >
                        <Mail className="w-3 h-3" />
                        <span>{isSendingMail ? "Gönderiliyor..." : "Gönder"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsTableFullScreen(!isTableFullScreen)}
              className="p-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg transition cursor-pointer shadow-xs"
              title={isTableFullScreen ? "Normal Ekrana Dön" : "Geniş Ekrana Geç"}
            >
              {isTableFullScreen ? <Minimize2 className="w-3.5 h-3.5 text-blue-600 animate-pulse" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Row */}
        {isFilterPanelOpen && (
          <div className="bg-slate-100 border-b border-gray-200 p-4 space-y-4 text-xs font-sans animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {/* Year selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Yıl (Sene):</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tüm Seneler (Hepsi)</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                </select>
              </div>

              {/* Hafta selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Hafta (Ziyaret):</label>
                <select
                  value={selectedWeekFilter}
                  onChange={(e) => setSelectedWeekFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tüm Haftalar</option>
                  {availableWeeks.map((wk, idx) => (
                    <option key={idx} value={wk}>Hafta {wk}</option>
                  ))}
                </select>
              </div>

              {/* Çalışma Tarih Aralığı */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Çalışma Tarih Aralığı:</label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="date"
                    value={selectedWorkDateStart}
                    onChange={(e) => setSelectedWorkDateStart(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 font-black">-</span>
                  <input
                    type="date"
                    value={selectedWorkDateEnd}
                    onChange={(e) => setSelectedWorkDateEnd(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Faaliyet Konusu selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Faaliyet Konusu:</label>
                <select
                  value={selectedActivityFilter}
                  onChange={(e) => setSelectedActivityFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tüm Faaliyetler</option>
                  {ganttActivityNames.map((name, idx) => (
                    <option key={idx} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* İyileştirme Konusu search input */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">İyileştirme Konusu (Arama):</label>
                <input
                  type="text"
                  placeholder="Yalın konu ara..."
                  value={selectedImprovementFilter}
                  onChange={(e) => setSelectedImprovementFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Çıktı search input */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Çıktı / Standart (Arama):</label>
                <input
                  type="text"
                  placeholder="Çıktı ara..."
                  value={selectedOutputFilter}
                  onChange={(e) => setSelectedOutputFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Sorumlu selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Sorumlu Mühendis:</label>
                <select
                  value={selectedResponsible}
                  onChange={(e) => setSelectedResponsible(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Herkes (Tüm Sorumlular)</option>
                  {uniqueResponsibles.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Takip Durumu (Status) selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Takip Durumu:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tüm Durumlar</option>
                  <option value="Açık">Açık</option>
                  <option value="Devam Ediyor">Devam Ediyor</option>
                  <option value="Kapalı">Kapalı</option>
                  <option value="İptal">İptal</option>
                </select>
              </div>

              {/* Termin Tarih Aralığı */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Termin Tarih Aralığı:</label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="date"
                    value={selectedDueDateStart}
                    onChange={(e) => setSelectedDueDateStart(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 font-black">-</span>
                  <input
                    type="date"
                    value={selectedDueDateEnd}
                    onChange={(e) => setSelectedDueDateEnd(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Termine Uyum selector */}
              <div className="space-y-1">
                <label className="font-extrabold text-slate-500 uppercase text-[11px] tracking-wider block">Termine Uyum:</label>
                <select
                  value={selectedComplianceFilter}
                  onChange={(e) => setSelectedComplianceFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">Tüm Uyumlar (Tümü)</option>
                  <option value="ZAMANINDA">ZAMANINDA</option>
                  <option value="GECİKME">GECİKME</option>
                </select>
              </div>
            </div>

            {/* Reset button & info */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium">
                * Filtreleme sonuçları dinamik olarak KPI özet kartlarına ve performans göstergelerine yansır.
              </span>
              {(selectedYear !== "ALL" || selectedStatus !== "ALL" || selectedResponsible !== "ALL" || selectedWeekFilter !== "ALL" || selectedWorkDateStart || selectedWorkDateEnd || selectedActivityFilter !== "ALL" || selectedImprovementFilter || selectedOutputFilter || selectedDueDateStart || selectedDueDateEnd || selectedComplianceFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSelectedYear("ALL");
                    setSelectedStatus("ALL");
                    setSelectedResponsible("ALL");
                    setSelectedWeekFilter("ALL");
                    setSelectedWorkDateStart("");
                    setSelectedWorkDateEnd("");
                    setSelectedActivityFilter("ALL");
                    setSelectedImprovementFilter("");
                    setSelectedOutputFilter("");
                    setSelectedDueDateStart("");
                    setSelectedDueDateEnd("");
                    setSelectedComplianceFilter("ALL");
                    showToast("Tüm gelişmiş süzgeçler sıfırlandı!");
                  }}
                  className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black rounded-lg cursor-pointer text-[10.5px] transition-all"
                >
                  Tüm Süzgeçleri Sıfırla
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scroll wrapper */}
        <div className={`overflow-x-auto overflow-y-auto ${isTableFullScreen ? "max-h-[calc(100vh-220px)]" : "max-h-[600px]"}`}>
          <table className="w-full text-[11px] font-sans text-left border-collapse select-text">
            
            {/* Excel Row Sütun Harfleri Başlığı (A, B, C, D...) */}
            <thead className="bg-gray-100 text-slate-400 font-mono text-[11px] text-center border-b sticky top-0 z-20">
              <tr>
                <th className="p-1.5 border-r border-b bg-gray-200">#</th>
                <th className="p-1 px-2 border-r border-b">A</th>
                <th className="p-1 px-2 border-r border-b">B</th>
                <th className="p-1 px-2 border-r border-b">C</th>
                <th className="p-1 px-2 border-r border-b">D</th>
                <th className="p-1 px-2 border-r border-b">E</th>
                <th className="p-1 px-2 border-r border-b">F</th>
                <th className="p-1 px-2 border-r border-b">G</th>
                <th className="p-1 px-2 border-r border-b text-center">H</th>
                <th className="p-1 px-2 border-r border-b">I</th>
                <th className="p-1 px-2 border-r border-b text-center">J</th>
                <th className="p-1 px-2 border-r border-b">K</th>
                <th className="p-1 px-2 border-r border-b text-center">L</th>
                <th className="p-1 px-2 border-b text-center min-w-[90px]">İşlemler</th>
              </tr>
            </thead>

            {/* Excel Column Headers */}
            <thead className="bg-[#fcfdfd] text-slate-900 border-b border-gray-200 sticky top-[21px] z-10 shadow-xs font-black">
              <tr>
                <th className="p-2.5 border-r border-gray-200 text-center bg-gray-50 text-[10px] font-mono font-bold">Sıra</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[70px]">Hafta</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[90px]">Çalışma Tarihi</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[110px]">Faaliyet Konusu</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[125px]">İyileştirme Konusu</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[320px]">Yapılan Çalışmalar / Alınan Kararlar</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[95px]">Çıktı</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[120px]">Sorumlu</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[125px] text-center">Takip Durumu</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[95px]">Termin</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[125px] text-center">Termine Uyum</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[140px]">Notlar</th>
                <th className="p-2.5 border-r border-gray-200 min-w-[120px] text-center bg-emerald-50 text-emerald-950">Kaizen Kazancı (₺)</th>
                <th className="p-2.5 text-center bg-gray-50 uppercase tracking-widest text-[10px]">Kontrol</th>
              </tr>
            </thead>

            {/* List Body */}
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRecords.map((item, idx) => {
                const isEditing = editingRowId === item.id;
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Row Index Indicator (Excel Row Number) */}
                    <td className="p-2 border-r border-gray-200 text-center bg-gray-100/70 font-mono text-slate-500 text-[10px] font-bold">
                      {idx + 1}
                    </td>

                    {/* Visited week */}
                    <td className="p-2 border-r border-gray-200 font-mono">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border font-bold"
                          value={editForm.visitedWeek || ""}
                          onChange={(e) => setEditForm({...editForm, visitedWeek: e.target.value})}
                        />
                      ) : (
                        <span>{item.visitedWeek}</span>
                      )}
                    </td>

                    {/* Study Date */}
                    <td className="p-2 border-r border-gray-200">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border"
                          value={editForm.workDate || ""}
                          onChange={(e) => setEditForm({...editForm, workDate: e.target.value})}
                        />
                      ) : (
                        item.workDate
                      )}
                    </td>

                    {/* Activity topic */}
                    <td className="p-2 border-r border-gray-200">
                      {isEditing ? (
                        <select
                          className="w-full p-1 border font-black text-emerald-800 bg-white"
                          value={editForm.activitySubject || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "DIĞER") {
                              setOtherActivityTriggerContext("edit");
                              setOtherActivityForm({ customSubject: "" });
                              setIsOtherActivityModalOpen(true);
                            } else {
                              setEditForm({ ...editForm, activitySubject: val });
                            }
                          }}
                        >
                          <option value="">Seçiniz...</option>
                          {ganttActivityNames.map((name, idx) => (
                            <option key={idx} value={name}>{name}</option>
                          ))}
                          <option value="DIĞER" className="font-extrabold text-blue-600">✨ Diğer (Yeni Faaliyet Bağla)...</option>
                        </select>
                      ) : (
                        <span className="font-extrabold text-emerald-800">{item.activitySubject}</span>
                      )}
                    </td>

                    {/* Improvement topic */}
                    <td className="p-2 border-r border-gray-200">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border font-semibold"
                          value={editForm.improvementSubject || ""}
                          onChange={(e) => setEditForm({...editForm, improvementSubject: e.target.value})}
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{item.improvementSubject}</span>
                      )}
                    </td>

                    {/* Work done done / Decisions taken */}
                    <td className="p-2 border-r border-gray-200 text-slate-800 font-medium">
                      {isEditing ? (
                        <textarea
                          className="w-full p-1 border text-[11px]"
                          value={editForm.workDone || ""}
                          onChange={(e) => setEditForm({...editForm, workDone: e.target.value})}
                        />
                      ) : (
                        item.workDone
                      )}
                    </td>

                    {/* Output */}
                    <td className="p-2 border-r border-gray-200 text-slate-500">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border"
                          value={editForm.output || ""}
                          onChange={(e) => setEditForm({...editForm, output: e.target.value})}
                        />
                      ) : (
                        item.output
                      )}
                    </td>

                    {/* Responsible */}
                    <td className="p-2 border-r border-gray-200 font-bold text-slate-900">
                      {isEditing ? (
                        <select
                          className="w-full p-1 border font-bold text-slate-800 bg-white"
                          value={editForm.responsible || ""}
                          onChange={(e) => setEditForm({ ...editForm, responsible: e.target.value })}
                        >
                          <option value="">Seçiniz...</option>
                          {workspaceTeamMembers.map((name, idx) => (
                            <option key={idx} value={name}>{name}</option>
                          ))}
                        </select>
                      ) : (
                        item.responsible
                      )}
                    </td>

                    {/* Status selection interactive dropdown */}
                    <td className="p-2 border-r border-gray-200 text-center">
                      {isEditing ? (
                        <select
                          className="p-1 border text-[11px] font-bold"
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        >
                          <option value="Açık">Açık</option>
                          <option value="Devam Ediyor">Devam Ediyor</option>
                          <option value="Kapalı">Kapalı</option>
                          <option value="İptal">İptal</option>
                        </select>
                      ) : (
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                          className={`p-1.5 rounded-md text-[10px] font-black border uppercase text-center focus:outline-none cursor-pointer ${
                            item.status === "Kapalı"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                              : item.status === "Devam Ediyor"
                              ? "bg-sky-50 border-sky-300 text-sky-800"
                              : EXCLUDED_STATUSES.includes(item.status)
                              ? "bg-slate-100 border-slate-300 text-slate-500"
                              : "bg-amber-50 border-amber-300 text-amber-800"
                          }`}
                        >
                          <option value="Açık">AÇIK</option>
                          <option value="Devam Ediyor">DEVAM EDİYOR</option>
                          <option value="Kapalı">KAPALI</option>
                          <option value="İptal">İPTAL</option>
                        </select>
                      )}
                    </td>

                    {/* Target Date */}
                    <td className="p-2 border-r border-gray-200">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border font-semibold text-slate-700"
                          value={editForm.dueDate || ""}
                          onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})}
                        />
                      ) : (
                        <span className="font-semibold text-slate-600">{item.dueDate}</span>
                      )}
                    </td>

                    {/* Due compliance dropdown */}
                    <td className="p-2 border-r border-gray-200 text-center">
                      {isEditing ? (
                        <select
                          className="p-1 border text-[11px] font-bold"
                          value={editForm.compliance}
                          onChange={(e) => setEditForm({...editForm, compliance: e.target.value})}
                        >
                          <option value="ZAMANINDA">ZAMANINDA</option>
                          <option value="GECİKME">GECİKME</option>
                        </select>
                      ) : (
                        <select
                          value={item.compliance}
                          onChange={(e) => handleUpdateCompliance(item.id, e.target.value)}
                          className={`p-1 rounded-md text-[11px] font-black uppercase text-center focus:outline-none cursor-pointer ${
                            item.compliance === "ZAMANINDA" 
                              ? "bg-teal-50 text-teal-800" 
                              : "bg-red-50 text-red-800"
                          }`}
                        >
                          <option value="ZAMANINDA">ZAMANINDA</option>
                          <option value="GECİKME">GECİKME</option>
                        </select>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="p-2 border-r border-gray-200 text-slate-500">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border"
                          value={editForm.notes || ""}
                          onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        />
                      ) : (
                        item.notes
                      )}
                    </td>

                    {/* Kaizen Savings Column L */}
                    <td className="p-2 border-r border-gray-200 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1 border text-center font-bold text-emerald-800 bg-emerald-50/50 rounded focus:ring-1 focus:ring-emerald-500"
                          placeholder="Örn: 150000"
                          value={editForm.kaizenSavings || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditForm({
                              ...editForm,
                              kaizenSavings: val,
                              savingsAmount: val
                            });
                          }}
                        />
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-black text-[10px] inline-block">
                          {item.kaizenSavings || item.savingsAmount ? `₺${parseFloat((item.kaizenSavings || item.savingsAmount || "0").toString().replace(/[^0-9.-]+/g, "")).toLocaleString("tr-TR")}` : "-"}
                        </span>
                      )}
                    </td>

                    {/* Operation Action controls */}
                    <td className="p-2 text-center bg-gray-50/50">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleToggleFlag(item.id)}
                          className={`p-1 rounded cursor-pointer transition-colors ${
                            item.flagged
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                              : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                          }`}
                          title={item.flagged ? "Takipten Kaldır" : "Takibe Al (Kritik İşaretle)"}
                        >
                          <Flag className="w-3.5 h-3.5" fill={item.flagged ? "currentColor" : "none"} />
                        </button>
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded cursor-pointer"
                              title="Kaydet"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingRowId(null)}
                              className="p-1 hover:bg-red-50 text-red-700 border border-red-300 rounded cursor-pointer"
                              title="Vazgeç"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenCIWizard(item)}
                              className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded cursor-pointer transition-colors"
                              title="CI Proje Kartına Aktar (Kanban P Adımı)"
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1 text-slate-650 hover:text-emerald-700 rounded hover:bg-slate-200 cursor-pointer"
                              title="Satırı Düzenle"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(item.id)}
                              className="p-1 text-slate-450 hover:text-red-700 rounded hover:bg-red-50 cursor-pointer"
                              title="Satırı Temizle"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={14} className="p-10 text-center text-gray-500 font-sans">
                    Arama kriterlerinize uyan kayıt bulunamadı. Lütfen süzgeçlerinizi gevşetip tekrar deneyin.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>

        {/* Footer with summary information count */}
        <div className="bg-slate-50 border-t border-gray-200 p-3.5 text-xs text-slate-500 font-bold flex justify-between items-center flex-col sm:flex-row gap-2">
          <span>Toplam kütükte {records.length} aksiyon kaydı bulunmaktadır.</span>
          <span className="font-mono bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md">
            Devam Eden: {records.filter(r => r.status === "Devam Ediyor").length} • Açık: {records.filter(r => r.status === "Açık").length} • Kapalı: {records.filter(r => r.status === "Kapalı").length}
          </span>
        </div>

      </div>
      </div>
      </>
      )}

      {activeTab === "weekly" && (() => {
        // Fully automatic — no manual week picker. "Geçen hafta" is always today's ISO week
        // number minus 1 (wrapping to ~week 52 of the prior year at a year boundary).
        const todayWeekInfo = getWeekAndYearFromDateString(new Date().toLocaleDateString("tr-TR"));
        let prevWeekNum: number | null = null;
        let prevYear: number | null = null;
        if (todayWeekInfo) {
          prevWeekNum = parseInt(todayWeekInfo.week, 10) - 1;
          prevYear = todayWeekInfo.year;
          if (prevWeekNum < 1) {
            prevWeekNum = 52;
            prevYear = prevYear - 1;
          }
        }

        const lastWeekActivities = prevWeekNum !== null
          ? records.filter(r => parseInt(r.visitedWeek, 10) === prevWeekNum && r.year === prevYear)
          : [];

        // Reminder list: still open/in-progress actions whose visit date is 30+ days in the past.
        const today = new Date();
        const staleActions = records
          .filter(r => r.status === "Açık" || r.status === "Devam Ediyor")
          .map(r => {
            const workD = parseTurkishDate(r.workDate);
            const daysOpen = workD ? Math.floor((today.getTime() - workD.getTime()) / (1000 * 60 * 60 * 24)) : null;
            return { record: r, daysOpen };
          })
          .filter((x): x is { record: ProjectRecord; daysOpen: number } => x.daysOpen !== null && x.daysOpen >= 30)
          .sort((a, b) => b.daysOpen - a.daysOpen);

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Geçen Hafta Yapılan Çalışmalar — auto-generated, no manual entry */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center space-x-2 border-b pb-3 mb-4">
                <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-800">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    Geçen Hafta Yapılan Çalışmalar{prevWeekNum !== null ? ` (Hafta ${prevWeekNum})` : ""}
                  </h3>
                  <p className="text-[10px] text-slate-500">Bir önceki haftanın saha kayıtlarından otomatik olarak oluşturulmuştur.</p>
                </div>
              </div>

              {lastWeekActivities.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  Geçen hafta için kayıtlı saha aksiyonu bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lastWeekActivities.map(act => (
                    <div key={act.id} className="border border-slate-150 rounded-xl p-3.5 bg-slate-50/50">
                      <p className="text-xs font-bold text-slate-800 leading-relaxed">{act.workDone || act.improvementSubject}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10.5px] text-slate-500 font-semibold">
                        <span>Aksiyon Sorumlusu: <span className="text-slate-800 font-black">{act.responsible || "—"}</span></span>
                        <span>Termin Tarihi: <span className="text-slate-800 font-black">{act.dueDate || "Belirtilmemiş"}</span></span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-black uppercase ${
                          act.status === "Kapalı" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : act.status === "Devam Ediyor" ? "bg-sky-50 text-sky-700 border-sky-100"
                          : EXCLUDED_STATUSES.includes(act.status) ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {act.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 30+ Gündür Kapanmayan Aksiyonlar — reminder list */}
            <div className="bg-white border border-rose-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-rose-100 pb-3 mb-4">
                <div className="p-1.5 bg-rose-50 rounded-xl text-rose-700">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    30+ Gündür Kapanmayan Aksiyonlar ({staleActions.length})
                  </h3>
                  <p className="text-[10px] text-slate-500">Ziyaret tarihinden bu yana 30 gün veya daha uzun süredir açık/devam eden aksiyonların hatırlatma listesi.</p>
                </div>
              </div>

              {staleActions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">
                  30 günü aşan gecikmiş aksiyon bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {staleActions.map(({ record: act, daysOpen }) => (
                    <div key={act.id} className="border border-rose-100 rounded-xl p-3.5 bg-rose-50/40 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">{act.workDone || act.improvementSubject}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10.5px] text-slate-500 font-semibold">
                          <span>Aksiyon Sorumlusu: <span className="text-slate-800 font-black">{act.responsible || "—"}</span></span>
                          <span>Termin Tarihi: <span className="text-slate-800 font-black">{act.dueDate || "Belirtilmemiş"}</span></span>
                        </div>
                      </div>
                      <span className="shrink-0 bg-rose-600 text-white text-[10.5px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                        {daysOpen} Gündür Açık
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {activeTab === "dashboard" && (
        <OpexProjectDashboard
          records={records}
          activities={activities || []}
          kaizens={kaizens || []}
          selectedCustomer={selectedCustomer}
          currentUser={currentUser}
        />
      )}

      {/* CI PROJECT CONVERSION MODAL */}
      {isCIModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 overflow-y-auto animate-fadeIn animate-duration-200" id="ci-conversion-modal">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 p-5 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base uppercase tracking-wider">CI Proje Kartı Tanımlama Formu</h3>
                  <p className="text-xs text-emerald-100 font-medium">Bu aksiyonu sürekli iyileştirme Kanban Panosu Planlandı (P) adımına aktarın</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCIModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition cursor-pointer"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Kaynak OPEX Aksiyon Bilgileri</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  <div><strong>Faaliyet Konusu:</strong> {sourceActionRecord?.activitySubject}</div>
                  <div><strong>İyileştirme Konusu:</strong> {sourceActionRecord?.improvementSubject}</div>
                  <div className="sm:col-span-2 mt-1"><strong>Saha Aksiyonu:</strong> {sourceActionRecord?.workDone}</div>
                  {sourceActionRecord?.responsible && <div><strong>Sorumlu:</strong> {sourceActionRecord?.responsible}</div>}
                  {sourceActionRecord?.dueDate && <div><strong>Termin:</strong> {sourceActionRecord?.dueDate}</div>}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-800">
                
                {/* Project Title */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Proje Adı / Başlığı <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-semibold text-slate-800 bg-white"
                    value={ciCardForm.title}
                    onChange={(e) => setCiCardForm({...ciCardForm, title: e.target.value})}
                  />
                </div>

                {/* Originator / Leader */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Proje Sahibi / Lideri</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.originator}
                    onChange={(e) => setCiCardForm({...ciCardForm, originator: e.target.value})}
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Bölüm / Departman</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.department}
                    onChange={(e) => setCiCardForm({...ciCardForm, department: e.target.value})}
                  />
                </div>

                {/* Date Proposed & Impact Level */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Öneri Tarihi</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.dateProposed}
                    onChange={(e) => setCiCardForm({...ciCardForm, dateProposed: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Etki Derecesi (Impact Level)</label>
                  <select
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.impactLevel}
                    onChange={(e) => setCiCardForm({...ciCardForm, impactLevel: e.target.value as any})}
                  >
                    <option value="High">Yüksek (High)</option>
                    <option value="Medium">Orta (Medium)</option>
                    <option value="Low">Düşük (Low)</option>
                  </select>
                </div>

                {/* Problem Definition */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Problem Tanımı / Mevcut Durum (Önceki)</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.problemDefinition}
                    onChange={(e) => setCiCardForm({...ciCardForm, problemDefinition: e.target.value})}
                  />
                </div>

                {/* Target Objective */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Hedeflenen Durum / Çözüm (Sonraki)</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.targetObjective}
                    onChange={(e) => setCiCardForm({...ciCardForm, targetObjective: e.target.value})}
                  />
                </div>

                {/* Cost Reduction / Financial Impact */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Maliyet Azaltma Kazanımı ({currency})</label>
                  <input
                    type="number"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-semibold text-slate-800 bg-white"
                    value={ciCardForm.targetCostReduction}
                    onChange={(e) => setCiCardForm({...ciCardForm, targetCostReduction: parseFloat(e.target.value) || 0, actualSavings: parseFloat(e.target.value) || 0})}
                  />
                </div>

                {/* Target KPI */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">İlişkili KPI / Odak Alanı</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.targetKpi}
                    onChange={(e) => setCiCardForm({...ciCardForm, targetKpi: e.target.value})}
                  />
                </div>

                {/* Root Cause */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Kök Neden Analizi (Ön Teşhis)</label>
                  <input
                    type="text"
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.rootCause}
                    onChange={(e) => setCiCardForm({...ciCardForm, rootCause: e.target.value})}
                  />
                </div>

                {/* Improvement Actions */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-750 block">Planlanan İyileştirme Faaliyetleri</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-medium text-slate-800 bg-white"
                    value={ciCardForm.improvementActions}
                    onChange={(e) => setCiCardForm({...ciCardForm, improvementActions: e.target.value})}
                  />
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 shrink-0">
              <button
                onClick={() => setIsCIModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveCIProject}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-black transition cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Kaydet ve Kanban P Adımına Ekle</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
