# Romaha — Hugo + GitHub Pages (Firestore подключается позже)

## URL (везде без слэша)
```
/en  /ka  /ru                 главная
/en/works                     каталог кейсов        → /en/works/<case>
/en/services                  каталог услуг         → /en/services/<service>
/en/insights                  блог                  → /en/insights/<article>
/en/about                     о нас
```
Корень `/` — редирект на язык (сохранённый → язык браузера → en).

## Где что менять
| Что | Файл |
|---|---|
| Дизайн страницы каталога кейсов / страницы кейса | `layouts/works/list.html` / `single.html` |
| Услуги | `layouts/services/list.html` / `single.html` |
| Блог | `layouts/insights/list.html` / `single.html` |
| О нас | `layouts/about/single.html` |
| Стили внутренних страниц | `assets/css/inner.css` (общая база — `base.css`) |
| Тексты страниц (по языкам) | `content/<lang>/...md` |
| Новый кейс / услуга / статья | новый файл в `content/<lang>/works|services|insights/` — **одно и то же имя файла во всех языках**, тогда переключатель языка ведёт на перевод |
| Названия пунктов меню, кнопок и т.п. | `i18n/en.toml` (интерфейс везде на английском; `ru.toml` и `ka.toml` — копии `en.toml`) |
| Контакты, логотип, тексты главной | `data/en/home.json` (ka/ru: положите `data/ka/home.json`, `data/ru/home.json` — иначе берётся en) |
| Меню и переключатель языков | `layouts/partials/nav.html`, `assets/css/menu.css`, `assets/js/menu.js` |

Каждая страница независима: правите один шаблон — остальные не затрагиваются.
Главная грузит тяжёлый `main.css` + свой движок скролла, внутренние страницы — только лёгкие `base.css`, `menu.css`, `inner.css`.

## Сборка
```bash
hugo server                     # локально (данные берутся из data/, Firestore не нужен)
hugo --minify --destination _site && bash scripts/postbuild.sh _site   # как в CI
```
`scripts/postbuild.sh` нужен для GitHub Pages: копирует `dir/index.html` → `dir.html`, чтобы `/en/works` отдавался без редиректа на `/en/works/`, и создаёт корневой редирект по языку.

## Firestore (позже)
Генератор `scripts/firestore-sync` пишет в `data/en` (флаг `-out` задаёт другую папку, например `data/ru`).
Пока `FIREBASE_PROJECT_ID` не задан в секретах GitHub — он ничего не делает, сайт собирается из `data/`.
