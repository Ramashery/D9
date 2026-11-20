// Слайды берутся из разметки Hugo (<script id="works-data" type="application/json">),
// которую list.html собирает из data/<lang>/works_slides.json.
const raw = JSON.parse(document.getElementById('works-data').textContent);

const TITLE_LINE = 89.6; // высота строки заголовка в дизайн-пикселях (112px * 0.8)
const GAP = 38.8; // расстояние от заголовка до строки с мета-данными

export const SLIDES = raw.slides.map((s) => {
  const lines = s.title.length;
  const height = lines * TITLE_LINE;
  const top = -(height + GAP) / 2; // группа «заголовок + мета» по центру экрана
  return {
    title: s.title,
    category: s.type,
    type: s.type,
    year: s.year,
    services: s.services,
    url: s.url || '',
    layout: { title: top, meta: top + height + GAP },
    media: { type: 'video', src: s.video, width: 1920, height: 1080 }, // размер уточняется после загрузки
    zoom: 1,
    work: null,
  };
});

export const meta = (slide) => `${slide.type} — ${slide.year}`;
export const PRELOADER_TILES = [];
