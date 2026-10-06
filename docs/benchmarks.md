# Ölçümler

Veri seti demo amaçlıdır, rakamlar ise gerçek ölçümdür: aşağıdaki ortamda [k6](https://k6.io) ile ölçüldü ve
[`tests/load`](../tests/load) altındaki script'lerle yeniden üretilebilir.

Üretim ortamı rakamı değildir: tüm bileşenler **aynı 4 vCPU'luk makinede** çalıştığı için yük üreticisi, API,
veritabanı ve broker CPU'yu paylaşır. Ayrık donanımda sonuçlar daha iyi olacaktır.

## Ortam

| | |
|---|---|
| Makine | 4 vCPU, 16 GB RAM, Linux (tek VM) |
| Topoloji | `docker compose`: API ×1, Worker ×2, SQL Server 2022 / Oracle 23ai Free, RabbitMQ 4, Redis 7, Aspire Dashboard |
| Veri | Demo seed (2 kiracı, 4 santral) + testin yazdığı 2024–2025 günlük verileri |
| Not | Ölçüm sırasında kiracı başına rate limit yükseltildi (aksi halde limiter — doğru şekilde — 429 döner) |

## Sonuçlar

### 1. Portföy dashboard'u (okuma)

`tests/load/dashboard-read.js` — 500 istek/sn sabit varış hızı (SQL Server 60 sn, Oracle 30 sn).

| Veritabanı | İstek/sn | p50 | p95 | Hata |
|---|---|---|---|---|
| SQL Server 2022 | 499 | 1,1 ms | **2,1 ms** | %0 |
| Oracle 23ai Free | 498 | 1,2 ms | 2,5 ms | %0 |

Tek istek gecikmesi, önbellek ıskası → isabeti (24 farklı ay, SQL Server): **12,7 ms → 2,4 ms** (ortalama).

### 2. Toplu upsert (yazma)

`tests/load/bulk-ingest.js` — 6 eşzamanlı yazıcı; her istek bir santralin bir yılını (365/366 satır) günceller
(SQL Server 60 sn, Oracle 45 sn).

| Veritabanı | Satır/sn | İstek p95 | Hata |
|---|---|---|---|
| SQL Server 2022 | **~13.000** | 380 ms | %0 |
| Oracle 23ai Free¹ | ~4.100 | 883 ms | %0 |

¹ Oracle Database Free, 2 CPU iş parçacığı ve 2 GB RAM ile sınırlandırılmış bir sürümdür.

### 3. Karışık yük (okuma + yazma aynı anda, SQL Server)

Dashboard 500 istek/sn ile okunurken toplu yazma sürdürüldü. Her yazma ilgili cache tag'lerini sildiği için okumaların
önemli kısmı yeniden hesaplanır (stampede koruması eşzamanlı ıskaları tek hesaplamaya indirir).

| | Değer |
|---|---|
| Dashboard p95 / hata | **82 ms** / %0 |
| Eşzamanlı yazma hızı | ~11.000 satır/sn |

### 4. Olay hattı (SQL Server)

Toplu yazma testinin ürettiği 2.198 `ProductionRecorded` olayı 2 worker replikası tarafından işlendi:

| | Değer |
|---|---|
| Outbox → işlendi gecikmesi | ort. **0,6 sn**, maks. 5,2 sn (burst sırasında) |
| Bekleyen mesaj (test sonu) | 0 |
| Tekrarlı iş emri | 0 (iki relay + iki tüketici aynı anda çalışırken) |

## Yeniden üretme

```bash
docker compose up --build -d
# Ölçüm için kiracı limitini yükseltin (veya docker-compose.override.yml kullanın):
#   RateLimiting__TenantPermitsPerSecond=100000  RateLimiting__TenantBurst=100000

k6 run tests/load/dashboard-read.js -e BASE_URL=http://localhost:8080 -e RATE=500 -e DURATION=60s
k6 run tests/load/bulk-ingest.js    -e BASE_URL=http://localhost:8080 -e VUS=6   -e DURATION=60s
```

Outbox gecikmesi (SQL Server):

```sql
SELECT AVG(DATEDIFF(millisecond, OccurredOnUtc, ProcessedOnUtc)) AS avg_ms,
       MAX(DATEDIFF(millisecond, OccurredOnUtc, ProcessedOnUtc)) AS max_ms
FROM OutboxMessages WHERE ProcessedOnUtc IS NOT NULL;
```
