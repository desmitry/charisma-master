# Charisma Master

Улучшай свою речь с [нашей помощью](https://charisma.geekiot.tech)!

## О проекте

* [Сайт](https://charisma.geekiot.tech), предоставляющий AI-анализ выступлений: выявление слов паразитов, недочетов и темпа речи, а также краткая выжимка слов спикера.

* Нейросети также анализирует слайды на презентации спикера (при их наличиии) и его жестикуляцию.

* Для навигации в речи спикера есть удобный плеер.

## При разработке

Перед началом убедитесь, что вы скопировали содержимое файла `backend/.env.example` в `backend/.env` и настроили его.

### Backend

 `cd backend`

 `uv sync`

 `docker run -d -p 6379:6379 redis`

 `celery -A app.celery_app worker --loglevel=info --pool=solo`

 `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### Frontend

 `cd frontend`

 `npm run build`

 `npm start`

## Деплой с помощью Docker Compose

Перед началом убедитесь, что вы скопировали содержимое файла `backend/.env.example` в `backend/.env` и настроили его.

Все необходимые для связи бекэнда и фронтэнда URL передаются в `docker-compose.yaml` , вам не стоит изменять `backend/.env` ради них, так как они будут перезаписаны. Просто держите в `backend/.env` актуальные данные для разработки, а в `docker-compose.yaml` перезаписывайте необходимые для деплоя данные.

### Команды

 `./scripts/build.sh`

 `docker compose up`
