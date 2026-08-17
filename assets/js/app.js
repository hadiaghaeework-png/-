/* =========================================================================
 *  رابط کاربری داشبورد تحلیل نمرات کنترل کیفیت
 * ========================================================================= */

const state = {
  /** teamId -> { team, fileName, rows, warnings, mapping } */
  datasets: new Map(),
  activeTab: 'upload',
  /** فیلترهای صفحه تحلیل */
  filter: { team: 'all', expert: 'all', qcExpert: 'all', from: '', to: '', minScore: '', search: '' },
  sort: { key: 'avg', dir: 'desc' },
  charts: {}
};

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fa = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '—' : Number(n).toLocaleString('fa-IR');
const pct = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + '٪';

function scoreColor(n) {
  if (n === null || isNaN(n)) return '#94a3b8';
  if (n >= 95) return '#059669';
  if (n >= 85) return '#22c55e';
  if (n >= 75) return '#f59e0b';
  if (n >= 60) return '#ea580c';
  return '#dc2626';
}

function fmtSeconds(s) {
  if (s === null || s === undefined || isNaN(s) || s === 0) return '—';
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${fa(m)}:${fa(r).padStart(2, '۰')}`;
}

/* =======================================================================
 *  ۱) صفحه آپلود — کارت هر تیم
 * ======================================================================= */

function renderUpload() {
  const host = $('#teams-grid');
  host.innerHTML = TEAMS.map(t => {
    const ds = state.datasets.get(t.id);
    const qn = t.criteria.filter(c => c.section === 'quality' && c.weight).length;
    const an = t.criteria.filter(c => c.section === 'qa' && c.weight).length;
    return `
      <div class="team-card ${ds ? 'loaded' : ''}" data-team="${t.id}">
        <div class="team-card-head">
          <div class="team-badge" style="background:${t.color}">${t.icon}</div>
          <div class="grow">
            <div class="t-name">${esc(t.name)}</div>
            <div class="t-en">${esc(t.nameEn)}</div>
            <div class="t-desc">${esc(t.description)}</div>
          </div>
        </div>

        <div class="team-meta">
          <span class="chip">${fa(qn)} معیار کیفی (${fa(t.qualityShare)}٪)</span>
          <span class="chip">${fa(an)} معیار سیستمی (${fa(t.qaShare)}٪)</span>
          ${ds ? `<span class="chip ok">${fa(ds.rows.length)} رکورد بارگذاری شد</span>` : '<span class="chip">فایلی بارگذاری نشده</span>'}
        </div>

        ${ds ? `
          <div class="file-info">
            <span>📄</span>
            <span class="fname" title="${esc(ds.fileName)}">${esc(ds.fileName)}</span>
            <span class="spacer"></span>
            <button class="btn btn-sm btn-danger" data-act="remove" data-team="${t.id}">حذف</button>
          </div>` : `
          <div class="drop" data-team="${t.id}" tabindex="0" role="button"
               aria-label="بارگذاری فایل برای ${esc(t.name)}">
            <div class="icon">⬆</div>
            <div class="t1">فایل اکسل را اینجا رها کنید</div>
            <div class="t2">یا برای انتخاب کلیک کنید — xlsx / xls / csv</div>
          </div>`}

        <div class="team-links">
          <a href="#" data-act="criteria" data-team="${t.id}">مشاهده المان‌ها و ضرایب</a>
          ${t.sample ? `<a href="${t.sample}" download>دانلود فایل نمونه</a>` : '<span class="muted">فایل نمونه موجود نیست</span>'}
          ${t.deck ? `<a href="${encodeURI(t.deck)}" download>سند المان‌ها (PPTX)</a>` : ''}
        </div>
      </div>`;
  }).join('');

  bindDropzones();

  const total = [...state.datasets.values()].reduce((a, d) => a + d.rows.length, 0);
  $('#upload-summary').innerHTML = state.datasets.size
    ? `<div class="alert ok">✔ <div><b>${fa(state.datasets.size)}</b> تیم بارگذاری شد؛ مجموعاً <b>${fa(total)}</b> رکورد ارزیابی آماده تحلیل است.
        برای دیدن نتایج به تب <b>تحلیل کلی</b> یا <b>کارشناسان</b> بروید.</div></div>`
    : `<div class="alert info">ℹ <div>برای هر تیم فایل خروجی فرم QC را بارگذاری کنید. ساختار ستون‌ها باید مانند فایل‌های نمونه باشد
        (<span class="mono">lead_id, tele_expert_name, score, …</span>). می‌توانید چند تیم را هم‌زمان بارگذاری کنید.</div></div>`;
}

function bindDropzones() {
  $$('.drop').forEach(dz => {
    const teamId = dz.dataset.team;
    dz.addEventListener('click', () => pickFile(teamId));
    dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(teamId); } });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('dragover');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f, teamId);
    });
  });

  $$('[data-act="remove"]').forEach(b => b.addEventListener('click', () => {
    state.datasets.delete(b.dataset.team);
    refreshAll();
  }));

  $$('[data-act="criteria"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    showCriteriaModal(TEAMS.find(t => t.id === a.dataset.team));
  }));
}

function pickFile(teamId) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = () => { if (inp.files[0]) handleFile(inp.files[0], teamId); };
  inp.click();
}

/* ---------- خواندن فایل ---------- */

function handleFile(file, teamId) {
  const team = TEAMS.find(t => t.id === teamId);
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });

      if (!aoa.length) { toast('فایل خالی است.', 'bad'); return; }

      // اگر ستون‌ها با تیم انتخابی جور نیست، هشدار بده
      const headers = aoa[0].map(h => (h == null ? '' : String(h)));
      const guesses = guessTeam(headers);
      const self = guesses.find(g => g.team.id === teamId);
      const best = guesses[0];

      const res = parseSheet(aoa, team, file.name);
      if (!res.rows.length) { toast('هیچ ردیف داده‌ای در فایل پیدا نشد.', 'bad'); return; }

      if (self && best && best.team.id !== teamId && best.ratio > self.ratio + 0.2) {
        res.warnings.unshift(
          `ساختار این فایل بیشتر به تیم «${best.team.name}» شبیه است ` +
          `(${Math.round(best.ratio * 100)}٪ تطبیق در برابر ${Math.round(self.ratio * 100)}٪). ` +
          'در صورت اشتباه بودن انتخاب تیم، فایل را حذف و در کارت درست بارگذاری کنید.'
        );
      }

      state.datasets.set(teamId, {
        team, fileName: file.name, rows: res.rows,
        warnings: res.warnings, mapping: res.mapping, headers: res.headers
      });

      toast(`«${team.short}» بارگذاری شد: ${fa(res.rows.length)} رکورد`, 'ok');
      refreshAll();
      if (res.warnings.length) showWarningsModal(team, res.warnings, res.mapping);
    } catch (err) {
      console.error(err);
      toast('خواندن فایل ناموفق بود: ' + err.message, 'bad');
    }
  };

  reader.onerror = () => toast('خطا در خواندن فایل.', 'bad');
  reader.readAsArrayBuffer(file);
}

/* ---------- بارگذاری فایل‌های نمونه ---------- */

async function loadSamples() {
  let n = 0;
  for (const t of TEAMS) {
    if (!t.sample || state.datasets.has(t.id)) continue;
    try {
      const r = await fetch(t.sample);
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
      const res = parseSheet(aoa, t, t.sample.split('/').pop());
      if (res.rows.length) {
        state.datasets.set(t.id, { team: t, fileName: t.sample.split('/').pop(), rows: res.rows, warnings: res.warnings, mapping: res.mapping, headers: res.headers });
        n++;
      }
    } catch (e) { console.warn('sample load failed', t.id, e); }
  }
  refreshAll();
  toast(n ? `${fa(n)} فایل نمونه بارگذاری شد.` : 'فایل نمونه‌ای برای بارگذاری نبود.', n ? 'ok' : 'warn');
}

/* =======================================================================
 *  ۲) داده‌های فیلترشده
 * ======================================================================= */

function allRows() {
  const out = [];
  state.datasets.forEach(ds => out.push(...ds.rows));
  return out;
}

function filteredRows() {
  const f = state.filter;
  const from = f.from ? new Date(f.from) : null;
  const to   = f.to   ? new Date(f.to + 'T23:59:59') : null;
  const min  = f.minScore === '' ? null : Number(f.minScore);
  const q    = f.search.trim().toLowerCase();

  return allRows().filter(r => {
    if (f.team !== 'all' && r.teamId !== f.team) return false;
    if (f.expert !== 'all' && r.expert !== f.expert) return false;
    if (f.qcExpert !== 'all' && r.qcExpert !== f.qcExpert) return false;
    const d = r.actionDate || r.formDate;
    if (from && (!d || d < from)) return false;
    if (to && (!d || d > to)) return false;
    if (min !== null && (r.score === null || r.score < min)) return false;
    if (q) {
      const hay = [r.leadName, r.leadId, r.leadPhone, r.expert, r.qcExpert, r.qcComment].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** تیم فعال برای تحلیل معیار‌محور (وقتی فیلتر روی یک تیم است) */
function activeTeam() {
  if (state.filter.team !== 'all') return TEAMS.find(t => t.id === state.filter.team);
  const ids = [...state.datasets.keys()];
  return ids.length === 1 ? TEAMS.find(t => t.id === ids[0]) : null;
}

/* =======================================================================
 *  ۳) نوار فیلتر
 * ======================================================================= */

function renderFilters() {
  const rows = allRows();
  const teamOpts = [...state.datasets.values()].map(d => d.team);
  const experts   = [...new Set(rows.filter(r => state.filter.team === 'all' || r.teamId === state.filter.team).map(r => r.expert))].sort((a, b) => a.localeCompare(b, 'fa'));
  const qcExperts = [...new Set(rows.map(r => r.qcExpert))].sort((a, b) => a.localeCompare(b, 'fa'));

  const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;

  $('#filters').innerHTML = `
    <div class="field">
      <label for="f-team">تیم</label>
      <select id="f-team">
        ${opt('all', 'همه تیم‌ها', state.filter.team)}
        ${teamOpts.map(t => opt(t.id, t.name, state.filter.team)).join('')}
      </select>
    </div>
    <div class="field">
      <label for="f-expert">کارشناس</label>
      <select id="f-expert">
        ${opt('all', 'همه کارشناسان', state.filter.expert)}
        ${experts.map(e => opt(e, e, state.filter.expert)).join('')}
      </select>
    </div>
    <div class="field">
      <label for="f-qc">ارزیاب QC</label>
      <select id="f-qc">
        ${opt('all', 'همه ارزیاب‌ها', state.filter.qcExpert)}
        ${qcExperts.map(e => opt(e, e, state.filter.qcExpert)).join('')}
      </select>
    </div>
    <div class="field">
      <label for="f-from">از تاریخ</label>
      <input type="date" id="f-from" value="${esc(state.filter.from)}">
    </div>
    <div class="field">
      <label for="f-to">تا تاریخ</label>
      <input type="date" id="f-to" value="${esc(state.filter.to)}">
    </div>
    <div class="field">
      <label for="f-min">حداقل نمره</label>
      <input type="number" id="f-min" min="0" max="100" placeholder="مثلاً ۸۰" value="${esc(state.filter.minScore)}">
    </div>
    <div class="field grow">
      <label for="f-search">جستجو</label>
      <input type="search" id="f-search" placeholder="نام لید، شماره، کارشناس یا نظر QC" value="${esc(state.filter.search)}">
    </div>
    <button class="btn btn-sm" id="f-reset">پاک کردن فیلترها</button>`;

  const on = (id, key, ev = 'change') => $(id).addEventListener(ev, e => {
    state.filter[key] = e.target.value;
    if (key === 'team') state.filter.expert = 'all';
    renderFilters(); renderCurrentTab();
  });

  on('#f-team', 'team'); on('#f-expert', 'expert'); on('#f-qc', 'qcExpert');
  on('#f-from', 'from'); on('#f-to', 'to');
  on('#f-min', 'minScore', 'input'); on('#f-search', 'search', 'input');

  $('#f-reset').addEventListener('click', () => {
    state.filter = { team: 'all', expert: 'all', qcExpert: 'all', from: '', to: '', minScore: '', search: '' };
    renderFilters(); renderCurrentTab();
  });
}

/* =======================================================================
 *  ۴) تب تحلیل کلی
 * ======================================================================= */

function renderOverview() {
  const host = $('#tab-overview');
  const rows = filteredRows();

  if (!rows.length) { host.innerHTML = emptyState(); return; }

  const s = summarize(rows);
  const dist = distribution(rows);
  const trend = byDate(rows);
  const team = activeTeam();
  const experts = byExpert(rows, team || TEAMS[0]);

  const teamStats = [...state.datasets.values()].map(ds => {
    const list = rows.filter(r => r.teamId === ds.team.id);
    return { team: ds.team, ...summarize(list) };
  }).filter(t => t.count > 0);

  host.innerHTML = `
    <div class="kpi-grid mb">
      <div class="kpi"><div class="label">تعداد ارزیابی</div><div class="value">${fa(s.count)}</div><div class="hint">${fa(s.experts)} کارشناس / ${fa(s.qcExperts)} ارزیاب</div></div>
      <div class="kpi ${s.avg >= 90 ? 'ok' : s.avg >= 75 ? 'warn' : 'bad'}"><div class="label">میانگین نمره</div><div class="value">${fa(s.avg)}</div><div class="hint">میانه ${fa(s.median)}</div></div>
      <div class="kpi ok"><div class="label">نمره کامل (۱۰۰)</div><div class="value">${fa(s.fullScore)}</div><div class="hint">${pct(s.count ? s.fullScore / s.count * 100 : 0)} از کل</div></div>
      <div class="kpi ${s.below80 ? 'warn' : 'ok'}"><div class="label">زیر نمره ۸۰</div><div class="value">${fa(s.below80)}</div><div class="hint">نیازمند بازخورد</div></div>
      <div class="kpi ${s.redLines ? 'bad' : 'ok'}"><div class="label">رد لاین</div><div class="value">${fa(s.redLines)}</div><div class="hint">نمره صفر شده</div></div>
      <div class="kpi"><div class="label">میانگین زمان شنیده‌شده</div><div class="value">${fmtSeconds(s.avgListen)}</div><div class="hint">مجموع ${fmtSeconds(s.totalListen)}</div></div>
    </div>

    ${teamStats.length > 1 ? `
    <div class="card">
      <div class="card-head"><h2>مقایسه تیم‌ها</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>تیم</th><th>ارزیابی</th><th>کارشناس</th><th>میانگین نمره</th>
            <th>نمره کامل</th><th>زیر ۸۰</th><th>رد لاین</th><th>وضعیت</th>
          </tr></thead>
          <tbody>
            ${teamStats.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1)).map(t => {
              const lab = performanceLabel(t.avg);
              return `<tr>
                <td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${t.team.color};margin-inline-end:7px"></span>${esc(t.team.name)}</td>
                <td class="mono">${fa(t.count)}</td>
                <td class="mono">${fa(t.experts)}</td>
                <td><div class="bar-row"><span class="pct">${fa(t.avg)}</span>
                  <div class="bar"><i style="width:${t.avg || 0}%;background:${scoreColor(t.avg)}"></i></div></div></td>
                <td class="mono">${fa(t.fullScore)}</td>
                <td class="mono">${fa(t.below80)}</td>
                <td class="mono">${t.redLines ? `<span style="color:var(--bad);font-weight:700">${fa(t.redLines)}</span>` : '۰'}</td>
                <td><span class="tag ${lab.cls}">${lab.text}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="charts-grid mb">
      <div class="card"><div class="card-head"><h2>توزیع نمرات</h2></div>
        <div class="card-body"><div class="chart-box"><canvas id="ch-dist"></canvas></div></div></div>
      <div class="card"><div class="card-head"><h2>روند میانگین نمره در زمان</h2></div>
        <div class="card-body"><div class="chart-box"><canvas id="ch-trend"></canvas></div></div></div>
    </div>

    <div class="charts-grid">
      <div class="card"><div class="card-head"><h2>میانگین نمره کارشناسان</h2>
        <span class="sub">${fa(experts.length)} نفر</span></div>
        <div class="card-body"><div class="chart-box tall"><canvas id="ch-experts"></canvas></div></div></div>
      <div class="card"><div class="card-head"><h2>ضعیف‌ترین معیارها</h2>
        <span class="sub">${team ? esc(team.short) : 'برای تفکیک معیارها یک تیم را در فیلتر انتخاب کنید'}</span></div>
        <div class="card-body">
          ${team ? '<div class="chart-box tall"><canvas id="ch-crit"></canvas></div>'
                 : '<div class="empty"><div class="icon">◎</div><div class="t1">معیارها بین تیم‌ها متفاوت است</div><div class="t2">از فیلتر بالا یک تیم مشخص انتخاب کنید تا تحلیل معیارها نمایش داده شود.</div></div>'}
        </div></div>
    </div>`;

  drawDistribution(dist);
  drawTrend(trend);
  drawExperts(experts);
  if (team) drawCriteria(byCriterion(rows, team), team);
}

/* =======================================================================
 *  ۵) تب کارشناسان
 * ======================================================================= */

function renderExperts() {
  const host = $('#tab-experts');
  const rows = filteredRows();
  if (!rows.length) { host.innerHTML = emptyState(); return; }

  const team = activeTeam();
  const stats = byExpert(rows, team || TEAMS[0]);

  const sortKeys = {
    expert: s => s.expert, count: s => s.count, avg: s => s.avg ?? -1,
    min: s => s.min ?? -1, max: s => s.max ?? -1,
    quality: s => s.avgQuality, qa: s => s.avgQa,
    red: s => s.redLines, below: s => s.below80, listen: s => s.avgListen
  };
  const k = sortKeys[state.sort.key] || sortKeys.avg;
  stats.sort((a, b) => {
    const va = k(a), vb = k(b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb, 'fa') : va - vb;
    return state.sort.dir === 'asc' ? cmp : -cmp;
  });

  const th = (key, label) => `<th class="sortable ${state.sort.key === key ? 'sorted' : ''}" data-sort="${key}">
      ${label} <span class="arrow">${state.sort.key === key ? (state.sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>`;

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>عملکرد کارشناسان</h2>
        <span class="sub">${fa(stats.length)} کارشناس · ${fa(rows.length)} ارزیابی</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" id="exp-csv">خروجی CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>#</th>${th('expert', 'کارشناس')}${team ? '' : '<th>تیم</th>'}${th('count', 'تعداد')}${th('avg', 'میانگین نمره')}
            ${th('quality', 'کیفی')}${th('qa', 'سیستمی')}${th('min', 'کمترین')}${th('max', 'بیشترین')}
            ${th('below', 'زیر ۸۰')}${th('red', 'رد لاین')}${th('listen', 'میانگین شنیدن')}
            <th>وضعیت</th><th></th>
          </tr></thead>
          <tbody>
            ${stats.map((s, i) => {
              const lab = performanceLabel(s.avg);
              return `<tr class="clickable" data-expert="${esc(s.expert)}">
                <td><span class="rank ${i < 3 && state.sort.key === 'avg' && state.sort.dir === 'desc' ? 'r' + (i + 1) : ''}">${fa(i + 1)}</span></td>
                <td><b>${esc(s.expert)}</b></td>
                ${team ? '' : `<td class="small nowrap">${[...new Set(s.rows.map(r => TEAMS.find(t2 => t2.id === r.teamId)?.short || r.teamId))].map(esc).join('، ')}</td>`}
                <td class="mono">${fa(s.count)}</td>
                <td><div class="bar-row"><span class="pct">${fa(s.avg)}</span>
                  <div class="bar"><i style="width:${s.avg || 0}%;background:${scoreColor(s.avg)}"></i></div></div></td>
                <td class="mono">${fa(s.avgQuality)}</td>
                <td class="mono">${fa(s.avgQa)}</td>
                <td class="mono">${fa(s.min)}</td>
                <td class="mono">${fa(s.max)}</td>
                <td class="mono">${s.below80 ? `<span style="color:var(--warn);font-weight:700">${fa(s.below80)}</span>` : '۰'}</td>
                <td class="mono">${s.redLines ? `<span style="color:var(--bad);font-weight:700">${fa(s.redLines)}</span>` : '۰'}</td>
                <td class="mono">${fmtSeconds(s.avgListen)}</td>
                <td><span class="tag ${lab.cls}">${lab.text}</span></td>
                <td><button class="btn btn-sm" data-detail="${esc(s.expert)}">جزئیات</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  $$('#tab-experts th.sortable').forEach(el => el.addEventListener('click', () => {
    const key = el.dataset.sort;
    if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort.key = key; state.sort.dir = key === 'expert' ? 'asc' : 'desc'; }
    renderExperts();
  }));

  $$('#tab-experts [data-detail]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    showExpertModal(b.dataset.detail, stats, team);
  }));
  $$('#tab-experts tr.clickable').forEach(tr => tr.addEventListener('click', () =>
    showExpertModal(tr.dataset.expert, stats, team)));

  $('#exp-csv').addEventListener('click', () => exportExpertsCsv(stats, team));
}

