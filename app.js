/* Antarmuka AntroAnak – Status Gizi Anak WHO–CDC */
(function () {
  'use strict';
  var G = window.Growth, fmt = G.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var last = null;

  function todayISO() {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function parseDate(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoOf(d) { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function tglIndo(d) { return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function num(id) { var v = $(id).value.replace(',', '.'); return v === '' ? null : parseFloat(v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, 2800); }

  $('tglUkur').value = todayISO();

  function contoh(o) {
    $('nama').value = o.nama; $('norm').value = o.norm;
    $(o.jk === 'm' ? 'jkL' : 'jkP').checked = true;
    var b = new Date(); b.setMonth(b.getMonth() - o.bulan);
    $('tglLahir').value = isoOf(b); $('tglUkur').value = todayISO();
    $('bb').value = o.bb; $('tb').value = o.tb; $(o.cara === 'baring' ? 'caraBaring' : 'caraBerdiri').checked = true;
    $('lk').value = o.lk || ''; $('petugas').value = '';
    $('form').requestSubmit();
  }
  $('btnContohBalita').addEventListener('click', function () { contoh({ nama: 'Contoh: Sari', norm: 'RM-000124', jk: 'f', bulan: 13, bb: '8.2', tb: '74.0', cara: 'baring', lk: '45.0' }); });
  $('btnContohAnak').addEventListener('click', function () { contoh({ nama: 'Contoh: Andi', norm: 'RM-000123', jk: 'm', bulan: 100, bb: '34.5', tb: '128.0', cara: 'berdiri' }); });

  $('form').addEventListener('reset', function () {
    setTimeout(function () { $('tglUkur').value = todayISO(); $('hasil').hidden = true; $('formMsg').hidden = true; }, 0);
  });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = [];
    var birth = parseDate($('tglLahir').value), meas = parseDate($('tglUkur').value);
    var bb = num('bb'), tb = num('tb'), lk = num('lk');
    if (!birth) msg.push('Isi tanggal lahir.');
    if (!meas) msg.push('Isi tanggal ukur.');
    if (!bb || bb < 0.5 || bb > 250) msg.push('Berat badan harus antara 0,5 dan 250 kg.');
    if (!tb || tb < 30 || tb > 230) msg.push('Panjang/tinggi badan harus antara 30 dan 230 cm.');
    if (lk !== null && (lk < 25 || lk > 60)) msg.push('Lingkar kepala harus antara 25 dan 60 cm, atau dikosongkan.');
    var inp = {
      sex: document.querySelector('input[name="jk"]:checked').value,
      birth: birth, meas: meas, bb: bb, tb: tb, lk: lk,
      cara: document.querySelector('input[name="cara"]:checked').value
    };
    var res = msg.length ? null : G.evaluate(inp);
    if (res && res.errors.length) msg = msg.concat(res.errors);
    if (msg.length) { $('formMsg').textContent = msg.join(' '); $('formMsg').hidden = false; $('hasil').hidden = true; return; }
    $('formMsg').hidden = true;
    last = { inp: inp, res: res, nama: $('nama').value.trim(), norm: $('norm').value.trim(), petugas: $('petugas').value.trim() };
    render(last);
    $('hasil').hidden = false;
    drawCharts(last);
    $('hasil').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  $('pembanding').addEventListener('change', function () { if (last) render(last); });

  function rowsHTML(out) {
    return out.rows.map(function (r) {
      var a = r.res, dec = r.ind.satuan === 'kg' ? 2 : 1, pTxt = '–', zTxt = '–';
      if (a) {
        pTxt = a.p < 0.1 ? '< 0,1' : a.p > 99.9 ? '> 99,9' : fmt(a.p, 1);
        zTxt = (a.z >= 0 ? '+' : '−') + fmt(Math.abs(a.z), 2);
      }
      var extra = '';
      if (r.extra && r.extra.pctP95 && a && a.p >= 85) extra = '<small class="muted">' + fmt(r.extra.pctP95, 0) + '% dari P95</small>';
      var zFirst = out.ref.skala === 'z';
      return '<tr><td class="ind">' + r.ind.nama + '<small>' + r.ind.lengkap + '</small></td>' +
        '<td class="num" data-label="Nilai">' + fmt(r.value, dec) + ' ' + r.ind.satuan + '</td>' +
        '<td class="num' + (zFirst ? ' key' : '') + '" data-label="Z-score">' + zTxt + '</td>' +
        '<td class="num' + (zFirst ? '' : ' key') + '" data-label="Persentil">' + pTxt + '</td>' +
        '<td class="klas"><span class="chip ' + r.klas.c + '">' + esc(r.klas.t) + '</span>' + extra + '</td></tr>';
    }).join('');
  }
  var THEAD = '<thead><tr><th>Indikator</th><th>Nilai</th><th>Z-score</th><th>Persentil</th><th>Interpretasi</th></tr></thead>';

  function bbiHTML(b, bb, refNama) {
    if (!b) return '<div class="bbi-text">%BBI tidak dapat dihitung: panjang/tinggi badan di luar rentang tabel ' + refNama + '.</div>';
    return '<div class="bbi-big">' + fmt(b.pct, 1) + '%</div>' +
      '<div class="bbi-text"><span class="chip ' + b.klas.c + '">' + b.klas.t + '</span><br>' +
      'BB ideal <b>' + fmt(b.ideal, 1) + ' kg</b> (' + esc(b.metode) + '). BB aktual ' + fmt(bb, 2) + ' kg.' +
      '<div class="bbi-scale"><span>&lt;70% gizi buruk</span><span>70–&lt;90% gizi kurang</span><span>90–110% gizi baik</span><span>&gt;110–120% overweight</span><span>&gt;120% obesitas</span></div></div>';
  }

  var FOOT = {
    who: 'Hasil utama memakai standar WHO 2006 dengan klasifikasi Permenkes No. 2 Tahun 2020 (z-score). Indikator berbasis berat memakai z-score terbatas WHO untuk nilai di luar ±3 SD.',
    cdc: 'Hasil utama memakai CDC 2000. Klasifikasi IMT/U mengikuti CDC (&lt;P5 gizi kurang, P5–&lt;P85 normal, P85–&lt;P95 gizi lebih, ≥P95 obesitas, ≥120% P95 obesitas berat).'
  };

  function render(s) {
    var inp = s.inp, res = s.res, P = res.primary, C = res.comparator, ap = res.ageParts;
    var umur = ap.y + ' th ' + ap.m + ' bln ' + ap.d + ' hr';
    var items = [
      ['Nama', s.nama || '–'], ['No. RM / ID', s.norm || '–'],
      ['Jenis kelamin', inp.sex === 'm' ? 'Laki-laki' : 'Perempuan'], ['Tanggal lahir', tglIndo(inp.birth)],
      ['Tanggal ukur', tglIndo(inp.meas)], ['Umur', umur + ' (' + fmt(res.ageMonths, 1) + ' bln)'],
      ['Berat badan', fmt(inp.bb, 2) + ' kg'], [inp.cara === 'baring' ? 'Panjang badan' : 'Tinggi badan', fmt(inp.tb, 1) + ' cm (' + (inp.cara === 'baring' ? 'berbaring' : 'berdiri') + ')']
    ];
    if (inp.lk) items.push(['Lingkar kepala', fmt(inp.lk, 1) + ' cm']);
    if (s.petugas) items.push(['Petugas', s.petugas]);
    items.push(['Referensi utama', P.ref.nama + ' (' + P.set + ')']);
    $('identitas').innerHTML = items.map(function (i) { return '<div><dt>' + esc(i[0]) + '</dt><dd>' + esc(i[1]) + '</dd></div>'; }).join('');

    $('refBadge').innerHTML = '<span class="ref-tag">' + P.ref.nama + '</span><span>' + esc(P.ref.lengkap) + '</span>';
    $('modeNote').textContent = res.mode === 'balita'
      ? 'Mode otomatis IDAI: anak berumur < 5 tahun dinilai dengan WHO 2006.'
      : 'Mode otomatis IDAI: anak berumur ≥ 5 tahun dinilai dengan CDC 2000.';

    $('catatanUkur').hidden = !P.notes.length;
    $('catatanUkur').innerHTML = P.notes.map(esc).join('<br>');

    $('tblMain').innerHTML = THEAD + '<tbody>' + rowsHTML(P) + '</tbody>';
    $('bbiBox').innerHTML = bbiHTML(P.bbi, inp.bb, P.ref.nama);

    var showC = $('pembanding').checked && C;
    $('cmpSec').hidden = !showC;
    if (showC) {
      $('cmpTitle').textContent = 'Pembanding · ' + C.ref.nama;
      $('cmpSub').textContent = C.ref.lengkap + (C.set ? ' · ' + C.set : '') + '. Hanya untuk informasi; catat hasil utama di rekam medis.';
      $('tblCmp').innerHTML = THEAD + '<tbody>' + rowsHTML(C) + '</tbody>';
      $('cmpBbi').innerHTML = C.bbi ? '%BBI menurut ' + C.ref.nama + ': <b>' + fmt(C.bbi.pct, 1) + '%</b> (' + C.bbi.klas.t.toLowerCase() + '; BB ideal ' + fmt(C.bbi.ideal, 1) + ' kg).' : '';
      $('cmpBbi').hidden = !C.bbi;
      $('cmpNotes').hidden = !C.notes.length;
      $('cmpNotes').innerHTML = C.notes.map(esc).join('<br>');
    }
    $('footNote').innerHTML = '<b>Catatan:</b> ' + FOOT[P.ref.id] + ' %BBI diklasifikasikan menurut kriteria Waterlow sesuai rekomendasi IDAI. Hasil ini alat bantu skrining dan tidak menggantikan penilaian klinis.';
    $('printedAt').textContent = 'Dicetak ' + new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  }

  /* ===== Grafik (canvas) ===== */
  function drawCharts(s) {
    var box = $('charts'); box.innerHTML = '';
    s.res.primary.charts.forEach(function (c) {
      var card = document.createElement('div'); card.className = 'chart-card';
      card.innerHTML = '<h4>' + esc(G.chartTitle(c)) + '</h4>';
      var cv = document.createElement('canvas');
      card.appendChild(cv); box.appendChild(card);
      drawOne(cv, c);
    });
  }

  function drawOne(cv, c) {
    var spec = G.chartSpec(c), cfg = spec.cfg, W = 640, H = 512, dpr = 2;
    cv.width = W * dpr; cv.height = H * dpr;
    var g = cv.getContext('2d'); g.scale(dpr, dpr);
    var ink = '#14302c', muted = '#6b7f7c', grid = '#e3ecea', teal = '#00897f', edge = '#c0392b', outer = '#3d3d3d';
    var ymin = Infinity, ymax = -Infinity;
    spec.lines.forEach(function (k) { k.pts.forEach(function (p) { if (isFinite(p[1])) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); } }); });
    ymin = Math.min(ymin, c.y); ymax = Math.max(ymax, c.y);
    var ystep = cfg.ystep;
    ymin = Math.floor(ymin / ystep) * ystep; ymax = Math.ceil(ymax / ystep) * ystep;
    while ((ymax - ymin) / ystep > 12) ystep *= 2;
    ymin = Math.floor(ymin / ystep) * ystep; ymax = Math.ceil(ymax / ystep) * ystep;
    var L = 48, R = 34, T = 14, B = 44, pw = W - L - R, ph = H - T - B;
    var X = function (x) { return L + (x - cfg.xmin) / (cfg.xmax - cfg.xmin) * pw; };
    var Y = function (y) { return T + ph - (y - ymin) / (ymax - ymin) * ph; };

    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.font = '12px system-ui, -apple-system, Roboto, sans-serif';
    g.strokeStyle = grid; g.lineWidth = 1; g.fillStyle = muted;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (var y = ymin; y <= ymax + 1e-9; y += ystep) { g.beginPath(); g.moveTo(L, Y(y)); g.lineTo(L + pw, Y(y)); g.stroke(); g.fillText(fmt(y, 0), L - 6, Y(y)); }
    g.textAlign = 'center'; g.textBaseline = 'top';
    var x0 = Math.ceil(cfg.xmin / cfg.xstep - 1e-9) * cfg.xstep;
    for (var x = x0; x <= cfg.xmax + 1e-9; x += cfg.xstep) {
      g.beginPath(); g.moveTo(X(x), T); g.lineTo(X(x), T + ph); g.stroke();
      g.fillText(cfg.years ? String(x / 12) : fmt(x, 0), X(x), T + ph + 6);
    }
    g.fillText(cfg.xl, L + pw / 2, T + ph + 24);
    g.save(); g.translate(13, T + ph / 2); g.rotate(-Math.PI / 2); g.fillText(cfg.yl, 0, -6); g.restore();

    var lo = spec.lines.filter(function (l) { return l.band === 'lo'; })[0], hi = spec.lines.filter(function (l) { return l.band === 'hi'; })[0];
    g.beginPath();
    lo.pts.forEach(function (p, i) { i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); });
    for (var i = hi.pts.length - 1; i >= 0; i--) g.lineTo(X(hi.pts[i][0]), Y(hi.pts[i][1]));
    g.closePath(); g.fillStyle = 'rgba(0,137,127,0.07)'; g.fill();

    var col = { main: teal, edge: edge, outer: outer, minor: '#9fb3b0' }, wid = { main: 2.2, edge: 1.4, outer: 1.4, minor: 0.9 };
    spec.lines.forEach(function (k) {
      g.beginPath();
      k.pts.forEach(function (p, i) { i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); });
      g.strokeStyle = col[k.s]; g.lineWidth = wid[k.s]; g.stroke();
      var lp = k.pts[k.pts.length - 1];
      g.fillStyle = k.s === 'minor' ? muted : col[k.s];
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = (k.s === 'main' ? 'bold ' : '') + '11px system-ui, sans-serif';
      g.fillText(k.lab, X(lp[0]) + 4, Y(lp[1]));
    });

    var px = X(c.x), py = Y(c.y);
    g.setLineDash([4, 4]); g.strokeStyle = ink; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, T + ph); g.lineTo(px, py); g.lineTo(L, py); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#1b1b1b'; g.stroke();
    g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fillStyle = '#c9da2b'; g.fill();
    g.strokeStyle = '#c4d4d1'; g.lineWidth = 1; g.strokeRect(L, T, pw, ph);
  }

  /* ===== Ekspor ===== */
  function fileBase() {
    var n = (last && last.nama ? last.nama : 'anak').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40) || 'anak';
    var ref = last ? last.res.primary.ref.nama.replace(/\s+/g, '') : '';
    return 'AntroAnak_' + ref + '_' + n + '_' + todayISO();
  }
  function snapshot() {
    if (!window.html2canvas) return Promise.reject(new Error('Pustaka ekspor belum termuat. Coba lagi sebentar.'));
    var el = $('report');
    el.classList.add('exporting');
    if (last) drawCharts(last);
    return window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 900 })
      .finally(function () { el.classList.remove('exporting'); });
  }
  function busy(btn, on) { btn.disabled = on; }
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function makePdf(canvas) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('Pustaka PDF belum termuat. Coba lagi sebentar.');
    var pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    var pw = 210, ph = 297, m = 10, w = pw - 2 * m;
    var pxPerMm = canvas.width / w, pageHpx = Math.floor((ph - 2 * m) * pxPerMm);
    for (var y = 0, page = 0; y < canvas.height; y += pageHpx, page++) {
      var h = Math.min(pageHpx, canvas.height - y);
      var part = document.createElement('canvas'); part.width = canvas.width; part.height = h;
      var ctx = part.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, part.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, w, h / pxPerMm);
    }
    pdf.setProperties({ title: 'Hasil Penilaian Status Gizi Anak', author: 'AntroAnak – Manjilala, Poltekkes Kemenkes Makassar' });
    return pdf.output('blob');
  }

  $('btnJpg').addEventListener('click', function () {
    var b = this; busy(b, true);
    snapshot().then(function (cv) {
      cv.toBlob(function (blob) { saveBlob(blob, fileBase() + '.jpg'); toast('JPG tersimpan di folder Unduhan.'); busy(b, false); }, 'image/jpeg', 0.92);
    }).catch(function (e) { toast(e.message); busy(b, false); });
  });
  $('btnPdf').addEventListener('click', function () {
    var b = this; busy(b, true);
    snapshot().then(function (cv) { saveBlob(makePdf(cv), fileBase() + '.pdf'); toast('PDF tersimpan di folder Unduhan.'); })
      .catch(function (e) { toast(e.message); }).finally(function () { busy(b, false); });
  });
  $('btnPrint').addEventListener('click', function () { window.print(); });

  if (navigator.canShare) {
    try { if (navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] })) $('btnShare').hidden = false; } catch (e) {}
  }
  $('btnShare').addEventListener('click', function () {
    var b = this; busy(b, true);
    snapshot().then(function (cv) {
      return new Promise(function (ok) { cv.toBlob(ok, 'image/jpeg', 0.92); });
    }).then(function (blob) {
      var f = new File([blob], fileBase() + '.jpg', { type: 'image/jpeg' });
      return navigator.share({ files: [f], title: 'Hasil status gizi anak' });
    }).catch(function (e) { if (e && e.name !== 'AbortError') toast('Gagal membagikan: ' + e.message); })
      .finally(function () { busy(b, false); });
  });

  /* ===== Panduan ===== */
  var guide = $('guide');
  function openGuide() { if (guide.showModal) guide.showModal(); else guide.setAttribute('open', ''); guide.querySelector('.guide-body').scrollTop = 0; }
  function closeGuide() { if (guide.close) guide.close(); else guide.removeAttribute('open'); }
  function seen() { try { localStorage.setItem('antroanak-panduan', '1'); } catch (e) {} $('welcome').hidden = true; }
  $('btnGuide').addEventListener('click', openGuide);
  $('btnGuide2').addEventListener('click', openGuide);
  $('btnGuideClose').addEventListener('click', closeGuide);
  guide.addEventListener('click', function (e) { if (e.target === guide) closeGuide(); });
  $('btnWelcomeOpen').addEventListener('click', function () { seen(); openGuide(); });
  $('btnWelcomeClose').addEventListener('click', seen);
  try { if (!localStorage.getItem('antroanak-panduan')) $('welcome').hidden = false; } catch (e) { $('welcome').hidden = false; }

  /* ===== PWA ===== */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('btnInstall').hidden = false; });
  $('btnInstall').addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; $('btnInstall').hidden = true; });
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
