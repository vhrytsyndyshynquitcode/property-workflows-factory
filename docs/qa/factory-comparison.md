# Звіт порівняння зрізу 3: звичайно проти фабрики

<!-- Шаблон: koldovsky/2026-quitcode-09-software-factory-hw/materials/factory/comparison-report.template.md (бонус WS9). -->

- Зріз 3: менеджер призначає задачі запуску вендору (зовнішньому виконавцю), а вендор бачить і закриває лише свої задачі — нічого іншого з агенції.
- AC зрізу 3: AC-VENDOR-01, AC-VENDOR-02, AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06, AC-VENDOR-07, AC-VENDOR-08, AC-VENDOR-09, AC-VENDOR-10
- Звичайно: https://github.com/vhrytsyndyshynquitcode/property-workflows, SHA `8f3cdef234d0e6e6766722db4c8473c699a918b0`, прод https://property-workflows-one.vercel.app
- Фабрика: https://github.com/vhrytsyndyshynquitcode/property-workflows-factory, SHA злиття фабрики `c7bc8cc2568ee2fca056216b5851881e3eeaad2a`, прод https://property-workflows-factory.vercel.app (`/api/health` → `sha: c7bc8cc…`, `db: ok`)
- Фабрика й імпортер: курс-редакція `koldovsky/2026-quitcode-09-factory` @ `1280bc62cb001ded1fa31f15f45057d8b51f45f3`; адаптер імпортера — https://github.com/vhrytsyndyshynquitcode/2026-quitcode-09-factory/commit/71ea218fa706f8bb187ffe3bde1424c7706ae432 (гілка `team/property-workflows`: префікс «Requirement:» у назві задачі + 2 тести)
- Моделі фабрики: планувальник, будівельник і рецензент — `claude-sonnet-5-5` (пакет доказів, «Cost and provenance»)

## Прогони фабрики

| Run id | Задача і AC | Стан | Спроби | Вартість | Wall-час | Дайджест пакета доказів | PR |
|---|---|---|---|---|---|---|---|
| `run-20261109134056-955ac2` | `vendor-role`: AC-VENDOR-01, 07, 09 (будівельник реалізував увесь зріз — усі 10 AC) | released | 5/5 (3 автоматичні + 2 після `answer`) | $1.40 (planner $0.30, builder $0.97, reviewer $0.13) | 2608 с (13:40:56 → 14:24:24 UTC, `events.jsonl`; включно з очікуванням схвалення плану й відповідей) | `b1ace0fc9a37a89a7bd7843dd0bc471d8e3a9f3155fdd46fa368c79e802d824f` | https://github.com/vhrytsyndyshynquitcode/property-workflows-factory/pull/1 (автозлиття після required checks) |
| `run-20261109142819-4b03ba` | `vendor-access`: AC-VENDOR-02, 08 | refused на допуску | 0 | $0.00 | 131 с | — | — |

`vendor-run` (AC-VENDOR-04, 06) і `vendor-lists` (AC-VENDOR-03, 05, 10) не запускали: їхні видимі тести вже зелені після першого прогону, тож допуск відмовив би так само, як `vendor-access` («visible test … already passes on the original code, so it cannot prove the change»).

## За AC

Звичайно: тести бази — `tests/db/vendor-access.test.ts`, тести сторінок — `tests/runs/vendor.test.ts`, UAT — `tests/e2e/vendor.spec.ts`, звіт https://github.com/vhrytsyndyshynquitcode/property-workflows/blob/8f3cdef234d0e6e6766722db4c8473c699a918b0/docs/qa/uat/2026-11-09/report.md (13/13 PASS, R6).
Фабрика: видимі тести — `tests/db/vendor-NN.test.ts` і `tests/vendor/ac-vendor-NN.test.ts` (тег `ws9-red`, з тексту AC); приховані сценарії — 4 запечатані набори.

