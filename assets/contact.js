/* Контактная панель + отправка заявки напрямую в Firestore (REST, без SDK).
   Коллекция `leads`: правила разрешают только create с проверкой полей. */
(function(){
  var root = document.documentElement;
  var panel = document.getElementById('contact-panel');
  var backdrop = document.getElementById('contact-backdrop');
  var openBtn = document.getElementById('open-contact');
  var closeBtn = document.getElementById('close-contact');
  var form = document.getElementById('contact-form');
  if(!panel || !openBtn || !form) return;

  function openPanel(){ panel.classList.add('is-open'); backdrop.classList.add('is-open'); root.classList.add('contact-open'); }
  function closePanel(){ panel.classList.remove('is-open'); backdrop.classList.remove('is-open'); root.classList.remove('contact-open'); }
  openBtn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  backdrop.addEventListener('click', closePanel);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePanel(); });

  // placeholder скрывается, как только в поле появился текст
  [].slice.call(panel.querySelectorAll('.contact-field__input, .contact-field__textarea')).forEach(function(inp){
    var wrap = inp.parentNode;
    function sync(){ wrap.classList.toggle('has-value', inp.value.length > 0); }
    inp.addEventListener('input', sync); sync();
  });

  // выбор услуги
  var toggle = document.getElementById('service-toggle');
  var opts = document.getElementById('service-options');
  var label = document.getElementById('service-label');
  var plus = document.getElementById('service-plus');
  var hidden = document.getElementById('service-input');
  function setOpen(o){ opts.classList.toggle('is-open', o); toggle.setAttribute('aria-expanded', String(o)); plus.textContent = o ? '–' : '+'; }
  toggle.addEventListener('click', function(){ setOpen(!opts.classList.contains('is-open')); });
  [].slice.call(opts.querySelectorAll('button')).forEach(function(b){
    b.addEventListener('click', function(){
      hidden.value = b.textContent; label.textContent = b.textContent;
      toggle.classList.add('has-value'); setOpen(false);
    });
  });

  // отправка
  var status = document.getElementById('contact-status');
  var submitBtn = form.querySelector('.contact-panel__submit');
  var FIELDS = ['name','email','company','role','service','message'];
  var busy = false;

  function say(text, bad){ status.textContent = text; status.classList.toggle('is-error', !!bad); }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(busy) return;
    var d = form.elements;
    if(d.website && d.website.value){ say(form.dataset.ok); return; }          // honeypot
    var email = (d.email.value || '').trim();
    if(!(d.name.value || '').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !(d.message.value || '').trim()){
      say('Name, a valid email and a message are required.', true);
      return;
    }
    var fields = { createdAt: { timestampValue: new Date().toISOString() },
                   page: { stringValue: location.pathname } };
    FIELDS.forEach(function(k){
      var v = d[k] ? String(d[k].value || '').trim().slice(0, k === 'message' ? 4000 : 300) : '';
      fields[k] = { stringValue: v };
    });

    var url = 'https://firestore.googleapis.com/v1/projects/' + form.dataset.project +
              '/databases/(default)/documents/leads?key=' + encodeURIComponent(form.dataset.key);
    busy = true; submitBtn.disabled = true; say('…');
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: fields }) })
      .then(function(r){ if(!r.ok) throw new Error(r.status); form.reset(); say(form.dataset.ok); })
      .catch(function(){ say(form.dataset.error, true); })
      .then(function(){ busy = false; submitBtn.disabled = false; });
  });
})();
