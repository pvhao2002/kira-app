---
name: devops-engineer
description: Setup monitoring (logs with Loki, CPU/RAM with Prometheus), dashboards in Grafana, and CI/CD pipelines on Kubernetes or Docker. Use when configuring observability, Grafana, Loki, Prometheus, metrics, log aggregation, Docker logging, or deploying/automating on k8s.
---

# DevOps Engineer – Monitoring & CI/CD on Kubernetes

## Khi nào áp dụng

- Setup hoặc cấu hình monitoring: log, CPU, RAM.
- Dùng Grafana, Loki, Prometheus trên Kubernetes.
- Thiết kế hoặc triển khai CI/CD cho cluster k8s.
- Setup Loki + Promtail theo dõi log (compose root + config trong `monitoring/`).

---

## 1. Monitoring stack: Grafana + Loki + Prometheus

### Tổng quan

| Thành phần   | Vai trò                          |
|-------------|-----------------------------------|
| **Prometheus** | Thu thập metrics (CPU, RAM, custom). |
| **Loki**       | Thu thập và index log (tương tự Prometheus cho logs). |
| **Grafana**    | Dashboard, query logs (Loki) và metrics (Prometheus). |

- **Log**: ứng dụng → Loki (Promtail hoặc sidecar thu thập) → Grafana query.
- **CPU/RAM**: node & pod metrics → Prometheus → Grafana.

### Cài đặt trên Kubernetes

- **Khuyến nghị**: dùng Helm charts chính thức.
- Thứ tự: cài Prometheus (Operator hoặc stack) → Loki (single binary hoặc simple scalable) → Promtail (nếu dùng Loki) → Grafana.

```bash
# Namespace
kubectl create namespace monitoring

# Prometheus Stack (Prometheus + Grafana, có sẵn dashboards)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring

# Loki + Promtail (logs)
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki -n monitoring
helm install promtail grafana/promtail -n monitoring -f promtail-values.yaml  # config scrape pod logs
```

- Trong Grafana: thêm **Data source** Loki (URL: `http://loki:3100`) và Prometheus (URL theo service của release, thường `http://kube-prometheus-stack-prometheus:9090`).

### Log (Loki)

- **Promtail**: chạy trên mỗi node hoặc làm sidecar, đọc log file (thường `/var/log/pods/*`) và gửi lên Loki.
- **Cấu hình Promtail**: chỉ rõ `pipeline_stages` (label, timestamp, parsing) và `scrape_configs` trỏ tới path log của k8s.
- Query trong Grafana: dùng LogQL (tương tự PromQL), ví dụ `{namespace="default", app="myapp"}`.

### CPU / RAM (Prometheus)

- Kube-prometheus-stack đã có ServiceMonitor cho cluster: node metrics (node_cpu_*, node_memory_*), pod (container_cpu_usage_seconds_total, container_memory_working_set_bytes).
- Tạo dashboard Grafana: import dashboard ID 1860 (Node Exporter), 315 (Kubernetes cluster), hoặc tự tạo panel với PromQL.
- PromQL ví dụ: `rate(container_cpu_usage_seconds_total{namespace="default"}[5m])`, `container_memory_working_set_bytes{namespace="default"}`.

### Checklist monitoring

- [ ] Prometheus scrape được targets (Targets UI: Up).
- [ ] Loki nhận log (Grafana Explore → Loki, có dòng log).
- [ ] Grafana có data source Loki và Prometheus.
- [ ] Dashboard CPU/RAM (node hoặc pod) hoạt động.
- [ ] Retention và storage (Loki, Prometheus) phù hợp môi trường (dev/staging/prod).

---

## 2. CI/CD trên Kubernetes

### Mục tiêu

- Build image từ source (Dockerfile).
- Push image lên registry (ECR, GCR, Harbor, Docker Hub…).
- Deploy lên k8s: rollout deployment/Helm, có thể kèm migration DB hoặc job.

### Thành phần thường dùng

- **Pipeline**: GitHub Actions, GitLab CI, Jenkins, Argo CD (GitOps).
- **Build**: Docker build (trong CI) hoặc Kaniko/Buildah trong cluster.
- **Deploy**: `kubectl set image` / `kubectl apply -f`, hoặc **Helm upgrade --install**.

### Workflow cơ bản

1. **Build**: CI build image, tag (commit SHA hoặc semver), push registry.
2. **Deploy**:
   - **Cách 1**: CI chạy `kubectl apply -f k8s/` hoặc `helm upgrade --install ...` (cần kubeconfig trong CI).
   - **Cách 2 (GitOps)**: CI chỉ push manifest/image tag lên repo; Argo CD (hoặc tương tự) sync cluster từ repo.

### Bảo mật và best practice

- Không commit kubeconfig hoặc secret vào repo. Dùng CI secrets (e.g. `KUBECONFIG` base64 hoặc OIDC với cloud).
- ServiceAccount cho CI/deploy: RBAC tối thiểu (chỉ namespace cần deploy).
- Image: dùng tag cụ thể, tránh `latest` cho production; scan image (Trivy, Snyk) trong pipeline.

### Checklist CI/CD

- [ ] Pipeline build + push image thành công.
- [ ] Cluster k8s pull được image (imagePullSecrets nếu registry private).
- [ ] Deploy không break rolling update (readiness/liveness đúng).
- [ ] Có rollback strategy (revision của Helm hoặc `kubectl rollout undo`).

---

## 3. Loki + Promtail với Docker

- Stack mẫu: **`docker-compose.yml`** ở root (Loki, Promtail, Grafana) + file config trong **`monitoring/`**. Promtail đọc `./logs`; job Docker có thể bật lại khi cần.
- Chi tiết và lưu ý Mac/Windows: [reference.md](reference.md).

## 4. Tài liệu tham khảo

- Chi tiết manifest mẫu, giá trị Helm, setup Docker và lệnh kiểm tra: [reference.md](reference.md).
