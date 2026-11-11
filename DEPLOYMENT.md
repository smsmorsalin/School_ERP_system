# Deployment Guide — Docker & Kubernetes

This document explains how to run the School ERP as containers and how to scale
it on Kubernetes. The application is a **single stateless Django image** that
serves the API, the compiled React SPA and static assets. PostgreSQL stores
data, Redis provides a shared cache, and uploaded media lives on shared storage.

```
                    ┌──────────────────────────────┐
  Browser ──HTTPS──▶│ Ingress / nginx              │
                    │  /api, /  → Django           │
                    │  /media    → media nginx     │
                    └──────────────┬───────────────┘
                                   │
                 ┌─────────────────┴──────────────────┐
                 │                                    │
          ┌──────▼───────┐                    ┌───────▼────────┐
          │ Django pods  │                    │ Media nginx    │
          │ Gunicorn     │                    │ (shared volume)│
          │ WhiteNoise   │                    └───────┬────────┘
          └───┬──────┬───┘                            │
              │      │                                │
       ┌──────▼──┐ ┌─▼────────┐                ┌──────▼──────┐
       │Postgres │ │  Redis   │                │ Media PVC   │
       │  PVC    │ │ (cache)  │                │ (RWX)       │
       └─────────┘ └──────────┘                └─────────────┘
```

---

## 1. Docker

### 1.1 Build the image

From the repository root:

```bash
docker build -t school-erp:latest .
```

The multi-stage `Dockerfile`:

1. builds the React SPA with Node 20,
2. installs Python dependencies,
3. collects Django static files,
4. runs as a non-root user (`uid 10001`) with Gunicorn + WhiteNoise.

The image contains both the API and the SPA, so there is no separate frontend
container. Media is **not** baked in; mount a volume or use object storage.

### 1.2 Run the full stack with Compose

```bash
cp .env.compose.example .env       # set a real SECRET_KEY and DB password
docker compose up -d --build
docker compose logs -f backend
open http://localhost:8080
```

Services:

| Service | Purpose | Port |
|---|---|---|
| `db` | PostgreSQL 16 | internal 5432 |
| `redis` | Shared cache / rate limits | internal 6379 |
| `media-init` | One-shot: gives uid 10001 ownership of the media volume | — |
| `backend` | Gunicorn + Django + SPA | internal 8000 |
| `nginx` | Reverse proxy + media | host 8080 |

The backend applies migrations and creates the built-in roles on first start.
Set `SEED_DEMO_DATA=1` in `.env` to load the demo school (demo credentials are in
`AI_HANDOFF.md`). **Never enable demo seeding in production.**

Useful commands:

```bash
docker compose ps
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py migrate
docker compose down            # keep data volumes
docker compose down -v         # delete database and media volumes
```

> Compose uses `config.settings.development` with `DEBUG=False` so it can run
> over plain HTTP on localhost. For a real deployment use the Kubernetes
> manifests, which use `config.settings.production` and require HTTPS.

### 1.3 Environment variables

The image reads the same variables as `backend/.env.example`. The important
container-specific ones:

| Variable | Notes |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` in Kubernetes |
| `SECRET_KEY` | 50+ random characters; never commit |
| `ALLOWED_HOSTS` | Public host name(s), comma-separated |
| `FRONTEND_URL` | `https://your-domain` in production |
| `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` | `https://your-domain` |
| `DB_*` | PostgreSQL connection |
| `REDIS_URL` | e.g. `redis://redis:6379/1`; omit for per-pod memory cache |
| `AUTH_COOKIE_SECURE` | Must be `True` in production |
| `RUN_MIGRATIONS` | `1` only for single-instance/Compose; use a Job in K8s |
| `WEB_CONCURRENCY` / `GUNICORN_THREADS` | Gunicorn tuning |

---

## 2. Kubernetes

### 2.1 Prerequisites

