/* Action Leap V2 · 核心
 * 职责：课程实例（= 客户 + 班次 + 主题课程）的唯一标识与隔离、本地存储、配置导出/导入+校验
 * 设计原则：纯前端、无后端；数据按「课程实例」隔离；配置以 JSON 文件在两端间传递
 * 数据模型 v3：场景→任务→(方法+行为) 完全嵌套闭环 —— 方法工具和高绩效行为挂在任务级，绩效指标挂场景级
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

  var PACKAGE_SCHEMA = 'action-leap-v2/config@3';

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

  function buildPackage(cfg) {
    return {
      schema: PACKAGE_SCHEMA,
      exportedAt: new Date().toISOString(),
      config: cfg
    };
  }

  function validatePackage(pkg) {
    if (!pkg || typeof pkg !== 'object') return { ok: false, err: '不是合法的配置文件' };
    if (pkg.schema !== PACKAGE_SCHEMA) return { ok: false, err: '文件格式不匹配（' + (pkg.schema || '未知') + '），可能需要重新导出' };
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
    store.set(pkg.config.sku, 'config', pkg.config);
    return { ok: true, sku: pkg.config.sku, config: pkg.config };
  }

  function uid(pre) {
    return (pre || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  global.ALV2 = {
    NS: NS,
    SKU: SKU,
    store: store,
    uid: uid,
    createBlank: createBlank,
    pkg: { schema: PACKAGE_SCHEMA, export: exportConfig, import: importConfig, validate: validatePackage }
  };
})(window);
