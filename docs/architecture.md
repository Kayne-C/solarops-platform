# Mimari

Bu doküman, SolarOps'un **neden** bu şekilde tasarlandığını ve hangi hata senaryolarına nasıl dayandığını anlatır.
Kararların gerekçeleri ve alternatifler [ADR'lerde](adr) yer alır.

## 1. Katmanlar

```text
            ┌────────────────────────── Api (Minimal API, gRPC) ─┐   ┌─ Worker (Generic Host) ─┐
            │  JWT · TenantResolution · RateLimiter · ETag      │   │  OutboxProcessor        │
            │  ProblemDetails · OpenAPI                         │   │  RabbitMqConsumerHost   │
            └───────────────┬───────────────────────────────────┘   └────────────┬────────────┘
                            │ ISender                                            │
            ┌───────────────▼────────────────────────────────────────────────────▼────────────┐
            │ Application: Command/Query + Handler, FluentValidation, Pipeline Behaviors,      │
            │ DailyYieldWriter, IIntegrationEventHandler<T>, IApplicationDbContext (port)     │
            └───────────────┬─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────▼──────────┐        ┌──────────────────────────────────────────────┐
            │ Domain (bağımlılıksız)    │◄───────┤ Infrastructure: EF Core 10, interceptor'lar,  │
            │ Plant, WorkOrder, ...     │        │ outbox/inbox, RabbitMQ, HybridCache, parser'lar│
            └──────────────────────────┘        └──────────────────────────────────────────────┘
```

- **Domain** hiçbir pakete bağlı değildir. İnvariantlar (kapasite > 0, bozunum ≤ %5, iş emri durum makinesi, fiziksel
  üretim sınırı) entity metodlarının içinde korunur; public setter yoktur (mimari testle zorlanır).
- **Application** use case başına bir dosya (vertical slice) içerir. `IApplicationDbContext` portu `DbSet<T>` sunar —
  repository katmanı yerine EF Core'un kendisi Unit of Work olarak kullanılır; sağlayıcıya özgü paketler (SqlServer,
  Oracle, Sqlite) Application'a giremez.
- **Infrastructure** tüm teknik detayı barındırır; hiçbir şey Api'ye referans vermez.
- **Api** handler'lara doğrudan erişemez; yalnızca `ISender` üzerinden konuşur (mimari testle zorlanır).

### Mediator ve pipeline

`Sender`, request tipine göre bir kez `MakeGenericType` ile pipeline nesnesi üretip `ConcurrentDictionary`'de saklar;
sonraki çağrılar sözlük araması + sanal çağrıdır. Behavior'lar kayıt sırasıyla dıştan içe sarılır:

1. `RequestTelemetryBehavior` — her use case için bir span, bir histogram ölçümü ve tek satır yapılandırılmış log.
2. `ValidationBehavior` — FluentValidation hatalarını, static abstract interface (`IResultFactory<T>`) sayesinde
   handler'a hiç ulaşmadan tipli `Result.Failure`'a çevirir.

## 2. Multi-tenancy

**Model:** paylaşılan veritabanı, paylaşılan şema, her satırda `TenantId` (gerekçe: [ADR-0002](adr/0002-multi-tenancy.md)).

| Katman | Mekanizma |
|---|---|
| Kimlik | Login'de kiracı slug'ı + e-posta → JWT içinde `tenant_id`, `role` |
| İstek kapsamı | `TenantResolutionMiddleware` claim'i scoped `TenantContext`'e bir kez yazar; değiştirilemez |
| Okuma | `ITenantOwned` her entity'ye **EF Core 10 named query filter** (`TenantIsolation`). Filtre, DbContext üzerindeki bir property'yi okuduğu için EF tek bir sorgu planını parametreyle tüm kiracılara uygular. Soft delete ayrı bir isimli filtredir; biri kapatılırken diğeri açık kalır. |
| Yazma | `AuditAndTenantInterceptor`: yeni satıra kiracıyı basar; farklı kiracıya ait bir satırı değiştirme girişiminde `CrossTenantWriteException` fırlatır |
| Arka plan | Outbox mesajı `TenantId` taşır; tüketici yeni scope açıp kiracıyı mesajdan geri yükler |
| Paylaşılan kaynaklar | Cache anahtarları/tag'leri kiracı önekli; rate limiter partition'ı kiracı başına token bucket |

Kiracı çözümlenmemişse `TenantId = Guid.Empty` olur ve filtre hiçbir satır döndürmez (*fail-closed*). Login gibi kiracı
öncesi akışlar filtreyi **isimle ve açıkça** kapatır (`IgnoreQueryFilters([QueryFilterNames.Tenant])`) ve yerine açık bir
`TenantId ==` koşulu koyar.