- Kubernetes 1.25+
- `kubectl` and `kustomize` (built into `kubectl`)
- An **Ingress controller** (the manifests assume ingress-nginx)
- **cert-manager** (optional, for automatic Let's Encrypt TLS)
- **metrics-server** (required by the HorizontalPodAutoscaler)
- A StorageClass that supports:
  - `ReadWriteOnce` for PostgreSQL, and
  - `ReadWriteMany` for shared media (NFS/EFS/CephFS/Longhorn RWX/Azure Files)

If you do not have RWX storage, see §2.8 (object storage / single replica).

> The bundled PostgreSQL StatefulSet and Redis Deployment are intended for
> small/medium installations. For a highly available production deployment,
> use a managed PostgreSQL and Redis instead, point `DB_HOST` / `REDIS_URL` at
> them, and remove those two resources from the Kustomization.

### 2.2 Build and publish the image

```bash
export IMAGE=ghcr.io/<your-account>/school-erp
docker build -t "$IMAGE:1.0.0" .
docker push "$IMAGE:1.0.0"
```

Update the image in **both** `deploy/k8s/kustomization.yaml` and
`deploy/k8s/jobs/kustomization.yaml`:

```yaml
images:
  - name: ghcr.io/smsmorsalin/school-erp
    newName: ghcr.io/<your-account>/school-erp
    newTag: 1.0.0
```

The included GitHub Actions workflow (`.github/workflows/docker.yml`) builds
and pushes `ghcr.io/<owner>/school-erp` on pushes to `main` and on version tags.

### 2.3 Configure the deployment

1. Edit `deploy/k8s/configmap.yaml`:
   - `ALLOWED_HOSTS`
   - `FRONTEND_URL`
   - `CORS_ALLOWED_ORIGINS`
   - `CSRF_TRUSTED_ORIGINS`
   - `EMAIL_*` when using SMTP
2. Edit `deploy/k8s/ingress.yaml`:
   - `spec.rules[0].host`
   - `spec.tls[0].hosts`
   - the `cert-manager.io/cluster-issuer` annotation
3. Set the storage class in:
   - `deploy/k8s/storage/media-pvc.yaml`
   - `deploy/k8s/postgres/statefulset.yaml` (`volumeClaimTemplates`)

### 2.4 Create the secret

```bash
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
# edit every REPLACE_ME value, then:
kubectl create namespace school-erp
kubectl apply -f deploy/k8s/secret.yaml
```

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

`deploy/k8s/secret.yaml` is gitignored; never commit it.

### 2.5 Deploy

```bash
# Validate first
kubectl diff -k deploy/k8s

# Apply all objects except the migration Job
kubectl apply -k deploy/k8s

# Run migrations + seed built-in roles (do this before/with a rollout)
kubectl -n school-erp delete job school-erp-migrate --ignore-not-found
kubectl apply -k deploy/k8s/jobs
kubectl -n school-erp wait --for=condition=complete job/school-erp-migrate --timeout=300s
```

Create the first administrator:

```bash
kubectl -n school-erp exec -it deploy/school-erp-backend -- \
  python manage.py createsuperuser
```

Check status:

```bash
kubectl -n school-erp get pods,svc,ingress,hpa
kubectl -n school-erp logs deploy/school-erp-backend --tail=100
kubectl -n school-erp port-forward svc/school-erp-backend 8000:80
curl -H 'X-Forwarded-Proto: https' http://127.0.0.1:8000/api/v1/health/ready/
```

Then open `https://your-domain`.

### 2.6 What gets deployed

| Object | Replicas | Notes |
|---|---|---|
| `Deployment/school-erp-backend` | 2 (HPA 2–10) | Gunicorn, non-root, read-only root FS |
| `Service/school-erp-backend` | — | ClusterIP :80 → :8000 |
| `Deployment/school-erp-media` | 2 | nginx serving `/media/` from RWX PVC |
| `Service/school-erp-media` | — | ClusterIP :80 → :8080 |
| `StatefulSet/school-erp-postgres` | 1 | PostgreSQL 16 + 20 Gi PVC |
| `Deployment/school-erp-redis` | 1 | cache-only Redis |
| `Job/school-erp-migrate` | — | explicit migration runner |
| `Ingress/school-erp` | — | TLS, `/media/` split, SPA/API |
| `HorizontalPodAutoscaler` | — | CPU 70% / memory 80% |
| `PodDisruptionBudget` | — | keeps 1 backend pod during drains |
| `NetworkPolicy` | — | only backend/migrations reach DB and Redis |

Probes:

- **Liveness:** `/api/v1/health/live/` — never touches the DB, so a database
  outage does not restart healthy pods.
- **Readiness:** `/api/v1/health/ready/` — returns `503` until PostgreSQL is
  reachable, so a failing pod is removed from the Service.

Both probes send `X-Forwarded-Proto: https` so the production HTTPS redirect
does not intercept them.

### 2.7 Scaling

The backend is **stateless**:

- JWT access tokens live in the client; refresh tokens are validated against
  PostgreSQL.
- Sessions are stored in PostgreSQL.
- Rate limits use Redis, so they are shared across pods.
- Static files are served by WhiteNoise from the read-only image.
- Media is shared through the RWX volume (or object storage).

Scale manually:

```bash
kubectl -n school-erp scale deploy/school-erp-backend --replicas=5
```

Or let the HPA do it. The HPA requires `metrics-server`. Note that re-applying
the manifests resets the Deployment to its declared `replicas: 2`; the HPA then
re-evaluates and scales as needed.

```bash
kubectl top pods -n school-erp
```

Tune `WEB_CONCURRENCY` (Gunicorn workers) and resource requests together.
A good starting point is 2–4 workers per pod with CPU requests of 250m.

### 2.8 Media storage options

The manifests use a `ReadWriteMany` PVC so that every backend pod and the media
server see the same files. Choose one of:

1. **RWX StorageClass (default):** NFS, Amazon EFS, Azure Files, CephFS,
   Longhorn RWX, etc. Set `storageClassName` in `media-pvc.yaml`.
2. **Object storage (most scalable):** add an S3-compatible backend
   (`django-storages` + `boto3`), set `MEDIA_URL` to the CDN/bucket URL and drop
   the media Deployment/PVC. This is the recommended option for multi-region or
   very large deployments.
3. **Single replica:** if only `ReadWriteOnce` is available, set the backend
   Deployment `replicas: 1`, remove the HPA (or set `minReplicas: 1`,
   `maxReplicas: 1`) and mount the RWO PVC in the backend only, using a sidecar
   or ingress rule if media must be served.

### 2.9 Upgrades and rollbacks

```bash
# Build and push a new tag, update both kustomization.yaml files, then:
kubectl -n school-erp delete job school-erp-migrate --ignore-not-found
kubectl apply -k deploy/k8s/jobs
kubectl -n school-erp wait --for=condition=complete job/school-erp-migrate --timeout=300s
kubectl apply -k deploy/k8s

# Watch the rolling update
kubectl -n school-erp rollout status deploy/school-erp-backend

# Roll back the application image
kubectl -n school-erp rollout undo deploy/school-erp-backend
```

Migrations are forward-only; take a PostgreSQL backup before upgrading.

### 2.10 Backups

- **PostgreSQL:** use your provider's automated backups or a CronJob running
  `pg_dump`. Test restores regularly.
- **Media:** back up the RWX volume or enable bucket versioning.
- **Secrets/config:** keep copies in a password manager or sealed-secrets.
- **Redis:** rate-limit counters are disposable, but use a managed Redis with
  replication if Redis availability is part of your login SLA.

Example manual backup:

```bash
kubectl -n school-erp exec deploy/school-erp-postgres -- \
  pg_dump -U schoolerp -Fc schoolerp > schoolerp-$(date +%F).dump
```

### 2.11 Troubleshooting

| Symptom | Check |
|---|---|
| Pods `Pending` | PVC not bound: `kubectl -n school-erp get pvc`; install an RWX class or switch storage |
| `CreateContainerConfigError` | Missing Secret: create `school-erp-secrets` |
| Readiness 503 | Database unreachable; check the Postgres pod and `DB_*` values |
| `DisallowedHost` in logs | Add the host to `ALLOWED_HOSTS` in the ConfigMap |
| Cookies not persisted | `AUTH_COOKIE_SECURE=True` requires HTTPS; check the Ingress TLS |
| HPA shows `<unknown>` | Install metrics-server |
| Media 404 | Confirm the media PVC is RWX and mounted; check the ingress `/media/` path |
| 413 on uploads | Raise `nginx.ingress.kubernetes.io/proxy-body-size` |
| Migrations race | Never run `RUN_MIGRATIONS=1` in multiple pods; use the Job |

---

## 3. Production security checklist

- [ ] HTTPS enforced by the Ingress; HTTP redirects to HTTPS.
- [ ] `SECRET_KEY` is unique and ≥50 characters.
- [ ] `ALLOWED_HOSTS`, `FRONTEND_URL`, CORS and CSRF origins use the real domain.
- [ ] `AUTH_COOKIE_SECURE=True`.
- [ ] PostgreSQL uses a strong password and, for managed databases, `DB_SSLMODE=require`.
- [ ] `DEBUG=False` (the production settings module enforces this).
- [ ] Public registration stays disabled unless explicitly required.
- [ ] Demo seeding is **off**.
- [ ] Database and media backups are configured and restore-tested.
- [ ] Network policies restrict database/cache access.
- [ ] Container images are pinned by tag/digest and scanned.
- [ ] Logs and metrics are collected (the API writes structured request logs to stdout).

---

## 4. Files in this repository

```
Dockerfile                         multi-stage API + SPA image
.dockerignore
docker-compose.yml                 PostgreSQL + Redis + backend + nginx
.env.compose.example               Compose environment template
docker/entrypoint.sh               migrations (optional) + exec
docker/gunicorn.conf.py            Gunicorn tuning
docker/nginx/nginx.conf            Compose reverse proxy
deploy/k8s/                        Kustomize manifests
deploy/k8s/README.md               quick Kubernetes runbook
```
