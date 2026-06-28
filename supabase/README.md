# SQL: схема и демо-данные

## Что запускать в Supabase

```
supabase/
  schema.sql              ← 1. всегда (структура, без демо)
  demo/
    apply.sql             ← 2. опционально (тестовые аккаунты и примеры)
    remove.sql            ← удалить демо, реальные данные не трогает
```

| Сценарий | Файлы по порядку |
|----------|------------------|
| Обновили проект / первый раз после реорганизации | `schema.sql` → `demo/remove.sql` → `demo/apply.sql` |
| Новый пустой Supabase, разработка | `schema.sql` → `demo/apply.sql` |
| Прод без демо | только `schema.sql` |
| Перезалить демо | `demo/remove.sql` → `demo/apply.sql` |

Повторный запуск `schema.sql` безопасен.

### Saved queries в Supabase Dashboard

В SQL Editor могут висеть **старые сохранённые запросы** (`run_now`, `apply_all` и т.д.) — их можно **удалить**. Они не влияют на базу, это только закладки в интерфейсе.

Данные и структура живут **в базе**, не в saved queries. Новые скрипты берите из этого репозитория и при необходимости сохраните заново:

1. `schema.sql`
2. `demo/apply.sql`
3. `demo/remove.sql`

---

## Структура папки

```
supabase/
  schema.sql
  README.md
  migrations/           ← исходники (из них собирается schema.sql)
  demo/                 ← демо-данные
  archive/              ← устаревшее, не запускать
```

Фрагменты в `demo/` (`00_staff_users.sql`, …) собираются в `demo/apply.sql` — **запускайте apply.sql**, не фрагменты по отдельности.

После правок миграций:

```bash
npm run db:build
```

---

## Демо vs реальные данные

**Демо:** `*@test.qc.ru`, контент с `is_demo = true`.

**Реальные:** обычные email, `is_demo = false` — не удаляются через `demo/remove.sql`.

> Домен `@test.qc.ru` зарезервирован под демо.

## Первый superadmin

Без демо первый зарегистрировавшийся на сайте → superadmin.

Если есть `superadmin@test.qc.ru` из демо, место superadmin уже занято — первый **реальный** пользователь будет student.

Для прода: не запускайте `demo/apply.sql`, либо сначала `demo/remove.sql`.

Альтернатива для dev-пользователей: `npm run seed:users` (нужен `SUPABASE_SERVICE_ROLE_KEY` в `.env`).
