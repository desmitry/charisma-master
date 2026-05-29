# Account

Сервис управления аккаунтами. Обрабатывает NATS-сообщения: создание пользователя, верификация, управление ролями.

**Стек:** Rust, sqlx, NATS

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATABASE_URL` | `postgresql://charisma:charisma@postgres:5432/charisma` | Подключение к Postgres |
| `NATS_URL` | `nats://nats:4222` | URL подключения к NATS |

## Схема базы данных

### `account.users`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Уникальный идентификатор пользователя (PK) |
| `created_at` | TIMESTAMPTZ | Время регистрации |
| `email` | TEXT | Email пользователя (уникальный, хранится в lowercase) |

### `account.credentials`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `user_id` | UUID | Ссылка на `account.users(id)` |
| `password_hash` | TEXT | Хеш пароля (bcrypt) |

### `account.roles`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Уникальный идентификатор роли (PK) |
| `name` | TEXT | Название роли (`user`, `moderator`, `admin`) |

### `account.permissions`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `id` | UUID | Уникальный идентификатор пермишена (PK) |
| `name` | TEXT | Название пермишена (напр. `user.profile.view.own`) |

### `account.user_roles`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `user_id` | UUID | Ссылка на `account.users(id)` |
| `role_id` | UUID | Ссылка на `account.roles(id)` |

### `account.role_permissions`

| Столбец | Тип | Описание |
|---------|-----|----------|
| `role_id` | UUID | Ссылка на `account.roles(id)` |
| `permission_id` | UUID | Ссылка на `account.permissions(id)` |

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

## Роли и права доступа

В проекте используется система ролевого доступа (RBAC) на основе таблиц `account.roles` и `account.permissions`.

### Роли

| Роль | Описание |
|------|----------|
| `user` | Обычный пользователь. Может загружать видео, получать анализ, управлять своими проектами |
| `moderator` | Модератор. Имеет доступ к управлению контентом (промпты, пресеты) и просмотру чужих анализов |
| `admin` | Администратор. Полный доступ ко всем функциям, включая управление пользователями и системными настройками |

### Пермишены

#### Пользовательские (доступны `user`)
- `user.profile.view.own` - просмотр своего профиля
- `user.profile.update.own` - редактирование своего профиля
- `user.analysis.create` - создание задачи анализа
- `user.analysis.view.own` - просмотр своих результатов
- `user.analysis.delete.own` - удаление своих результатов

#### Модераторские (доступны `moderator`)
- `user.profile.view.any` - просмотр профилей любых пользователей
- `user.analysis.view.any` - просмотр анализов любых пользователей
- `content.prompts.manage` - управление промптами (CRUD)
- `content.presets.manage` - управление пресетами (CRUD)
- `content.algorithm_weights.view` - просмотр весов алгоритмов

#### Административные (доступны `admin`)
- `user.account.delete.any` - удаление/бан пользователей
- `user.analysis.delete.any` - удаление анализов любых пользователей
- `content.algorithm_weights.manage` - редактирование весов алгоритмов
- `system.settings.view` - просмотр системных настроек
- `system.settings.edit` - редактирование системных настроек