/* =======================================================================
 *  ۶) تب معیارها
 * ======================================================================= */

function renderCriteriaTab() {
  const host = $('#tab-criteria');
  const rows = filteredRows();
  if (!rows.length) { host.innerHTML = emptyState(); return; }

  const team = activeTeam();
  if (!team) {
    host.innerHTML = `<div class="card"><div class="card-body">
      <div class="empty"><div class="icon">◎</div>
        <div class="t1">برای تحلیل معیارها یک تیم انتخاب کنید</div>
        <div class="t2">هر تیم مجموعه معیار و ضرایب مخصوص خود را دارد، بنابراین تحلیل معیارها فقط برای یک تیم معنا دارد.</div>
      </div></div></div>`;
    return;
  }

  const crit = byCriterion(rows, team);
  const experts = byExpert(rows, team);

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>عملکرد به تفکیک معیار — ${esc(team.name)}</h2>
        <span class="sub">${fa(rows.length)} ارزیابی</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" id="crit-csv">خروجی CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>معیار</th><th>بخش</th><th>ضریب</th><th>رعایت شده</th><th>نقض شده</th>
            <th>بی‌اثر / ثبت‌نشده</th><th>درصد رعایت</th><th>امتیاز از دست رفته</th>
          </tr></thead>
          <tbody>
            ${crit.map(c => `<tr>
              <td class="wrap-cell"><b>${esc(c.label)}</b><div class="cd muted small">${esc(c.desc)}</div></td>
              <td><span class="chip">${c.section === 'quality' ? 'کیفی' : 'سیستمی'}</span></td>
              <td class="mono">${fa(c.weight)}</td>
              <td class="mono" style="color:var(--ok)">${fa(c.ok)}</td>
              <td class="mono" style="color:${c.fail ? 'var(--bad)' : 'inherit'};font-weight:${c.fail ? 700 : 400}">${fa(c.fail)}</td>
              <td class="mono muted">${fa(c.na)}</td>
              <td><div class="bar-row"><span class="pct">${pct(c.rate)}</span>
                <div class="bar"><i style="width:${c.rate || 0}%;background:${scoreColor(c.rate)}"></i></div></div></td>
              <td class="mono">${fa(c.lostPoints)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>ماتریس کارشناس × معیار</h2>
        <span class="sub">درصد رعایت هر معیار توسط هر کارشناس</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>کارشناس</th>
            ${crit.map(c => `<th title="${esc(c.label)} — ضریب ${c.weight}" style="writing-mode:vertical-rl;transform:rotate(180deg);height:150px;padding:8px 4px">${esc(c.label)}</th>`).join('')}
            <th>میانگین</th></tr></thead>
          <tbody>
            ${experts.map(s => `<tr>
              <td class="nowrap"><b>${esc(s.expert)}</b> <span class="muted small">(${fa(s.count)})</span></td>
              ${crit.map(c => {
                const st = s.criteria[c.key];
                if (!st || st.rate === null) return '<td class="mono muted" style="text-align:center">—</td>';
                const bg = st.rate >= 95 ? 'var(--ok-soft)' : st.rate >= 80 ? '#fef9c3' : st.rate >= 60 ? 'var(--warn-soft)' : 'var(--bad-soft)';
                return `<td class="mono" style="text-align:center;background:${bg}" title="${st.ok} از ${st.ok + st.fail}">${Math.round(st.rate)}</td>`;
              }).join('')}
              <td><div class="bar-row"><span class="pct">${fa(s.avg)}</span>
                <div class="bar"><i style="width:${s.avg || 0}%;background:${scoreColor(s.avg)}"></i></div></div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  $('#crit-csv').addEventListener('click', () => exportCriteriaCsv(crit, team));
}

/* =======================================================================
 *  ۷) تب رکوردها
 * ======================================================================= */

function renderRecords() {
  const host = $('#tab-records');
  const rows = filteredRows().slice().sort((a, b) =>
    (b.actionDate?.getTime() || 0) - (a.actionDate?.getTime() || 0));
  if (!rows.length) { host.innerHTML = emptyState(); return; }

  const cap = 500;
  const show = rows.slice(0, cap);

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>رکوردهای ارزیابی</h2>
        <span class="sub">${fa(rows.length)} رکورد${rows.length > cap ? ` (نمایش ${fa(cap)} مورد اول)` : ''}</span>
        <span class="spacer"></span>
        <button class="btn btn-sm" id="rec-csv">خروجی CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>تاریخ تماس</th><th>تیم</th><th>کارشناس</th><th>لید</th><th>شماره</th>
            <th>نمره QC</th><th>بازمحاسبه</th><th>کیفی</th><th>سیستمی</th><th>زمان شنیدن</th>
            <th>رد لاین</th><th>ارزیاب QC</th><th>نظر QC</th>
          </tr></thead>
          <tbody>
            ${show.map(r => `<tr class="clickable" data-rec="${esc(r._id)}">
              <td class="nowrap small">${fmtDateTime(r.actionDate)}</td>
              <td class="nowrap small">${esc(TEAMS.find(t => t.id === r.teamId)?.short || r.teamId)}</td>
              <td class="nowrap">${esc(r.expert)}</td>
              <td class="nowrap">${esc(r.leadName || '—')}</td>
              <td class="mono small">${esc(r.leadPhone || '—')}</td>
              <td><b style="color:${scoreColor(r.score)}">${fa(r.score)}</b></td>
              <td class="mono ${r.reportedScore !== null && r.recomputed !== null && Math.abs(r.reportedScore - r.recomputed) > 1 ? 'muted' : ''}"
                  title="نمره بازمحاسبه‌شده بر اساس ضرایب سند">${fa(r.recomputed)}</td>
              <td class="mono">${fa(r.qualityScore)}</td>
              <td class="mono">${fa(r.qaScore)}</td>
              <td class="mono">${fmtSeconds(r.listenTime)}</td>
              <td>${r.redLine ? '<span class="tag critical">دارد</span>' : '<span class="muted">—</span>'}</td>
              <td class="nowrap small">${esc(r.qcExpert)}</td>
              <td class="wrap-cell small">${esc((r.qcComment || '').slice(0, 110))}${(r.qcComment || '').length > 110 ? '…' : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  $$('#tab-records tr.clickable').forEach(tr => tr.addEventListener('click', () => {
    const rec = rows.find(r => r._id === tr.dataset.rec);
    if (rec) showRecordModal(rec);
  }));
  $('#rec-csv').addEventListener('click', () => exportRecordsCsv(rows));
}

/* =======================================================================
 *  ۸) نمودارها
 * ======================================================================= */

function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

const chartFont = { family: 'Vazirmatn, Segoe UI, Tahoma, sans-serif', size: 12 };

function drawDistribution(dist) {
  const el = $('#ch-dist'); if (!el) return;
  destroyChart('dist');
  state.charts.dist = new Chart(el, {
    type: 'bar',
    data: {
      labels: dist.map(d => d.label),
      datasets: [{ label: 'تعداد تماس', data: dist.map(d => d.count),
        backgroundColor: dist.map(d => d.color), borderRadius: 6, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { titleFont: chartFont, bodyFont: chartFont } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, font: chartFont } }, x: { ticks: { font: chartFont } } }
    }
  });
}

function drawTrend(trend) {
  const el = $('#ch-trend'); if (!el) return;
  destroyChart('trend');
  state.charts.trend = new Chart(el, {
    type: 'line',
    data: {
      labels: trend.map(t => t.label),
      datasets: [
        { label: 'میانگین نمره', data: trend.map(t => t.avg), borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29,78,216,.12)', fill: true, tension: .32,
          pointRadius: 4, pointBackgroundColor: '#1d4ed8', yAxisID: 'y' },
        { label: 'تعداد ارزیابی', data: trend.map(t => t.count), borderColor: '#94a3b8',
          borderDash: [5, 5], tension: .32, pointRadius: 3, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { font: chartFont } }, tooltip: { titleFont: chartFont, bodyFont: chartFont } },
      scales: {
        y:  { min: 0, max: 100, position: 'right', ticks: { font: chartFont }, title: { display: true, text: 'نمره', font: chartFont } },
        y1: { beginAtZero: true, position: 'left', grid: { drawOnChartArea: false }, ticks: { precision: 0, font: chartFont }, title: { display: true, text: 'تعداد', font: chartFont } },
        x:  { ticks: { font: chartFont, maxRotation: 45 } }
      }
    }
  });
}

function drawExperts(stats) {
  const el = $('#ch-experts'); if (!el) return;
  destroyChart('experts');
  const top = stats.slice(0, 22);
  state.charts.experts = new Chart(el, {
    type: 'bar',
    data: {
      labels: top.map(s => s.expert),
      datasets: [{ label: 'میانگین نمره', data: top.map(s => s.avg),
        backgroundColor: top.map(s => scoreColor(s.avg)), borderRadius: 5 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: chartFont, bodyFont: chartFont,
          callbacks: { afterLabel: (c) => `تعداد ارزیابی: ${top[c.dataIndex].count}` }
        }
      },
      scales: { x: { min: 0, max: 100, ticks: { font: chartFont } }, y: { ticks: { font: chartFont } } }
    }
  });
}

function drawCriteria(crit, team) {
  const el = $('#ch-crit'); if (!el) return;
  destroyChart('crit');
  const data = crit.filter(c => c.rate !== null).slice(0, 16);
  state.charts.crit = new Chart(el, {
    type: 'bar',
    data: {
      labels: data.map(c => c.label),
      datasets: [{ label: 'درصد رعایت', data: data.map(c => c.rate),
        backgroundColor: data.map(c => scoreColor(c.rate)), borderRadius: 5 }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: chartFont, bodyFont: chartFont,
          callbacks: { afterLabel: (c) => {
            const d = data[c.dataIndex];
            return [`ضریب: ${d.weight}`, `رعایت شده: ${d.ok} از ${d.evaluated}`, `امتیاز از دست رفته: ${d.lostPoints}`];
          } }
        }
      },
      scales: { x: { min: 0, max: 100, ticks: { font: chartFont } }, y: { ticks: { font: chartFont, autoSkip: false } } }
    }
  });
}

/* =======================================================================
 *  ۹) مودال‌ها
 * ======================================================================= */

function openModal(title, bodyHtml, extraBtns = '') {
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3><span class="spacer" style="margin-inline-start:auto"></span>
        ${extraBtns}<button class="btn btn-sm" data-close>بستن</button></div>
      <div class="modal-body">${bodyHtml}</div></div>`;
  el.addEventListener('click', e => { if (e.target === el || e.target.hasAttribute('data-close')) el.remove(); });
  document.addEventListener('keydown', function esc2(e) {
    if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', esc2); }
  });
  document.body.appendChild(el);
  return el;
}

function showCriteriaModal(team) {
  const q = team.criteria.filter(c => c.section === 'quality');
  const a = team.criteria.filter(c => c.section === 'qa');
  const list = (arr) => `<div class="crit-list">${arr.map(c => `
      <div class="crit-row">
        <div><div class="cl">${esc(c.label)}</div><div class="cd">${esc(c.desc)}</div>
          <div class="cd mono" style="opacity:.6">${esc(c.key)}</div></div>
        <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:${team.color}">${fa(c.weight)}</div>
          <div class="cd">ضریب</div></div>
      </div>`).join('')}</div>`;

  openModal(`المان‌های کنترل کیفیت — ${esc(team.name)}`, `
    <div class="alert info">ℹ <div>نمره نهایی = <b>${fa(team.qualityShare)}٪</b> نمره کیفی تماس + <b>${fa(team.qaShare)}٪</b> نمره QA (سیستم).
      معیارهایی که مقدار «−» دارند از محاسبه حذف و نمره نرمال‌سازی می‌شود. ثبت هر رد لاین نمره کل تماس را <b>صفر</b> می‌کند.</div></div>
    <div class="section-title">پارامترهای کیفی تماس — ${fa(team.qualityShare)}٪</div>
    ${list(q)}
    <div class="section-title">پارامترهای سیستمی (QA) — ${fa(team.qaShare)}٪</div>
    ${list(a)}
    <div class="section-title">رد لاین‌ها</div>
    <div class="alert bad">⛔ <ul class="tips" style="margin:0">${team.redLines.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <div class="section-title">ستون‌های مورد انتظار فایل</div>
    <div class="alert info"><div class="mono small" style="direction:ltr;text-align:left;line-height:2">
      ${['lead_id','lead_name','lead_phone','action_date','action_name','tele_expert_name','qc_expert_name','form_created_date','score']
        .concat(team.criteria.map(c => c.key))
        .concat(['Red_line','Red_line_Reason','QC comment','Listening time (second)'])
        .map(esc).join(' · ')}
    </div></div>`);
}

function showWarningsModal(team, warnings, mapping) {
  openModal(`نکات بارگذاری — ${esc(team.name)}`, `
    ${warnings.map(w => `<div class="alert warn">⚠ <div>${esc(w)}</div></div>`).join('')}
    ${mapping && mapping.extra.length ? `<div class="alert info">ℹ <div>ستون‌های اضافی که استفاده نشدند:
      <span class="mono small" style="direction:ltr">${mapping.extra.map(esc).join(', ')}</span></div></div>` : ''}
    <p class="small muted">تحلیل با ستون‌های موجود انجام شد. اگر معیاری در فایل نباشد، ضریب آن از مخرج حذف می‌شود تا نمره منصفانه بماند.</p>`);
}

function showExpertModal(expertName, stats, team) {
  let s = stats.find(x => x.expert === expertName);
  if (!s) return;
  // وقتی «همه تیم‌ها» انتخاب است، معیارها باید با تیم واقعی همان کارشناس محاسبه شوند
  const t = team || TEAMS.find(x => x.id === s.rows[0]?.teamId) || TEAMS[0];
  if (!team) {
    const own = s.rows.filter(r => r.teamId === t.id);
    s = byExpert(own, t).find(x => x.expert === expertName) || s;
  }
  const lab = performanceLabel(s.avg);
  const tips = recommendations(s, t);
  const crit = t.criteria.filter(c => c.weight)
    .map(c => ({ c, st: s.criteria[c.key] }))
    .filter(x => x.st)
    .sort((a, b) => (a.st.rate ?? 101) - (b.st.rate ?? 101));

  const recent = s.rows.slice()
    .sort((a, b) => (b.actionDate?.getTime() || 0) - (a.actionDate?.getTime() || 0))
    .slice(0, 12);

  openModal(`کارنامه کارشناس — ${esc(s.expert)}`, `
    <div class="kpi-grid mb">
      <div class="kpi"><div class="label">تعداد ارزیابی</div><div class="value">${fa(s.count)}</div></div>
      <div class="kpi ${s.avg >= 90 ? 'ok' : s.avg >= 75 ? 'warn' : 'bad'}"><div class="label">میانگین نمره</div>
        <div class="value">${fa(s.avg)}</div><div class="hint"><span class="tag ${lab.cls}">${lab.text}</span></div></div>
      <div class="kpi"><div class="label">بازه نمره</div><div class="value">${fa(s.min)}–${fa(s.max)}</div></div>
      <div class="kpi"><div class="label">کیفی / سیستمی</div><div class="value">${fa(s.avgQuality)} / ${fa(s.avgQa)}</div></div>
      <div class="kpi ${s.redLines ? 'bad' : 'ok'}"><div class="label">رد لاین</div><div class="value">${fa(s.redLines)}</div></div>
      <div class="kpi"><div class="label">میانگین شنیدن</div><div class="value">${fmtSeconds(s.avgListen)}</div></div>
    </div>

    <div class="section-title">توصیه‌های بهبود</div>
    <div class="alert ${s.avg >= 90 && !s.redLines ? 'ok' : 'warn'}">
      <div>💡<ul class="tips" style="margin:6px 0 0">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>

    <div class="section-title">عملکرد در معیارها</div>
    <div class="table-wrap"><table>
      <thead><tr><th>معیار</th><th>ضریب</th><th>رعایت</th><th>نقض</th><th>بی‌اثر</th><th>درصد</th></tr></thead>
      <tbody>${crit.map(x => `<tr>
        <td class="wrap-cell">${esc(x.c.label)}</td>
        <td class="mono">${fa(x.c.weight)}</td>
        <td class="mono" style="color:var(--ok)">${fa(x.st.ok)}</td>
        <td class="mono" style="color:${x.st.fail ? 'var(--bad)' : 'inherit'}">${fa(x.st.fail)}</td>
        <td class="mono muted">${fa(x.st.na)}</td>
        <td><div class="bar-row"><span class="pct">${pct(x.st.rate)}</span>
          <div class="bar"><i style="width:${x.st.rate || 0}%;background:${scoreColor(x.st.rate)}"></i></div></div></td>
      </tr>`).join('')}</tbody>
    </table></div>

    <div class="section-title">آخرین ارزیابی‌ها</div>
    <div class="table-wrap"><table>
      <thead><tr><th>تاریخ</th><th>لید</th><th>نمره</th><th>رد لاین</th><th>نظر QC</th></tr></thead>
      <tbody>${recent.map(r => `<tr>
        <td class="nowrap small">${fmtDateTime(r.actionDate)}</td>
        <td class="nowrap">${esc(r.leadName || '—')}</td>
        <td><b style="color:${scoreColor(r.score)}">${fa(r.score)}</b></td>
        <td>${r.redLine ? '<span class="tag critical">دارد</span>' : '—'}</td>
        <td class="wrap-cell small">${esc((r.qcComment || '—').slice(0, 150))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`);
}

function showRecordModal(r) {
  const t = TEAMS.find(x => x.id === r.teamId);
  const rowsHtml = t.criteria.filter(c => c.weight).map(c => {
    const m = r.marks[c.key];
    const txt = m === 1 ? '<span class="mark m1">✔ رعایت شده</span>'
              : m === 0 ? '<span class="mark m0">✘ رعایت نشده</span>'
              : '<span class="mark mna">— بی‌اثر / ثبت نشده</span>';
    return `<tr>
      <td class="wrap-cell"><b>${esc(c.label)}</b><div class="cd muted small">${esc(c.desc)}</div></td>
      <td><span class="chip">${c.section === 'quality' ? 'کیفی' : 'سیستمی'}</span></td>
      <td class="mono">${fa(c.weight)}</td>
      <td class="nowrap">${txt}</td></tr>`;
  }).join('');

  openModal(`جزئیات ارزیابی — ${esc(r.leadName || r.leadId)}`, `
    ${r.redLine ? `<div class="alert bad">⛔ <div><b>رد لاین ثبت شده:</b> ${esc(r.redLineReason || 'بدون توضیح')} — نمره کل این تماس صفر شد.</div></div>` : ''}
    <div class="kpi-grid mb">
      <div class="kpi ${r.score >= 90 ? 'ok' : r.score >= 75 ? 'warn' : 'bad'}"><div class="label">نمره ثبت‌شده تیم QC</div><div class="value">${fa(r.score)}</div>
        <div class="hint">مبنای گزارش‌ها</div></div>
      <div class="kpi"><div class="label">نمره بازمحاسبه‌شده</div><div class="value">${fa(r.recomputed)}</div>
        <div class="hint">بر اساس ضرایب سند المان‌ها</div></div>
      <div class="kpi"><div class="label">نمره کیفی</div><div class="value">${fa(r.qualityScore)}</div><div class="hint">سهم ${fa(t.qualityShare)}٪</div></div>
      <div class="kpi"><div class="label">نمره سیستمی</div><div class="value">${fa(r.qaScore)}</div><div class="hint">سهم ${fa(t.qaShare)}٪</div></div>
      <div class="kpi"><div class="label">زمان شنیده‌شده</div><div class="value">${fmtSeconds(r.listenTime)}</div></div>
    </div>
    ${r.reportedScore !== null && r.recomputed !== null && Math.abs(r.reportedScore - r.recomputed) > 1
      ? `<div class="alert warn">⚠ <div>اختلاف <b>${fa(Math.abs(round1(r.reportedScore - r.recomputed)))}</b> نمره بین نمره ثبت‌شده و نمره بازمحاسبه‌شده وجود دارد؛ معمولاً به‌دلیل معیارهایی است که در فرم خالی مانده‌اند.</div></div>`
      : ''}

    <div class="table-wrap mb"><table>
      <tbody>
        <tr><th style="width:150px">تیم</th><td>${esc(t.name)}</td></tr>
        <tr><th>کارشناس</th><td>${esc(r.expert)}</td></tr>
        <tr><th>ارزیاب QC</th><td>${esc(r.qcExpert)}</td></tr>
        <tr><th>شناسه لید</th><td class="mono">${esc(r.leadId || '—')}</td></tr>
        <tr><th>شماره تماس</th><td class="mono">${esc(r.leadPhone || '—')}</td></tr>
        <tr><th>تاریخ تماس</th><td>${fmtDateTime(r.actionDate)}</td></tr>
        <tr><th>تاریخ ثبت فرم</th><td>${fmtDateTime(r.formDate)}</td></tr>
        <tr><th>نوع اکشن</th><td>${esc(r.actionName || '—')}</td></tr>
        ${r.qcComment ? `<tr><th>نظر ارزیاب</th><td class="wrap-cell">${esc(r.qcComment)}</td></tr>` : ''}
      </tbody></table></div>

    <div class="section-title">ریز نمرات معیارها</div>
    <div class="table-wrap"><table>
      <thead><tr><th>معیار</th><th>بخش</th><th>ضریب</th><th>نتیجه</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>`);
}

/* =======================================================================
 *  ۱۰) خروجی CSV
 * ======================================================================= */

function downloadCsv(name, rows) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function exportExpertsCsv(stats, team) {
  const crit = (team || TEAMS[0]).criteria.filter(c => c.weight);
  const head = ['کارشناس', 'تعداد ارزیابی', 'میانگین نمره', 'نمره کیفی', 'نمره سیستمی',
    'کمترین', 'بیشترین', 'زیر ۸۰', 'رد لاین', 'میانگین زمان شنیدن (ثانیه)', 'وضعیت']
    .concat(team ? crit.map(c => `${c.label} (٪)`) : []);
  const body = stats.map(s => [s.expert, s.count, s.avg, s.avgQuality, s.avgQa, s.min, s.max,
    s.below80, s.redLines, s.avgListen, performanceLabel(s.avg).text]
    .concat(team ? crit.map(c => s.criteria[c.key]?.rate ?? '') : []));
  downloadCsv(`qc-experts-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
}

function exportCriteriaCsv(crit, team) {
  const head = ['معیار', 'کلید', 'بخش', 'ضریب', 'رعایت شده', 'نقض شده', 'بی‌اثر', 'درصد رعایت', 'امتیاز از دست رفته'];
  const body = crit.map(c => [c.label, c.key, c.section === 'quality' ? 'کیفی' : 'سیستمی',
    c.weight, c.ok, c.fail, c.na, c.rate ?? '', c.lostPoints]);
  downloadCsv(`qc-criteria-${team.id}-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
}

function exportRecordsCsv(rows) {
  const head = ['تیم', 'تاریخ تماس', 'کارشناس', 'ارزیاب QC', 'شناسه لید', 'نام لید', 'شماره',
    'نمره ثبت‌شده QC', 'نمره بازمحاسبه‌شده', 'نمره کیفی', 'نمره سیستمی', 'رد لاین', 'دلیل رد لاین',
    'زمان شنیدن (ثانیه)', 'نظر QC'];
  const body = rows.map(r => [
    TEAMS.find(t => t.id === r.teamId)?.name || r.teamId,
    r.actionDate ? r.actionDate.toISOString().slice(0, 19).replace('T', ' ') : '',
    r.expert, r.qcExpert, r.leadId, r.leadName, r.leadPhone,
    r.score, r.recomputed ?? '', r.qualityScore, r.qaScore,
    r.redLine ? 'دارد' : '', r.redLineReason, r.listenTime ?? '', r.qcComment
  ]);
  downloadCsv(`qc-records-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...body]);
}

/* =======================================================================
 *  ۱۱) تب‌ها و راه‌اندازی
 * ======================================================================= */

function emptyState() {
  return `<div class="card"><div class="card-body"><div class="empty">
      <div class="icon">📊</div>
      <div class="t1">داده‌ای برای نمایش نیست</div>
      <div class="t2">${state.datasets.size
        ? 'با فیلترهای فعلی رکوردی پیدا نشد. فیلترها را تغییر دهید یا پاک کنید.'
        : 'ابتدا از تب «بارگذاری فایل» برای هر تیم فایل اکسل خروجی فرم QC را بارگذاری کنید.'}</div>
    </div></div></div>`;
}

function renderCurrentTab() {
  const t = state.activeTab;
  if (t === 'upload')   renderUpload();
  if (t === 'overview') renderOverview();
  if (t === 'experts')  renderExperts();
  if (t === 'criteria') renderCriteriaTab();
  if (t === 'records')  renderRecords();
}

function refreshAll() {
  renderUpload();
  renderFilters();
  $('#filters-card').classList.toggle('hidden', state.activeTab === 'upload' || !state.datasets.size);
  renderCurrentTab();
  const n = allRows().length;
  $('#global-count').textContent = n ? `${fa(n)} رکورد` : '';
  $('#btn-reset').disabled = !state.datasets.size;
}

function setTab(tab) {
  state.activeTab = tab;
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
  $('#filters-card').classList.toggle('hidden', tab === 'upload' || !state.datasets.size);
  renderCurrentTab();
}

function toast(msg, kind = 'info') {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.style.cssText = 'position:fixed;bottom:22px;inset-inline-start:22px;z-index:500;display:flex;flex-direction:column;gap:9px';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'alert ' + (kind === 'bad' ? 'bad' : kind === 'ok' ? 'ok' : kind === 'warn' ? 'warn' : 'info');
  el.style.cssText = 'box-shadow:var(--shadow-lg);margin:0;min-width:250px';
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, 4200);
}

document.addEventListener('DOMContentLoaded', () => {
  $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#btn-samples').addEventListener('click', loadSamples);
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('تمام فایل‌های بارگذاری‌شده حذف شوند؟')) return;
    state.datasets.clear();
    state.filter = { team: 'all', expert: 'all', qcExpert: 'all', from: '', to: '', minScore: '', search: '' };
    refreshAll();
  });
  $('#btn-print').addEventListener('click', () => window.print());
  refreshAll();
});
