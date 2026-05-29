# ML Worker

Celery-воркер. Транскрибация, анализ видео/аудио, оценка выступления через LLM.

**Стек:** Celery, Whisper, MediaPipe, GigaChat, OpenAI, LangGraph

## Переменные окружения

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

## LangChain / LangGraph

ML Worker использует **LangChain** и **LangGraph** для работы с LLM-моделями и поиска информации:

- В `competition_research.py` применяется `langchain_community.utilities.DuckDuckGoSearchAPIWrapper` для поиска и анализа открытых источников.
- **LangGraph** используется для построения агентных цепочек запросов к LLM (OpenAI, GigaChat).

## Пример конфигурации

См. [`example.env`](example.env) и [`example.docker.env`](example.docker.env).
