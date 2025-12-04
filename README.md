* Build:

```uv sync```

```docker run -d -p 6379:6379 redis```

```celery -A src.celery_app worker --loglevel=info --pool=solo```

```uvicorn src.main:app --reload --host 0.0.0.0 --port 8000```

* Docker:

```cd backend```

```docker build -t ghrc.io/desmitry/charisma-master-backend:latest -f Dockerfile .```

```cd ..```

```docker compose up -d```
