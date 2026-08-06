/* Action Leap V2 · 核心
 * 职责：课程实例（= 客户 + 班次 + 主题课程）的唯一标识与隔离、本地存储、配置导出/导入+校验
 * 设计原则：纯前端、无后端；数据按「课程实例」隔离；配置以 JSON 文件在两端间传递
 * 数据模型 v4：在 v3（场景→任务→(方法+行为) 嵌套闭环）之上新增：
 *   - course.rhythm    两周节奏（工作日数 / 每日上限 / 开始方式 / 偏移天数）
 *   - course.aiConfig  讲师自有 API Key（仅存浏览器本地、不进导出包）
 *   - course.sample    是否不可删示范样例
 *   - task.plan        该任务在两周内的推送次数（默认 2）
 * 说明：界面上不出现 SKU/项目包 等词，SKU 仅作为内部隔离键使用。
 */
(function (global) {
  'use strict';

  var NS = 'al_v2';

  function slug(s) {
    return (s || '').toString().trim().toLowerCase()
      .replace(/[^a-zA-Z0-9一-龥_-]/g, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '') || 'item';
  }

  var SKU = {
    make: function (client, cohort, version) {
      return [slug(client), slug(cohort), version || 'v1'].join('_');
    },
    parse: function (sku) {
      var p = (sku || '').split('_');
      return { client: p[0] || '', cohort: p[1] || '', version: p[2] || 'v1' };
    }
  };

  /* 本地存储：以课程实例为命名空间 */
  var store = {
    key: function (sku, part) { return [NS, sku, part].join(':'); },
    get: function (sku, part, fallback) {
      try {
        var v = localStorage.getItem(this.key(sku, part));
        return v ? JSON.parse(v) : (fallback === undefined ? null : fallback);
      } catch (e) { return fallback === undefined ? null : fallback; }
    },
    set: function (sku, part, val) {
      localStorage.setItem(this.key(sku, part), JSON.stringify(val));
    },
    del: function (sku, part) {
      if (!part) {
        var pre = NS + ':' + sku + ':';
        var toDel = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(pre) === 0) toDel.push(k);
        }
        toDel.forEach(function (k) { localStorage.removeItem(k); });
        return;
      }
      localStorage.removeItem(this.key(sku, part));
    },
    listCourses: function () {
      var out = [], pre = NS + ':';
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(pre) === 0) {
          var sku = k.slice(pre.length).split(':')[0];
          if (out.indexOf(sku) < 0) out.push(sku);
        }
      }
      return out;
    }
  };

  var PACKAGE_SCHEMA = 'action-leap-v2/config@4';

  /* 默认节奏：10 个工作日 × 每日最多 2 = 上限 20 次打卡机会 */
  function defaultRhythm() {
    return {
      workdays: 10,            // 两周（按工作日计，跳过周末）
      perDayMax: 2,            // 每个工作日最多推送的任务数
      startMode: 'cohort',     // cohort=全班统一开始日；individual=学员各自首次打开日
      startOffsetDays: 1,      // 相对"今天/培训结束日"的偏移（默认下一个工作日）
      skipWeekend: true        // 跳过周六周日
    };
  }

  function defaultAiConfig() {
    return {
      provider: 'openai-compatible',
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',              // 仅存浏览器本地，绝不进入导出/分享包
      model: 'gpt-4o-mini'
    };
  }

  /* 新建空白课程 —— 场景→任务→(方法+行为) 嵌套模型 */
  function createBlank(o) {
    o = o || {};
    return {
      sku: SKU.make(o.client, o.cohort, 'v1'),
      client: o.client || '',
      cohort: o.cohort || '',
      theme: o.theme || '',
      needs: o.needs || '',
      note: o.note || '',
      /* 两周节奏（v4 新增）*/
      rhythm: defaultRhythm(),
      /* AI 配置（v4 新增）：讲师自有 Key，仅本地 */
      aiConfig: defaultAiConfig(),
      /* 示范样例标记（v4 新增）*/
      sample: { isSample: false, locked: false, cloneFrom: '' },
      /* 场景驱动闭环（主结构）—— 所有内容嵌套在此 */
      scenarios: [],
      /* 培训价值证据链 —— 回答"这笔培训投入，到底带来了什么？" */
      evidenceChain: {
        spentWhat: '',       // 投入了什么（培训内容）
        changedWhat: '',     // 改变了什么（学员行为变化）
        producedWhat: '',    // 产出了什么（业务产出）
        earnedWhat: '',      // 贡献了什么（绩效/业绩价值）
        links: ['', '', ''],           // 环节间逻辑连接
        expectedEvidence: ['', '', '', ''] // 每步预期证据
      },
      consensus: { status: 'draft', approver: '', approvedAt: '' },
      createdAt: new Date().toISOString()
    };
  }

  /* 把任意版本的 config 升到 @4，保证老数据可继续用 */
  function migrate(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    cfg.rhythm = cfg.rhythm || defaultRhythm();
    cfg.aiConfig = cfg.aiConfig || defaultAiConfig();
    cfg.sample = cfg.sample || { isSample: false, locked: false, cloneFrom: '' };
    (cfg.scenarios || []).forEach(function (sc) {
      (sc.tasks || []).forEach(function (tk) {
        tk.plan = tk.plan || { times: 2 };
        if (typeof tk.plan.times !== 'number' || tk.plan.times < 1) tk.plan.times = 2;
      });
    });
    return cfg;
  }

  function buildPackage(cfg) {
    /* 导出前抹掉 AI Key 与本地敏感信息 */
    var out = JSON.parse(JSON.stringify(cfg));
    if (out.aiConfig) out.aiConfig.apiKey = '';
    return {
      schema: PACKAGE_SCHEMA,
      exportedAt: new Date().toISOString(),
      config: out
    };
  }

  function validatePackage(pkg) {
    if (!pkg || typeof pkg !== 'object') return { ok: false, err: '不是合法的配置文件' };
    if (!pkg.schema || pkg.schema.indexOf('action-leap-v2/config@') !== 0)
      return { ok: false, err: '文件格式不匹配（' + (pkg.schema || '未知') + '），可能需要重新导出' };
    var t = pkg.config;
    if (!t) return { ok: false, err: '缺少 config 字段' };
    var need = ['sku', 'client', 'cohort', 'theme', 'scenarios', 'evidenceChain'];
    for (var i = 0; i < need.length; i++) {
      if (!(need[i] in t)) return { ok: false, err: '配置缺少字段：' + need[i] };
    }
    if (!Array.isArray(t.scenarios)) return { ok: false, err: 'scenarios 须为数组' };
    return { ok: true };
  }

  function exportConfig(cfg) {
    return JSON.stringify(buildPackage(cfg), null, 2);
  }

  function importConfig(jsonStr) {
    var pkg;
    try { pkg = JSON.parse(jsonStr); }
    catch (e) { return { ok: false, err: '文本解析失败：' + e.message }; }
    var v = validatePackage(pkg);
    if (!v.ok) return v;
    var cfg = migrate(pkg.config);
    store.set(cfg.sku, 'config', cfg);
    return { ok: true, sku: cfg.sku, config: cfg };
  }

  function uid(pre) {
    return (pre || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- 任务扁平化（v4 排程用）---------- */
  function flatTasks(course) {
    var out = [];
    (course.scenarios || []).forEach(function (sc) {
      (sc.tasks || []).forEach(function (tk) {
        out.push({
          taskId: tk.id,
          task: tk,
          scenarioId: sc.id,
          scenarioTitle: sc.title || '',
          scenarioChallenge: sc.challenge || '',
          metricLabel: sc.metric && sc.metric.label ? sc.metric.label : ''
        });
      });
    });
    return out;
  }

  /* ---------- 工作日序列 ---------- */
  function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  function workdaySequence(startDate, count, skipWeekend) {
    var seq = [];
    var cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    while (seq.length < count) {
      if (!skipWeekend || !isWeekend(cur)) {
        seq.push(new Date(cur));
      }
      cur = addDays(cur, 1);
    }
    return seq;
  }

  /* 计算统一开始日：默认 = 今天 + startOffsetDays，再顺延到下一个工作日 */
  function cohortStartDate(rhythm, fromDate) {
    rhythm = rhythm || defaultRhythm();
    var base = fromDate ? new Date(fromDate) : new Date();
    var d = addDays(base, rhythm.startOffsetDays || 1);
    while (rhythm.skipWeekend && isWeekend(d)) d = addDays(d, 1);
    return d;
  }

  /* ---------- 排程引擎（v4 核心）----------
   * 把每个任务的 plan.times 次打卡机会均匀铺到 workdays 个工作日，
   * 每天不超过 perDayMax。漏打不在本层处理（学员端按"已点亮"补位）。
   */
  function schedulePlan(course, opts) {
    opts = opts || {};
    var rhythm = course.rhythm || defaultRhythm();
    var tasks = flatTasks(course);

    // 把每个任务的多次出现按 task 分组，轮转交错 → 天然均匀铺开
    var byTask = [];
    tasks.forEach(function (t) {
      var n = (t.task.plan && t.task.plan.times) || 2;
      if (n < 1) n = 1;
      var arr = [];
      for (var i = 0; i < n; i++) arr.push(t);
      byTask.push(arr);
    });
    var occ = [];
    var any = true;
    while (any) {
      any = false;
      byTask.forEach(function (arr) { if (arr.length) { occ.push(arr.shift()); any = true; } });
    }

    var total = occ.length;
    var limit = rhythm.workdays * rhythm.perDayMax;
    var warnings = [];
    if (total > limit) {
      warnings.push('任务打卡机会 ' + total + ' 超出上限 ' + limit + '（工作日 ' + rhythm.workdays +
        ' × 每日 ' + rhythm.perDayMax + '）。涉及学员端不会超限，但建议回到节奏设置中精简。');
    }
    // 单日超额提醒（理论上不会发生，因切块受 perDayMax 约束）
    if (total > 0 && Math.ceil(total / rhythm.perDayMax) > rhythm.workdays) {
      warnings.push('任务较多，部分工作日会被推满（每日 ' + rhythm.perDayMax + ' 个）。');
    }

    // 真实日期序列（用于预览/展示）；不传 startDate 则用今天推算
    var startDate = opts.startDate ? new Date(opts.startDate) : cohortStartDate(rhythm, opts.fromDate);
    var dates = workdaySequence(startDate, rhythm.workdays, rhythm.skipWeekend);

    var days = dates.map(function (dt, idx) {
      return {
        idx: idx,                       // 第几个工作日（0 起）
        date: dt,
        weekday: dt.getDay(),
        label: (dt.getMonth() + 1) + '月' + dt.getDate() + '日',
        tasks: []
      };
    });

    // 切块：每 perDayMax 个 occ 进一天
    occ.forEach(function (t, i) {
      var d = Math.floor(i / rhythm.perDayMax);
      if (d >= days.length) d = days.length - 1;
      days[d].tasks.push({
        taskId: t.taskId,
        scenarioId: t.scenarioId,
        scenarioTitle: t.scenarioTitle,
        scenarioChallenge: t.scenarioChallenge,
        taskTitle: t.task.title || '',
        taskWhy: t.task.why || '',        // 为什么是它（v4 学员端"why 层三"引用）
        metricLabel: t.metricLabel
      });
    });

    return {
      days: days,
      total: total,
      limit: limit,
      used: total,
      rhythm: rhythm,
      startDate: startDate,
      warnings: warnings
    };
  }

  /* 校验节奏设置是否合法（用于配置端实时提示，不硬拦） */
  function validateRhythm(course) {
    var rhythm = course.rhythm || defaultRhythm();
    var tasks = flatTasks(course);
    var total = tasks.reduce(function (s, t) {
      return s + ((t.task.plan && t.task.plan.times) || 2);
    }, 0);
    var limit = rhythm.workdays * rhythm.perDayMax;
    return {
      total: total,
      limit: limit,
      valid: total <= limit,
      overBy: total > limit ? total - limit : 0
    };
  }

  global.ALV2 = {
    NS: NS,
    SKU: SKU,
    store: store,
    uid: uid,
    createBlank: createBlank,
    migrate: migrate,
    defaultRhythm: defaultRhythm,
    defaultAiConfig: defaultAiConfig,
    flatTasks: flatTasks,
    schedulePlan: schedulePlan,
    validateRhythm: validateRhythm,
    cohortStartDate: cohortStartDate,
    workdaySequence: workdaySequence,
    pkg: { schema: PACKAGE_SCHEMA, export: exportConfig, import: importConfig, validate: validatePackage }
  };
})(window);
