// Firebase Cloud Function (2nd gen): при любой правке контента в Firestore
// запускает пересборку сайта на GitHub Actions (repository_dispatch).
// Деплой:  firebase deploy --only functions
// Секрет:  firebase functions:secrets:set GH_TOKEN   (PAT с правом repo → Contents/Actions: write)
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const GH_TOKEN = defineSecret('GH_TOKEN');
const REPO = 'YOUR-USER/YOUR-REPO';

let timer; // простая «склейка» нескольких правок подряд внутри одного инстанса
async function dispatch() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GH_TOKEN.value()}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ event_type: 'firestore-updated' }),
  });
  if (!r.ok) throw new Error(`GitHub dispatch failed: ${r.status}`);
}
const opts = { secrets: [GH_TOKEN], region: 'europe-west1' };
exports.rebuildOnHome     = onDocumentWritten({ ...opts, document: 'site/{doc}' },     dispatch);
exports.rebuildOnSections = onDocumentWritten({ ...opts, document: 'sections/{doc}' }, dispatch);
