# Charisma API Reference

**Base URL:** `https://charisma.geekiot.tech`
**Local:** `http://localhost:8000`

**Interactive docs:** `/docs` (Swagger UI) | `/redoc` (ReDoc)

---

## Endpoints

### POST /api/v1/process

Загрузить видео выступления для анализа.

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_speech_file` | file | * | Видеофайл (MP4, AVI, MOV) |
| `user_speech_url` | string | * | Ссылка на Rutube |
| `evaluation_criteria_file` | file | ** | Файл с критериями оценки |
| `evaluation_criteria_id` | string | ** | ID пресета критериев |
| `user_presentation_file` | file | - | Файл презентации (.pptx) |
| `persona` | string | - | Роль AI-критика. Default: `speech_review_specialist` |
| `analyze_provider` | string | - | `gigachat` \| `openai`. Default: `gigachat` |
| `transcribe_provider` | string | - | `sber_gigachat` \| `whisper_local` \| `whisper_openai`. Default: `sber_gigachat` |

\* Необходим ровно один: файл или URL.
\** Необходим ровно один: файл или ID пресета.

**Personas:** `strict_critic`, `kind_mentor`, `steve_jobs_style`, `speech_review_specialist`

```bash
curl -X POST https://charisma.geekiot.tech/api/v1/process \
  -F "user_speech_file=@speech.mp4" \
  -F "evaluation_criteria_id=preset_1" \
  -F "persona=speech_review_specialist" \
  -F "analyze_provider=gigachat" \
  -F "transcribe_provider=sber_gigachat"
```

**Response:** `200 OK`
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET /api/v1/tasks/{task_id}/status

Получить текущий статус обработки задачи.

```bash
curl https://charisma.geekiot.tech/api/v1/tasks/{task_id}/status
```

**Response:** `200 OK`
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "PROCESSING",
  "hint": "Анализ видео...",
  "progress": 0.25,
  "stage": null,
  "error": null
}
```

**States:** `PENDING` | `PROCESSING` | `SUCCESS` | `FAILURE`

---

### GET /api/v1/analysis/{task_id}

Получить полный результат анализа выступления.

```bash
curl https://charisma.geekiot.tech/api/v1/analysis/{task_id}
```

**Response:** `200 OK` — `AnalysisResult` (транскрипция, темп, паузы, индекс уверенности, LLM-отчёт, критерии).

**Errors:** `404` — анализ не найден или ещё обрабатывается.

---

### POST /api/v1/telemetry/{task_id}/rate

Оценить качество анализа (1-5).

```bash
curl -X POST https://charisma.geekiot.tech/api/v1/telemetry/{task_id}/rate \
  -H "Content-Type: application/json" \
  -d '{"rating": 4}'
```

**Response:** `200 OK`
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "rating": 4,
  "message": "Оценка сохранена"
}
```

**Errors:** `404` — задача не найдена | `400` — уже оценена.

---

### GET /api/v1/telemetry/stats

Агрегированная статистика.

```bash
curl https://charisma.geekiot.tech/api/v1/telemetry/stats
```

**Response:** `200 OK`
```json
{
  "total_analyses": 150,
  "rated_count": 89,
  "average_rating": 4.2,
  "average_confidence": 68.5
}
```

---

### GET /health

Проверка работоспособности сервиса.

```bash
curl https://charisma.geekiot.tech/health
```

**Response:** `200 OK`
```json
{"status": "ok"}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Некорректные параметры запроса |
| 404 | Ресурс не найден |
| 422 | Ошибка валидации (Pydantic) |
| 500 | Внутренняя ошибка сервера |

---

## OpenAPI Schema

Файл: [`backend/docs/openapi.json`](../backend/docs/openapi.json)

Генерация:
```bash
cd backend && python scripts/export_openapi.py
```
