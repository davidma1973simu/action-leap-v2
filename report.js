/* Action Leap V2 · 高层汇报生成
 * 流程：assemble(sku) 聚合 → ALV2.ai.reportDraft(ctx, aiConfig) 拿结构化 JSON →
 *       render(data) 渲染两页 A4 → window.open + 自动 print
 *
 * 关键约束：
 *   - 仅在 P4（成果汇报）调用；不污染其他页面。
 *   - AI 必须显式有 Key；无 Key 时友好提示，不做降级模板。
 *   - 趋势图直接复用 v2-core.metricTrend 的 SVG 输出。
 */
(function (global) {
  'use strict';
  var ALV2 = global.ALV2 || (global.ALV2 = {});
  ALV2.report = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + pad(m) + '-' + pad(day);
  }

  /* ============ 聚合：把课程+学员+subs+指标拼成给 AI 的 ctx ============ */
  function assemble(sku) {
    var course = ALV2.store.get(sku, 'config', null);
    if (!course) throw new Error('找不到课程配置');
    var students = ALV2.store.get(sku, 'students', []) || [];
    var reviews = ALV2.store.get(sku, 'reviews', {}) || {};

    // 汇总所有学员的 subs（submission 数组）
    var allSubs = [];
    students.forEach(function (st) {
      var arr = ALV2.store.get(sku, 'subs:' + st.id, []) || [];
      arr.forEach(function (sub) {
        sub._studentName = st.name || '匿名';
        sub._studentId = st.id;
        allSubs.push(sub);
      });
    });

    var comp = ALV2.completion ? ALV2.completion(course, allSubs) : { done: 0, total: 0 };
    // 场景级指标趋势
    var metricTrends = (course.scenarios || []).map(function (sc) {
      var t = ALV2.metricTrend ? ALV2.metricTrend(sc) : null;
      var series = (sc.metric && sc.metric.series) || [];
      var baseline = null, current = null, valid = series.filter(function (s) { return typeof s.value === 'number' && isFinite(s.value); });
      if (valid.length) {
        baseline = valid[0].value;
        current = valid[valid.length - 1].value;
      }
      return {
        scenarioName: sc.name || '未命名场景',
        unit: (sc.metric && sc.metric.unit) || '',
        label: (sc.metric && (sc.metric.label || sc.metric.name)) || '未命名指标',
        baseline: baseline,
        current: current,
        delta: (baseline != null && current != null) ? +(current - baseline).toFixed(2) : null,
        deltaPct: (baseline != null && current != null && baseline !== 0)
          ? +(((current - baseline) / baseline) * 100).toFixed(1) : null,
        hasData: valid.length >= 2,
        points: t && t.points ? t.points : []
      };
    });

    // 证据链合格度（四步都填 = OK）
    var ec = course.evidenceChain || {};
    var ecOk = ec.spentWhat && ec.changedWhat && ec.producedWhat && ec.earnedWhat ? 1 : 0;

    // 关键行为复盘摘要（来自 reviews）
    var reviewLines = [];
    Object.keys(reviews).forEach(function (sName) {
      var rv = reviews[sName] || {};
      var kf = rv.keyFeedback || {};
      Object.keys(kf).forEach(function (bid) {
        var f = kf[bid] || {};
        if (f.rating) reviewLines.push(sName + '/' + bid + ' = ' + f.rating + (f.text ? '：' + f.text.slice(0, 40) : ''));
      });
    });
    var keyBehaviorRecap = reviewLines.length
      ? reviewLines.slice(0, 3).join('\n')
      : '（暂无复盘评分）';

    // 具体行为样本（挑 3 条 key 且有完整 resultImpact 的）
    var keySubs = allSubs.filter(function (s) { return s.kind === 'key' && s.resultImpact; });
    var behaviorSamples = keySubs.slice(0, 3).map(function (s) {
      return '· ' + (s._studentName || '学员') + ' / 场景「' + (s.scene || '') + '」/ 行动「' +
        (s.action || '') + '」/ 影响：' + (s.resultImpact || '').slice(0, 60);
    }).join('\n') || '（暂无具体案例）';

    return {
      course: course,
      students: students,
      totalSubs: allSubs.length,
      completion: comp,
      metricTrends: metricTrends,
      evidenceChain: ec,
      evidenceChainOk: ecOk,
      keyBehaviorRecap: keyBehaviorRecap,
      behaviorSamples: behaviorSamples
    };
  }

  /* ============ 渲染：两页 A4 报告 HTML ============ */
  function render(data) {
    var c = data.course;
    var comp = data.completion;
    var trends = data.metricTrends;
    var completionRate = comp.total ? Math.round((comp.done / comp.total) * 100) : 0;
    var validTrend = trends.find(function (t) { return t.hasData; });

    // KPI 大字
    var kpis = [
      { n: data.students.length, l: '参与学员' },
      { n: data.totalSubs, l: '打卡提交' },
      { n: completionRate + '%', l: '行为完成率' },
      { n: (data.evidenceChainOk ? '100%' : '待补'), l: '价值链合格' }
    ];

    // 趋势图（挑一个有数据的场景；SVG 走 v2-core 的 RP.trendChart 思路简化版）
    var trendHTML = '';
    if (validTrend) {
      var W = 480, H = 110, PADX = 28, PADY = 18;
      var pts = validTrend.points;
      var xStep = (W - PADX * 2) / Math.max(1, pts.length - 1);
      var polyPts = pts.map(function (p, i) {
        return (PADX + i * xStep).toFixed(1) + ',' + (PADY + (1 - p.y / 100) * (H - PADY * 2)).toFixed(1);
      }).join(' ');
      var dotHtml = pts.map(function (p, i) {
        var x = PADX + i * xStep, y = PADY + (1 - p.y / 100) * (H - PADY * 2);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2" fill="#FF7A4D" />' +
          '<text x="' + x.toFixed(1) + '" y="' + (H - 4) + '" font-size="9" text-anchor="middle" fill="#666">' +
          (p.label || '') + '</text>';
      }).join('');
      var deltaTxt = (validTrend.delta > 0 ? '+' : '') + validTrend.delta +
        (validTrend.unit ? ' ' + validTrend.unit : '') + '（' + (validTrend.deltaPct > 0 ? '+' : '') + validTrend.deltaPct + '%）';
      trendHTML =
        '<div class="rep-chart">' +
          '<div class="rep-chart-h">' +
            '<div><div class="rep-eyebrow">指标趋势</div>' +
            '<div class="rep-chart-title">' + esc(validTrend.scenarioName) + ' · ' + esc(validTrend.label) + '</div></div>' +
            '<div class="rep-chart-delta">' + esc(deltaTxt) + '</div>' +
          '</div>' +
          '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="xMidYMid meet">' +
            '<line x1="' + PADX + '" y1="' + (H - PADY) + '" x2="' + (W - PADX) + '" y2="' + (H - PADY) +
            '" stroke="#E5DED4" stroke-width="1" />' +
            '<polyline points="' + polyPts + '" fill="none" stroke="#FF7A4D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' +
            dotHtml +
          '</svg>' +
        '</div>';
    } else {
      trendHTML = '<div class="rep-chart rep-empty">' +
        '<div class="rep-eyebrow">指标趋势</div>' +
        '<div class="rep-muted">尚未补录指标序列。训前 + 训后各录 1 个数值即可生成趋势图。</div></div>';
    }

    // 结论三连
    var findingsHtml = (data.topFindings || []).map(function (f, i) {
      return '<li><span class="rep-num">' + (i + 1) + '</span><span>' + esc(f) + '</span></li>';
    }).join('');

    // 明细附录：每个场景的指标（数字一字排开）
    var appendix = trends.map(function (t) {
      var v = t.hasData
        ? '<b>' + esc(String(t.baseline)) + ' → ' + esc(String(t.current)) + '</b>' +
          (t.unit ? ' ' + esc(t.unit) : '') +
          ' <span class="rep-delta ' + (t.delta > 0 ? 'up' : (t.delta < 0 ? 'down' : '')) + '">' +
          (t.delta > 0 ? '+' : '') + esc(String(t.delta)) +
          (t.deltaPct != null ? '（' + (t.deltaPct > 0 ? '+' : '') + t.deltaPct + '%）' : '') + '</span>'
        : '<span class="rep-muted">待补录训前/训后数据</span>';
      return '<tr><td>' + esc(t.scenarioName) + '</td><td>' + esc(t.label) + '</td><td>' + v + '</td></tr>';
    }).join('');

    var risksBlock = data.risk
      ? '<div class="rep-block"><div class="rep-eyebrow warn">风险提示</div><div class="rep-text">' + esc(data.risk) + '</div></div>'
      : '';
    var assetBlock = data.assetRecommendation
      ? '<div class="rep-block"><div class="rep-eyebrow">组织资产沉淀建议</div><div class="rep-text">' + esc(data.assetRecommendation) + '</div></div>'
      : '';

    return [
      // ===== PAGE 1 =====
      '<div class="rep-page">',
        '<header class="rep-head">',
          '<div class="rep-brand">Action Leap · 培训成果高层简报</div>',
          '<div class="rep-meta">',
            '<div class="rep-title">' + esc(c.theme || '未命名课程') + '</div>',
            '<div class="rep-sub">' + esc(c.client || '客户') + ' · ' + esc(c.cohort || '班次') + ' · 生成日期 ' + todayStr() + '</div>',
          '</div>',
        '</header>',

        '<section class="rep-summary">',
          '<div class="rep-eyebrow">执行摘要</div>',
          '<p class="rep-lead">' + esc(data.executiveSummary || '（AI 未生成）') + '</p>',
        '</section>',

        '<section class="rep-kpis">',
          kpis.map(function (k) {
            return '<div class="rep-kpi"><div class="n">' + esc(String(k.n)) + '</div><div class="l">' + esc(k.l) + '</div></div>';
          }).join(''),
        '</section>',

        trendHTML,

        '<footer class="rep-foot">本简报由 Action Leap V2 基于课程配置与学员打卡数据自动生成 · 仅供内部使用</footer>',
      '</div>',

      // ===== PAGE 2 =====
      '<div class="rep-page">',
        '<header class="rep-head-simple">',
          '<div class="rep-eyebrow">结论与建议</div>',
          '<div class="rep-title-sm">' + esc(c.theme || '未命名课程') + ' · 第二页</div>',
        '</header>',

        '<section class="rep-findings">',
          '<div class="rep-eyebrow">三条最强结论</div>',
          '<ol class="rep-list">' + (findingsHtml || '<li class="rep-muted">AI 未生成结论</li>') + '</ol>',
        '</section>',

        '<div class="rep-grid-2">',
          risksBlock,
          assetBlock,
        '</div>',

        '<section class="rep-appendix">',
          '<div class="rep-eyebrow">附录 · 各场景指标明细</div>',
          '<table class="rep-table"><thead><tr><th>场景</th><th>指标</th><th>基线 → 当前</th></tr></thead><tbody>' +
            appendix + '</tbody></table>',
        '</section>',

        '<footer class="rep-foot">Action Leap V2 · 让培训看得见改变、看得见价值</footer>',
      '</div>'
    ].join('');
  }

  /* ============ 打印调度 ============ */
  function buildPrintHTML(reportHTML, course) {
    // 打印窗口独立呈现：只引入专用样式，避免主站 theme-warm 的暖底干扰 PDF
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<title>Action Leap · ' + esc(course.theme || '高层简报') + '</title>' +
      '<link rel="stylesheet" href="report-print.css?v=1">' +
      '</head><body class="rep-print-body">' + reportHTML +
      '<script>setTimeout(function(){window.print();}, 350);<' + '/script>' +
      '</body></html>';
  }

  function openPrintWindow(reportHTML, course) {
    var w = window.open('', '_blank');
    if (!w) throw new Error('浏览器拦截了打印窗口，请允许弹窗后重试');
    w.document.open();
    w.document.write(buildPrintHTML(reportHTML, course));
    w.document.close();
  }

  /* ============ 主入口 ============ */
  function generate(sku) {
    if (!sku) throw new Error('缺少课程 ID');
    var ctx = assemble(sku);
    var aiConfig = ALV2.getAIConfig();
    if (!aiConfig || !aiConfig.apiKey) {
      var err = new Error('尚未配置 AI。请点左上角「AI 设置」选模型并填入 API Key 后重试');
      err.code = 'NO_KEY';
      throw err;
    }

    return ALV2.ai.reportDraft({
      course: ctx.course,
      students: ctx.students,
      totalSubs: ctx.totalSubs,
      completion: ctx.completion,
      metricTrends: ctx.metricTrends,
      evidenceChain: ctx.evidenceChain,
      keyBehaviorRecap: ctx.keyBehaviorRecap,
      behaviorSamples: ctx.behaviorSamples
    }, aiConfig).then(function (draft) {
      var data = Object.assign({}, draft, {
        course: ctx.course,
        students: ctx.students,
        totalSubs: ctx.totalSubs,
        completion: ctx.completion,
        metricTrends: ctx.metricTrends,
        evidenceChain: ctx.evidenceChain
      });
      var html = render(data);
      openPrintWindow(html, ctx.course);
      return data;
    });
  }

  ALV2.report = {
    assemble: assemble,
    render: render,
    generate: generate,
    openPrintWindow: openPrintWindow,
    buildPrintHTML: buildPrintHTML
  };
})(window);