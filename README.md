# Anar

AI-платформа для управления профилем ученика. Помогает школам собирать наблюдения, анализировать развитие и своевременно выявлять риски по каждому ученику.

---

## Стек технологий

| Слой | Технология |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| UI компоненты | Tailwind CSS + shadcn/ui |
| База данных + Auth | Supabase (PostgreSQL) |
| AI аналитика | Claude API (Anthropic) |
| Графики | Recharts |
| PDF генерация | @react-pdf/renderer |
| Excel импорт | SheetJS (xlsx) |
| Деплой | Vercel |

---

Загрузка анкет → AI генерирует начальный профиль (1 раз)
      ↓
Учителя добавляют наблюдения (алгоритм, каждый день)
      ↓
Ночью: у кого новые наблюдения → AI обновляет профиль
      ↓
Раз в день: AI анализирует наблюдения школы за месяц
Всё остальное — алгоритм. По-моему это и есть оптимальная схема. 

## Структура проекта

```
smartschool/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Страница входа
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Общий layout с сайдбаром
│   │   ├── page.tsx              # Главная / дашборд администрации
│   │   ├── students/
│   │   │   ├── page.tsx          # Список учеников по классам
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx      # Профиль ученика (все вкладки)
│   │   │   └── import/
│   │   │       └── page.tsx      # Импорт из Excel
│   │   ├── observations/
│   │   │   └── new/
│   │   │       └── page.tsx      # Добавить наблюдение
│   │   ├── staff/
│   │   │   └── page.tsx          # Сотрудники + матрица прав
│   │   ├── analytics/
│   │   │   └── page.tsx          # Аналитика школы
│   │   └── student-book/
│   │       └── page.tsx          # Книга ученика (PDF)
│   └── api/
│       ├── ai/
│       │   ├── insights/
│       │   │   └── route.ts      # AI выводы для дашборда
│       │   └── student-summary/
│       │       └── route.ts      # AI сводка по ученику
│       ├── students/
│       │   └── import/
│       │       └── route.ts      # Обработка Excel импорта
│       └── pdf/
│           └── route.ts          # Генерация PDF книги ученика
│
├── components/
│   ├── ui/                       # shadcn/ui базовые компоненты
│   ├── layout/
│   │   ├── Sidebar.tsx           # Боковое меню
│   │   └── Header.tsx            # Шапка с профилем
│   ├── dashboard/
│   │   ├── StatsCards.tsx        # Карточки статистики
│   │   ├── RiskGroup.tsx         # Группа риска
│   │   ├── AIInsights.tsx        # AI выводы панель
│   │   └── ObservationsFeed.tsx  # Лента наблюдений
│   ├── students/
│   │   ├── StudentCard.tsx       # Карточка ученика в списке
│   │   ├── ClassGroup.tsx        # Группа класса (аккордеон)
│   │   └── profile/
│   │       ├── ProfileHeader.tsx
│   │       ├── OverviewTab.tsx
│   │       ├── InterestsTab.tsx
│   │       ├── GradesTab.tsx
│   │       ├── ActivityTab.tsx
│   │       ├── AchievementsTab.tsx
│   │       ├── PsychologyTab.tsx
│   │       └── DocumentsTab.tsx
│   ├── observations/
│   │   ├── ObservationForm.tsx   # Форма добавления наблюдения
│   │   └── CategoryPicker.tsx    # Выбор категории (6 иконок)
│   ├── analytics/
│   │   ├── SchoolCharts.tsx      # Графики аналитики
│   │   └── AIAnalysis.tsx        # AI анализ наблюдений
│   └── pdf/
│       └── StudentBookPDF.tsx    # Шаблон PDF книги
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Supabase браузерный клиент
│   │   ├── server.ts             # Supabase серверный клиент
│   │   └── middleware.ts         # Auth middleware
│   ├── ai/
│   │   └── claude.ts             # Клиент Claude API + промпты
│   ├── excel/
│   │   └── parser.ts             # Парсер Excel файлов
│   └── utils.ts                  # Общие утилиты
│
├── hooks/
│   ├── useStudents.ts
│   ├── useObservations.ts
│   └── useAIInsights.ts
│
├── types/
│   └── index.ts                  # Все TypeScript типы
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_seed_data.sql
│
├── public/
│   └── logo.svg
│
├── .env.local                    # Переменные окружения (не в git)
├── middleware.ts                 # Next.js middleware (защита роутов)
└── README.md
```