| AC | Звичайно: тест і доказ | Звичайно: UAT | Фабрика: `verifiedBy` і доказ у пакеті | Фабрика: UAT на проді двійника | Різниця в поведінці |
|---|---|---|---|---|---|
| AC-VENDOR-01 | `tests/db/vendor-access.test.ts`, SQL-мутант V01 KILLED | PASS (R6) | visible ✓ (132/132), holdout `vendor-role` 4/4 у воротах | не виконано | немає (за тестами) |
| AC-VENDOR-02 | `tests/db/vendor-access.test.ts`, V02 KILLED | PASS (R6) | visible ✓; holdout `vendor-access` 4/4 — перевірено вручну після злиття, не воротами | не виконано | немає (за тестами) |
| AC-VENDOR-03 | `tests/runs/vendor.test.ts` | PASS (R6) | visible ✓; holdout `vendor-lists` 3/4 вручну — HV03a хибний сам (не передає `createdAt`, якого вимагає контракт `tests/vendor/contract.ts`) | не виконано | немає (за тестами) |
| AC-VENDOR-04 | `tests/db/vendor-access.test.ts`, V04 KILLED | PASS (R6) | visible ✓; holdout `vendor-run` 4/4 вручну | не виконано | немає (за тестами) |
| AC-VENDOR-05 | `tests/runs/vendor.test.ts` | PASS (R6) | visible ✓; holdout `vendor-lists` 3/3 вручну | не виконано | **так:** вендор закриває останню обов'язкову задачу без підтвердження (див. «Вади») |
| AC-VENDOR-06 | `tests/db/vendor-access.test.ts`, V06 KILLED | PASS (R6) | visible ✓; holdout `vendor-run` 4/4 вручну | не виконано | немає (за тестами) |
| AC-VENDOR-07 | `tests/db/vendor-access.test.ts`, V07 KILLED | PASS (R6) | visible ✓, holdout `vendor-role` 4/4 у воротах | не виконано | немає (за тестами) |
| AC-VENDOR-08 | `tests/db/vendor-access.test.ts`, V08 KILLED | PASS (R6) | visible ✓; holdout `vendor-access` 4/4 вручну | не виконано | не перевірено: фабрика змінила `src/app/templates/page.tsx` і `src/app/runs/new/page.tsx`, але не `src/app/templates/[id]/**` (захист там — лише RLS) |
| AC-VENDOR-09 | `tests/db/vendor-access.test.ts`, V09 KILLED | PASS (R6) | visible ✓, holdout `vendor-role` 4/4 у воротах | не виконано | немає (за тестами) |
| AC-VENDOR-10 | `tests/runs/vendor.test.ts` | PASS (R6) | visible ✓; holdout `vendor-lists` 4/4 вручну | не виконано | немає (за тестами) |

«Вручну» — 27 сценаріїв наборів `vendor-access`, `vendor-run`, `vendor-lists` я розшифрував і прогнав Vitest на `c7bc8cc` після злиття (38/39 разом із `vendor-role`), бо їхні задачі фабрика відмовила на допуску. Це не ворота фабрики.

## Метрики

| Метрика | Звичайно | Фабрика | Джерело |
|---|---|---|---|
| Час (календарний) | PR «Специфікація» 02.11 10:57 → злиття останнього PR зрізу 09.11 10:31 UTC; задачі реалізації: #45 відкрито 08:41 → #48 злито 10:31 (1 год 50 хв) | `ws9-red` 09.11 11:19 UTC → злиття PR #1 14:26 UTC (3 год 07 хв, з них ~1 год — очікування печатки й налаштування двійника людиною) | PR https://github.com/vhrytsyndyshynquitcode/property-workflows/pull/41, …/pull/45, …/pull/48; тег `ws9-red`; PR фабрики #1 |
| Хвилини людини | не виміряно | не виміряно | журналу хвилин не вели |
| Вартість | не виміряно | $1.40 (усі 5 спроб) + $0.00 (refused) | пакет доказів, «Cost and provenance»; `run.json` |
| Токени | не виміряно | вихід 37 763; вхід 128 + кеш читання 1 501 625 + запис у кеш 217 187 | `store/runs/run-20261109134056-955ac2/agent-*-summary.json` |
| Спроби | не виміряно | 5/5 прогону `vendor-role` | `run.json` → `attempts` |
| Що зловили ворота | CodeRabbit на #47 — 5 знахідок; на #45, #46, #48 рев'ю не було | спроба 1 — maintainability (2 дублювання); 2 — visible-tests (typecheck); 3 — mutation 2/4 (вендору вимкнули підтвердження); 4 — typecheck (`rpc` без типу); boundary — 1 відмова хука в кожному прогоні; допуск — refused `vendor-access` | `run.json`, `events.jsonl` |
| Втручання людини | — | 9 (див. нижче) | розділ «Втручання людини у фабриці» |
| Вади від UAT | 0 (13/13 PASS) | не виміряно — UAT на проді двійника не виконано | звіт UAT основного репо |
| Вади від PM | не виміряно (приймання до 15.11) | не виміряно | — |
| Мутації | SQL-мутанти V01, V02, V04, V06, V07, V08, V09 — 7/7 KILLED | ворота mutation 4/4 (score 1.00) на останній спробі | `scripts/mutants.mjs` основного репо; пакет доказів |
| Розмір diff (`src`, `supabase`) | 16 файлів, +381 −62 | 12 файлів, +429 −41 | `git diff --shortstat ws9-base 8f3cdef -- src supabase`; `git diff --shortstat ws9-base c7bc8cc -- src supabase` |
| Якість коду | fallow audit зелений у `quality` | maintainability PASS; рев'юер — 3 примітки (1 medium, 2 low); fallow audit у PR #1 зелений | пакет доказів, «Review notes»; checks PR #1 |

