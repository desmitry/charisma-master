# API Gateway

FastAPI-бэкенд. Приём файлов, запуск задач, опрос статуса, выдача результатов и стриминг видео.

**Стек:** FastAPI, Celery, uvicorn

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `SERVICE_HOST` | `0.0.0.0` | Хост для запуска uvicorn |
| `SERVICE_PORT` | `8000` | Порт для запуска uvicorn |
| `ORIGIN_URL` | `http://localhost:3000` | Разрешённый origin для CORS |
| `MODE` | `dev`/`prod` | Режим работы (для локальной разработки или Docker) |
| `REDIS_URL` | `redis://localhost:6379/0` | URL подключения к Redis |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis-брокер Celery |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Бэкенд результатов Celery |
| `DATABASE_URL` | `postgresql://charisma:charisma@localhost:5432/charisma` | Подключение к Postgres |
| `SEAWEEDFS_ENDPOINT` | `localhost:8333` | Адрес S3-шлюза SeaweedFS |
| `SEAWEEDFS_ACCESS_KEY` | "" | Ключ доступа S3 |
| `SEAWEEDFS_SECRET_KEY` | "" | Секретный ключ S3 |
| `NATS_URL` | `nats://nats:4222` | URL подключения к NATS |
| `JWT_SECRET` | `dev-secret-key` | Секретный ключ для подписи JWT |
| `JWT_ALGORITHM` | `HS256` | Алгоритм подписи JWT |
| `ACCESS_TOKEN_EXPIRE_MINS` | `15` | Время жизни access-токена (минут) |
| `REFRESH_TOKEN_EXPIRE_MINS` | `10080` | Время жизни refresh-токена (минут, 7 дней) |
| `DAILY_PROCESS_LIMIT` | `3` | Максимум обработок видео в день на пользователя |

## API эндпоинты

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| POST | `/api/v1/auth/register` | Нет | Регистрация пользователя, принимает `email` и `password` |
| POST | `/api/v1/auth/login` | Нет | Вход, возвращает `access_token` и `refresh_token` |
| POST | `/api/v1/auth/refresh` | Нет | Обновление access-токена, принимает `refresh_token` |
| POST | `/api/v1/auth/logout` | Bearer | Выход, черный список текущего токена |
| GET | `/api/v1/auth/me` | Bearer | Информация о текущем пользователе (роли, права) |
| POST | `/api/v1/process` | Bearer | Отправить видео на анализ. Возвращает `task_id`. **429** при превышении дневного лимита |
| GET | `/api/v1/tasks/{task_id}/status` | Bearer | Опросить прогресс задачи |
| GET | `/api/v1/tasks/{task_id}/wait` | Bearer | Дождаться завершения задачи (long-polling) |
| GET | `/api/v1/analysis/{task_id}` | Bearer | Получить итоговый анализ (только свой, если не модератор) |
| GET | `/media/{task_id}.mp4` | Bearer | Стриминг видео с поддержкой Range-запросов |
| GET | `/health` | Нет | Проверка работоспособности |

## Пример конфигурации

См. [`example.env`](example.env) и [`example.docker.env`](example.docker.env).
