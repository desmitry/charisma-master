### Build:
* Backend

```cd backend```

```uv sync```

```docker run -d -p 6379:6379 redis```

```celery -A src.celery_app worker --loglevel=info --pool=solo```

```uvicorn src.main:app --reload --host 0.0.0.0 --port 8000```

* Frontend:

```cd frontend```

```npm install```

```npm run dev```


### With Docker:

```cd backend```

```docker build -t ghcr.io/desmitry/charisma-master-backend:latest -f Dockerfile .```

```cd ..```

```cd frontend```

```docker build -t ghcr.io/desmitry/charisma-master-frontend:latest -f Dockerfile .```

```cd ..```

```docker compose up -d```
