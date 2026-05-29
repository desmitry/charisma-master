# Kubernetes

Проект включает конфигурацию для развёртывания в Kubernetes.

## Структура

```
k8s/
├── base/                           # Базовые манифесты
│   ├── namespace.yaml              # Namespace проекта
│   ├── configmap.yaml              # Общий ConfigMap
│   ├── secret.yaml                 # Secret (заполнить своими данными)
│   ├── ingress.yaml                # Ingress для внешнего доступа
│   ├── kustomization.yaml
│   ├── postgres/                   # Postgres (PVC, deployment, service)
│   ├── redis/                      # Redis (deployment, service)
│   ├── migrator/                   # Миграция БД (job + RBAC)
│   ├── api-gateway/                # API Gateway (deployment, service)
│   ├── ml-worker/                  # ML Worker (deployment)
│   └── frontend/                   # Frontend (deployment, service)
└── overlays/prod/                  # Продакшен-оверлей
    ├── kustomization.yaml
    └── patches/                    # Патчи для продакшена
        ├── api-gateway.yaml
        ├── frontend.yaml
        └── ml-worker.yaml
```

## Деплой

Для развёртывания в кластере:

```bash
kubectl apply -k k8s/base
```

Для продакшен-окружения:

```bash
kubectl apply -k k8s/overlays/prod
```
