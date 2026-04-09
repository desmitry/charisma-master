# Charisma Master

Улучшай свою речь с [нашей помощью](https://charisma-master.ru)!

Платформа для AI-анализа публичных выступлений. Позволяет тренировать свои ораторские навыки на основе обратной связи, которую предоставляет сервис.

## Архитектура

Микросервисная архитектура, для управления проектом используется uv workspaces. Проект предоставляет собой монорепозиторий, состоит из 3-х Python-сервисов, общих Python-пакетов, а также обособленного фронтенда на NodeJS.

### Сервисы

| Сервис | Описание | Стек |
|--------|----------|------|
| `services/api_gateway` | FastAPI-бэкенд. Приём файлов, запуск задач, опрос статуса, выдача результатов и стриминг видео | FastAPI, Celery, uvicorn |
| `services/ml_worker` | Celery-воркер. Транскрибация, анализ видео/аудио, оценка выступления через LLM | Celery, Whisper, MediaPipe, GigaChat, OpenAI |
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
| Postgres | Хранит промпты (таблица `prompts`) и пресеты критериев оценивания (таблица `presets`) |
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
├── pyproject.toml              # корень uv workspace
├── uv.lock                     # зафиксированные зависимости
├── docker-compose.yaml         # все сервисы и инфраструктура
├── docker-compose.gpu.yaml     # оверлей: включение GPU для ml_worker
├── .dockerignore
│
├── packages/
│   ├── charisma_schemas/       # общие Pydantic-модели
│   └── charisma_storage/       # общий клиент SeaweedFS
│
├── services/
│   ├── api_gateway/            # FastAPI + отправка Celery-задач
│   ├── ml_worker/              # Celery-воркер (ML-обработка)
│   ├── migrator/               # мигратор БД (промпты и пресеты)
│   └── frontend/               # Next.js веб-приложение
│
└── docs/
    ├── prompts/                # системные промпты для LLM-анализа
    │   ├── personas/           # промпты для разных ролей
    │   ├── speech_analysis.txt
    │   ├── criteria_extraction.txt
    │   └── criteria_evaluation.txt
    └── presets/                # пресеты критериев оценивания (JSON)
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

Хуки запускают `ruff check --fix` и `ruff format` для всех изменённых Python-файлов.

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

Каждый Python-сервис читает настройки из переменных окружения через pydantic-settings. Для локальной разработки используются файлы `.env`, для Docker Compose — `.docker.env`.

Скопируйте example-файлы перед первым запуском:

```bash
# Для локальной разработки
cp services/api_gateway/example.env services/api_gateway/.env
cp services/ml_worker/example.env services/ml_worker/.env

# Для Docker Compose
cp services/api_gateway/example.docker.env services/api_gateway/.docker.env
cp services/ml_worker/example.docker.env services/ml_worker/.docker.env
```

Отредактируйте скопированные файлы, указав реальные API-ключи и учётные данные.

### API Gateway

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | `postgresql://charisma:charisma@localhost:5432/charisma` | Подключение к Postgres |
| `SEAWEEDFS_ENDPOINT` | `localhost:9222` | Адрес S3-шлюза SeaweedFS |
| `SEAWEEDFS_ACCESS_KEY` | "" | Ключ доступа S3 (пусто — без аутентификации) |
| `SEAWEEDFS_SECRET_KEY` | "" | Секретный ключ S3 |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis-брокер |
| `ORIGIN_URL` | `*` | Разрешённый origin для CORS |

### ML Worker

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | `postgresql://charisma:charisma@localhost:5432/charisma` | Подключение к Postgres (для промптов) |
| `SEAWEEDFS_ENDPOINT` | `localhost:9222` | Адрес S3-шлюза SeaweedFS |
| `WHISPER_MODEL_TYPE` | `medium` | Размер локальной модели Whisper |
| `WHISPER_DEVICE` | `cuda` | `cuda` или `cpu` |
| `GIGACHAT_CREDENTIALS` | "" | Base64-кодированные учётные данные GigaChat |
| `OPENAI_API_KEY` | "" | API-ключ OpenAI |

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

## SeaweedFS buckets

| Bucket | Назначение | Записывает | Читает |
|-------|------------|------------|--------|
| `uploads` | Загруженные видео, презентации, файлы критериев | API Gateway | ML Worker |
| `results` | Результаты анализа в формате `{task_id}.json` | ML Worker | API Gateway |
