# Kubernetes quick runbook

Full details live in [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md). This is the
short version.

## 1. Prerequisites

- ingress-nginx, metrics-server, optionally cert-manager
- A StorageClass with `ReadWriteMany` for media (or switch to object storage)
- An image pushed to a registry you can pull from

## 2. Configure

```bash
# 1. Domain / origins
$EDITOR deploy/k8s/configmap.yaml      # ALLOWED_HOSTS, FRONTEND_URL, CORS, CSRF
$EDITOR deploy/k8s/ingress.yaml        # host, TLS host, issuer

# 2. Storage classes
$EDITOR deploy/k8s/storage/media-pvc.yaml
$EDITOR deploy/k8s/postgres/statefulset.yaml

# 3. Image (update both files)
$EDITOR deploy/k8s/kustomization.yaml       # images: newName / newTag
$EDITOR deploy/k8s/jobs/kustomization.yaml  # images: newName / newTag

# 4. Secret
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
$EDITOR deploy/k8s/secret.yaml
```

## 3. Deploy

```bash
kubectl create namespace school-erp
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -k deploy/k8s

# migrations + built-in roles
kubectl -n school-erp delete job school-erp-migrate --ignore-not-found
kubectl apply -k deploy/k8s/jobs
kubectl -n school-erp wait --for=condition=complete job/school-erp-migrate --timeout=300s

# first admin
kubectl -n school-erp exec -it deploy/school-erp-backend -- python manage.py createsuperuser
```

## 4. Verify

```bash
kubectl -n school-erp get pods,svc,ingress,hpa,pvc
kubectl -n school-erp rollout status deploy/school-erp-backend
kubectl -n school-erp logs deploy/school-erp-backend --tail=100

kubectl -n school-erp port-forward svc/school-erp-backend 8000:80
curl -H 'X-Forwarded-Proto: https' http://127.0.0.1:8000/api/v1/health/live/
curl -H 'X-Forwarded-Proto: https' http://127.0.0.1:8000/api/v1/health/ready/
```

## 5. Operations

```bash
# Scale
kubectl -n school-erp scale deploy/school-erp-backend --replicas=4

# Roll out a new image tag
kubectl -n school-erp apply -k deploy/k8s
kubectl -n school-erp rollout status deploy/school-erp-backend

# Roll back
kubectl -n school-erp rollout undo deploy/school-erp-backend

# Inspect a pod
kubectl -n school-erp describe pod -l app.kubernetes.io/component=backend
kubectl -n school-erp exec -it deploy/school-erp-backend -- sh
```

## Notes

- The migration Job is **not** part of the Kustomization; run it explicitly.
- Never set `RUN_MIGRATIONS=1` on multi-replica pods.
- Liveness never depends on the database; readiness does.
- Media requires an RWX volume unless you move uploads to object storage.
