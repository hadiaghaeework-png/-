/**
 * پیکربندی تیم‌ها و المان‌های کنترل کیفیت
 * -------------------------------------------------
 * ضرایب هر معیار دقیقاً از فایل‌های «المان های کنترل کیفیت» استخراج شده است.
 *  - بخش «نمره کیفی تماس» (quality)
 *  - بخش «نمره QA / سیستم» (qa)
 * مجموع ضرایب هر تیم برابر ۱۰۰ است.
 *
 * قواعد نمره‌دهی هر معیار:
 *   1  → معیار به‌درستی رعایت شده
 *   0  → معیار رعایت نشده یا فراموش شده
 *   -  → معیار در ارزیابی بی‌اثر است (از مخرج حذف می‌شود)
 *
 * RED LINE: در صورت ثبت رد لاین، نمره کل تماس صفر می‌شود.
 */

const RED_LINES_COMMON = [
  'خندیدن به نشانه تمسخر کاربر حین تماس',
  'خوردن یا نوشیدن چیزی در زمان تماس',
  'قطع نکردن تماس بعد از اتمام مکالمه',
  'ارائه اطلاعات غیرضروری به کاربر',
  'عدم برقراری تماس دوم در صورتی که تماس اول حین مکالمه قطع شده باشد'
];

