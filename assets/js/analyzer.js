/* =========================================================================
 *  موتور تحلیل نمرات کنترل کیفیت
 *  ورودی : آرایه‌ای از ردیف‌های خام اکسل (AOA) + تعریف تیم
 *  خروجی : رکوردهای نرمال‌شده + آمار تجمیعی
 * ========================================================================= */

/* ---------------------- ابزارهای کمکی ---------------------- */

/** پاک‌سازی مقدار سلول: حذف گیومه‌های اضافه، unescape یونیکد، trim */
function cleanCell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  let s = String(v).trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  // رشته‌های \u06cc که در خروجی کوئری escape شده‌اند
  if (s.indexOf('\\u') !== -1) {
    try {
      s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    } catch (e) { /* noop */ }
  }
  s = s.replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\\\//g, '/');
  return s.trim();
}

/** نرمال‌سازی نام ستون برای تطبیق */
function normKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[()]/g, '');
}

/** تبدیل ارقام فارسی/عربی به لاتین */
function toEnDigits(s) {
  return String(s)
    .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
}

/** تفسیر مقدار یک معیار: 1 / 0 / '-' (بی‌اثر) / null (خالی) */
function parseMark(v) {
  const s = toEnDigits(cleanCell(v)).trim();
  if (s === '' ) return null;         // ثبت نشده
  if (s === '-' || s === '—' || s === 'na' || s === 'N/A') return 'na';
  const n = Number(s);
  if (n === 1) return 1;
  if (n === 0) return 0;
  const low = s.toLowerCase();
  if (['yes', 'true', 'بله', 'رعایت شده', 'ok'].includes(low)) return 1;
  if (['no', 'false', 'خیر', 'رعایت نشده'].includes(low)) return 0;
  return null;
}

/** تبدیل تاریخ اکسل/رشته به Date */
function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {           // Excel serial
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(d) ? null : d;
  }
  const s = cleanCell(v);
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
  } catch (e) { return d.toISOString().slice(0, 10); }
}

function fmtDateTime(d) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

function round1(n) { return Math.round(n * 10) / 10; }

/* ---------------------- تطبیق ستون‌ها ---------------------- */

/**
 * نگاشت هدر فایل به کلیدهای مورد انتظار تیم.
 * برمی‌گرداند: { index: {key -> colIndex}, unmatched: [criteriaKey], extra: [header] }
 */
