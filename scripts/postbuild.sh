#!/usr/bin/env bash
# Постобработка сборки для GitHub Pages: URL без слэша на конце.
#   bash scripts/postbuild.sh _site [/base-path] ["en ka ru"] [en]
#
# 1) dir/index.html → dir.html  — Pages отдаёт /en/works как файл works.html
#    (иначе он редиректит /en/works → /en/works/).
# 2) корневой index.html — выбирает язык (сохранённый → язык браузера → en) и ведёт на /<lang>.
set -euo pipefail
out="${1:-_site}"
base="${2:-}"; base="${base%/}"
langs="${3:-en ka ru}"
def="${4:-en}"

[ -d "$out" ] || { echo "нет папки $out" >&2; exit 1; }

n=0
while IFS= read -r -d '' f; do
  cp "$f" "$(dirname "$f").html"; n=$((n+1))
done < <(find "$out" -mindepth 2 -type f -name index.html -print0)
echo "postbuild: создано $n файлов вида <dir>.html"

cat > "$out/index.html" <<HTML
<!doctype html>
<html lang="$def"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Romaha Dev Agency</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="$base/$def">
<noscript><meta http-equiv="refresh" content="0;url=$base/$def"></noscript>
<script>
(function(){
  var L="${langs// /,}".split(","),p="$def";
  try{
    var s=localStorage.getItem("lang");
    if(s&&L.indexOf(s)>-1){p=s}
    else{var n=navigator.languages||[navigator.language||""];
      for(var i=0;i<n.length;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(L.indexOf(c)>-1){p=c;break}}}
  }catch(e){}
  location.replace("$base/"+p+location.hash);
})();
</script></head>
<body><a href="$base/$def">Romaha Dev Agency</a></body></html>
HTML
echo "postbuild: корневой редирект → $base/<lang>"