## 3. Yazma yolu ve olaylar

### Tek yazma yolu

REST bulk upsert, dosya import'u ve gRPC stream aynı `DailyYieldWriter`'ı kullanır:

1. Batch içinde aynı gün tekrarlanıyorsa son değer kazanır.
2. Tarih aralığındaki mevcut satırlar **tek sorguda** okunur (`PlantId + Date` aralığı, unique index ile örtüşür).
3. Her satır domain kuralından geçer (negatif değil, devreye alma tarihinden önce değil, gelecekte değil,
   `kurulu güç × 24 saat`'i aşmıyor). Reddedilenler sebep koduyla raporlanır; batch'in geri kalanı işlenir.
4. Değişiklik varsa `Plant.RecordProduction(...)` **batch başına tek** `ProductionRecorded` olayı üretir.
5. Tek `SaveChanges` → satırlar + outbox mesajı aynı transaction'da.
6. İlgili cache tag'leri (santral + portföy) invalidate edilir.

Eşzamanlı iki yazıcı aynı yeni günü eklemeye çalışırsa unique index ikincisini reddeder → `409 Production.ConcurrentWrite`.
İşlem idempotent upsert olduğu için istemci güvenle tekrar dener.

### Outbox → broker → inbox

```text
SaveChanges ─► OutboxInterceptor: aggregate.DomainEvents → OutboxMessages (aynı transaction)
OutboxProcessor (Worker): en eski işlenmemiş N mesaj → RabbitMQ (publisher confirms) → ProcessedOnUtc
RabbitMqConsumerHost: abonelik başına quorum queue, manual ack, prefetch=16
IntegrationEventDispatcher: yeni scope → kiracıyı geri yükle → trace'i devam ettir → Inbox kontrolü → handler → Inbox kaydı
```

- **At-least-once** teslimat bilinçli bir tercihtir; relay'in publish ile "işlendi" işaretlemesi arasında çökmesi
  yeniden yayına yol açar. Tekrarlar iki katmanda emilir: `(MessageId, Consumer)` Inbox anahtarı ve iş kuralının doğal
  anahtarı (`perf-alert:{plant}:{yyyy-MM}` korelasyon anahtarı + unique index).
- Bu yüzden birden fazla relay örneği aynı anda çalışabilir (docker-compose'da 2 worker replikası çalışır ve
  ölçümlerde tekrarlı iş emri oluşmamıştır). Mesaj sırası kiracı/santral bazında kritik değildir: değerlendirme her
  seferinde veritabanındaki güncel durumdan yeniden hesaplanır.
- Hatalı mesaj requeue edilir; quorum queue'nun `x-delivery-limit=5` ayarı sonsuz döngüyü keser ve mesajı
  `<queue>.dlq`'ya taşır.
- Mesaj tipi, assembly-qualified isim değil, olay tipinin kısa adıdır ve tüketici yalnızca kendi abone olduğu tipe
  deserialize eder (keyfi tip yükleme yok).

### Performans değerlendirmesi

`EvaluatePlantPerformanceCommand(plant, yıl, ay)`:

1. Ayın beklentisi: aynı yıl için baseline varsa o, yoksa en yakın önceki PVsyst yılı bozunumla projekte edilir.
2. Beklenti, verisi olan gün sayısına göre pro-rata alınır (ay ortası ve veri boşlukları düşük performans sayılmaz).
3. `indeks = gerçekleşen / beklenen`; kiracının eşiğine göre `Normal`, `Warning` (eşik − 0,10'a kadar) veya `Critical`.
4. Eşik altındaysa iş emri açılır; varsa yalnızca **önceliği yükseltilir** — otomasyon, insanın verdiği önceliği asla
   düşürmez; teknisyen aynı anda kaydı değiştirmişse (concurrency hatası) insanın değişikliği kazanır.
5. 3 günden az veri ile karar verilmez (tek bulutlu gün ekip göndermeye değmez).

## 4. Eşzamanlılık (iş emirleri)

Her mutasyon aggregate'in `ConcurrencyStamp` değerini döndürür; bu alan EF Core concurrency token'ıdır ve HTTP'de ETag
olarak sunulur ([ADR-0004](adr/0004-optimistic-concurrency.md)):

```text
GET  /work-orders/{id}                       → 200, ETag: "a1…"
POST /work-orders/{id}/assignments If-Match: "a1…" → 200, ETag: "b2…"
POST /work-orders/{id}/activities  If-Match: "a1…" → 412 Precondition Failed (lost update engellendi)
POST /work-orders/{id}/activities  (If-Match yok)  → 428 Precondition Required
```

Kontrol iki aşamalıdır: handler eski ETag'i hızlıca reddeder; okuma ile yazma arasındaki yarışı veritabanındaki
`WHERE ConcurrencyStamp = @original` yakalar. Alt kayıt (aktivite, atama) eklemek de kökün damgasını değiştirdiği için
aggregate'in tamamı korunur.

## 5. Okuma yolu ve önbellek

- Portföy dashboard'u veritabanında tek `GROUP BY PlantId` ile toplanır; beklenti hesabı uygulamada yapılır.
- `HybridCache`: L1 (process içi, 1–2 dk) + L2 (Redis, 5–10 dk). Aynı anahtar için eşzamanlı ıskalar tek hesaplamaya
  indirgenir (stampede koruması).
- Anahtarlar ve tag'ler kiracı önekli (`t:{tenant}:plant:{plant}`, `t:{tenant}:portfolio`). Üretim veya baseline
  yazımı ilgili tag'leri siler; okuyucu bir sonraki istekte taze veriyi görür (entegrasyon testiyle doğrulanır).
- Redis erişilemezse readiness `Degraded` olur, istekler L1 + veritabanıyla hizmet vermeye devam eder.

## 6. Ingest kanalları

| Kanal | Kullanım | Notlar |
|---|---|---|
| `PUT …/daily-yields` | Entegrasyonlar, manuel düzeltme | ≤ 5.000 satır/istek, idempotent |
| `POST …/daily-yields/imports` | Vendor exportları | ≤ 10 MB, satır bazlı uyarılar, format başına parser |
| gRPC `StreamDailyYields` | SCADA / data-logger gateway | Tek HTTP/2 stream'de çok santral; 500'lük batch'ler, her batch yeni DI scope (uzun stream'de change tracker büyümez); HTTP/2 flow control doğal back-pressure sağlar |

Parser'lar başlıkları Türkçe büyük/küçük harf farklarına (İ/ı) dayanıklı biçimde normalize eder, kolonları sabit
konumdan değil başlıktan bulur ve şu gerçek dünya tuzaklarını ele alır: FusionSolar'da kümülatif "Toplam Kazanç"
kolonu, Retgen'de saat bileşenli mükerrer satır (DST), NetEco'da UTF-16 kodlama ve tırnak içindeki tab karakteri.

## 7. Gözlemlenebilirlik

- **Trace:** ASP.NET Core + HttpClient + `SolarOps` ActivitySource. İstek sırasında üretilen olayın `traceparent`'ı
  outbox satırına, oradan RabbitMQ header'ına yazılır; tüketici span'i aynı trace'e bağlanır.
- **Metric:** `solarops.request.duration`, `solarops.production.daily_yields_written|rejected`,
  `solarops.performance.alerts`, `solarops.outbox.published` + runtime/ASP.NET metrikleri.
- **Log:** `LoggerMessage` kaynak üreteçleri ile yapılandırılmış, OTLP ile dışa aktarılır.
- **Health:** `/health/live` (bağımlılıksız) ve `/health/ready` (DB, RabbitMQ, Redis).

## 8. Hata senaryoları

| Senaryo | Davranış |
|---|---|
| RabbitMQ kapalı | API etkilenmez (yalnızca outbox'a yazar); relay yayınlayamaz, mesajlar birikir ve broker dönünce gönderilir. Tüketici host'u üstel bekleme ile yeniden bağlanır. |
| Worker publish sonrası, işaretleme öncesi çöker | Mesaj tekrar yayınlanır; Inbox tekrarı atlar. |
| Aynı mesaj iki tüketiciye ulaşır | Inbox PK veya iş kuralının unique index'i ikinciyi reddeder; handler idempotent. |
| Zehirli mesaj | 5 teslim denemesi → DLQ; diğer mesajlar akmaya devam eder. |
| Redis kapalı | Readiness `Degraded`; L1 + DB ile çalışmaya devam. |
| Eşzamanlı iş emri düzenleme | 412; istemci yeniden okuyup tekrar dener. |
| Bir kiracının import patlaması | Kiracı başına token bucket → 429 + `Retry-After`; diğer kiracılar etkilenmez. |
| Şema değişikliği | Tek seferlik `migrator` (veya pipeline adımı); uygulama replikaları migration yarışına girmez. |