function mapColumns(headers, team) {
  const normHeaders = headers.map(normKey);
  const index = {};
  const used = new Set();

  const find = (candidates) => {
    for (const c of candidates) {
      const i = normHeaders.indexOf(normKey(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  // ستون‌های شناسنامه‌ای
  const meta = {};
  for (const [field, cands] of Object.entries(META_FIELDS)) {
    const i = find(cands);
    if (i !== -1) { meta[field] = i; used.add(i); }
  }

  // معیارها
  const unmatched = [];
  for (const c of team.criteria) {
    const cands = [c.key].concat(c.aliases || []);
    const i = find(cands);
    if (i !== -1) { index[c.key] = i; used.add(i); }
    else unmatched.push(c);
  }

  const extra = headers
    .map((h, i) => ({ h, i }))
    .filter(o => !used.has(o.i) && String(o.h || '').trim() !== '')
    .map(o => o.h);

  return { meta, index, unmatched, extra };
}

/**
 * حدس تیم مناسب برای یک فایل بر اساس هم‌پوشانی ستون‌ها.
 * برمی‌گرداند: [{team, matched, total, ratio}] مرتب‌شده نزولی
 */
function guessTeam(headers) {
  const normHeaders = headers.map(normKey);
  return TEAMS.map(t => {
    let matched = 0;
    t.criteria.forEach(c => {
      const cands = [c.key].concat(c.aliases || []).map(normKey);
      if (cands.some(k => normHeaders.includes(k))) matched++;
    });
    return { team: t, matched, total: t.criteria.length, ratio: matched / t.criteria.length };
  }).sort((a, b) => b.ratio - a.ratio || b.matched - a.matched);
}

/* ---------------------- محاسبه نمره ---------------------- */

/**
 * محاسبه نمره یک تماس بر اساس ضرایب تیم.
 * معیارهای «-» یا ثبت‌نشده از مخرج حذف می‌شوند (normalize).
 */
function scoreRow(marks, team) {
  const sections = { quality: { got: 0, max: 0 }, qa: { got: 0, max: 0 } };
  const detail = {};

  team.criteria.forEach(c => {
    if (!c.weight) return;
    const m = marks[c.key];
    detail[c.key] = m;
    if (m === 1 || m === 0) {
      sections[c.section].max += c.weight;
      if (m === 1) sections[c.section].got += c.weight;
    }
  });

  const qShare = team.qualityShare;
  const aShare = team.qaShare;

  const qualityPct = sections.quality.max ? sections.quality.got / sections.quality.max : null;
  const qaPct      = sections.qa.max      ? sections.qa.got      / sections.qa.max      : null;

  // اگر یکی از بخش‌ها اصلاً ارزیابی نشده، سهم آن به بخش دیگر منتقل می‌شود
  let total;
  if (qualityPct === null && qaPct === null) total = null;
  else if (qaPct === null)      total = qualityPct * 100;
  else if (qualityPct === null) total = qaPct * 100;
  else total = qualityPct * qShare + qaPct * aShare;

  return {
    quality: qualityPct === null ? null : round1(qualityPct * 100),
    qa:      qaPct === null      ? null : round1(qaPct * 100),
    total:   total === null      ? null : round1(total),
    detail,
    qualityWeights: sections.quality,
    qaWeights: sections.qa
  };
}

/* ---------------------- پردازش فایل ---------------------- */

/**
 * تبدیل AOA به رکوردهای تحلیل‌شده.
 * @param {Array<Array>} aoa  ردیف اول = هدر
 * @param {Object} team
 * @param {String} fileName
 */
function parseSheet(aoa, team, fileName) {
  if (!aoa || aoa.length < 2) {
    return { rows: [], warnings: ['فایل خالی است یا فقط سطر عنوان دارد.'], mapping: null };
  }
  const headers = aoa[0].map(h => (h === null || h === undefined ? '' : String(h)));
  const mapping = mapColumns(headers, team);
  const warnings = [];

  if (mapping.unmatched.length) {
    warnings.push(
      `${mapping.unmatched.length} معیار در فایل یافت نشد و از محاسبه کنار گذاشته شد: ` +
      mapping.unmatched.map(c => c.label).join('، ')
    );
  }
  if (mapping.meta.expert === undefined) {
    warnings.push('ستون «tele_expert_name» (نام کارشناس) پیدا نشد؛ تحلیل کارشناسی امکان‌پذیر نیست.');
  }

  const rows = [];
  for (let r = 1; r < aoa.length; r++) {
    const raw = aoa[r] || [];
    const isEmpty = raw.every(c => c === null || c === undefined || String(c).trim() === '');
    if (isEmpty) continue;

    const get = (i) => (i === undefined ? '' : cleanCell(raw[i]));

    const marks = {};
    team.criteria.forEach(c => {
      const i = mapping.index[c.key];
      marks[c.key] = i === undefined ? null : parseMark(raw[i]);
    });

    const computed = scoreRow(marks, team);

    const redRaw   = mapping.meta.redLine !== undefined ? parseMark(raw[mapping.meta.redLine]) : null;
    const redWhy   = get(mapping.meta.redLineWhy);
    const hasRed   = redRaw === 1 || (!!redWhy && redRaw !== 0);

    const reported = mapping.meta.score !== undefined
      ? Number(toEnDigits(cleanCell(raw[mapping.meta.score])))
      : NaN;

    // نمره بازمحاسبه‌شده بر اساس ضرایب سند المان‌ها
    const recomputed = hasRed ? 0 : computed.total;
    // نمره‌ای که تیم QC در فرم ثبت کرده (مرجع اصلی)
    const reportedScore = isNaN(reported) ? null : (hasRed ? 0 : reported);

    const listenRaw = mapping.meta.listenTime !== undefined
      ? Number(toEnDigits(cleanCell(raw[mapping.meta.listenTime])))
      : NaN;

    rows.push({
      _id: `${fileName}#${r}`,
      file: fileName,
      teamId: team.id,
      teamName: team.name,
      leadId:    get(mapping.meta.leadId).replace(/\.0$/, ''),
      leadName:  get(mapping.meta.leadName),
      leadPhone: get(mapping.meta.leadPhone),
      actionName: get(mapping.meta.actionName),
      actionDate: parseDate(mapping.meta.actionDate !== undefined ? raw[mapping.meta.actionDate] : null),
      formDate:   parseDate(mapping.meta.formDate   !== undefined ? raw[mapping.meta.formDate]   : null),
      expert:     get(mapping.meta.expert)   || 'نامشخص',
      qcExpert:   get(mapping.meta.qcExpert) || 'نامشخص',
      qcComment:  get(mapping.meta.qcComment),
      redLine:    hasRed,
      redLineReason: redWhy,
      listenTime: isNaN(listenRaw) ? null : listenRaw,
      reportedScore,
      recomputed,
      // نمره مرجع: نمره ثبت‌شده تیم QC، و در نبود آن نمره بازمحاسبه‌شده
      score: reportedScore !== null ? reportedScore : recomputed,
      qualityScore: hasRed ? 0 : computed.quality,
      qaScore:      hasRed ? 0 : computed.qa,
      marks
    });
  }

  // معیارهایی که ستونشان هست ولی در هیچ ردیفی مقدار ندارند
  const allEmpty = team.criteria.filter(c =>
    c.weight && mapping.index[c.key] !== undefined && rows.every(r => r.marks[c.key] === null)
  );
  if (allEmpty.length) {
    warnings.push(
      `${allEmpty.length} معیار در تمام ردیف‌ها خالی است و در نمره‌دهی لحاظ نشد: ` +
      allEmpty.map(c => c.label).join('، ')
    );
  }

  // اختلاف نمره محاسبه‌شده با نمره ثبت‌شده در فرم
  const mismatched = rows.filter(r =>
    r.reportedScore !== null && r.recomputed !== null && Math.abs(r.reportedScore - r.recomputed) > 1
  );
  if (mismatched.length) {
    warnings.push(
      `${mismatched.length} ردیف اختلاف بیش از ۱ نمره بین ستون «score» فایل و نمره بازمحاسبه‌شده بر اساس ضرایب سند دارد. ` +
      'مبنای گزارش‌ها همان نمره ثبت‌شده تیم QC است؛ نمره بازمحاسبه‌شده در جزئیات هر رکورد قابل مشاهده است.'
    );
  }

  return { rows, warnings, mapping, headers };
}

/* ---------------------- آمار تجمیعی ---------------------- */

function mean(arr) {
  const v = arr.filter(x => typeof x === 'number' && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function median(arr) {
  const v = arr.filter(x => typeof x === 'number' && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** آمار کلی مجموعه رکوردها */
function summarize(rows) {
  const scores = rows.map(r => r.score).filter(s => s !== null);
  return {
    count: rows.length,
    experts: new Set(rows.map(r => r.expert)).size,
    qcExperts: new Set(rows.map(r => r.qcExpert)).size,
    avg: scores.length ? round1(mean(scores)) : null,
    median: scores.length ? round1(median(scores)) : null,
    min: scores.length ? Math.min(...scores) : null,
    max: scores.length ? Math.max(...scores) : null,
    redLines: rows.filter(r => r.redLine).length,
    fullScore: rows.filter(r => r.score === 100).length,
    below80: rows.filter(r => r.score !== null && r.score < 80).length,
    avgListen: round1(mean(rows.map(r => r.listenTime)) || 0),
    totalListen: rows.reduce((a, r) => a + (r.listenTime || 0), 0)
  };
}

/** تحلیل به تفکیک کارشناس */
function byExpert(rows, team) {
  const map = new Map();
  rows.forEach(r => {
    if (!map.has(r.expert)) map.set(r.expert, []);
    map.get(r.expert).push(r);
  });

  const out = [];
  map.forEach((list, expert) => {
    const scores = list.map(r => r.score).filter(s => s !== null);
    const crit = {};
    team.criteria.forEach(c => {
      if (!c.weight) return;
      let ok = 0, fail = 0, na = 0;
      list.forEach(r => {
        const m = r.marks[c.key];
        if (m === 1) ok++; else if (m === 0) fail++; else na++;
      });
      const evaluated = ok + fail;
      crit[c.key] = { ok, fail, na, rate: evaluated ? round1((ok / evaluated) * 100) : null };
    });

    out.push({
      expert,
      count: list.length,
      avg: scores.length ? round1(mean(scores)) : null,
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
      avgQuality: round1(mean(list.map(r => r.qualityScore)) || 0),
      avgQa: round1(mean(list.map(r => r.qaScore)) || 0),
      redLines: list.filter(r => r.redLine).length,
      below80: list.filter(r => r.score !== null && r.score < 80).length,
      avgListen: round1(mean(list.map(r => r.listenTime)) || 0),
      criteria: crit,
      rows: list
    });
  });

  return out.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
}

/** تحلیل به تفکیک معیار (کل تیم) */
function byCriterion(rows, team) {
  return team.criteria.filter(c => c.weight).map(c => {
    let ok = 0, fail = 0, na = 0;
    rows.forEach(r => {
      const m = r.marks[c.key];
      if (m === 1) ok++; else if (m === 0) fail++; else na++;
    });
    const evaluated = ok + fail;
    return {
      ...c,
      ok, fail, na, evaluated,
      rate: evaluated ? round1((ok / evaluated) * 100) : null,
      lostPoints: fail * c.weight
    };
  }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
}

/** روند زمانی بر اساس روز */
function byDate(rows) {
  const map = new Map();
  rows.forEach(r => {
    const d = r.actionDate || r.formDate;
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({
      date: key,
      label: fmtDate(new Date(key)),
      count: list.length,
      avg: round1(mean(list.map(r => r.score)) || 0)
    }));
}

/** توزیع نمرات در بازه‌ها */
function distribution(rows) {
  const buckets = [
    { label: '۰ تا ۵۹', min: 0,   max: 59.99, color: '#dc2626' },
    { label: '۶۰ تا ۶۹', min: 60, max: 69.99, color: '#ea580c' },
    { label: '۷۰ تا ۷۹', min: 70, max: 79.99, color: '#f59e0b' },
    { label: '۸۰ تا ۸۹', min: 80, max: 89.99, color: '#84cc16' },
    { label: '۹۰ تا ۹۹', min: 90, max: 99.99, color: '#22c55e' },
    { label: '۱۰۰',      min: 100, max: 100,  color: '#059669' }
  ];
  return buckets.map(b => ({
    ...b,
    count: rows.filter(r => r.score !== null && r.score >= b.min && r.score <= b.max).length
  }));
}

/** رتبه‌بندی و برچسب عملکرد */
function performanceLabel(avg) {
  if (avg === null) return { text: 'بدون داده', cls: 'na' };
  if (avg >= 95) return { text: 'عالی', cls: 'excellent' };
  if (avg >= 85) return { text: 'خوب', cls: 'good' };
  if (avg >= 75) return { text: 'قابل قبول', cls: 'fair' };
  if (avg >= 60) return { text: 'نیازمند بهبود', cls: 'weak' };
  return { text: 'بحرانی', cls: 'critical' };
}

/** تولید توصیه‌های خودکار برای یک کارشناس */
function recommendations(expertStat, team) {
  const tips = [];
  const weak = team.criteria
    .filter(c => c.weight)
    .map(c => ({ c, s: expertStat.criteria[c.key] }))
    .filter(x => x.s && x.s.rate !== null && x.s.rate < 90)
    .sort((a, b) => a.s.rate - b.s.rate);

  weak.slice(0, 4).forEach(x => {
    tips.push(`«${x.c.label}» فقط در ${x.s.rate}٪ تماس‌ها رعایت شده (${x.s.fail} مورد از دست‌رفته، ضریب ${x.c.weight}) — ${x.c.desc}`);
  });

  if (expertStat.redLines > 0) {
    tips.push(`${expertStat.redLines} مورد رد لاین ثبت شده که نمره آن تماس‌ها را صفر کرده است؛ بازبینی فوری لازم است.`);
  }
  if (expertStat.below80 > 0) {
    tips.push(`${expertStat.below80} تماس زیر نمره ۸۰ دارد.`);
  }
  if (!tips.length) tips.push('عملکرد در تمام معیارها بالای ۹۰٪ است؛ نیازی به اقدام اصلاحی فوری نیست.');
  return tips;
}

if (typeof module !== 'undefined') {
  module.exports = {
    cleanCell, normKey, parseMark, parseDate, fmtDate, fmtDateTime, round1,
    mapColumns, guessTeam, scoreRow, parseSheet,
    summarize, byExpert, byCriterion, byDate, distribution,
    performanceLabel, recommendations, mean, median
  };
}
