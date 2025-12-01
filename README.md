```pip install -r requirements.txt```

```docker run -d -p 6379:6379 redis```

```celery -A src.app.backend.celery_app worker --loglevel=info --pool=solo```

```uvicorn src.app.backend.main:app --reload --host 0.0.0.0 --port 8000```