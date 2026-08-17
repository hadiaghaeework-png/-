#!/usr/bin/env node
/**
 * ساخت نسخه تک‌فایلی داشبورد
 * ---------------------------------------------------------------
 * همه‌ی CSS، جاوااسکریپت، فونت‌ها، کتابخانه‌ها و فایل‌های نمونه را
 * داخل یک فایل HTML جاسازی می‌کند تا بدون سرور و بدون اینترنت
 * فقط با دابل‌کلیک در مرورگر باز شود.
 *
 * اجرا:  node build-standalone.js
 * خروجی: داشبورد-کنترل-کیفیت.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT  = path.join(ROOT, 'داشبورد-کنترل-کیفیت.html');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const b64  = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');

console.log('در حال ساخت نسخه تک‌فایلی…\n');

/* ---------- ۱) CSS با فونت‌های base64 ---------- */
let css = read('assets/css/style.css');
css = css.replace(/url\('\.\.\/fonts\/([^']+)'\)/g, (_, file) => {
  console.log('  → جاسازی فونت:', file);
  return `url('data:font/woff2;base64,${b64('assets/fonts/' + file)}')`;
});

/* ---------- ۲) کتابخانه‌ها و کد برنامه ---------- */
const vendor = ['assets/vendor/xlsx.full.min.js', 'assets/vendor/chart.umd.js'];
const app    = ['assets/js/teams.js', 'assets/js/analyzer.js', 'assets/js/app.js'];

const js = [...vendor, ...app].map(f => {
  console.log('  → جاسازی اسکریپت:', f);
  return `/* ===== ${f} ===== */\n` + read(f);
}).join('\n;\n');

/* ---------- ۳) فایل‌های نمونه به صورت base64 ---------- */
const samples = {};
for (const f of fs.readdirSync(path.join(ROOT, 'samples'))) {
  if (!f.endsWith('.xlsx')) continue;
  console.log('  → جاسازی نمونه:', f);
  samples['samples/' + f] = b64('samples/' + f);
}

/* ---------- ۴) مونتاژ HTML ---------- */
let html = read('index.html');

// حذف تگ‌های خارجی
html = html.replace(/\s*<link rel="stylesheet"[^>]*>/g, '');
html = html.replace(/\s*<script src="[^"]*"><\/script>/g, '');

/**
 * درج امن متن در HTML.
 * نکته مهم: از تابع جایگزین استفاده می‌کنیم تا دنباله‌هایی مثل $& و $' که
 * در کدهای مینیفای‌شده فراوان‌اند، به‌عنوان الگوی جایگزینی تفسیر نشوند.
 * همچنین </script> داخل رشته‌ها باید escape شود تا تگ زودتر بسته نشود.
 */
const injectAt = (marker, payload) => {
  const i = html.indexOf(marker);
  if (i === -1) throw new Error('marker not found: ' + marker);
  html = html.slice(0, i) + payload + html.slice(i);
};
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

// تزریق CSS
injectAt('</head>', `<style>\n${css}\n</style>\n`);

// در نسخه تک‌فایلی لینک دانلود اسناد PPTX کار نمی‌کند، پس حذفش می‌کنیم
const patchLinks = `
/* نسخه تک‌فایلی: لینک‌های دانلود فایل‌های جانبی غیرفعال می‌شوند */
TEAMS.forEach(t => { t.deck = null; });

/* بارگذاری نمونه‌ها از داده جاسازی‌شده به‌جای fetch */
const EMBEDDED_SAMPLES = ${JSON.stringify(samples)};

function b64ToBytes(b64s) {
  const bin = atob(b64s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

loadSamples = function () {
  let n = 0;
  for (const t of TEAMS) {
    if (!t.sample || state.datasets.has(t.id) || !EMBEDDED_SAMPLES[t.sample]) continue;
    try {
      const wb  = XLSX.read(b64ToBytes(EMBEDDED_SAMPLES[t.sample]), { type: 'array', cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
      const res = parseSheet(aoa, t, t.sample.split('/').pop());
      if (res.rows.length) {
        state.datasets.set(t.id, { team: t, fileName: t.sample.split('/').pop(),
          rows: res.rows, warnings: res.warnings, mapping: res.mapping, headers: res.headers });
        n++;
      }
    } catch (e) { console.warn('sample load failed', t.id, e); }
  }
  refreshAll();
  toast(n ? n.toLocaleString('fa-IR') + ' فایل نمونه بارگذاری شد.' : 'فایل نمونه‌ای برای بارگذاری نبود.', n ? 'ok' : 'warn');
};

/* دانلود فایل نمونه از داده جاسازی‌شده */
document.addEventListener('click', function (e) {
  const a = e.target.closest('a[download][href^="samples/"]');
  if (!a) return;
  e.preventDefault();
  const data = EMBEDDED_SAMPLES[a.getAttribute('href')];
  if (!data) return;
  const blob = new Blob([b64ToBytes(data)],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const tmp = document.createElement('a');
  tmp.href = url; tmp.download = a.getAttribute('href').split('/').pop();
  tmp.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});
`;

injectAt('</body>', `<script>\n${safeJs(js)}\n${safeJs(patchLinks)}\n</script>\n`);

fs.writeFileSync(OUT, html, 'utf8');

const mb = (fs.statSync(OUT).size / 1048576).toFixed(2);
console.log(`\n✔ ساخته شد: ${path.basename(OUT)}  (${mb} مگابایت)`);
console.log('  کافی است روی این فایل دابل‌کلیک کنید — بدون سرور و بدون اینترنت کار می‌کند.');
