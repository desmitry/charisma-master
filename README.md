### Development without Docker Compose итд:
* Backend

```cd backend```

```uv sync```

```docker run -d -p 6379:6379 redis```

```celery -A app.celery_app worker --loglevel=info --pool=solo```

```uvicorn app.main:app --reload --host 0.0.0.0 --port 8000```

* Frontend:

```cd frontend```

```npm install```

```npm run dev```


### Deploy with Docker Compose:

```./scripts/build.sh```

```docker compose up```
