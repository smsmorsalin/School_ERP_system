# Convenience commands for local development and container/Kubernetes deploys.

IMAGE ?= school-erp:local
NS ?= school-erp

.PHONY: help docker-build up down logs ps test frontend-build \
        k8s-diff k8s-apply k8s-migrate k8s-delete

help:
	@echo "School ERP"
	@echo ""
	@echo "  make docker-build     Build the production image ($(IMAGE))"
	@echo "  make up               Start the Compose stack (db, redis, backend, nginx)"
	@echo "  make down             Stop the Compose stack (keeps volumes)"
	@echo "  make logs             Follow backend logs"
	@echo "  make ps               Show Compose service status"
	@echo "  make test             Run the backend test suite"
	@echo "  make frontend-build   Build the React SPA into frontend/dist"
	@echo "  make k8s-diff         Preview Kubernetes changes"
	@echo "  make k8s-apply        Apply the Kustomize manifests"
	@echo "  make k8s-migrate      Run the migration Job and wait for completion"
	@echo "  make k8s-delete       Delete the Kustomize resources"

docker-build:
	docker build -t $(IMAGE) .

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200 backend

ps:
	docker compose ps

test:
	cd backend && .venv/bin/python -m pytest -q

frontend-build:
	cd frontend && npm run build

k8s-diff:
	kubectl diff -k deploy/k8s || true

k8s-apply:
	kubectl apply -k deploy/k8s

k8s-migrate:
	kubectl -n $(NS) delete job school-erp-migrate --ignore-not-found
	kubectl apply -k deploy/k8s/jobs
	kubectl -n $(NS) wait --for=condition=complete job/school-erp-migrate --timeout=300s

k8s-delete:
	kubectl delete -k deploy/k8s --ignore-not-found
