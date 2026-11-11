"""Gunicorn configuration tuned for container/Kubernetes deployments.

Every value can be tuned with an environment variable so the same image works
for small and large installations.
"""

import multiprocessing
import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# gthread gives good throughput for I/O-bound Django workloads without the
# memory cost of many processes.
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gthread")
# With threads, a small number of processes is enough; cap the default so a
# large host does not spawn dozens of workers in one container.
workers = int(
    os.getenv("WEB_CONCURRENCY", str(max(2, min(4, multiprocessing.cpu_count()))))
)
threads = int(os.getenv("GUNICORN_THREADS", "4"))

timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))

# Recycle workers periodically to bound memory usage.
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "100"))

# Reuse an in-memory temp dir mounted by Kubernetes (emptyDir at /tmp).
worker_tmp_dir = os.getenv("GUNICORN_WORKER_TMP_DIR", "/tmp")

# Trust proxy headers from the ingress controller. Restrict this in clusters
# where pods are directly reachable.
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "*")

accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")
access_log_format = os.getenv(
    "GUNICORN_ACCESS_LOG_FORMAT",
    '%({x-forwarded-for}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"',
)

# Do not preload: each worker gets its own database connections and the
# application code is small enough that copy-on-write savings are not worth
# the complications around connection lifetime.
preload_app = False
