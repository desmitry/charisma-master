# Charisma Master

Улучшай свою речь с [нашей помощью](https://charisma-master.ru)!

Платформа для AI-анализа публичных выступлений. Позволяет тренировать свои ораторские навыки на основе обратной связи, которую предоставляет сервис.

## Архитектура

[![Build Status](https://github.com/desmitry/charisma-master/actions/workflows/build.yaml/badge.svg)](https://github.com/desmitry/charisma-master/actions/workflows/build.yaml)
[![Deploy Status](https://github.com/desmitry/charisma-master/actions/workflows/deploy.yaml/badge.svg)](https://github.com/desmitry/charisma-master/actions/workflows/deploy.yaml)


Микросервисная архитектура, для управления проектом используется uv workspaces. Проект предоставляет собой монорепозиторий. Состоит из 3-х Python-сервисов, общих Python-пакетов, а также фронтенда на NodeJS.

### Сервисы

| Сервис | Описание | Стек |
|--------|----------|------|
| `services/api_gateway` | FastAPI-бэкенд. Приём файлов, запуск задач, опрос статуса, выдача результатов и стриминг видео | FastAPI, Celery, uvicorn |
| `services/ml_worker` | Celery-воркер. Транскрибация, анализ видео/аудио, оценка выступления через LLM | Celery, Whisper, MediaPipe, GigaChat, OpenAI, LangGraph |
| `services/migrator` | Одноразовый сервис. Загружает промпты и пресеты из `docs/` в Postgres при старте | psycopg2 |
| `services/frontend` | Веб-приложение. Интерфейс загрузки, индикатор прогресса, дашборд результатов | Next.js, React, Tailwind CSS |

### Общие пакеты

| Пакет | Описание |
|-------|----------|
| `packages/charisma_schemas` | Pydantic-модели, общие для api_gateway и ml_worker |
| `packages/charisma_storage` | Клиент SeaweedFS (S3-совместимый), используется обоими Python-сервисами |

### Инфраструктура

| Компонент | Назначение |
|-----------|------------|
| Postgres | Хранит промпты (таблица `prompts`), пресеты критериев оценивания (таблица `presets`), веса для Data Driven алгоритмов (таблица `algorithm_weights`) |
| SeaweedFS | Объектное хранилище для загруженных видео, презентаций, файлов критериев и результатов анализа |
| Redis | Брокер сообщений Celery и бэкенд результатов |

### Поток данных

1. Пользователь загружает видео (или указывает ссылку на RuTube) через фронтенд.
2. API Gateway конвертирует видео в faststart MP4 и загружает в SeaweedFS (bucket `uploads`).
3. API Gateway отправляет Celery-задачу, содержащую ключи SeaweedFS objects.
4. ML Worker скачивает файлы из SeaweedFS, обрабатывает их и записывает результат обратно в SeaweedFS (bucket `results`)
5. Фронтенд опрашивает эндпоинт статуса задачи, затем получает итоговый анализ через API Gateway.
6. Воспроизведение видео идёт через API Gateway как StreamingResponse с поддержкой HTTP Range.

## Структура проекта

```
charisma-master/
├── .github/                     # GitHub Actions, GitHub Templates
├── scripts/                     # Вспомогательные скрипты
├── docker-compose.yaml          # Основная конфигурация Docker Compose
├── docker-compose.gpu.yaml      # Оверлей для использования GPU
├── .dockerignore                # Исключения для сборки
├── pyproject.toml               # Корневой uv‑workspace
├── uv.lock                      # Lock для uv-пакетов
├── packages/                    # Общие Python‑пакеты
│   ├── charisma_schemas/        # Pydantic‑модели
│   └── charisma_storage/        # Клиент SeaweedFS (S3‑совместимый)
├── services/                    # Микросервисы проекта
│   ├── api_gateway/             # FastAPI‑бэкенд, маршрутизация задач, взаимодействие с SeaweedFS
│   ├── ml_worker/               # Celery‑воркер, обработка медиа, LLM‑анализ, интеграция LangChain
│   ├── migrator/                # Одноразовый сервис, загружает промпты и пресеты в БД
│   └── frontend/                # Next.js фронтенд (React, Tailwind CSS)
├── docs/                        # Документация, промпты и пресеты
│   ├── prompts/                 # Промпты для LLM
│   │   └── personas/            # Специфические промпты для ролей
│   └── presets/                 # Готовые пресеты оценивания
└── example.env                  # Пример Docker Compose env-файла
```

## Требования
### Основное:
- Docker, Docker Compose
- uv (для локальной разработки)
- Python 3.12
- Node.js 25 (для разработки фронтенда)

### Pre-commit хуки

Проект использует pre-commit для автоматической проверки кода перед коммитом. Установите после клонирования:

```bash
uv sync --group dev
uv run pre-commit install
```

Хуки запускают `ruff check --fix` и `ruff format` для всех изменённых Python-файлов. Также происходит проверка на утечку секретов в git-историю.

## Деплой

```bash
docker compose up -d
```

Запускает все сервисы: Postgres, SeaweedFS (master, volume, filer, s3), migrator, Redis, ml_worker, api_gateway и frontend.

Мигратор запускается один раз при старте, создаёт необходимые таблицы, загружает промпты и пресеты из `docs/`, после чего завершается со статусом `service_completed_successfully`.

Для включения GPU-поддержки ML Worker:

```bash
docker compose -f docker-compose.yaml -f docker-compose.gpu.yaml up -d
```

## Локальная разработка

### Бэкенд

```bash
uv sync

# Запуск инфраструктуры
docker compose up -d postgres seaweedfs-master seaweedfs-volume seaweedfs-filer seaweedfs-s3 redis

# Запуск мигратора
docker compose up migrator

# Запуск Celery-воркера
celery -A services/ml_worker/app.celery_app worker --loglevel=info --pool=solo

# Запуск API Gateway
uvicorn services.api_gateway.app.main:app --reload --host 0.0.0.0 --port 8000
```

### Фронтенд

```bash
cd services/frontend
npm install
npm run dev
```

## Конфигурация

Проект использует переменные окружения для настройки сервисов.  

Docker Compose читает переменные из файла `.env` в корне проекта (создаётся из `example.docker.env`). Каждый Python-сервис также имеет свои `.docker.env` или `.env` файлы для специфичных настроек.

### Локальная разработка (не рекомендуется)

Для локальной разработки используйте файлы `.env` в директориях сервисов:

```bash
cp services/api_gateway/example.env services/api_gateway/.env
cp services/ml_worker/example.env services/ml_worker/.env
```

### Быстрый старт с Docker Compose

Скопируйте примеры конфигурации перед первым запуском:

```bash
# Для Docker Compose
cp example.docker.env .env

# Для сервисов
cp services/api_gateway/example.docker.env services/api_gateway/.docker.env
cp services/ml_worker/example.docker.env services/ml_worker/.docker.env
```

### Переменные окружения Docker Compose

Файл `example.docker.env` в корне проекта содержит переменные, используемые непосредственно в `docker-compose.yaml`:

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `POSTGRES_USER` | `charisma` | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | `charisma` | Пароль PostgreSQL |
| `POSTGRES_DB` | `charisma` | Название базы данных |
| `MIGRATOR_IMAGE` | `ghcr.io/desmitry/charisma-master-migrator:latest` | Образ мигратора |
| `ML_WORKER_IMAGE` | `ghcr.io/desmitry/charisma-master-ml-worker:latest` | Образ ML Worker |
| `API_GATEWAY_IMAGE` | `ghcr.io/desmitry/charisma-master-api-gateway:latest` | Образ API Gateway |
| `FRONTEND_IMAGE` | `ghcr.io/desmitry/charisma-master-frontend:latest` | Образ Frontend |
| `CELERY_LOG_LEVEL` | `info` | Уровень логирования Celery (`debug`, `info`, `warning`, `error`, `critical`) |

### API Gateway

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

### ML Worker

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `REDIS_URL` | `redis://localhost:6379/0` | URL подключения к Redis |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis-брокер Celery |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Бэкенд результатов Celery |
| `DATABASE_URL` | `postgresql://charisma:charisma@localhost:5432/charisma` | Подключение к Postgres (для промптов) |
| `SEAWEEDFS_ENDPOINT` | `localhost:8333` | Адрес S3-шлюза SeaweedFS |
| `SEAWEEDFS_ACCESS_KEY` | "" | Ключ доступа S3 |
| `SEAWEEDFS_SECRET_KEY` | "" | Секретный ключ S3 |
| `WHISPER_MODEL_NAME` | `whisper-1` | Название модели Whisper |
| `WHISPER_MODEL_TYPE` | `base` | Размер локальной модели Whisper (`tiny`, `base`, `small`, `medium`, `large`) |
| `WHISPER_DEVICE` | `cpu` | Устройство для Whisper (`cuda` или `cpu`) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Тип вычислений (`float16`, `int8`, `default`) |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` | Базовый URL OpenAI API |
| `OPENAI_API_KEY` | "" | API-ключ OpenAI |
| `OPENAI_MODEL_NAME` | `gpt-4o-mini` | Модель OpenAI для анализа |
| `GIGACHAT_CREDENTIALS` | "" | Base64-кодированные учётные данные GigaChat |
| `GIGACHAT_SCOPE` | `GIGACHAT_API_PERS` | Область доступа GigaChat |
| `GIGACHAT_MODEL_NAME` | `GigaChat` | Модель GigaChat для анализа |
| `GIGACHAT_VERIFY_SSL` | `false` | Проверка SSL-сертификатов GigaChat |
| `SBER_SALUTE_CREDENTIALS` | "" | Учётные данные Sber Salute |
| `SBER_SPEECH_SCOPE` | `SALUTE_SPEECH_PERS` | Область доступа Sber Salute Speech |
| `COMPETITION_SEARCH_RESULTS` | `5` | Количество результатов поиска конкурентов |
| `COMPETITION_SOURCES_TO_ANALYZE` | `3` | Количество источников для анализа |
| `COMPETITION_FETCH_TIMEOUT_SECONDS` | `10` | Таймаут загрузки источника (сек) |
| `COMPETITION_SOURCE_TEXT_LIMIT` | `6000` | Лимит текста источника (символов) |

## Скрипты

Существует два вспомогательных скрипта, которые упрощают работу с инфраструктурой:

- **`scripts/load_weight_json.py`** – загружает конфигурацию весов алгоритма в PostgreSQL. Принимает путь к JSON‑файлу и идентификатор конфигурации. Таблица `algorithm_weights` будет создана автоматически, если её ещё нет.
- **`scripts/upload_demo_to_seaweedfs.py`** – загружает демонстрационное видео и JSON‑результат анализа в SeaweedFS под именами `demo.mp4` и `demo.json` соответственно.

## API эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/v1/process` | Отправить видео на анализ. Возвращает `task_id` |
| GET | `/api/v1/tasks/{task_id}/status` | Опросить прогресс задачи |
| GET | `/api/v1/analysis/{task_id}` | Получить итоговый результат анализа |
| GET | `/media/{task_id}.mp4` | Стриминг видео с поддержкой Range-запросов |
| GET | `/health` | Проверка работоспособности |

## Схема базы данных

### `prompts`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `key` | TEXT | Уникальный идентификатор промпта (напр. `speech_analysis`, `persona:strict_critic`) |
| `content` | TEXT | Текст промпта |
| `updated_at` | TIMESTAMPTZ | Время последнего обновления |

### `presets`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | TEXT | Идентификатор пресета (напр. `general`, `urfu`) |
| `name` | TEXT | Человекочитаемое название |
| `description` | TEXT | Описание пресета |
| `criteria` | JSONB | Массив критериев оценивания |
| `created_at` | TIMESTAMPTZ | Время создания |
| `updated_at` | TIMESTAMPTZ | Время последнего обновления |

### `algorithm_weights`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | TEXT | Уникальный идентификатор конфигурации (например, `default`, `v1`) |
| `config` | JSONB | JSON‑конфигурация весов алгоритма |
| `updated_at` | TIMESTAMPTZ | Время последнего обновления |

## SeaweedFS buckets

| Bucket | Назначение | Записывает | Читает |
|-------|------------|------------|--------|
| `uploads` | Загруженные видео, презентации, файлы критериев | API Gateway | ML Worker |
| `results` | Результаты анализа в формате `{task_id}.json` | ML Worker | API Gateway |
