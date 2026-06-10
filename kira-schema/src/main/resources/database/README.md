# Database Optimization Guide (MySQL 8 + Docker)

Tai lieu nay huong dan setup va toi uu MySQL cho du an, bao gom:
- InnoDB memory/log tuning
- `max_connections` va budget connection pool theo service
- quy trinh apply config qua Docker + `.cnf`
- monitor va checklist van hanh

Ap dung cho cau hinh hien tai:
- Host: Apple M1, RAM 16GB
- DB data: ~2.1GB
- MySQL: 8.0.x

## 1) Cau truc va file can biet

- Docker compose: `docker-compose.yml`
- MySQL primary config: `mysql/primary/conf.d/primary.cnf`
- MySQL replica config: `mysql/replica/conf.d/replica.cnf`
- Script health check: `database/health-check.sql`
- Pool config service quan trong: `kira-service/src/main/resources/application.yml`

## 2) Baseline config dang dung

### MySQL (`primary.cnf`, `replica.cnf`)

```ini
[mysqld]
innodb_buffer_pool_size=4G
innodb_redo_log_capacity=512M
max_connections=230

innodb_flush_method=O_DIRECT
innodb_flush_neighbors=0
thread_cache_size=64
table_open_cache=2000
wait_timeout=600
interactive_timeout=600

slow_query_log=ON
long_query_time=0.5
log_queries_not_using_indexes=ON
binlog_expire_logs_seconds=604800
```

### App pool (hien tai)

- `kira-service` datasource `ex`: `maximum-pool-size: 10` (da ha ve default Hikari)
- Cac service khac: tuy module, can tinh theo budget tong ben duoi

## 3) Setup / apply config

### B1. Sua file `.cnf`

Cap nhat ca:
- `mysql/primary/conf.d/primary.cnf`
- `mysql/replica/conf.d/replica.cnf`

Theo baseline o tren.

### B2. Restart MySQL containers

```bash
docker compose restart mysql-primary mysql-replica
docker compose ps mysql-primary mysql-replica
```

### B3. Verify bien da apply

```bash
docker compose exec -T mysql-primary sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -Nse "
SELECT @@max_connections,@@innodb_buffer_pool_size,@@innodb_redo_log_capacity,
       @@thread_cache_size,@@table_open_cache,@@wait_timeout,@@interactive_timeout,
       @@slow_query_log,@@long_query_time,@@log_queries_not_using_indexes,@@binlog_expire_logs_seconds;"'
```

Lam tuong tu cho `mysql-replica`.

## 4) Connection va pool-size budgeting (quan trong nhat)

Khong de tung service tu do tang pool. Luon tinh budget tong:

```text
SUM(pool_size_moi_datasource * so_instance_service) + reserve_mysql <= max_connections
```

Khuyen nghi:
- `reserve_mysql` (system/admin/maintenance): 15-30
- Muc canh bao: su dung > 80% `max_connections`
- Muc nguy hiem: > 90%

Voi `max_connections=230`, mau budget an toan:
- Reserve MySQL: 20
- Tong pool tat ca service: <= 180
- Headroom dot bien: ~30

Neu du kien scale consumers, uu tien:
1) Giam pool moi instance ve muc vua du
2) Tang so instance theo nhu cau
3) Chi tang `max_connections` khi da co du lieu monitor cho thay can thiet

## 5) Monitor dinh ky

Su dung `database/health-check.sql` va chay toi thieu tren:
- `mysql-primary` (write path)
- `mysql-replica` (read path)

Chi so can theo doi:
- `Threads_connected` / `max_connections`
- `Innodb_buffer_pool_read_requests` vs `Innodb_buffer_pool_reads`
- `Innodb_log_waits`
- lock waits / blocking transactions
- slow queries

Cong thuc hit ratio:

```text
1 - (Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests)
```

Muc tieu:
- Buffer pool hit ratio: > 99.5% (workload on dinh)
- `Innodb_log_waits`: gan 0
- Connection usage: thuong < 80%

## 6) Slow query workflow

Voi `slow_query_log=ON`:
1) Thu thap truy van cham (>= `long_query_time`)
2) Tim query top N theo tan suat/tong thoi gian
3) Kiem tra index phu hop (covering index neu can)
4) Verify lai bang workload thuc te

Luu y: `log_queries_not_using_indexes=ON` rat huu ich cho giai doan audit, nhung co the tao nhieu log. Khi he thong da on dinh, co the tat neu log qua lon.

## 7) Checklist khi tang tai (12+ consumers, nhieu instance)

- [ ] Khong de bat ky service nao co pool mac dinh qua cao ma khong co budget
- [ ] Xac dinh ro service nao doc/ghi nhieu nhat
- [ ] Chay load test nho truoc khi scale that
- [ ] Theo doi connection usage, lock waits, p95/p99 query latency
- [ ] Chi tang `max_connections` sau khi da toi uu pool/query

## 8) Rollback nhanh

Neu can rollback:
1) Revert cac gia tri trong `primary.cnf` / `replica.cnf`
2) Restart:
   ```bash
   docker compose restart mysql-primary mysql-replica
   ```
3) Verify lai bien runtime

## 9) Ghi chu production

- `replica_skip_errors=1007` chi nen dung local/dev, khong khuyen nghi production
- Tach quyen user DB theo nguyen tac it quyen nhat (least privilege)
- Co backup + restore test dinh ky truoc moi thay doi lon

