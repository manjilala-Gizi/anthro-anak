/* Mesin perhitungan status gizi anak: CDC 2000, WHO 2006, WHO 2007 (metode LMS).
 *
 * z = ((X/M)^L - 1) / (L*S)   (L != 0);   z = ln(X/M)/S  (L == 0)
 *
 * WHO: indikator berbasis berat (BB/U, BB/PB, BB/TB, IMT/U) memakai z-score terbatas
 *      (restricted) untuk |z| > 3, persis seperti WHO Anthro / AnthroPlus:
 *      z > 3  -> 3 + (X - SD3pos) / (SD3pos - SD2pos)
 *      z < -3 -> -3 + (X - SD3neg) / (SD2neg - SD3neg)
 *
 * Mode otomatis (rekomendasi IDAI):
 *      umur < 60 bulan  -> WHO 2006, klasifikasi Permenkes No. 2 Tahun 2020 (pembanding: CDC 2000)
 *      umur >= 60 bulan -> CDC 2000 (pembanding: WHO 2007, 5–19 tahun)
 */
(function (root) {
  'use strict';
  var CDC = root.CDC2000, WHO = root.WHO_GS;
  var DPM = 30.4375; // hari per bulan

  /* ---------- utilitas LMS ---------- */
  function zLMS(X, L, M, S) {
    return Math.abs(L) < 1e-7 ? Math.log(X / M) / S : (Math.pow(X / M, L) - 1) / (L * S);
  }
  function xLMS(z, L, M, S) {
    return Math.abs(L) < 1e-7 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
  }
  function zRestricted(X, L, M, S) {
    var z = zLMS(X, L, M, S);
    if (z > 3) { var p3 = xLMS(3, L, M, S), p2 = xLMS(2, L, M, S); return 3 + (X - p3) / (p3 - p2); }
    if (z < -3) { var n3 = xLMS(-3, L, M, S), n2 = xLMS(-2, L, M, S); return -3 + (X - n3) / (n2 - n3); }
    return z;
  }
  function round2(z) { return Math.round(z * 100) / 100; }
  // Distribusi normal kumulatif (Hart / West)
  function normCdf(z) {
    var x = Math.abs(z), c;
    if (x > 37) c = 0;
    else {
      var e = Math.exp(-x * x / 2);
      if (x < 7.07106781186547) {
        var n = 0.0352624965998911 * x + 0.700383064443688; n = n * x + 6.37396220353165; n = n * x + 33.912866078383;
        n = n * x + 112.079291497871; n = n * x + 221.213596169931; n = n * x + 220.206867912376;
        var d = 0.0883883476483184 * x + 1.75566716318264; d = d * x + 16.064177579207; d = d * x + 86.7807322029461;
        d = d * x + 296.564248779674; d = d * x + 637.333633378831; d = d * x + 793.826512519948; d = d * x + 440.413735824752;
        c = e * n / d;
      } else {
        var f = x + 0.65; f = x + 4 / f; f = x + 3 / f; f = x + 2 / f; f = x + 1 / f;
        c = e / f / 2.506628274631;
      }
    }
    return z > 0 ? 1 - c : c;
  }

  /* ---------- pencarian tabel ---------- */
  // CDC: array [x, L, M, S], interpolasi linear
  function cdcLMS(key, sex, x) {
    var tab = CDC[key][sex], n = tab.length;
    if (x < tab[0][0] - 1e-9 || x > tab[n - 1][0] + 1e-9) return null;
    if (x <= tab[0][0]) return tab[0].slice(1);
    if (x >= tab[n - 1][0]) return tab[n - 1].slice(1);
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (tab[mid][0] <= x) lo = mid; else hi = mid; }
    var a = tab[lo], b = tab[hi], t = (x - a[0]) / (b[0] - a[0]);
    return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2]), a[3] + t * (b[3] - a[3])];
  }
  // WHO: {x0, dx, n, L[], M[], S[]}. Tabel harian dicari per hari (dibulatkan);
  // tabel panjang/tinggi (0,1 cm) dan WHO 2007 (bulan) diinterpolasi linear.
  function whoLMS(key, sex, x, exactRow) {
    var t = WHO[key][sex], pos = (x - t.x0) / t.dx;
    if (exactRow) pos = Math.floor(pos + 0.5);
    if (pos < -1e-9 || pos > t.n - 1 + 1e-9) return null;
    var i = Math.min(Math.floor(pos + 1e-9), t.n - 1), f = pos - i;
    if (f < 1e-9 || i === t.n - 1) return [t.L[i], t.M[i], t.S[i]];
    return [t.L[i] + f * (t.L[i + 1] - t.L[i]), t.M[i] + f * (t.M[i + 1] - t.M[i]), t.S[i] + f * (t.S[i + 1] - t.S[i])];
  }

  /* ---------- definisi indikator ---------- */
  var IND = {
    // CDC 2000
    'cdc:wfa_inf': { nama: 'BB/U', lengkap: 'Berat badan menurut umur', satuan: 'kg', grafik: '0–36 bulan' },
    'cdc:lfa_inf': { nama: 'PB/U', lengkap: 'Panjang badan menurut umur', satuan: 'cm', grafik: '0–36 bulan' },
    'cdc:hcfa':    { nama: 'LK/U', lengkap: 'Lingkar kepala menurut umur', satuan: 'cm', grafik: '0–36 bulan' },
    'cdc:wfl':     { nama: 'BB/PB', lengkap: 'Berat badan menurut panjang badan', satuan: 'kg', grafik: '45–103,5 cm' },
    'cdc:wfa':     { nama: 'BB/U', lengkap: 'Berat badan menurut umur', satuan: 'kg', grafik: '2–20 tahun' },
    'cdc:hfa':     { nama: 'TB/U', lengkap: 'Tinggi badan menurut umur', satuan: 'cm', grafik: '2–20 tahun' },
    'cdc:bmi':     { nama: 'IMT/U', lengkap: 'Indeks massa tubuh menurut umur', satuan: 'kg/m²', grafik: '2–20 tahun' },
    'cdc:wfs':     { nama: 'BB/TB', lengkap: 'Berat badan menurut tinggi badan', satuan: 'kg', grafik: '77–121,5 cm' },
    // WHO 2006
    'who:wfa':  { nama: 'BB/U', lengkap: 'Berat badan menurut umur', satuan: 'kg', grafik: '0–5 tahun' },
    'who:lfa':  { nama: 'PB/U', lengkap: 'Panjang badan menurut umur', satuan: 'cm', grafik: '0–2 tahun' },
    'who:hfa':  { nama: 'TB/U', lengkap: 'Tinggi badan menurut umur', satuan: 'cm', grafik: '2–5 tahun' },
    'who:wfl':  { nama: 'BB/PB', lengkap: 'Berat badan menurut panjang badan', satuan: 'kg', grafik: '45–110 cm' },
    'who:wfh':  { nama: 'BB/TB', lengkap: 'Berat badan menurut tinggi badan', satuan: 'kg', grafik: '65–120 cm' },
    'who:bmi':  { nama: 'IMT/U', lengkap: 'Indeks massa tubuh menurut umur', satuan: 'kg/m²', grafik: '0–5 tahun' },
    'who:hcfa': { nama: 'LK/U', lengkap: 'Lingkar kepala menurut umur', satuan: 'cm', grafik: '0–5 tahun' },
    // WHO 2007
    'w07:hfa':  { nama: 'TB/U', lengkap: 'Tinggi badan menurut umur', satuan: 'cm', grafik: '5–19 tahun' },
    'w07:wfa':  { nama: 'BB/U', lengkap: 'Berat badan menurut umur', satuan: 'kg', grafik: '5–10 tahun' },
    'w07:bmi':  { nama: 'IMT/U', lengkap: 'Indeks massa tubuh menurut umur', satuan: 'kg/m²', grafik: '5–19 tahun' }
  };

  var REF = {
    cdc: { id: 'cdc', nama: 'CDC 2000', lengkap: 'CDC 2000 Growth Charts', skala: 'persentil' },
    who: { id: 'who', nama: 'WHO 2006', lengkap: 'WHO Child Growth Standards 2006 · Permenkes No. 2 Tahun 2020', skala: 'z' },
    w07: { id: 'w07', nama: 'WHO 2007', lengkap: 'WHO Growth Reference 2007 (5–19 tahun) · Permenkes No. 2 Tahun 2020', skala: 'z' }
  };

  /* ---------- klasifikasi ---------- */
  // CDC (persentil)
  function kCdcBMI(p, pctP95) {
    if (p >= 95 && pctP95 >= 120) return { t: 'Obesitas berat (≥120% P95)', c: 'bad' };
    if (p >= 95) return { t: 'Obesitas (≥P95)', c: 'bad' };
    if (p >= 85) return { t: 'Gizi lebih / overweight (P85–<P95)', c: 'warn' };
    if (p >= 5) return { t: 'Normal (P5–<P85)', c: 'ok' };
    return { t: 'Gizi kurang / underweight (<P5)', c: 'bad' };
  }
  // TB/U CDC: batas perawakan pendek < P3 (setara ±−2 SD), mengikuti rekomendasi IDAI
  function kCdcTB(p) { return p < 3 ? { t: 'Pendek (<P3)', c: 'warn' } : p > 97 ? { t: 'Tinggi (>P97)', c: 'info' } : { t: 'Normal (P3–P97)', c: 'ok' }; }
  function kCdcBBU(p) { return p < 5 ? { t: 'BB kurang (<P5)', c: 'warn' } : p > 95 ? { t: 'BB lebih (>P95)', c: 'warn' } : { t: 'Sesuai umur (P5–P95)', c: 'ok' }; }
  function kCdcBBTB(p) { return p < 5 ? { t: 'Kurus, risiko gizi kurang (<P5)', c: 'bad' } : p >= 95 ? { t: 'Gemuk, risiko gizi lebih (≥P95)', c: 'warn' } : { t: 'Normal (P5–<P95)', c: 'ok' }; }
  function kCdcLK(p) { return p < 5 ? { t: 'Di bawah P5, perlu evaluasi', c: 'warn' } : p > 95 ? { t: 'Di atas P95, perlu evaluasi', c: 'warn' } : { t: 'Normal (P5–P95)', c: 'ok' }; }
  // Permenkes No. 2 Tahun 2020 (z-score)
  function kBBU(z) {
    if (z < -3) return { t: 'BB sangat kurang (< −3 SD)', c: 'bad' };
    if (z < -2) return { t: 'BB kurang (−3 s.d. < −2 SD)', c: 'warn' };
    if (z <= 1) return { t: 'BB normal (−2 s.d. +1 SD)', c: 'ok' };
    return { t: 'Risiko BB lebih (> +1 SD)', c: 'warn' };
  }
  function kTBU(z) {
    if (z < -3) return { t: 'Sangat pendek (< −3 SD)', c: 'bad' };
    if (z < -2) return { t: 'Pendek (−3 s.d. < −2 SD)', c: 'warn' };
    if (z <= 3) return { t: 'Normal (−2 s.d. +3 SD)', c: 'ok' };
    return { t: 'Tinggi (> +3 SD)', c: 'info' };
  }
  function kBBTB(z) { // juga untuk IMT/U 0–60 bulan
    if (z < -3) return { t: 'Gizi buruk (< −3 SD)', c: 'bad' };
    if (z < -2) return { t: 'Gizi kurang (−3 s.d. < −2 SD)', c: 'warn' };
    if (z <= 1) return { t: 'Gizi baik (−2 s.d. +1 SD)', c: 'ok' };
    if (z <= 2) return { t: 'Berisiko gizi lebih (> +1 s.d. +2 SD)', c: 'warn' };
    if (z <= 3) return { t: 'Gizi lebih (> +2 s.d. +3 SD)', c: 'bad' };
    return { t: 'Obesitas (> +3 SD)', c: 'bad' };
  }
  function kIMT518(z) {
    if (z < -3) return { t: 'Gizi buruk (< −3 SD)', c: 'bad' };
    if (z < -2) return { t: 'Gizi kurang (−3 s.d. < −2 SD)', c: 'warn' };
    if (z <= 1) return { t: 'Gizi baik (−2 s.d. +1 SD)', c: 'ok' };
    if (z <= 2) return { t: 'Gizi lebih (> +1 s.d. +2 SD)', c: 'warn' };
    return { t: 'Obesitas (> +2 SD)', c: 'bad' };
  }
  function kLKwho(z) {
    if (z < -2) return { t: 'LK kecil (< −2 SD), perlu evaluasi', c: 'warn' };
    if (z > 2) return { t: 'LK besar (> +2 SD), perlu evaluasi', c: 'warn' };
    return { t: 'Normal (−2 s.d. +2 SD)', c: 'ok' };
  }
  function kBBI(pct) {
    if (pct > 120) return { t: 'Obesitas', c: 'bad' };
    if (pct > 110) return { t: 'Overweight', c: 'warn' };
    if (pct >= 90) return { t: 'Gizi baik', c: 'ok' };
    if (pct >= 70) return { t: 'Gizi kurang', c: 'warn' };
    return { t: 'Gizi buruk', c: 'bad' };
  }

  /* ---------- umur ---------- */
  function ageDays(birth, meas) {
    var a = Date.UTC(birth.getFullYear(), birth.getMonth(), birth.getDate());
    var b = Date.UTC(meas.getFullYear(), meas.getMonth(), meas.getDate());
    return Math.round((b - a) / 86400000);
  }
  function ageParts(birth, meas) {
    var y = meas.getFullYear() - birth.getFullYear(), m = meas.getMonth() - birth.getMonth(), d = meas.getDate() - birth.getDate();
    if (d < 0) { m -= 1; d += new Date(meas.getFullYear(), meas.getMonth(), 0).getDate(); }
    if (m < 0) { y -= 1; m += 12; }
    return { y: y, m: m, d: d };
  }
  function fmt(v, d) { return Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function umurTeks(months) {
    var y = Math.floor(months / 12), m = Math.round(months - y * 12);
    if (m === 12) { y += 1; m = 0; }
    return (y ? y + ' th ' : '') + m + ' bln';
  }

  /* ---------- pembuat hasil ---------- */
  function newResult(ref) { return { ref: REF[ref], rows: [], charts: [], notes: [], bbi: null }; }
  // Titik potong (dalam z) tiap indikator, untuk penanda "dekat batas"
  var P3 = 1.880794, P5 = 1.644854, P85 = 1.036433;
  var CUTS = {
    'cdc:wfa_inf': [-P5, P5], 'cdc:wfa': [-P5, P5], 'cdc:lfa_inf': [-P3, P3], 'cdc:hfa': [-P3, P3],
    'cdc:wfl': [-P5, P5], 'cdc:wfs': [-P5, P5], 'cdc:bmi': [-P5, P85, P5], 'cdc:hcfa': [-P5, P5],
    'who:wfa': [-3, -2, 1], 'who:lfa': [-3, -2, 3], 'who:hfa': [-3, -2, 3], 'who:wfl': [-3, -2, 1, 2, 3],
    'who:wfh': [-3, -2, 1, 2, 3], 'who:bmi': [-3, -2, 1, 2, 3], 'who:hcfa': [-2, 2],
    'w07:hfa': [-3, -2, 3], 'w07:wfa': [-3, -2, 1], 'w07:bmi': [-3, -2, 1, 2]
  };
  var NEAR = 0.1; // ±0,1 SD

  function addRow(out, key, value, lms, zfun, klas, chart, extra) {
    var row = { key: key, ind: IND[key], value: value, res: null, klas: null, extra: extra || null };
    if (lms) {
      var z = zfun(value, lms[0], lms[1], lms[2]);
      if (out.ref.skala === 'z') z = round2(z);
      row.res = { z: z, p: normCdf(z) * 100, median: lms[1], pctMed: value / lms[1] * 100 };
      row.near = (CUTS[key] || []).some(function (c) { return Math.abs(z - c) < NEAR; });
      row.klas = klas(out.ref.skala === 'z' ? z : row.res.p, row.res);
      if (Math.abs(z) > 5) out.notes.push(IND[key].nama + ' (' + out.ref.nama + ') memiliki z-score ' + fmt(z, 2) + ', di luar ±5 SD. Periksa ulang pengukuran dan tanggal.');
      if (chart) out.charts.push(chart);
    } else {
      row.klas = { t: 'Di luar rentang ' + IND[key].grafik, c: 'na' };
    }
    out.rows.push(row);
    return row;
  }
  function setBBI(out, bb, ideal, metode) {
    if (!ideal) return;
    var pct = bb / ideal * 100;
    out.bbi = { ideal: ideal, pct: pct, klas: kBBI(pct), metode: metode };
  }

  /* ---------- CDC 2000 ---------- */
  function heightAgeCDC(sex, tb) {
    var tab = CDC.hfa[sex];
    if (tb < tab[0][2]) return null;
    if (tb >= tab[tab.length - 1][2]) return tab[tab.length - 1][0];
    for (var i = 1; i < tab.length; i++) if (tab[i][2] >= tb) {
      var a = tab[i - 1], b = tab[i];
      return a[0] + (tb - a[2]) / (b[2] - a[2]) * (b[0] - a[0]);
    }
    return null;
  }
  function evalCDC(inp, age) {
    var out = newResult('cdc'), sex = inp.sex;
    var infant = age < 24 || (age <= 36 && inp.cara === 'baring');
    out.set = infant ? 'CDC 0–36 bulan' : 'CDC 2–20 tahun';
    var len = inp.tb;
    if (infant && inp.cara === 'berdiri') { len = inp.tb + 0.7; out.notes.push('Diukur berdiri pada umur < 2 tahun: PB dikoreksi +0,7 cm menjadi ' + fmt(len, 1) + ' cm.'); }
    if (!infant && inp.cara === 'baring') { len = inp.tb - 0.7; out.notes.push('Diukur berbaring pada umur ≥ 2 tahun: TB dikoreksi −0,7 cm menjadi ' + fmt(len, 1) + ' cm.'); }
    out.lenUsed = len;
    function ch(key, x, y) { return { ref: 'cdc', key: key, x: x, y: y, sex: sex }; }
    var P = function (f) { return function (p) { return f(p); }; };
    if (infant) {
      addRow(out, 'cdc:wfa_inf', inp.bb, cdcLMS('wfa_inf', sex, age), zLMS, P(kCdcBBU), ch('wfa_inf', age, inp.bb));
      addRow(out, 'cdc:lfa_inf', len, cdcLMS('lfa_inf', sex, Math.min(age, 35.5)), zLMS, P(kCdcTB), ch('lfa_inf', age, len));
      addRow(out, 'cdc:wfl', inp.bb, cdcLMS('wfl', sex, len), zLMS, P(kCdcBBTB), ch('wfl', len, inp.bb));
      if (inp.lk) addRow(out, 'cdc:hcfa', inp.lk, cdcLMS('hcfa', sex, age), zLMS, P(kCdcLK), ch('hcfa', age, inp.lk));
      var l1 = cdcLMS('wfl', sex, len);
      if (l1) setBBI(out, inp.bb, l1[1], 'P50 BB/PB CDC pada PB ' + fmt(len, 1) + ' cm');
    } else {
      addRow(out, 'cdc:hfa', len, cdcLMS('hfa', sex, age), zLMS, P(kCdcTB), ch('hfa', age, len));
      addRow(out, 'cdc:wfa', inp.bb, cdcLMS('wfa', sex, age), zLMS, P(kCdcBBU), ch('wfa', age, inp.bb));
      var imt = inp.bb / Math.pow(len / 100, 2), lb = cdcLMS('bmi', sex, age), pctP95 = lb ? imt / xLMS(1.644854, lb[0], lb[1], lb[2]) * 100 : null;
      addRow(out, 'cdc:bmi', imt, lb, zLMS, function (p) { return kCdcBMI(p, pctP95); }, ch('bmi', age, imt), { pctP95: pctP95 });
      if (age < 60 && len >= 77 && len <= 121.5) addRow(out, 'cdc:wfs', inp.bb, cdcLMS('wfs', sex, len), zLMS, P(kCdcBBTB), ch('wfs', len, inp.bb));
      if (inp.lk && age <= 36) addRow(out, 'cdc:hcfa', inp.lk, cdcLMS('hcfa', sex, age), zLMS, P(kCdcLK), ch('hcfa', age, inp.lk));
      var l2 = age < 60 ? cdcLMS('wfs', sex, len) : null;
      if (l2) setBBI(out, inp.bb, l2[1], 'P50 BB/TB CDC pada TB ' + fmt(len, 1) + ' cm');
      else {
        var ha = heightAgeCDC(sex, len);
        if (ha !== null) setBBI(out, inp.bb, cdcLMS('wfa', sex, ha)[1], 'metode height-age: TB ' + fmt(len, 1) + ' cm = P50 TB/U pada umur ' + umurTeks(ha) + ', lalu P50 BB/U pada umur tersebut');
      }
    }
    return out;
  }

  /* ---------- WHO 2006 (0–5 tahun) ---------- */
  function evalWHO(inp, days) {
    var out = newResult('who'), sex = inp.sex;
    var under2 = days < 731;
    out.set = under2 ? 'WHO 0–2 tahun' : 'WHO 2–5 tahun';
    var len = inp.tb;
    if (under2 && inp.cara === 'berdiri') { len = inp.tb + 0.7; out.notes.push('Diukur berdiri pada umur < 2 tahun: PB dikoreksi +0,7 cm menjadi ' + fmt(len, 1) + ' cm (aturan WHO).'); }
    if (!under2 && inp.cara === 'baring') { len = inp.tb - 0.7; out.notes.push('Diukur berbaring pada umur ≥ 2 tahun: TB dikoreksi −0,7 cm menjadi ' + fmt(len, 1) + ' cm (aturan WHO).'); }
    out.lenUsed = len;
    var mo = days / DPM;
    function ch(key, x, y) { return { ref: 'who', key: key, x: x, y: y, sex: sex, under2: under2 }; }
    addRow(out, 'who:wfa', inp.bb, whoLMS('wfa', sex, days, true), zRestricted, kBBU, ch('wfa', mo, inp.bb));
    addRow(out, under2 ? 'who:lfa' : 'who:hfa', len, whoLMS('lhfa', sex, days, true), zLMS, kTBU, ch('lhfa', mo, len));
    var wk = under2 ? 'wfl' : 'wfh';
    var lw = whoLMS(wk, sex, len, false);
    addRow(out, 'who:' + wk, inp.bb, lw, zRestricted, kBBTB, ch(wk, len, inp.bb));
    var imt = inp.bb / Math.pow(len / 100, 2);
    addRow(out, 'who:bmi', imt, whoLMS('bmi', sex, days, true), zRestricted, kBBTB, ch('bmi', mo, imt));
    if (inp.lk) addRow(out, 'who:hcfa', inp.lk, whoLMS('hcfa', sex, days, true), zLMS, kLKwho, ch('hcfa', mo, inp.lk));
    if (lw) setBBI(out, inp.bb, lw[1], 'median BB/' + (under2 ? 'PB' : 'TB') + ' WHO pada ' + (under2 ? 'PB ' : 'TB ') + fmt(len, 1) + ' cm');
    return out;
  }

  /* ---------- WHO 2007 (5–19 tahun) ---------- */
  function evalWHO07(inp, mo) {
    var out = newResult('w07'), sex = inp.sex;
    out.set = 'WHO 2007 (5–19 tahun)';
    var len = inp.tb;
    if (inp.cara === 'baring') { len = inp.tb - 0.7; out.notes.push('Diukur berbaring: TB dikoreksi −0,7 cm menjadi ' + fmt(len, 1) + ' cm.'); }
    function ch(key, x, y) { return { ref: 'w07', key: key, x: x, y: y, sex: sex }; }
    var ok = mo >= 60 && mo < 229;
    addRow(out, 'w07:hfa', len, ok ? whoLMS('hfa07', sex, mo, false) : null, zLMS, kTBU, ch('hfa07', mo, len));
    addRow(out, 'w07:wfa', inp.bb, mo >= 60 && mo < 121 ? whoLMS('wfa07', sex, mo, false) : null, zRestricted, kBBU, ch('wfa07', mo, inp.bb));
    var imt = inp.bb / Math.pow(len / 100, 2);
    addRow(out, 'w07:bmi', imt, ok ? whoLMS('bmi07', sex, mo, false) : null, zRestricted, kIMT518, ch('bmi07', mo, imt));
    return out;
  }

  /* ---------- penilaian lengkap ---------- */
  function evaluate(inp) {
    var res = { errors: [] };
    var days = ageDays(inp.birth, inp.meas), mo = days / DPM;
    res.ageDays = days; res.ageMonths = mo; res.ageParts = ageParts(inp.birth, inp.meas);
    if (days < 0) { res.errors.push('Tanggal ukur lebih awal dari tanggal lahir.'); return res; }
    if (mo > 240.5) { res.errors.push('Umur anak di atas 20 tahun; aplikasi ini berlaku untuk 0–20 tahun.'); return res; }
    if (mo < 60) {
      res.mode = 'balita';
      res.primary = evalWHO(inp, days);
      res.comparator = evalCDC(inp, mo);
    } else {
      res.mode = 'anak';
      res.primary = evalCDC(inp, mo);
      res.comparator = mo < 229 ? evalWHO07(inp, mo) : null;
    }
    return res;
  }

  /* ---------- spesifikasi grafik ---------- */
  var CDC_LINES = [
    { lab: '3', z: -1.880794, s: 'minor' }, { lab: '5', z: -1.644854, s: 'edge', band: 'lo' }, { lab: '10', z: -1.281552, s: 'minor' },
    { lab: '25', z: -0.67449, s: 'minor' }, { lab: '50', z: 0, s: 'main' }, { lab: '75', z: 0.67449, s: 'minor' },
    { lab: '90', z: 1.281552, s: 'minor' }, { lab: '95', z: 1.644854, s: 'edge', band: 'hi' }, { lab: '97', z: 1.880794, s: 'minor' }
  ];
  var WHO_LINES = [
    { lab: '−3', z: -3, s: 'outer' }, { lab: '−2', z: -2, s: 'edge', band: 'lo' }, { lab: '−1', z: -1, s: 'minor' }, { lab: '0', z: 0, s: 'main' },
    { lab: '+1', z: 1, s: 'minor' }, { lab: '+2', z: 2, s: 'edge', band: 'hi' }, { lab: '+3', z: 3, s: 'outer' }
  ];
  var CDC_CFG = {
    wfa_inf: { xmin: 0, xmax: 36, xstep: 3, xl: 'Umur (bulan)', ystep: 2, yl: 'kg' },
    lfa_inf: { xmin: 0, xmax: 35.5, xstep: 3, xl: 'Umur (bulan)', ystep: 5, yl: 'cm' },
    hcfa: { xmin: 0, xmax: 36, xstep: 3, xl: 'Umur (bulan)', ystep: 2, yl: 'cm' },
    wfl: { xmin: 45, xmax: 103.5, xstep: 5, xl: 'Panjang badan (cm)', ystep: 2, yl: 'kg' },
    wfs: { xmin: 77, xmax: 121.5, xstep: 5, xl: 'Tinggi badan (cm)', ystep: 2, yl: 'kg' },
    wfa: { xmin: 24, xmax: 240, xstep: 24, xl: 'Umur (tahun)', ystep: 10, yl: 'kg', years: true },
    hfa: { xmin: 24, xmax: 240, xstep: 24, xl: 'Umur (tahun)', ystep: 10, yl: 'cm', years: true },
    bmi: { xmin: 24, xmax: 240, xstep: 24, xl: 'Umur (tahun)', ystep: 2, yl: 'kg/m²', years: true }
  };
  function steps(a, b, st) { var r = []; for (var j = a; j < b; j += st) r.push(j); r.push(b); return r; }
  function chartSpec(c) {
    var cfg, lines, pts = [], i;
    if (c.ref === 'cdc') {
      cfg = CDC_CFG[c.key]; lines = CDC_LINES;
      CDC[c.key][c.sex].forEach(function (r) { if (r[0] >= cfg.xmin - 1e-9 && r[0] <= cfg.xmax + 1e-9) pts.push([r[0], r[1], r[2], r[3]]); });
    } else {
      lines = WHO_LINES;
      var tk = c.key, t = WHO[tk][c.sex], isAge = (tk !== 'wfl' && tk !== 'wfh');
      if (c.ref === 'who' && isAge) {
        var lo = c.under2 ? 0 : 24, hi = c.under2 ? 24 : 60;
        cfg = { xmin: lo, xmax: hi, xstep: c.under2 ? 2 : 6, xl: 'Umur (bulan)', ystep: { wfa: 2, lhfa: 5, bmi: 1, hcfa: 2 }[tk], yl: tk === 'bmi' ? 'kg/m²' : tk === 'wfa' ? 'kg' : 'cm' };
        steps(Math.round(lo * DPM), Math.min(t.n - 1, Math.round(hi * DPM)), 7).forEach(function (j) { pts.push([j / DPM, t.L[j], t.M[j], t.S[j]]); });
      } else if (!isAge) {
        cfg = { xmin: t.x0, xmax: t.x0 + (t.n - 1) * t.dx, xstep: 5, xl: (tk === 'wfl' ? 'Panjang' : 'Tinggi') + ' badan (cm)', ystep: 2, yl: 'kg' };
        steps(0, t.n - 1, 5).forEach(function (j) { pts.push([t.x0 + j * t.dx, t.L[j], t.M[j], t.S[j]]); });
      } else { // WHO 2007, per bulan
        cfg = { xmin: 60, xmax: t.x0 + t.n - 1, xstep: 12, xl: 'Umur (tahun)', ystep: tk === 'bmi07' ? 2 : tk === 'wfa07' ? 5 : 10, yl: tk === 'bmi07' ? 'kg/m²' : tk === 'wfa07' ? 'kg' : 'cm', years: true };
        for (i = 0; i < t.n; i++) pts.push([t.x0 + i, t.L[i], t.M[i], t.S[i]]);
      }
    }
    return {
      cfg: cfg,
      lines: lines.map(function (ln) {
        return { lab: ln.lab, s: ln.s, band: ln.band, pts: pts.map(function (r) { return [r[0], xLMS(ln.z, r[1], r[2], r[3])]; }) };
      })
    };
  }
  function chartTitle(c) {
    var map = { cdc: 'cdc:', who: 'who:', w07: 'w07:' };
    var k = { wfa_inf: 'wfa_inf', lfa_inf: 'lfa_inf', hcfa: 'hcfa', wfl: 'wfl', wfs: 'wfs', wfa: 'wfa', hfa: 'hfa', bmi: 'bmi',
      lhfa: c.under2 ? 'lfa' : 'hfa', wfh: 'wfh', hfa07: 'hfa', wfa07: 'wfa', bmi07: 'bmi' }[c.key];
    var ind = IND[map[c.ref] + k];
    var rentang = ind.grafik;
    if (c.ref === 'who' && c.key !== 'wfl' && c.key !== 'wfh') rentang = c.under2 ? '0–2 tahun' : '2–5 tahun';
    return ind.nama + ' · ' + ind.lengkap + ' (' + REF[c.ref].nama + ', ' + (c.sex === 'm' ? 'laki-laki' : 'perempuan') + ', ' + rentang + ')';
  }

  root.Growth = {
    IND: IND, REF: REF, evaluate: evaluate, chartSpec: chartSpec, chartTitle: chartTitle,
    zLMS: zLMS, xLMS: xLMS, zRestricted: zRestricted, normCdf: normCdf, cdcLMS: cdcLMS, whoLMS: whoLMS,
    ageDays: ageDays, ageParts: ageParts, fmt: fmt, umurTeks: umurTeks, evalWHO07: evalWHO07
  };
})(typeof window !== 'undefined' ? window : globalThis);
