# ADR-0005: SQL Server ve Oracle'ı aynı kod tabanından desteklemek

- **Durum:** Kabul edildi
- **Bağlam:** Hedef müşteriler (enerji şirketleri, holdingler) kurumsal standart olarak SQL Server veya Oracle
  kullanıyor. Yerel geliştirme ve testlerin harici bağımlılık olmadan çalışması isteniyor.

## Karar

- Sağlayıcı yapılandırmayla seçilir: `Database:Provider = SqlServer | Oracle | Sqlite`.
- Her sunucu sağlayıcısı için **ayrı migration assembly'si** (`SolarOps.Migrations.SqlServer`, `...Oracle`); CI,
  `dotnet ef migrations has-pending-model-changes` ile ikisinin de modelle senkron olduğunu doğrular.
- SQLite yalnızca geliştirme/test içindir (`EnsureCreated`).
- Sağlayıcı farkları modelde, konvansiyonlarla çözülür:
  - Oracle sağlayıcısı `DateOnly`'yi `NVARCHAR2(10)` olarak eşler → değer dönüştürücü ile yerel `DATE`.
  - Oracle'da sınırsız string `NVARCHAR2(2000)` olur → outbox payload'ı LOB'a (`NCLOB` / `nvarchar(max)`) zorlanır.
  - SQLite'ta decimal yoktur → `REAL` dönüşümü (yalnızca SQLite).
  - Unique index'lerde provider'a özgü filtre (`WHERE … IS NOT NULL`) kullanılmaz; anahtarlar her zaman doludur
    (manuel iş emirleri de `manual:{id}` korelasyon anahtarı alır), böylece SQL Server ve Oracle'ın NULL semantiği
    farkı ortadan kalkar.
  - Unique ihlali sağlayıcıdan bağımsız bir istisnaya çevrilir (SQL Server 2601/2627, ORA-00001, SQLite 2067).
- Container imajı ICU içeren chiseled varyantı kullanır: SqlClient globalization-invariant modda çalışmaz.

## Sonuçlar

- (+) Aynı stack docker-compose ile SQL Server 2022 ve Oracle 23ai Free üzerinde doğrulandı (aynı sonuçlar).
- (−) İki migration seti bakım ister; her model değişikliğinde ikisi de üretilir.
