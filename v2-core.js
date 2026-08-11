/* Action Leap V2 · 核心
 * 职责：课程实例（= 客户 + 班次 + 主题课程）的唯一标识与隔离、本地存储、配置导出/导入+校验
 * 设计原则：纯前端、无后端；数据按「课程实例」隔离；配置以 JSON 文件在两端间传递
 * 数据模型 v5（2026-08-11 重做）：
 *   - 去掉 task 中间层；行为（高绩效行为）直接挂在 scenario 上：scenario.behaviors[]
 *   - 每个 Behavior 带六字段：scene / challenge / action(+expectedResult) + 学员提交填 resultImpact / difficulty / futureApplication
 *   - Behavior.kind = 'micro'（微行为，30 秒）| 'key'（关键行为，≤5 分钟）；学员端统一叫「高绩效行为」
 *   - course.rhythm：三周窗口 windowWorkdays=15、totalActions=10、microCount=8、keyCount=2、keySlots=[2,10]、freeDays=[4,7,9,12,14]
 *   - 学员提交 Submission：{behaviorId,scene,challenge,action,edited,resultImpact,difficulty,futureApplication,aiFeedback,ts}
 *   - 复盘 Review：{keyFeedback:{[behaviorId]:{text,rating}}, microSummary, overall?:{a,b,c}}
 *   - 完成门禁：10 条全部有 Submission 才可「提交迁移」
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

  var PACKAGE_SCHEMA = 'action-leap-v2/config@5';

  /* 默认节奏：三周 = 15 个工作日，安排 10 次行动（5 天不安排），非连续 */
  function defaultRhythm() {
    return {
      windowWorkdays: 15,      // 三周（按工作日计，跳过周末）
      totalActions: 10,        // 10 次高绩效行为（8 微 + 2 关）
      microCount: 8,           // 微行为数量
      keyCount: 2,             // 关键行为数量
      keySlots: [2, 10],       // 关键行为落在：第 1 周第 3 个工作日、第 3 周第 1 个工作日（0 基索引）
      freeDays: [4, 7, 9, 12, 14], // 5 个不安排行动的工作日（不含 keySlots）
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

  /* 新建空白课程 —— 场景直接挂行为与指标/方法 */
  function createBlank(o) {
    o = o || {};
    return {
      sku: SKU.make(o.client, o.cohort, 'v1'),
      client: o.client || '',
      cohort: o.cohort || '',
      theme: o.theme || '',
      needs: o.needs || '',
      note: o.note || '',
      /* 三周节奏（v5 新增）*/
      rhythm: defaultRhythm(),
      /* AI 配置（v4 沿用）：讲师自有 Key，仅本地 */
      aiConfig: defaultAiConfig(),
      /* 示范样例标记（v4 沿用）*/
      sample: { isSample: false, locked: false, cloneFrom: '' },
      /* 场景驱动闭环（主结构）—— 行为直接挂场景，去掉 task 中间层 */
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

  /* 把任意版本的 config 升到 @5，保证老数据可继续用 */
  function migrate(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    cfg.rhythm = cfg.rhythm || defaultRhythm();
    // 旧节奏字段兼容：若仍是 workdays/perDayMax 形态，换算成新形态
    if (cfg.rhythm.workdays && !cfg.rhythm.windowWorkdays) {
      cfg.rhythm = defaultRhythm();
    }
    cfg.aiConfig = cfg.aiConfig || defaultAiConfig();
    cfg.sample = cfg.sample || { isSample: false, locked: false, cloneFrom: '' };
    (cfg.scenarios || []).forEach(function (sc) {
      // 旧模型：行为挂在 task 下。升到 @5：行为直接挂 scenario。
      if (!sc.behaviors && sc.tasks) {
        sc.behaviors = [];
        (sc.tasks || []).forEach(function (tk) {
          (tk.behaviors || []).forEach(function (b) {
            sc.behaviors.push({
              id: b.id || ALV2uid('behavior'),
              kind: 'micro',
              scene: sc.name || sc.title || '',
              challenge: sc.challenge || '',
              action: b.desc || (b.action || ''),
              expectedResult: '',
              order: sc.behaviors.length
            });
          });
          // 方法工具上提
          if (tk.methods && tk.methods.length) sc.methods = (sc.methods || []).concat(tk.methods);
        });
        // 多个 task 会制造多个场景行为，这里只取第一个 task 的方法，避免重复
        delete sc.tasks;
      }
      sc.behaviors = sc.behaviors || [];
      sc.behaviors.forEach(function (b, i) {
        if (!b.kind) b.kind = 'micro';
        if (b.scene == null) b.scene = sc.name || sc.title || '';
        if (b.challenge == null) b.challenge = sc.challenge || '';
        if (b.order == null) b.order = i;
      });
      sc.methods = sc.methods || [];
      sc.methods.forEach(function (mm) { if (!mm.supports) mm.supports = []; });
      sc.metric = sc.metric || { label: '', target: '' };
      if (!sc.metric.series) sc.metric.series = [];
      if (sc.metric.unit == null) sc.metric.unit = '';
      if (sc.metric.caliber == null) sc.metric.caliber = '';
    });
    return cfg;
  }

  function ALV2uid(pre) { return (pre || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

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

  /* ---------- 行为扁平化（v5 排程用）---------- */
  function flatBehaviors(course) {
    var out = [];
    (course.scenarios || []).forEach(function (sc) {
      (sc.behaviors || []).forEach(function (b) {
        out.push({
          behaviorId: b.id,
          kind: b.kind || 'micro',
          scene: b.scene || sc.name || sc.title || '',
          challenge: b.challenge != null ? b.challenge : (sc.challenge || ''),
          action: b.action || '',
          expectedResult: b.expectedResult || '',
          order: (b.order != null ? b.order : 0),
          scenarioId: sc.id,
          scenarioTitle: sc.name || sc.title || ''
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

  function spacedFree(wd, freeCount, keySlots) {
    var cand = [];
    for (var i = 1; i < wd; i++) { if (keySlots.indexOf(i) < 0) cand.push(i); }
    if (cand.length <= freeCount) return cand.slice();
    var out = [];
    for (var k = 0; k < freeCount; k++) {
      out.push(cand[Math.round(k * (cand.length - 1) / (freeCount - 1 || 1))]);
    }
    return out;
  }

  /* ---------- 排程引擎（v5 核心）----------
   * 三周 15 个工作日里安排 10 次行动（5 天不安排），非连续。
   * 关键行为落在 keySlots 指定日；微行为填其余行动日；每天最多 1 次。
   */
  function schedulePlan(course, opts) {
    opts = opts || {};
    var rhythm = course.rhythm || defaultRhythm();
    var behaviors = flatBehaviors(course);

    var wd = rhythm.windowWorkdays || 15;
    var free = (rhythm.freeDays && rhythm.freeDays.length)
      ? rhythm.freeDays.slice()
      : spacedFree(wd, (wd - (rhythm.totalActions || behaviors.length)), rhythm.keySlots || []);

    // 行动日 = 所有工作日去掉 freeDays
    var actionDays = [];
    for (var i = 0; i < wd; i++) { if (free.indexOf(i) < 0) actionDays.push(i); }

    var keys = behaviors.filter(function (b) { return b.kind === 'key'; })
      .sort(function (a, b) { return a.order - b.order; });
    var micros = behaviors.filter(function (b) { return b.kind !== 'key'; })
      .sort(function (a, b) { return a.order - b.order; });

    var keySlots = (rhythm.keySlots && rhythm.keySlots.length) ? rhythm.keySlots : [];
    var dayToBehavior = {};
    keys.forEach(function (b, i) {
      var d = keySlots[i];
      if (d == null || actionDays.indexOf(d) < 0) d = actionDays[actionDays.length - 1 - (keys.length - 1 - i)];
      if (d == null || actionDays.indexOf(d) < 0) d = actionDays[actionDays.length - 1];
      dayToBehavior[d] = b;
    });
    var freeAction = actionDays.filter(function (d) { return !dayToBehavior[d]; });
    micros.forEach(function (b, i) {
      var d = freeAction[i];
      if (d == null) d = actionDays[actionDays.length - 1];
      dayToBehavior[d] = b;
    });

    var startDate = opts.startDate ? new Date(opts.startDate) : cohortStartDate(rhythm, opts.fromDate);
    var dates = workdaySequence(startDate, wd, rhythm.skipWeekend);

    var days = dates.map(function (dt, idx) {
      var b = dayToBehavior[idx];
      return {
        idx: idx,
        date: dt,
        weekday: dt.getDay(),
        label: (dt.getMonth() + 1) + '月' + dt.getDate() + '日',
        behavior: b ? {
          behaviorId: b.behaviorId, kind: b.kind, scene: b.scene, challenge: b.challenge,
          action: b.action, expectedResult: b.expectedResult,
          scenarioId: b.scenarioId, scenarioTitle: b.scenarioTitle
        } : null
      };
    });

    var total = behaviors.length;
    return {
      days: days,
      total: total,
      limit: rhythm.totalActions || total,
      used: total,
      rhythm: rhythm,
      startDate: startDate,
      warnings: []
    };
  }

  /* 完成度：已提交的行为数 / 总数 */
  function completion(course, submissions) {
    var total = flatBehaviors(course).length;
    var done = 0;
    (submissions || []).forEach(function (s) { if (s && s.behaviorId) done++; });
    // 去重后实际完成数
    var uniq = {};
    (submissions || []).forEach(function (s) { if (s && s.behaviorId) uniq[s.behaviorId] = 1; });
    return { done: Object.keys(uniq).length, total: total, complete: total > 0 && Object.keys(uniq).length >= total };
  }

  /* 校验节奏设置是否合法（用于配置端实时提示，不硬拦） */
  function validateRhythm(course) {
    var rhythm = course.rhythm || defaultRhythm();
    var total = flatBehaviors(course).length;
    var limit = rhythm.totalActions || 10;
    return {
      total: total,
      limit: limit,
      valid: total <= limit,
      overBy: total > limit ? total - limit : 0
    };
  }

  /* ---------- 价值逻辑链（方法 → 行为 → 指标）----------
   * 返回每个场景的因果结构，供 P4「逻辑」块与配置端因果编辑使用。
   */
  function valueChain(course) {
    return (course.scenarios || []).map(function (sc) {
      var behMap = {};
      (sc.behaviors || []).forEach(function (b) { behMap[b.id] = b; });
      var methods = (sc.methods || []).map(function (m) {
        var supports = (m.supports || []).map(function (bid) {
          var b = behMap[bid];
          return b ? { behaviorId: bid, action: b.action || '', kind: b.kind || 'micro' } : null;
        }).filter(function (x) { return x; });
        return { id: m.id, name: m.name, desc: m.desc, output: m.output, supports: supports };
      });
      return { scenario: sc, methods: methods, metric: sc.metric || {}, behaviors: sc.behaviors || [] };
    });
  }

  /* ---------- 指标时间序列趋势 ----------
   * 从 metric.series 提取数字序列，生成趋势面板与 SVG 所需坐标。
   */
  function metricTrend(sc) {
    var m = sc.metric || {};
    var series = (m.series || []).filter(function (p) {
      return p && p.value !== '' && p.value != null && !isNaN(parseFloat(p.value));
    });
    var values = series.map(function (p) { return parseFloat(p.value); });
    var labels = series.map(function (p) { return p.label || ''; });
    var notes = series.map(function (p) { return p.note || ''; });
    var hasData = values.length >= 2;
    var baseline = values.length ? values[0] : null;
    var current = values.length ? values[values.length - 1] : null;
    var delta = (baseline != null && current != null) ? (current - baseline) : null;
    var deltaPct = (baseline != null && baseline !== 0 && current != null)
      ? ((current - baseline) / Math.abs(baseline) * 100) : null;
    var min = values.length ? Math.min.apply(null, values) : 0;
    var max = values.length ? Math.max.apply(null, values) : 1;
    var span = (max - min) || 1;
    var points = values.map(function (v, i) {
      return {
        x: values.length === 1 ? 50 : Math.round((i / (values.length - 1)) * 1000) / 10,
        y: Math.round((1 - (v - min) / span) * 1000) / 10,
        value: v, label: labels[i], note: notes[i]
      };
    });
    return {
      labels: labels, values: values, notes: notes, hasData: hasData,
      baseline: baseline, current: current, delta: delta, deltaPct: deltaPct,
      unit: m.unit || '', points: points
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
    flatBehaviors: flatBehaviors,
    schedulePlan: schedulePlan,
    completion: completion,
    validateRhythm: validateRhythm,
    cohortStartDate: cohortStartDate,
    workdaySequence: workdaySequence,
    valueChain: valueChain,
    metricTrend: metricTrend,
    pkg: { schema: PACKAGE_SCHEMA, export: exportConfig, import: importConfig, validate: validatePackage }
  };
})(window);