## Втручання людини у фабриці

- Виправлення допоміжної функції в 26 прихованих сценаріях бази до печатки (сортування задач за позицією в межах розділу давало хибний порядок; перевірено на `main` основного репо: 25/26).
- Печатка 4 наборів (`holdouts seal`), ключ — лише в змінній середовища користувача.
- `approve config` і `approve intent` × 4 (`vendor-role`, `vendor-access`, `vendor-run`, `vendor-lists`).
- `approve plan run-20261109134056-955ac2` — план охоплював увесь зріз, а не лише AC задачі; схвалено свідомо.
- `answer` після спроби 3 (mutation): «не вимикати підтвердження для вендора; вирішувати в базі функцією `is_last_required_task`, без гілки за роллю в TypeScript».
- `answer` після спроби 4 (typecheck): «додати функцію в `database.types.ts` руками, без cast і ts-ignore».
- `deliver run-20261109134056-955ac2` — справжній репозиторій: push, PR #1 з пакетом доказів в описі, `gh pr merge --auto --squash`; злито після required checks, `db-deploy` застосував `20261109120000_vendor_role.sql` (https://github.com/vhrytsyndyshynquitcode/property-workflows-factory/actions/runs/42634642583).
- Налаштування двійника: перезапуск `db-deploy` після додавання секрету, змінна `PROD_URL`, ruleset `solo-main`.
- Відкритий і закритий без злиття PR #2 (UAT-специфікації з основного репо) — правило бонусу забороняє переносити тести основної реалізації; у двійнику не лишилось.

## Вади

- **Підтверджено (рецензент фабрики, перевірено читанням коду):** `src/app/runs/[id]/page.tsx:119` — вендору рендериться `MarkDoneForm … confirmed`, тож `markTaskDone` пропускає перевірку `is_last_required_task`, і вендор закриває останню обов'язкову задачу (а з нею запуск) одним кліком без «This cannot be undone». Після першої підказки будівельник переніс обхід із дії в сторінку. Ворота не зловили: сторінки не покрито тестами, мутанти лише в змінених рядках дії. У звичайній реалізації вендор отримує підтвердження (`is_last_required_task` для всіх ролей).
- Рецензент (low): `launch_run` мовчки ігнорує невідомі ключі задач у `p_assignments`; вендор читає рядок `runs` повністю (зокрема `run_manager_id`) прямим запитом — у звичайній реалізації так само (не перевірено окремо).

## Що не перевірено

- UAT на проді двійника — не виконано: для синтетичних акаунтів двійника потрібен `SUPABASE_SECRET_KEY` проєкту Supabase двійника в `.env.local`, а його не внесено. Без цього AC, що видно лише в браузері, у двійнику не доведено.
- Ізоляція агента — на рівні політики в одному обліковому записі ОС (пакет доказів, «Not verified»).
- AC-VENDOR-08 для `/templates/[id]` у двійнику — лише RLS, сторінку фабрика не змінювала.
- Приховані сценарії трьох наборів — перевірено мною вручну, не воротами фабрики.

## Частковий прогін

Зроблено: двійник (`ws9-base`, свій Supabase і Vercel, auto-merge, ruleset, `SUPABASE_DB_URL`, `PROD_URL`), адаптер імпортера, червоні тести `ws9-red` з тексту AC, 39 прихованих сценаріїв (запечатано), doctor, схвалення, прогін, поставка `deliver` з автозлиттям і міграцією, деплой двійника. Не зроблено: UAT на проді двійника (немає ключа Supabase двійника локально) і виправлення вади підтвердження вендора. Доведено тестами й прихованими сценаріями: усі 10 AC на рівні бази й чистих функцій; браузером у двійнику — жодного.

## Висновок

1. Де фабрика краща: за $1.40 і 43 хв wall-часу прогону (з очікуванням людини) реалізувала весь зріз з одного прогону, а ворота (mutation, typecheck) самі відбили два хибні варіанти.
2. Де фабрика гірша: обхідний шлях замість правила — вимкнене підтвердження вендора пройшло всі ворота, бо UI без тестів; задачі зрізу не ізолюються — перший прогін забрав AC інших задач, і ті відмовлено на допуску.
3. Що візьмемо у звичайний процес: мутації на змінених рядках як ворота PR і правило «червоний тест на сторінку, а не лише на дію» для кожного AC із підтвердженням.
