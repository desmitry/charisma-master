# Charisma — Speech Analysis API

Base URL: `http://localhost:8000`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

---

## Endpoints

### 1. Upload & Process

**POST** `/api/v1/process`

Upload a speech recording (file or RuTube URL) together with evaluation criteria and start the analysis pipeline.

| Field                       | Type           | Required | Description                              |
|-----------------------------|----------------|----------|------------------------------------------|
| `user_speech_file`          | file (binary)  | *        | Video/audio file of the speech           |
| `user_speech_url`           | string (form)  | *        | RuTube URL (mutually exclusive with file)|
| `evaluation_criteria_file`  | file (binary)  | **       | Custom criteria file                     |
| `evaluation_criteria_id`    | string         | **       | Preset criteria ID from the database     |
| `user_presentation_file`    | file (binary)  | no       | Presentation slides                      |
| `persona`                   | string (form)  | no       | Analysis persona (default: `speech_review_specialist`) |
| `analyze_provider`          | string (form)  | no       | LLM provider for analysis (default: `gigachat`)        |
| `transcribe_provider`       | string (form)  | no       | Transcription provider (default: `sber_gigachat`)      |

\* Exactly one of `user_speech_file` / `user_speech_url` is required.
\** Exactly one of `evaluation_criteria_file` / `evaluation_criteria_id` is required.

**Example**

```bash
curl -X POST http://localhost:8000/api/v1/process \
  -F "user_speech_file=@speech.mp4" \
  -F "evaluation_criteria_id=default" \
  -F "persona=speech_review_specialist" \
  -F "analyze_provider=gigachat" \
  -F "transcribe_provider=sber_gigachat"
```

**Response** `200 OK`

```json
{
  "task_id": "b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b"
}
```

---

### 2. Task Status

**GET** `/api/v1/tasks/{task_id}/status`

Poll the current state of an analysis task.

**States**: `PENDING` | `PROCESSING` | `SUCCESS` | `FAILURE`

**Example**

```bash
curl http://localhost:8000/api/v1/tasks/b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b/status
```

**Response** `200 OK`

```json
{
  "task_id": "b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b",
  "state": "PROCESSING",
  "hint": "Транскрибация аудио...",
  "stage": "transcribe",
  "progress": 0.45,
  "error": null
}
```

---

### 3. Analysis Results

**GET** `/api/v1/analysis/{task_id}`

Retrieve the completed analysis (scores, transcript, feedback).

**Example**

```bash
curl http://localhost:8000/api/v1/analysis/b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b
```

**Response** `200 OK` — full `AnalysisResult` JSON (schema in `/docs`).

---

### 4. Health Check

**GET** `/health`

Returns service liveness status.

**Example**

```bash
curl http://localhost:8000/health
```

**Response** `200 OK`

```json
{
  "status": "ok"
}
```

---

### 5. Media Streaming

**GET** `/media/{task_id}.mp4`

Stream the uploaded video with HTTP Range support for browser playback and seeking.

**Example**

```bash
# Full download
curl -o video.mp4 http://localhost:8000/media/b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b.mp4

# Partial content (byte range)
curl -H "Range: bytes=0-1048575" \
  http://localhost:8000/media/b3f1c2a4-5d6e-7f80-9a1b-2c3d4e5f6a7b.mp4 -o chunk.mp4
```

**Responses**

- `200 OK` — full file (no Range header).
- `206 Partial Content` — requested byte range with `Content-Range` header.

---

## Error Codes

| Code | Meaning                                                    |
|------|------------------------------------------------------------|
| 400  | Invalid request parameters (missing file/url, bad input)   |
| 404  | Resource not found (video, analysis result, preset)        |
| 416  | Invalid or unsatisfiable Range header                      |
| 500  | Internal server error (ffmpeg failure, storage error, etc.)|