---

## База данных (Supabase)

```sql
schools          -- Школы (мультитенантность)
├── id
├── name
└── created_at

users            -- Сотрудники школы
├── id
├── school_id
├── role         -- admin | deputy | teacher | class_teacher | psychologist | manager | security | nurse
├── full_name
├── email
└── avatar_url

classes          -- Классы (10А, 11Б...)
├── id
├── school_id
├── name         -- "10А"
├── teacher_id   -- классный руководитель
└── year

students         -- Ученики
├── id
├── school_id
├── class_id
├── full_name
├── photo_url
├── status       -- active | inactive
├── risk_level   -- none | medium | high
├── goals        -- JSON массив целей
├── parent_name
└── parent_phone

observations     -- Наблюдения учителей
├── id
├── student_id
├── author_id
├── category     -- academic | behavior | psychology | sport | creative | social
├── content      -- текст наблюдения
├── created_at
└── is_alert     -- тревожный сигнал

student_interests  -- Интересы ученика
├── student_id
├── hobbies      -- JSON
├── sports       -- JSON
└── subjects     -- JSON

ai_insights      -- Кешированные AI выводы
├── id
├── school_id
├── student_id   -- null = для всей школы
├── content      -- JSON с выводами
└── generated_at
```

---

## Роли и права доступа

| Функция | Администрация | Завуч | Учитель | Кл. рук. | Психолог | Медсестра | Охранник | Менеджер |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Все наблюдения | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Аналитика школы | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Профиль ученика | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Добавить наблюдение | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Управление сотрудниками | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Переменные окружения (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## План разработки (14 дней)

### Неделя 1 — Фундамент и ядро

| День | Задача | Статус |
|---|---|---|
| День 1 | Инициализация проекта: Next.js + Supabase + Tailwind + shadcn/ui | ⬜ |
| День 2 | Auth: страница входа, роли, middleware защита роутов | ⬜ |
| День 3 | БД: все таблицы, RLS политики, seed данные | ⬜ |
| День 4 | Список учеников — классы, поиск, фильтры, добавление | ⬜ |
| День 5 | Профиль ученика — все 7 вкладок | ⬜ |
| День 6 | Форма добавления наблюдения — 6 категорий | ⬜ |
| День 7 | Сотрудники — список, роли, матрица прав | ⬜ |

### Неделя 2 — AI, Аналитика, Полировка

| День | Задача | Статус |
|---|---|---|
| День 8 | Дашборд директора — статистика, группа риска | ⬜ |
| День 9 | Claude API: AI выводы на дашборде и в профиле ученика | ⬜ |
| День 10 | Аналитика школы — графики Recharts | ⬜ |
| День 11 | Дашборд классного руководителя + график настроения | ⬜ |
| День 12 | Книга ученика — PDF генерация | ⬜ |
| День 13 | Импорт из Excel (SheetJS) | ⬜ |
| День 14 | Тесты, исправление багов, деплой на Vercel | ⬜ |

---

## Запуск проекта

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build
```

---

## Ключевые решения архитектуры

- **Мультитенантность с первого дня** — каждая школа изолирована через `school_id`
- **RLS в Supabase** — безопасность на уровне БД, каждый видит только свои данные
- **AI кешируется** — выводы генерируются раз в день, не при каждом запросе
- **Server Components** — тяжёлые запросы к БД на сервере, клиент получает готовые данные