const TEAMS = [
  /* ------------------------------------------------------------------ */
  {
    id: 'bnpl_happycall',
    group: 'BNPL',
    name: 'BNPL – هپی کال',
    nameEn: 'BNPL – Happy Call',
    short: 'هپی کال',
    color: '#2563eb',
    icon: '☎',
    qualityShare: 80,
    qaShare: 20,
    sample: 'samples/qc_bnpl_happycall_sample.xlsx',
    deck: 'docs/المان های کنترل کیفیت - Happy Call.pptx',
    description: 'بررسی کیفیت تماس‌های هپی کال (اعلام اقساط، روش پرداخت و دریافت شماره دوم)',
    criteria: [
      { key: 'Call_opening_quality',                  label: 'شروع مناسب مکالمه',            weight: 5,  section: 'quality', desc: 'دقت در وضعیت میکروفون، شروع به موقع مکالمه' },
      { key: 'agent_introduction_and_role',           label: 'معرفی خود و اعلام سمت',        weight: 5,  section: 'quality', desc: 'معرفی نام و واحدی که موظف به معرفی هستیم (بیمه مرکزی، سامانه کل بیمه و…)' },
      { key: 'user_identify_verification',            label: 'احراز هویت بیمه‌گذار',          weight: 5,  section: 'quality', desc: 'بیان نام خانوادگی کاربر در ابتدای مکالمه یا پرسش از ایشان' },
      { key: 'due_amount_info',                       label: 'اعلام موعد پرداخت و مبلغ اقساط', weight: 7,  section: 'quality', desc: 'مبلغ کل بیمه‌نامه – اعلام تعداد اقساط و مبلغ هر قسط' },
      { key: 'payment_method_explained',              label: 'توضیح صحیح روش‌های پرداخت',    weight: 13, section: 'quality', desc: 'شماره کارت و لینک مستقیم – مهلت پرداخت بدون جریمه ۴ روزه' },
      { key: 'Explained_Representative_Payment_Risk', label: 'تذکرات پرداخت از طریق نماینده', weight: 8,  section: 'quality', desc: 'پرداخت به نماینده به منزله تسویه نهایی نیست و پیگیری آن بر عهده بیمه‌گذار است' },
      { key: 'polite_tone',                           label: 'لحن و ادبیات محترمانه و تعاملی', weight: 7,  section: 'quality', desc: 'کنترل خشم – لحن مناسب' },
      { key: 'call_closure',                          label: 'پایان‌بندی مکالمه',             weight: 5,  section: 'quality', desc: 'جمع‌بندی صحبت‌ها، عدم قطع کردن تماس روی کاربر بدون خداحافظی' },
      { key: 'second_number_collection',              label: 'دریافت شماره تماس دوم',        weight: 13, section: 'quality', desc: 'ثبت شماره و نام شخص' },
      { key: 'Discrepancy_Management',                label: 'مدیریت مغایرت',                weight: 7,  section: 'quality', desc: 'ارجاع درست موارد' },
      { key: 'question_space',                        label: 'ایجاد فضای پرسش',              weight: 5,  section: 'quality', desc: 'بررسی اطلاعات لازم پیش از تماس و پاسخگویی به سوالات کاربر' },

      { key: 'Correctly_record_action',               label: 'ثبت درست اکشن تماس',           weight: 5,  section: 'qa', desc: 'ثبت اکشن برای تمامی تماس‌ها الزامی و انتخاب درست دراپ‌دان ملاک ارزیابی است' },
      { key: 'Note',                                  label: 'درج یادداشت کامل',             weight: 5,  section: 'qa', desc: 'توضیحات لازم هر تماس باید در بخش اطلاعات تکمیلی ثبت شود' },
      { key: 'second_number_entry',                   label: 'ثبت شماره تماس دوم',           weight: 5,  section: 'qa', desc: 'ثبت شماره تماس دوم در سیستم' },
      { key: 'payment_method_selection',              label: 'مشخص کردن نحوه پرداخت',        weight: 5,  section: 'qa', desc: 'انتخاب نحوه پرداخت در فرم CRM' }
    ],
    redLines: RED_LINES_COMMON
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'bnpl_enduser',
    group: 'BNPL',
    name: 'BNPL – وصول مطالبات (End User)',
    nameEn: 'BNPL – End User',
    short: 'وصول مطالبات',
    color: '#0891b2',
    icon: '⛁',
    qualityShare: 80,
    qaShare: 20,
    sample: 'samples/qc_bnpl_enduser_sample.xlsx',
    deck: 'docs/المان های کنترل کیفیت - End User.pptx',
    description: 'بررسی کیفیت تماس‌های کارشناسان وصول مطالبات کاربر نهایی',
    criteria: [
      { key: 'Call_opening_quality',               label: 'شروع مناسب مکالمه',                 weight: 7,  section: 'quality', desc: 'دقت در وضعیت میکروفون، شروع به موقع مکالمه' },
      { key: 'agent_introduction_and_role',        label: 'معرفی خود و اعلام سمت',             weight: 8,  section: 'quality', desc: 'معرفی نام و واحدی که موظف به معرفی هستیم (بیمه، سامانه کل بیمه و…)' },
      { key: 'user_identify_verification',         label: 'احراز هویت بیمه‌گذار/نماینده',       weight: 7,  section: 'quality', desc: 'بیان نام خانوادگی کاربر در ابتدای مکالمه یا پرسش از ایشان' },
      { key: 'policy_info_and_outstanding_amount', label: 'اعلام اطلاعات بیمه‌نامه و میزان معوق', weight: 10, section: 'quality', desc: 'اعلام اطلاعات بیمه‌نامه و شفاف کردن تعداد روزهای معوق' },
      { key: 'payment_guidance',                   label: 'راهنمایی درست برای نحوه پرداخت',     weight: 10, section: 'quality', desc: 'ارسال لینک یا اعلام شماره کارت در تماس‌های اولیه' },
      { key: 'tone_match_call_type',               label: 'لحن و ادبیات متناسب با نوع تماس',    weight: 20, section: 'quality', desc: 'پرهیز از تنش اضافی، کنترل خشم، استفاده از کلمات مناسب' },
      { key: 'lead_topic_mastery',                 label: 'تسلط به موضوع لید',                 weight: 8,  section: 'quality', desc: 'بررسی اطلاعات لازم پیش از تماس و پاسخگویی به سوالات کاربر' },
      { key: 'call_closure',                       label: 'پایان‌بندی مکالمه',                  weight: 10, section: 'quality', desc: 'جمع‌بندی صحبت‌ها، عدم قطع کردن تماس روی کاربر بدون خداحافظی' },

      { key: 'Correctly_record_action',            label: 'ثبت درست اکشن تماس',                weight: 10, section: 'qa', desc: 'ثبت اکشن برای تمامی تماس‌ها الزامی و انتخاب درست دراپ‌دان ملاک ارزیابی است' },
      { key: 'Note',                               label: 'درج یادداشت کامل',                  weight: 10, section: 'qa', desc: 'توضیحات لازم هر تماس باید در بخش اطلاعات تکمیلی ثبت شود' },
      { key: 'Next_follow-up_time',                label: 'ثبت زمان پیگیری بعدی',              weight: 0,  section: 'qa', desc: 'اطلاعاتی – بدون ضریب در نمره نهایی' }
    ],
    redLines: RED_LINES_COMMON.concat(['ارائه اطلاعات اشتباه به کاربر'])
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'bnpl_installment',
    group: 'BNPL',
    name: 'BNPL – فروش اقساطی',
    nameEn: 'BNPL – Installment Sales',
    short: 'فروش اقساطی',
    color: '#7c3aed',
    icon: '▦',
    qualityShare: 90,
    qaShare: 10,
    sample: null,
    deck: 'docs/المان های کنترل کیفیت - Installment Sales.pptx',
    description: 'بررسی کیفیت مکالمات فروش اقساطی (ثبت‌نام مرحله‌ای و مذاکره)',
    criteria: [
      { key: 'Call_opening_quality',        label: 'شروع مناسب مکالمه',                weight: 6,  section: 'quality', desc: 'دقت در وضعیت میکروفون، شروع به موقع مکالمه' },
      { key: 'agent_introduction_and_role', label: 'معرفی خود و اعلام سمت',            weight: 6,  section: 'quality', desc: 'معرفی نام و واحدی که موظف به معرفی هستیم (شرکا بیمه بازار)' },
      { key: 'user_identify_verification',  label: 'احراز هویت نماینده',               weight: 6,  section: 'quality', desc: 'بیان نام خانوادگی کاربر در ابتدای مکالمه یا پرسش از ایشان' },
      { key: 'correct_call_reason',         label: 'بیان صحیح علت تماس',               weight: 10, section: 'quality', desc: 'توضیح مرحله ثبت‌نام و موارد کلیدی مربوط به آن', aliases: ['call_reason', 'reason_of_call'] },
      { key: 'empathy_active_listening',    label: 'همدلی و گوش دادن فعال',            weight: 10, section: 'quality', desc: 'دقت کامل به صحبت‌های کاربر، همدلی، یافتن راه‌حل و اطمینان دادن برای پیگیری', aliases: ['empathy_and_active_listening', 'active_listening'] },
      { key: 'effective_negotiation',       label: 'تعامل و مذاکره مؤثر',              weight: 16, section: 'quality', desc: 'مذاکره برای متقاعد کردن کاربر یا فهمیدن علت اصلی عدم تمایل' },
      { key: 'polite_tone',                 label: 'لحن و ادبیات محترمانه و تعاملی',    weight: 10, section: 'quality', desc: 'کنترل خشم – لحن مناسب – صحبت پرانرژی' },
      { key: 'next_steps_clarification',    label: 'شفاف‌سازی مسیر و تعهدات بعد از تماس', weight: 10, section: 'quality', desc: 'جمع‌بندی صحبت‌ها، توضیح مراحل بعدی و ایجاد ارتباط لازم', aliases: ['post_call_commitments', 'path_clarification'] },
      { key: 'topic_mastery',               label: 'تسلط به موضوع',                    weight: 6,  section: 'quality', desc: 'تمرکز کامل، راهنمایی درست و دقت در اطلاعات ثبت‌شده', aliases: ['lead_topic_mastery'] },
      { key: 'call_closure',                label: 'پایان‌بندی محترمانه تماس',          weight: 10, section: 'quality', desc: 'جمع‌بندی صحبت‌ها، عدم قطع کردن تماس روی کاربر بدون خداحافظی', aliases: ['courteous_closure'] },

      { key: 'Correctly_record_action',     label: 'ثبت درست اکشن تماس',               weight: 10, section: 'qa', desc: 'ثبت اکشن برای تمامی تماس‌ها الزامی؛ انتخاب درست دراپ‌دان و یادداشت کامل ملاک ارزیابی است', aliases: ['call_action_logging'] }
    ],
    redLines: RED_LINES_COMMON
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'mlm',
    group: 'MLM',
    name: 'MLM – بازاریابی شبکه‌ای',
    nameEn: 'MLM',
    short: 'MLM',
    color: '#c2410c',
    icon: '◈',
    qualityShare: 80,
    qaShare: 20,
    sample: 'samples/qc_mlm_sample.xlsx',
    deck: 'docs/المان های کنترل کیفیت - MLM.pptx',
    description: 'بررسی کیفیت مکالمات بازاریابی شبکه‌ای (نیازسنجی، پرزنت و جذب نماینده)',
    criteria: [
      { key: 'Call_opening_quality',           label: 'شروع مناسب مکالمه',              weight: 6,  section: 'quality', desc: 'دقت در وضعیت میکروفون، شروع به موقع مکالمه' },
      { key: 'agent_introduction_and_role',    label: 'معرفی خود و اعلام واحد',         weight: 8,  section: 'quality', desc: 'معرفی نام و واحدی که موظف به معرفی هستیم (شرکا بیمه بازار – کانون پیشخوان و…)' },
      { key: 'user_identify_verification',     label: 'احراز هویت نماینده',             weight: 6,  section: 'quality', desc: 'بیان نام خانوادگی کاربر در ابتدای مکالمه یا پرسش از ایشان' },
      { key: 'pre_offer_needs_assessment',     label: 'نیازسنجی قبل از ارائه پیشنهاد',   weight: 10, section: 'quality', desc: 'شناخت درک کاربر از صنعت بیمه و سابقه فعالیت پیش از مذاکره' },
      { key: 'professional_concern_handling',  label: 'مدیریت حرفه‌ای نگرانی‌ها و اعتراضات', weight: 10, section: 'quality', desc: 'دقت به صحبت‌های کاربر، همدلی، یافتن راه‌حل و اطمینان دادن برای پیگیری' },
      { key: 'effective_negotiation',          label: 'تعامل و مذاکره مؤثر',            weight: 10, section: 'quality', desc: 'پرزنت پنل یا جشنواره – شفافیت در توضیح مدل درآمدی' },
      { key: 'link_establishment',             label: 'ایجاد یا تثبیت راه ارتباطی',      weight: 10, section: 'quality', desc: 'مشخص کردن یک پیام‌رسان برای ارتباط و تعیین زمان پیگیری بعدی' },
      { key: 'professional_tone',              label: 'ادبیات حرفه‌ای',                 weight: 10, section: 'quality', desc: 'عدم استفاده از واژه‌های «شماره شخصی»، «پشتیبان»، «پیشنهاد همکاری»' },
      { key: 'courteous_closure',              label: 'پایان‌بندی محترمانه تماس',        weight: 10, section: 'quality', desc: 'جمع‌بندی صحبت‌ها، عدم قطع کردن تماس روی کاربر بدون خداحافظی' },

      { key: 'call_action_logging',            label: 'ثبت درست اکشن تماس',             weight: 10, section: 'qa', desc: 'انتخاب درست دراپ‌دان و ثبت اکشن برای تمام تماس‌ها الزامی است' },
      { key: 'note',                           label: 'یادداشت کامل',                   weight: 10, section: 'qa', desc: 'توضیحات کامل هر تماس باید در بخش اطلاعات تکمیلی ثبت شود' }
    ],
    redLines: RED_LINES_COMMON.concat(['ارائه اطلاعات اشتباه به کاربر'])
  }
];

/** ستون‌های شناسنامه‌ای مشترک بین همه فرم‌ها */
const META_FIELDS = {
  leadId:      ['lead_id'],
  leadName:    ['lead_name'],
  leadPhone:   ['lead_phone'],
  actionDate:  ['action_date'],
  actionName:  ['action_name'],
  expert:      ['tele_expert_name', 'expert_name', 'agent_name'],
  qcExpert:    ['qc_expert_name', 'qc_name'],
  formDate:    ['form_created_date'],
  score:       ['score', 'final_score'],
  redLine:     ['red_line', 'redline'],
  redLineWhy:  ['red_line_reason', 'redline_reason'],
  qcComment:   ['qc comment', 'qc_comment', 'comment'],
  listenTime:  ['listening time (second)', 'listening_time', 'listening time']
};

if (typeof module !== 'undefined') { module.exports = { TEAMS, META_FIELDS }; }
