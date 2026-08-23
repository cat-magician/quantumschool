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
  schema.sql            ← единственный источник структуры
  README.md
  demo/
    apply.sql           ← демо-данные (самодостаточный файл)
    remove.sql          ← удалить демо
  functions/            ← Edge Functions
```

Миграций нет: правки вносятся прямо в `schema.sql`, он идемпотентный. Демо-фрагменты
тоже не нужны — `demo/apply.sql` содержит всё, включая свои временные функции.

---

## Демо vs реальные данные

**Демо:** `*@test.qc.ru`, контент с `is_demo = true`.

**Реальные:** обычные email, `is_demo = false` — не удаляются через `demo/remove.sql`.

> Домен `@test.qc.ru` зарезервирован под демо.

Демо-аккаунты создаются с паролем, но войти ими через интерфейс нельзя: форма
логина собирает технический адрес `<login>@id.quantumschool.ru`, а у демо домен
`@test.qc.ru`. Это фикстуры для наполнения базы и для служебных скриптов
из `scripts/`.

## Способы входа

| Способ | Что лежит в `auth.users.email` | Где настраивается |
|--------|-------------------------------|-------------------|
| Яндекс ID | настоящая почта из Яндекс ID | Custom Provider `custom:yandex`, см. `.env.example` |
| Логин и пароль | технический `<login>@id.quantumschool.ru` | провайдер Email с выключенным Confirm email |

Логин хранится в `user_profiles.login` (выводится из адреса триггером
`handle_new_user`, менять его из приложения нельзя). Необязательная настоящая
почта — в `user_profiles.recovery_email`, в аутентификации она не участвует:
непроверенный адрес в `auth.users.email` позволил бы занять чужой аккаунт,
к которому потом привяжется Яндекс ID настоящего владельца почты.

Пароль забыли — писем в системе нет, новый выдаёт суперадмин кнопкой
«Новый пароль» в карточке участника (`superadmin_set_login_password`).

> Роль **не** читается из `raw_user_meta_data`: при регистрации по логину её
> задаёт клиент. Сиды проставляют роль отдельным UPDATE профиля.

## Суперадмины

Права выдаются **по адресу почты**. Список — в `schema.sql` → `superadmin_allowlist`:

- `marcellau@yandex.ru`
- `n.tatarinova@rqc.ru`
- `sokol.dm@phystech.edu`

Адрес должен совпадать с тем, который отдаёт Яндекс ID при входе (для домена вроде
`rqc.ru` это значит, что почта живёт в Яндекс 360). При первом входе триггер
`handle_new_user` сразу ставит роль **superadmin**.

Чтобы добавить или убрать суперадмина: поправьте оба списка в блоке
`superadmin_allowlist` (`DELETE ... WHERE email NOT IN` и `INSERT`) и прогоните
`schema.sql`. Повторный прогон синхронизирует роли: allowlist → superadmin,
остальные superadmin → student.

**Демо** (`demo/apply.sql`) не создаёт superadmin — только `@test.qc.ru` с ролью admin/student для разработки.

Для прода: не запускайте `demo/apply.sql`, либо сначала `demo/remove.sql`.

Альтернатива для dev-пользователей: `npm run seed:users` (нужен `SUPABASE_SERVICE_ROLE_KEY` в `.env`).

---

## Вход через Яндекс ID

### 1. Supabase → Authentication → Providers → New Provider → Manual configuration

Identifier `custom:yandex`, тип OAuth2:

| Поле | Значение |
|------|----------|
| Authorization URL | `https://oauth.yandex.com/authorize` |
| Token URL | `https://oauth.yandex.com/token` |
| UserInfo URL | функция из шага 2 (не `https://login.yandex.ru/info`) |
| Scopes | `login:info login:email` |

Client ID и Client Secret — из [oauth.yandex.com](https://oauth.yandex.com/). После каждого
сохранения проверяйте, что они не пустые: Dashboard затирает секрет.

Галочка **Allow users without email** должна быть **выключена**: почта — единственный
идентификатор пользователя, по ней же выдаются права суперадмина.

### 2. Обязательный прокси userinfo

Напрямую с `https://login.yandex.ru/info` вход не работает по двум причинам:

- Supabase Auth требует в ответе поле `sub`, а Яндекс отдаёт `id` — вход падает с
  «missing provider id» ([supabase/auth#2519](https://github.com/supabase/auth/issues/2519),
  на момент написания не исправлено);
- Supabase ищет `email`, а Яндекс кладёт адрес в `default_email`.

Настройками провайдера это не обходится. `supabase/functions/yandex-userinfo` проксирует
запрос к Яндексу и переименовывает поля.

Деплой из Dashboard (без CLI): **Edge Functions → Deploy a new function**, вставить
содержимое `supabase/functions/yandex-userinfo/index.ts` и **выключить Verify JWT** —
Supabase зовёт функцию с токеном Яндекса, а не со своим JWT. Через CLI:

```bash
supabase functions deploy yandex-userinfo --no-verify-jwt
```

Затем в провайдере укажите UserInfo URL:

```
https://YOUR_PROJECT.supabase.co/functions/v1/yandex-userinfo
```

**Allow users without email** — выключено: почта единственный идентификатор (суперадмины
тоже выдаются по email).

### 3. oauth.yandex.com → приложение → API Яндекс ID

- Права: `login:info`, `login:email`
- Redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 4. Supabase → Authentication → URL Configuration → Redirect URLs

- `http://localhost:5173/dashboard`
- `https://quantumschool.ru/dashboard`

Без этих адресов Supabase игнорирует `redirectTo` и возвращает пользователя на Site URL.

Опционально: Authentication → Providers → Email → **Confirm email**. На вход через
Яндекс это почти не влияет (почта уже подтверждена провайдером), но полезно, если
когда-нибудь появятся служебные email-аккаунты.

### 5. Выбор аккаунта Яндекса при входе

Сессия в личном кабинете живёт долго (`persistSession` в `supabase.ts`) — пока
пользователь не нажал «Выйти», повторно через Яндекс его не гоняем.

При нажатии «Войти с Яндекс ID» показываем экран выбора аккаунта: `force_confirm=yes`
передаётся из `AuthContext.tsx` (`signInWithOAuth` → `queryParams`). Дублировать в
**Authorization params** провайдера не обязательно, но можно для подстраховки:

```json
{ "force_confirm": "yes" }
```

[Документация Яндекса](https://yandex.ru/dev/id/doc/ru/codes/code-url) принимает
значения `yes`, `true` и `1`.

### Особенности Dashboard

- Форма провайдера **затирает Client Secret** при сохранении. После каждого сохранения
  проверяйте, что ключи на месте.
- В поле **JWKS URI** Dashboard сам подставляет `https://oauth.yandex.com/.well-known/jwks.json`
  при открытии «Update provider». Этого адреса не существует (404), но на вход это не влияет:
  Яндекс не выдаёт `id_token`, и поле не используется. Стирать не нужно — оно появится снова.
- **Issuer URL** для OAuth2-конфигурации не заполняется.

### Если ошибка осталась

| Сообщение | Причина |
|-----------|---------|
| `missing provider id` | UserInfo URL всё ещё ведёт на `login.yandex.ru`, либо у функции включён Verify JWT |
| `Error getting user email from external provider` | В Scopes нет `login:email`, либо не отмечено право в приложении Яндекса |
| Возврат на главную вместо кабинета | Адрес `/dashboard` не добавлен в Redirect URLs |
