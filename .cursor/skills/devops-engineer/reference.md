# DevOps Engineer – Reference

## Loki + Promtail với Docker (không dùng k8s)

Stack mẫu nằm ở **`monitoring/`** trong repo:

- `docker-compose.yml` (root): mysql, rabbitmq, Loki, Promtail, Grafana — config monitoring trong `monitoring/`.
- `monitoring/loki-config.yaml`: cấu hình Loki (single binary, filesystem storage).
- `monitoring/promtail-config.yaml`: Promtail dùng `docker_sd_configs` để tự phát hiện container và gửi log lên Loki.

Chạy: `cd monitoring && docker compose up -d`. Vào Grafana (http://localhost:3000), thêm data source Loki với URL `http://loki:3100`. Query log theo label `container_name` (tên container), ví dụ `{container_name="mysql"}`.

**Lưu ý**: Trên Linux cần mount `/var/lib/docker/containers` vào container Promtail (đã có trong compose). Trên Docker Desktop (Mac/Windows) path này không khả dụng; có thể dùng [Loki Docker logging driver](https://grafana.com/docs/loki/latest/send-data/docker-driver/) cho từng service thay cho Promtail.

### Thu thập log nhiều consumer / nhiều máy (vd. kira-queue)

- **App**: set env **`INSTANCE_ID`** cho mỗi process → log file dạng `kira-queue-<INSTANCE_ID>.log` → label `service` trong Loki = tên file (dễ filter).
- **Promtail**: trên mỗi máy chạy Promtail với **`promtail-distributed.yaml`** và **`-config.expand-env=true`**. Set env: **`LOKI_URL`** (Loki trung tâm), **`INSTANCE_NAME`** (tên máy/instance), **`LOG_PATH`** (thư mục log). Config dùng `${HOSTNAME}`, `${INSTANCE_NAME}` làm label `host`, `instance` để tracking theo máy.
- Chi tiết: xem **`monitoring/README.md`** mục "Nhiều consumer / nhiều máy".

---

## Promtail values (Helm) – scrape pod logs

`promtail-values.yaml` mẫu để scrape log pods trong cluster:

```yaml
config:
  clients:
    - url: http://loki:3100/loki/api/v1/push
  positions:
    filename: /tmp/positions.yaml
  scrape_configs:
    - job_name: kubernetes-pods
      pipeline_stages:
        - cri: {}
        - labeldrop:
            - filename
      kubernetes_sd_configs:
        - role: pod
      relabel_configs:
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
          action: keep
          regex: true
        - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
          action: replace
          target_label: __metrics_path__
          regex: (.+)
        - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
          action: replace
          regex: ([^:]+)(?::\d+)?;(\d+)
          replacement: ${1}:${2}
          target_label: __address__
        - action: labelmap
          regex: __meta_kubernetes_pod_label_(.+)
        - source_labels: [__meta_kubernetes_namespace]
          target_label: namespace
        - source_labels: [__meta_kubernetes_pod_name]
          target_label: pod
```

Nếu không dùng annotation, có thể dùng `job_name: kubernetes-pods` với `path: /var/log/pods/*/*.log` (cần volume mount đúng).

## PromQL – CPU và RAM

- **CPU usage (pod, 5m rate)**:
  `sum(rate(container_cpu_usage_seconds_total{namespace="default", container!=""}[5m])) by (pod)`
- **Memory working set (pod)**:
  `sum(container_memory_working_set_bytes{namespace="default", container!=""}) by (pod) / 1024/1024`
- **Node CPU**:
  `1 - (rate(node_cpu_seconds_total{mode="idle"}[5m]))`
- **Node memory (available)**:
  `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100`

## Loki – LogQL ví dụ

- Tất cả log namespace `default`: `{namespace="default"}`
- Log app cụ thể: `{namespace="default", app="myapp"} |= "error"`
- Rate log theo stream: `rate({namespace="default"}[5m])`

## Kiểm tra nhanh sau khi cài

```bash
# Prometheus targets
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# Mở http://localhost:9090/targets

# Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
# Login admin / (password trong secret kube-prometheus-stack-grafana)

# Loki
kubectl port-forward -n monitoring svc/loki 3100:3100
# Grafana Data source: http://loki:3100
```

## CI/CD – GitHub Actions mẫu (build + deploy k8s)

```yaml
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ${{ env.REGISTRY }}/myapp:${{ github.sha }}

- name: Deploy to k8s
  run: |
    echo "$KUBECONFIG_BASE64" | base64 -d > kubeconfig
    export KUBECONFIG=$(pwd)/kubeconfig
    kubectl set image deployment/myapp myapp=${{ env.REGISTRY }}/myapp:${{ github.sha }} -n default
    kubectl rollout status deployment/myapp -n default
  env:
    KUBECONFIG_BASE64: ${{ secrets.KUBECONFIG_BASE64 }}
```

Dùng secret cho `KUBECONFIG_BASE64` hoặc OIDC (GKE/EKS/AKS) thay vì file kubeconfig.

## Helm deploy từ CI

```bash
helm upgrade --install myapp ./chart \
  --namespace default \
  --set image.repository=$REGISTRY/myapp \
  --set image.tag=$TAG \
  --wait --timeout 5m
```
