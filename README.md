# Romaha — Hugo + Firestore + GitHub Pages

```
Firestore ──(go run, при сборке)──▶ data/*.json ──▶ Hugo ──▶ public/ ──▶ GitHub Pages
                                                       ▲
форма на сайте ──(REST, прямо из браузера)──▶ Firestore: leads
```

## Структура
| Путь | Назначение |
|---|---|
| `scripts/firestore-sync/` | Go-генератор: Firestore → `data/home.json`, `data/sections.json` (и `-seed` в обратную сторону) |
| `data/` | Контент (сейчас — seed из вашего HTML; в CI перезаписывается данными из Firestore) |
| `layouts/index.html` + `layouts/partials/` | Шаблон главной: hero, секции (цикл), footer, контактная панель |
| `assets/css`, `assets/js` | Ваши CSS/JS, вынесенные из HTML; Hugo склеивает, минифицирует, добавляет хэш |
| `firestore/` | Правила безопасности и Cloud Function для автопересборки |
| `.github/workflows/deploy.yml` | Сборка и деплой |

## Модель данных Firestore
- `site/home` — meta, logo, hero, contacts, footer, form (тексты формы и список услуг)
- `sections/{id}` — `order`, `title`, `cards[3]`, `accent_videos[2]`, `reveal_video`, `square_video`, `takeover{…}`
- `leads/{auto}` — заявки (только создание, читать — в консоли)

Новую секцию добавляет новый документ в `sections` — шаблон отрисует её сам.

## Запуск
```bash
# 0. Локально без Firestore (из seed в data/):
hugo server

# 1. Один раз залить seed в Firestore:
cd scripts/firestore-sync
FIREBASE_PROJECT_ID=... FIREBASE_SA_JSON="$(cat sa.json)" go run . -seed

# 2. Скачать актуальные данные:
FIREBASE_PROJECT_ID=... go run .
```
GitHub → Settings: Pages → Source = GitHub Actions; Secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_SA_JSON` (необязателен при публичном чтении).
В `hugo.toml` пропишите `baseURL`, `params.firebase.projectId/apiKey`. Правила — `firestore/firestore.rules`.
