// raffle-picker-bd — app wiring: state, wheel canvas, spin animation, persistence.
'use strict';
(function () {
  const LS_KEY = 'raffle-picker-bd-v1';
  const LANG_KEY = 'raffle-picker-bd-lang';
  const SAMPLE = ['Rahim', 'Karim', 'Sumon', 'Nusrat', 'Fahim', 'Priya', 'Tanvir', 'Mim'];

  let lang = localStorage.getItem(LANG_KEY) || 'en';
  let names = [];
  let winners = [];
  let noRepeat = true;
  let spinning = false;
  let rot = 0;

  function t(key) { return STR[lang][key] || STR.en[key] || key; }
  function fmt(n) { return lang === 'bn' ? toBnDigits(n) : String(n); }
  function $(id) { return document.getElementById(id); }

  function persist() {
    localStorage.setItem(LS_KEY, JSON.stringify({ app: 'raffle-picker-bd', version: 1, names, winners, noRepeat }));
    localStorage.setItem(LANG_KEY, lang);
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const v = validateImport(JSON.parse(raw));
      if (v.ok) { names = v.data.names; winners = v.data.winners; noRepeat = v.data.noRepeat; }
    } catch (e) { /* corrupted storage: start empty, never crash */ }
  }

  function drawWheel() {
    const cv = $('wheelCanvas');
    const ctx = cv.getContext('2d');
    const W = cv.width, cx = W / 2, cy = W / 2, R = W / 2 - 6;
    ctx.clearRect(0, 0, W, W);
    if (names.length === 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#475569'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(t('emptyPool'), cx, cy);
      return;
    }
    const seg = (Math.PI * 2) / names.length;
    names.forEach((name, i) => {
      const a0 = rot + i * seg, a1 = a0 + seg;
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a0 + seg / 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right';
      const label = name.length > 14 ? name.slice(0, 13) + '…' : name;
      ctx.fillText(label, R - 10, 5);
      ctx.restore();
    });
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(names.length), cx, cy + 5);
  }

  function render() {
    document.querySelector('h1').textContent = t('title');
    $('subtitle').textContent = t('subtitle');
    $('namesTitle').textContent = t('namesTitle');
    $('bulkLabel').textContent = t('bulkLabel');
    $('bulkNames').placeholder = t('bulkPlaceholder');
    $('addBulkBtn').textContent = t('addBulk');
    $('singleLabel').textContent = t('singleLabel');
    $('addSingleBtn').textContent = t('addSingle');
    $('sampleBtn').textContent = t('sample');
    $('sampleNote').textContent = t('sampleNote');
    $('wheelTitle').textContent = t('wheelTitle');
    $('spinBtn').textContent = spinning ? t('spinning') : t('spin');
    $('quickLabel').textContent = t('quickLabel');
    $('quickDrawBtn').textContent = t('quickDraw');
    $('noRepeatLabel').textContent = t('noRepeat');
    $('winnersTitle').textContent = t('winnersTitle');
    $('resetDrawBtn').textContent = t('resetDraw');
    $('dataTitle').textContent = t('dataTitle');
    $('exportBtn').textContent = t('exportBtn');
    $('importBtn').textContent = t('importBtn');
    $('eraseBtn').textContent = t('eraseBtn');
    $('eraseHint').textContent = t('eraseHint');
    $('footerText').textContent = t('footer');
    $('langBtn').textContent = lang === 'en' ? 'বাংলা' : 'English';
    $('poolCount').textContent = fmt(names.length) + ' ' + t('pool');
    $('winnerCount').textContent = fmt(winners.length) + ' ' + t('winners');
    $('noRepeatToggle').checked = noRepeat;
    $('spinBtn').disabled = spinning || names.length < 2;
    $('quickDrawBtn').disabled = spinning || names.length < 1;

    const list = $('nameList');
    list.innerHTML = '';
    names.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'name-row';
      const span = document.createElement('span');
      span.textContent = name;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'mini'; btn.textContent = t('remove');
      btn.setAttribute('data-i', String(i));
      btn.addEventListener('click', () => { names.splice(i, 1); persist(); drawWheel(); render(); });
      row.appendChild(span); row.appendChild(btn); list.appendChild(row);
    });
    if (names.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-note'; p.textContent = t('emptyPool');
      list.appendChild(p);
    }

    const wl = $('winnersList');
    wl.innerHTML = '';
    if (winners.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-note'; p.textContent = t('noWinners');
      wl.appendChild(p);
    } else {
      winners.forEach((w, i) => {
        const row = document.createElement('div');
        row.className = 'winner-row';
        const d = new Date(w.at);
        row.textContent = fmt(i + 1) + '. ' + w.name + ' — ' +
          String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        wl.appendChild(row);
      });
    }
    drawWheel();
  }

  function showError(code) {
    const map = { empty: 'errEmpty', duplicate: 'errDuplicate', 'too-long': 'errTooLong', 'too-many': 'errTooMany' };
    $('formError').textContent = code ? t(map[code] || 'errEmpty') : '';
  }
  function announceWinner(name) {
    const b = $('winnerBanner');
    b.innerHTML = '';
    const small = document.createElement('div');
    small.className = 'banner-label'; small.textContent = t('winnerLabel');
    const big = document.createElement('div');
    big.className = 'banner-name'; big.textContent = name;
    b.appendChild(small); b.appendChild(big);
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }

  function recordWinners(drawn) {
    const now = new Date().toISOString();
    drawn.forEach(n => winners.push({ name: n, at: now }));
    persist(); render();
  }

  function spin() {
    if (spinning || names.length < 2) { showError(names.length < 2 ? 'needTwo' : ''); $('formError').textContent = names.length < 2 ? t('needTwo') : ''; return; }
    const idx = secureRandomIndex(names.length);
    const winner = names[idx];
    const start = rot;
    const target = targetRotation(rot, idx, names.length, 5);
    spinning = true; showError(''); $('winnerBanner').innerHTML = '';
    render();
    const T0 = performance.now(), DUR = 4500;
    function frame(now) {
      const p = Math.min(1, (now - T0) / DUR);
      const eased = 1 - Math.pow(1 - p, 5);
      rot = start + (target - start) * eased;
      drawWheel();
      if (p < 1) requestAnimationFrame(frame);
      else {
        rot = target % (Math.PI * 2);
        spinning = false;
        announceWinner(winner);
        if (noRepeat) names.splice(names.indexOf(winner), 1);
        recordWinners([winner]);
      }
    }
    requestAnimationFrame(frame);
  }

  function quickDraw() {
    if (spinning || names.length < 1) { $('formError').textContent = t('needOne'); return; }
    const count = Math.max(1, Math.min(10, parseInt($('quickCount').value, 10) || 1));
    const res = drawWinners(names, count, noRepeat);
    if (res.winners.length === 0) { $('formError').textContent = t('needOne'); return; }
    names = res.remaining;
    showError('');
    if (res.winners.length === 1) announceWinner(res.winners[0]);
    else {
      const b = $('winnerBanner'); b.innerHTML = '';
      const small = document.createElement('div');
      small.className = 'banner-label'; small.textContent = t('winnerLabel');
      b.appendChild(small);
      res.winners.forEach(n => { const d = document.createElement('div'); d.className = 'banner-name'; d.textContent = n; b.appendChild(d); });
    }
    recordWinners(res.winners);
  }

  document.addEventListener('DOMContentLoaded', () => {
    load(); render();
    $('langBtn').addEventListener('click', () => { lang = lang === 'en' ? 'bn' : 'en'; persist(); render(); });
    $('addBulkBtn').addEventListener('click', () => {
      const res = addNames(names, $('bulkNames').value);
      names = res.names; persist();
      $('formError').textContent = res.error ? t('errTooMany') :
        (fmt(res.added) + ' ' + t('addedMsg') + ', ' + fmt(res.skipped) + ' ' + t('skippedMsg'));
      $('bulkNames').value = ''; render();
    });
    $('singleForm').addEventListener('submit', e => {
      e.preventDefault();
      const res = addSingleName(names, $('singleName').value);
      names = res.names; persist(); showError(res.error);
      if (res.ok) $('singleName').value = '';
      render();
    });
    $('sampleBtn').addEventListener('click', () => {
      const res = addNames(names, SAMPLE.join('\n'));
      names = res.names; persist(); render();
    });
    $('spinBtn').addEventListener('click', spin);
    $('quickDrawBtn').addEventListener('click', quickDraw);
    $('noRepeatToggle').addEventListener('change', e => { noRepeat = e.target.checked; persist(); render(); });
    $('resetDrawBtn').addEventListener('click', () => {
      const back = winners.map(w => w.name).filter(n => !names.includes(n));
      names = names.concat(back); winners = []; $('winnerBanner').innerHTML = '';
      persist(); render();
    });
    $('exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ app: 'raffle-picker-bd', version: 1, names, winners, noRepeat }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'raffle-picker-bd.json'; a.click();
      URL.revokeObjectURL(a.href);
    });
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const v = validateImport(JSON.parse(r.result));
          if (!v.ok) { $('importError').textContent = t('errImport'); return; }
          names = v.data.names; winners = v.data.winners; noRepeat = v.data.noRepeat;
          $('importError').textContent = t('imported'); persist(); render();
        } catch (err) { $('importError').textContent = t('errImport'); }
      };
      r.readAsText(f); e.target.value = '';
    });
    $('eraseBtn').addEventListener('click', () => {
      if ($('eraseInput').value !== 'DELETE') { $('importError').textContent = t('eraseHint'); return; }
      localStorage.removeItem(LS_KEY);
      names = []; winners = []; $('winnerBanner').innerHTML = ''; $('eraseInput').value = '';
      $('importError').textContent = ''; render();
    });
  });
})();
