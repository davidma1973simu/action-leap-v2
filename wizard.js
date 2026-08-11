/* Action Leap V2 · 七步配置向导（Phase 2，schema@5）
 * 职责：把"场景驱动闭环"的配置拆成一条有序问答线，降低讲师认知负荷。
 *   - 新建课程强制走向导；走完生成正式 course 并进入"配置构建器"（专家模式）。
 *   - 每步一个大白话问题；含 AI 起草与「确认关卡」（所有 AI 草稿必须人工确认才可发布）。
 *   - 共享 ALV2 数据模型；行为直接挂场景，带 kind(micro/key) + 六字段。
 */
(function (global) {
  'use strict';
  var ALV2 = global.ALV2;
  var ai = ALV2 && ALV2.ai;

  var state = {
    draft: null,
    step: 0,
    onDone: null,
    dirty: false
  };

  /* 七步元数据：标题 + 大白话问题 + 引导 */
  var STEPS = [
    { key: 'shell',    t: '课程外壳',   q: '这门课服务谁？什么班次、什么主题？',                h: '先填三项基础信息，后面的框架细节逐步补充。' },
    { key: 'scene',    t: '关键场景',   q: '学员回到工作后，最常在哪几个真实场景"卡住"？',     h: '写 1–3 个真实工作场景，每个配一句挑战（大白话）。' },
    { key: 'behavior', t: '高绩效行为', q: '每个场景里，学员要练哪几条"高绩效行为"？',          h: '一条行为 = 锚定在场景里的具体行动。最多 8 条微行为 + 2 条关键行为。' },
    { key: 'method',   t: '方法工具',   q: '做这些事用什么方法工具？',                          h: '给场景挂方法工具，学员才知道"怎么做得对"。' },
    { key: 'metric',   t: '改善指标',   q: '这个场景要改善哪个业务指标？（可选）',             h: '填指标名 + 目标，用于最后的成果汇报。' },
    { key: 'rhythm',   t: '三周节奏',   q: '节奏怎么排？开始日、开始方式？',                    h: '固定三周 15 工作日、10 次行动（8 微 + 2 关）、5 天不安排。' },
    { key: 'review',   t: '预览发布',   q: '检查一遍——确认无误，就发布给学员。',              h: 'AI 帮你起草的内容，需要逐项确认后才算数。' }
  ];

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : s.toString()).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 生命周期 ---------- */
  function open(onDone) {
    state.draft = ALV2.createBlank({ client: '', cohort: '', theme: '', needs: '', note: '' });
    state.step = 0;
    state.onDone = onDone || function () {};
    state.dirty = false;
    render();
    el('wizard').classList.remove('hidden');
    requestAnimationFrame(function () { el('wizard').classList.add('show'); });
  }
  function close() {
    el('wizard').classList.remove('show');
    setTimeout(function () { el('wizard').classList.add('hidden'); }, 220);
  }

  /* ---------- 总渲染 ---------- */
  function render() {
    var root = el('wizard');
    if (root.dataset.built !== '1') { root.innerHTML = shell(); root.dataset.built = '1'; }
    renderProgress();
    renderBody();
    renderFoot();
  }

  function shell() {
    return '' +
      '<div class="wz-modal">' +
      '  <div class="wz-top">' +
      '    <div class="wz-brand"><span class="wz-dot"></span>新建课程 · 七步向导</div>' +
      '    <button class="wz-x" id="wz-close" title="关闭">✕</button>' +
      '  </div>' +
      '  <div class="wz-progress" id="wz-progress"></div>' +
      '  <div class="wz-body" id="wz-body"></div>' +
      '  <div class="wz-foot" id="wz-foot"></div>' +
      '</div>' +
      '<div class="wz-ai" id="wz-ai"></div>';
  }

  function renderProgress() {
    var box = el('wz-progress');
    var html = '';
    STEPS.forEach(function (s, i) {
      var cls = i === state.step ? 'on' : (i < state.step ? 'done' : '');
      html += '<div class="wz-p ' + cls + '" data-i="' + i + '">' +
        '<span class="wz-pn">' + (i < state.step ? '✓' : (i + 1)) + '</span>' +
        '<span class="wz-pt">' + esc(s.t) + '</span></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.wz-p').forEach(function (n) {
      n.onclick = function () {
        var i = +n.dataset.i;
        if (i <= state.step) { state.step = i; renderBody(); renderFoot(); renderProgress(); }
      };
    });
  }

  function renderBody() {
    var body = el('wz-body');
    var s = STEPS[state.step];
    var fn = { shell: stepShell, scene: stepScene, behavior: stepBehavior, method: stepMethod,
               metric: stepMetric, rhythm: stepRhythm, review: stepReview }[s.key];
    body.innerHTML =
      '<div class="wz-step-head">' +
      '  <div class="wz-q">' + esc(s.q) + '</div>' +
      '  <div class="wz-h">' + esc(s.h) + '</div>' +
      '</div>' + fn();
    bindBody();
  }

  function renderFoot() {
    var foot = el('wz-foot');
    var last = state.step === STEPS.length - 1;
    var prev = state.step > 0
      ? '<button class="btn btn-ghost" id="wz-prev">上一步</button>' : '';
    var next = last
      ? '<button class="btn btn-primary" id="wz-finish">完成并进入构建器</button>'
      : '<button class="btn btn-primary" id="wz-next">下一步</button>';
    foot.innerHTML = prev + next;
    if (el('wz-prev')) el('wz-prev').onclick = function () { if (state.step > 0) { state.step--; render(); } };
    if (el('wz-next')) el('wz-next').onclick = function () { if (state.step < STEPS.length - 1) { state.step++; render(); } };
    if (el('wz-finish')) el('wz-finish').onclick = finish;
    if (el('wz-close')) el('wz-close').onclick = close;
  }

  /* ---------- 步骤 1：课程外壳 ---------- */
  function stepShell() {
    var d = state.draft;
    return '' +
      '<div class="wz-form">' +
      '  <div class="wz-row"><div class="field"><label>客户名称 <span class="req">*</span></label>' +
      '    <input class="in" id="wz-client" value="' + esc(d.client) + '" placeholder="例如：松下电机" /></div>' +
      '  <div class="field"><label>班次 <span class="req">*</span></label>' +
      '    <input class="in" id="wz-cohort" value="' + esc(d.cohort) + '" placeholder="例如：2026 春训营" /></div></div>' +
      '  <div class="field"><label>主题课程 <span class="req">*</span></label>' +
      '    <input class="in" id="wz-theme" value="' + esc(d.theme) + '" placeholder="例如：战略执行与全局经营沙盘" /></div>' +
      '  <div class="field"><label>培训需求与目标（可选）</label>' +
      '    <textarea class="in" id="wz-needs" rows="3" placeholder="例如：建立商业全局观、做出高质量商业决策、跨部门协同">' + esc(d.needs) + '</textarea></div>' +
      '  <div class="wz-ai-entry">' +
      '    <button class="btn btn-ghost btn-sm" id="wz-aiset">AI 设置</button>' +
      '    <button class="btn btn-soft btn-sm" id="wz-sample">看示范样例</button>' +
      '    <span class="wz-ai-hint">填好你的模型 Key，可让 AI 一键起草下面的场景与行为</span>' +
      '  </div>' +
      '</div>';
  }

  /* ---------- 步骤 2：关键场景 ---------- */
  function stepScene() {
    var d = state.draft;
    var rows = (d.scenarios || []).map(function (sc, i) {
      return sceneRow(sc, i);
    }).join('');
    return '' +
      '<div class="wz-list" id="wz-scenes">' + rows + '</div>' +
      '<div class="wz-add-row">' +
      '  <button class="btn btn-ghost btn-sm" id="wz-add-scene">+ 添加场景</button>' +
      '  <button class="btn btn-soft btn-sm" id="wz-draft">✦ AI 起草</button>' +
      '  <span class="wz-soft">最多 3 个场景</span>' +
      '</div>';
  }
  function sceneRow(sc, i) {
    var draft = sc._draft ? ' draft' : '';
    return '<div class="wz-item' + draft + '" data-scid="' + esc(sc.id) + '">' +
      '<div class="wz-item-h"><span class="wz-idx">场景 ' + (i + 1) + '</span>' +
      (sc._draft ? '<span class="wz-tag">AI 草稿</span>' : '') +
      '<button class="wz-del" data-del-sc="' + esc(sc.id) + '">删除</button></div>' +
      '<input class="in" data-sc-title="' + esc(sc.id) + '" value="' + esc(sc.name || sc.title || '') + '" placeholder="场景名，如：跨部门需求评审会" />' +
      '<textarea class="in" data-sc-ch="' + esc(sc.id) + '" rows="2" placeholder="学员在这里面常遇到的挑战（大白话）">' + esc(sc.challenge) + '</textarea>' +
      '</div>';
  }

  /* ---------- 步骤 3：高绩效行为（直接挂场景，带 kind + 六字段） ---------- */
  function stepBehavior() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先在「关键场景」里添加场景。</div>';
    var microCount = countKind(d, 'micro'), keyCount = countKind(d, 'key');
    var html = '<div class="wz-form" style="margin-bottom:10px">' +
      '<div class="wz-soft">已添加：<b>' + microCount + ' / 8</b> 微行为 · <b>' + keyCount + ' / 2</b> 关键行为（上限共 10 条）</div></div>';
    d.scenarios.forEach(function (sc) {
      html += '<div class="wz-group" data-scid="' + esc(sc.id) + '">' +
        '<div class="wz-group-t">▸ ' + esc(sc.name || sc.title || '未命名场景') + '</div>' +
        '<div class="wz-sublist" data-behaviors="' + esc(sc.id) + '">' +
        (sc.behaviors || []).map(function (b, i) { return behRow(sc, b, i); }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '  <button class="btn btn-ghost btn-sm" data-add-beh="' + esc(sc.id) + '" data-kind="micro">+ 添加微行为</button>' +
        '  <button class="btn btn-ghost btn-sm" data-add-beh="' + esc(sc.id) + '" data-kind="key">+ 添加关键行为</button>' +
        '</div></div>';
    });
    return html;
  }
  function countKind(d, kind) {
    var n = 0; (d.scenarios || []).forEach(function (sc) { (sc.behaviors || []).forEach(function (b) { if ((b.kind || 'micro') === kind) n++; }); });
    return n;
  }
  function behRow(sc, b, i) {
    var kind = b.kind || 'micro';
    var draft = b._draft ? ' draft' : '';
    return '<div class="wz-item sm' + draft + '" data-bid="' + esc(b.id) + '">' +
      '<div class="wz-item-h"><span class="wz-idx">' + (kind === 'key' ? '关键' : '微') + ' ' + (i + 1) + '</span>' +
      (b._draft ? '<span class="wz-tag sm">AI</span>' : '') +
      '<button class="wz-del" data-del-b="' + esc(b.id) + '">✕</button></div>' +
      '<input class="in" data-b-scene="' + esc(b.id) + '" value="' + esc(b.scene) + '" placeholder="场景：这条行为发生在哪" />' +
      '<textarea class="in" data-b-ch="' + esc(b.id) + '" rows="2" placeholder="挑战：在该场景下面对什么挑战">' + esc(b.challenge) + '</textarea>' +
      '<textarea class="in" data-b-act="' + esc(b.id) + '" rows="2" placeholder="行动：学员要采取的具体行为（大白话）">' + esc(b.action) + '</textarea>' +
      '<input class="in" data-b-exp="' + esc(b.id) + '" value="' + esc(b.expectedResult) + '" placeholder="预期结果：练成后带来什么（一句话）" />' +
      '</div>';
  }

  /* ---------- 步骤 4：方法工具（挂场景） ---------- */
  function stepMethod() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先添加场景。</div>';
    var html = '';
    d.scenarios.forEach(function (sc) {
      html += '<div class="wz-group" data-scid="' + esc(sc.id) + '">' +
        '<div class="wz-group-t">▸ ' + esc(sc.name || sc.title || '未命名场景') + '</div>' +
        '<div class="wz-sub-label">方法工具</div>' +
        '<div class="wz-sublist" data-methods="' + esc(sc.id) + '">' +
        (sc.methods || []).map(function (m, i) { return methodRow(sc, m, i); }).join('') +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-add-method="' + esc(sc.id) + '">+ 添加方法工具</button>' +
        '</div>';
    });
    return html || '<div class="wz-empty">先添加场景。</div>';
  }
  function methodRow(sc, m, i) {
    var draft = m._draft ? ' draft' : '';
    var behOpts = (sc.behaviors || []).map(function (b) {
      var ck = (m.supports || []).indexOf(b.id) >= 0 ? 'checked' : '';
      return '<label class="wz-chk"><input type="checkbox" data-wz-supp="' + esc(m.id) + '" value="' + esc(b.id) + '" ' + ck + '/> ' + esc((b.kind === 'key' ? '关 ' : '') + (b.action || b.scene || '行为')) + '</label>';
    }).join('') || '<span class="wz-muted">先添加该场景的行为</span>';
    return '<div class="wz-item sm' + draft + '" data-mid="' + esc(m.id) + '">' +
      '<input class="in" data-m-name="' + esc(m.id) + '" value="' + esc(m.name) + '" placeholder="方法/工具名，如：5 Why" />' +
      '<input class="in" data-m-desc="' + esc(m.id) + '" value="' + esc(m.desc) + '" placeholder="怎么用（一句话）" />' +
      (m._draft ? '<span class="wz-tag sm">AI</span>' : '') +
      '<button class="wz-del" data-del-m="' + esc(m.id) + '">✕</button>' +
      '<div class="wz-supp"><span class="wz-supp-t">支撑行为</span>' + behOpts + '</div></div>';
  }

  /* ---------- 步骤 5：改善指标 ---------- */
  function wzSeriesRow(s) {
    s = s || {};
    return '<div class="wz-ms-row">' +
      '<input class="in" data-wz-ms-label value="' + esc(s.label || '') + '" placeholder="期次" />' +
      '<input class="in" data-wz-ms-value value="' + esc(s.value != null ? s.value : '') + '" placeholder="数值" />' +
      '<input class="in" data-wz-ms-note value="' + esc(s.note || '') + '" placeholder="备注" />' +
      '</div>';
  }
  function stepMetric() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先添加场景。</div>';
    var html = '';
    d.scenarios.forEach(function (sc) {
      var m = sc.metric || {};
      var draft = m._draft ? ' draft' : '';
      html += '<div class="wz-item' + draft + '" data-scid="' + esc(sc.id) + '">' +
        '<div class="wz-item-h"><span class="wz-idx">▸ ' + esc(sc.name || sc.title || '未命名场景') + '</span>' +
        (m._draft ? '<span class="wz-tag">AI 草稿</span>' : '') + '</div>' +
        '<div class="wz-row">' +
        '<input class="in" data-mt-label="' + esc(sc.id) + '" value="' + esc(m.label) + '" placeholder="指标名，如：需求返工率" />' +
        '<input class="in" data-mt-target="' + esc(sc.id) + '" value="' + esc(m.target) + '" placeholder="目标，如：下降 30%" />' +
        '</div>' +
        '<div class="wz-series" data-sc="' + esc(sc.id) + '">' +
        (m.series && m.series.length ? m.series.map(function (s) { return wzSeriesRow(s); }).join('') : '') +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-mt-add-series="' + esc(sc.id) + '">+ 录入一期数值</button>' +
        '</div>';
    });
    return html;
  }

  /* ---------- 步骤 6：三周节奏（固定窗口 + 可编辑开始方式） ---------- */
  function stepRhythm() {
    var r = state.draft.rhythm || ALV2.defaultRhythm();
    var keyDays = (r.keySlots || []).map(function (i) {
      if (i === 2) return '第 1 周第 3 个工作日';
      if (i === 10) return '第 3 周第 1 个工作日';
      return '第 ' + (i + 1) + ' 个工作日';
    }).join('、');
    return '' +
      '<div class="wz-form">' +
      '  <div class="wz-rhythm-fixed">' +
      '    <div class="wz-rf-row"><span>三周窗口</span><b>15 个工作日</b></div>' +
      '    <div class="wz-rf-row"><span>行动安排</span><b>10 次（8 微行为 + 2 关键行为）· 5 天不安排</b></div>' +
      '    <div class="wz-rf-row"><span>关键行为位置</span><b>' + keyDays + '</b></div>' +
      '  </div>' +
      '  <div class="wz-row" style="margin-top:14px">' +
      '    <div class="field"><label>开始方式</label><select class="in" id="wz-sm">' +
      '      <option value="cohort"' + (r.startMode === 'cohort' ? ' selected' : '') + '>全班统一开始日</option>' +
      '      <option value="individual"' + (r.startMode === 'individual' ? ' selected' : '') + '>学员各自首次打开</option>' +
      '    </select></div>' +
      '    <div class="field"><label>开始偏移（天）</label><input class="in" type="number" min="0" max="14" id="wz-so" value="' + (r.startOffsetDays) + '" /></div>' +
      '  </div>' +
      '  <label class="wz-check"><input type="checkbox" id="wz-sw" ' + (r.skipWeekend ? 'checked' : '') + ' /> 跳过周末</label>' +
      '</div>';
  }

  /* ---------- 步骤 7：预览 + 确认关卡 ---------- */
  function stepReview() {
    var d = state.draft;
    var sceneN = (d.scenarios || []).length;
    var behN = 0, keyN = 0; (d.scenarios || []).forEach(function (sc) { (sc.behaviors || []).forEach(function (b) { behN++; if ((b.kind || 'micro') === 'key') keyN++; }); });
    var drafts = collectDrafts();
    var draftHtml = drafts.length
      ? '<div class="wz-gate">' +
        '<div class="wz-gate-h">⚠ AI 起草待确认（' + drafts.length + ' 项）</div>' +
        '<div class="wz-gate-list" id="wz-gate">' + drafts.map(function (x, i) { return gateItem(x, i); }).join('') + '</div>' +
        '<button class="btn btn-soft btn-sm" id="wz-accept-all">全部采纳</button>' +
        '</div>'
      : '<div class="wz-gate ok"><div class="wz-gate-h">✓ 没有待确认的 AI 草稿</div></div>';

    return '' +
      '<div class="wz-form">' +
      '  <div class="wz-summary">' +
      '    <div class="wz-sum-row"><span>客户 / 班次</span><b>' + esc(d.client || '—') + ' · ' + esc(d.cohort || '—') + '</b></div>' +
      '    <div class="wz-sum-row"><span>主题课程</span><b>' + esc(d.theme || '—') + '</b></div>' +
      '    <div class="wz-sum-row"><span>场景 / 行为</span><b>' + sceneN + ' 个场景 · ' + behN + ' 行为（' + keyN + ' 关键）</b></div>' +
      '    <div class="wz-sum-row"><span>三周节奏</span><b>15 工作日 · 10 行动（8 微 + 2 关）</b></div>' +
      '  </div>' +
      draftHtml +
      '  <div class="wz-ai-entry"><button class="btn btn-ghost btn-sm" id="wz-aiset2">AI 设置</button>' +
      '    <span class="wz-ai-hint">完成后将生成学员端分享链接，进入构建器可继续微调</span></div>' +
      '</div>';
  }
  function gateItem(x, i) {
    return '<div class="wz-gate-item" data-gi="' + i + '">' +
      '<span class="wz-gate-t">' + esc(x.label) + '</span>' +
      '<span class="wz-gate-d">' + esc(x.desc) + '</span>' +
      '<span class="wz-gate-act">' +
      '  <button class="btn btn-soft btn-sm" data-gate-ok="' + i + '">采纳</button>' +
      '  <button class="btn btn-ghost btn-sm" data-gate-del="' + i + '">删除</button>' +
      '</span></div>';
  }

  /* 收集所有带 _draft 标记的项 */
  function collectDrafts() {
    var d = state.draft, out = [];
    (d.scenarios || []).forEach(function (sc) {
      if (sc._draft) out.push({ type: 'scene', id: sc.id, label: '场景', desc: sc.name || sc.title || '（未命名）', obj: sc });
      (sc.behaviors || []).forEach(function (b) { if (b._draft) out.push({ type: 'behavior', id: b.id, label: '行为', desc: (b.action || b.scene || '（未命名）'), obj: b }); });
      (sc.methods || []).forEach(function (m) { if (m._draft) out.push({ type: 'method', id: m.id, label: '方法工具', desc: m.name || m.desc || '（未命名）', obj: m }); });
      if (sc.metric && sc.metric._draft) out.push({ type: 'metric', id: 'm', label: '指标', desc: sc.metric.label || '（未命名）', obj: sc.metric });
    });
    if (d.evidenceChain && d.evidenceChain._draft) out.push({ type: 'chain', id: 'c', label: '证据链', desc: '培训价值证据链', obj: d.evidenceChain });
    return out;
  }

  /* ---------- 事件绑定 ---------- */
  function bindBody() {
    var d = state.draft;

    // step 1
    if (el('wz-client')) el('wz-client').oninput = function () { d.client = this.value; };
    if (el('wz-cohort')) el('wz-cohort').oninput = function () { d.cohort = this.value; };
    if (el('wz-theme'))  el('wz-theme').oninput  = function () { d.theme = this.value; };
    if (el('wz-needs'))  el('wz-needs').oninput  = function () { d.needs = this.value; };
    if (el('wz-aiset'))  el('wz-aiset').onclick = openAiSettings;
    if (el('wz-aiset2')) el('wz-aiset2').onclick = openAiSettings;
    if (el('wz-sample')) el('wz-sample').onclick = function () {
      close();
      if (global.ALV2_viewSample) global.ALV2_viewSample();
    };

    // step 2
    if (el('wz-add-scene')) el('wz-add-scene').onclick = function () {
      if (d.scenarios.length >= 3) { toast('最多 3 个场景', 'err'); return; }
      d.scenarios.push({ id: ALV2.uid('scene'), name: '', challenge: '', methods: [], behaviors: [], metric: { label: '', target: '' } });
      renderBody();
    };
    if (el('wz-draft')) el('wz-draft').onclick = openDraftGen;
    bindGeneric(el('wz-scenes'), '[data-sc-title]', 'oninput', function (node) {
      var sc = findScene(node.dataset.scTitle); if (sc) sc.name = node.value;
    });
    bindGeneric(el('wz-scenes'), '[data-sc-ch]', 'oninput', function (node) {
      var sc = findScene(node.dataset.scCh); if (sc) sc.challenge = node.value;
    });
    bindGeneric(el('wz-scenes'), '[data-del-sc]', 'onclick', function (node) {
      d.scenarios = d.scenarios.filter(function (x) { return x.id !== node.dataset.delSc; });
      renderBody();
    });

    // step 3 behaviors
    bindGeneric(el('wz-body'), '[data-add-beh]', 'onclick', function (node) {
      var sc = findScene(node.dataset.addBeh); if (!sc) return;
      var kind = node.dataset.kind || 'micro';
      if (kind === 'micro' && countKind(d, 'micro') >= 8) { toast('微行为最多 8 条', 'err'); return; }
      if (kind === 'key' && countKind(d, 'key') >= 2) { toast('关键行为最多 2 条', 'err'); return; }
      sc.behaviors = sc.behaviors || [];
      sc.behaviors.push({ id: ALV2.uid('behavior'), kind: kind, scene: sc.name || sc.title || '', challenge: sc.challenge || '', action: '', expectedResult: '', order: sc.behaviors.length });
      renderBody();
    });
    bindGeneric(el('wz-body'), '[data-b-scene]', 'oninput', function (node) {
      var b = findBehavior(node.dataset.bScene); if (b) b.scene = node.value;
    });
    bindGeneric(el('wz-body'), '[data-b-ch]', 'oninput', function (node) {
      var b = findBehavior(node.dataset.bCh); if (b) b.challenge = node.value;
    });
    bindGeneric(el('wz-body'), '[data-b-act]', 'oninput', function (node) {
      var b = findBehavior(node.dataset.bAct); if (b) b.action = node.value;
    });
    bindGeneric(el('wz-body'), '[data-b-exp]', 'oninput', function (node) {
      var b = findBehavior(node.dataset.bExp); if (b) b.expectedResult = node.value;
    });
    bindGeneric(el('wz-body'), '[data-del-b]', 'onclick', function (node) {
      deleteBehavior(node.dataset.delB); renderBody();
    });

    // step 4 methods
    bindGeneric(el('wz-body'), '[data-add-method]', 'onclick', function (node) {
      var sc = findScene(node.dataset.addMethod); if (sc) { sc.methods = sc.methods || []; sc.methods.push({ id: ALV2.uid('method'), name: '', desc: '' }); }
      renderBody();
    });
    bindGeneric(el('wz-body'), '[data-m-name]', 'oninput', function (node) {
      var m = findMethod(node.dataset.mName); if (m) m.name = node.value;
    });
    bindGeneric(el('wz-body'), '[data-m-desc]', 'oninput', function (node) {
      var m = findMethod(node.dataset.mDesc); if (m) m.desc = node.value;
    });
    bindGeneric(el('wz-body'), '[data-del-m]', 'onclick', function (node) {
      deleteMethod(node.dataset.delM); renderBody();
    });
    bindGeneric(el('wz-body'), '[data-wz-supp]', 'onchange', function (node) {
      var m = findMethod(node.dataset.wzSupp); if (!m) return;
      m.supports = [];
      el('wz-body').querySelectorAll('[data-wz-supp="' + m.id + '"]:checked').forEach(function (cb) { m.supports.push(cb.value); });
    });

    // step 5
    bindGeneric(el('wz-body'), '[data-mt-label]', 'oninput', function (node) {
      var sc = findScene(node.dataset.mtLabel); if (sc) { sc.metric = sc.metric || {}; sc.metric.label = node.value; }
    });
    bindGeneric(el('wz-body'), '[data-mt-target]', 'oninput', function (node) {
      var sc = findScene(node.dataset.mtTarget); if (sc) { sc.metric = sc.metric || {}; sc.metric.target = node.value; }
    });
    bindGeneric(el('wz-body'), '[data-mt-add-series]', 'onclick', function (node) {
      var box = el('wz-body').querySelector('.wz-series[data-sc="' + node.dataset.mtAddSeries + '"]');
      if (box) box.insertAdjacentHTML('beforeend', wzSeriesRow({}));
    });
    bindGeneric(el('wz-body'), '[data-wz-ms-label],[data-wz-ms-value],[data-wz-ms-note]', 'oninput', function (node) {
      var box = node.closest('.wz-series'); if (!box) return;
      var sc = findScene(box.dataset.sc); if (!sc) return;
      sc.metric = sc.metric || {};
      var ser = [];
      box.querySelectorAll('.wz-ms-row').forEach(function (row) {
        var label = row.querySelector('[data-wz-ms-label]').value.trim();
        var val = row.querySelector('[data-wz-ms-value]').value.trim();
        var note = row.querySelector('[data-wz-ms-note]').value.trim();
        if (label || val) ser.push({ label: label, value: val, note: note });
      });
      sc.metric.series = ser;
    });

    // step 6
    if (el('wz-sm')) el('wz-sm').onchange = function () { d.rhythm.startMode = this.value; };
    if (el('wz-so')) el('wz-so').oninput = function () { d.rhythm.startOffsetDays = clampInt(this.value, 0, 14, 1); };
    if (el('wz-sw')) el('wz-sw').onchange = function () { d.rhythm.skipWeekend = this.checked; };

    // step 7
    if (el('wz-accept-all')) el('wz-accept-all').onclick = function () {
      collectDrafts().forEach(function (x) { delete x.obj._draft; });
      toast('已采纳全部 AI 草稿', 'ok'); renderBody();
    };
    bindGeneric(el('wz-body'), '[data-gate-ok]', 'onclick', function (node) {
      var i = +node.dataset.gateOk; var arr = collectDrafts(); if (arr[i]) delete arr[i].obj._draft; renderBody();
    });
    bindGeneric(el('wz-body'), '[data-gate-del]', 'onclick', function (node) {
      var i = +node.dataset.gateDel; var arr = collectDrafts(); var x = arr[i];
      if (x) deleteDraftItem(x); renderBody();
    });
  }

  function bindGeneric(scope, sel, evt, fn) {
    if (!scope) return;
    scope.querySelectorAll(sel).forEach(function (n) { n[evt] = fn; });
  }

  function clampInt(v, min, max, def) {
    var n = parseInt(v, 10); if (isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  /* ---------- 查找辅助（行为直接挂场景） ---------- */
  function findScene(id) { return (state.draft.scenarios || []).filter(function (s) { return s.id === id; })[0] || null; }
  function findBehavior(id) {
    var out = null; (state.draft.scenarios || []).forEach(function (sc) { (sc.behaviors || []).forEach(function (b) { if (b.id === id) out = b; }); }); return out;
  }
  function findMethod(id) {
    var out = null; (state.draft.scenarios || []).forEach(function (sc) { (sc.methods || []).forEach(function (m) { if (m.id === id) out = m; }); }); return out;
  }
  function deleteBehavior(id) {
    (state.draft.scenarios || []).forEach(function (sc) { sc.behaviors = (sc.behaviors || []).filter(function (b) { return b.id !== id; }); });
  }
  function deleteMethod(id) {
    (state.draft.scenarios || []).forEach(function (sc) { sc.methods = (sc.methods || []).filter(function (m) { return m.id !== id; }); });
  }
  function deleteDraftItem(x) {
    if (x.type === 'scene') state.draft.scenarios = state.draft.scenarios.filter(function (s) { return s.id !== x.id; });
    else if (x.type === 'behavior') deleteBehavior(x.id);
    else if (x.type === 'method') deleteMethod(x.id);
    else if (x.type === 'metric') { var sc = findScene(x.id); if (sc) sc.metric = { label: '', target: '' }; }
    else if (x.type === 'chain') { state.draft.evidenceChain = { spentWhat: '', changedWhat: '', producedWhat: '', earnedWhat: '', links: ['', '', ''], expectedEvidence: ['', '', '', ''], _draft: false }; }
  }

  /* ---------- AI 设置弹窗 ---------- */
  function openAiSettings() {
    var a = state.draft.aiConfig || ALV2.defaultAiConfig();
    var box = el('wz-ai');
    box.innerHTML = '<div class="wz-ai-modal">' +
      '<div class="wz-ai-head"><b>AI 设置</b><button class="wz-x" id="wz-ai-x">✕</button></div>' +
      '<p class="wz-ai-note">Key 只存在本机浏览器，绝不外传、不进导出包。没有 Key 时，AI 起草按钮不可用。</p>' +
      '<div class="field"><label>接口地址</label><input class="in" id="wz-ai-url" value="' + esc(a.baseURL) + '" placeholder="https://api.openai.com/v1" /></div>' +
      '<div class="field"><label>模型</label><input class="in" id="wz-ai-model" value="' + esc(a.model) + '" placeholder="gpt-4o-mini" /></div>' +
      '<div class="field"><label>API Key</label><input class="in" id="wz-ai-key" type="password" value="' + esc(a.apiKey) + '" placeholder="sk-..." /></div>' +
      '<div class="wz-ai-foot"><button class="btn btn-primary btn-sm" id="wz-ai-save">保存</button></div>' +
      '</div>';
    box.classList.add('show');
    el('wz-ai-x').onclick = function () { box.classList.remove('show'); box.innerHTML = ''; };
    el('wz-ai-save').onclick = function () {
      state.draft.aiConfig = {
        provider: 'openai-compatible',
        baseURL: el('wz-ai-url').value.trim() || 'https://api.openai.com/v1',
        model: el('wz-ai-model').value.trim() || 'gpt-4o-mini',
        apiKey: el('wz-ai-key').value.trim()
      };
      box.classList.remove('show'); box.innerHTML = '';
      toast('AI 设置已保存（仅本机）', 'ok');
    };
  }

  /* ---------- AI 起草弹窗 ---------- */
  function openDraftGen() {
    var a = state.draft.aiConfig || {};
    if (!a.apiKey) { toast('请先在「AI 设置」里填写 Key', 'err'); openAiSettings(); return; }
    var box = el('wz-ai');
    box.innerHTML = '<div class="wz-ai-modal">' +
      '<div class="wz-ai-head"><b>AI 起草 · 关键场景</b><button class="wz-x" id="wz-dg-x">✕</button></div>' +
      '<p class="wz-ai-note">最少只需三句话。也可附上课程资料（txt / md），AI 会据此生成场景、行为、方法、指标，全部标记为草稿待你确认。</p>' +
      '<div class="field"><label>课程主题</label><input class="in" id="wz-dg-theme" value="' + esc(state.draft.theme) + '" placeholder="如：战略执行与全局经营沙盘" /></div>' +
      '<div class="field"><label>学员岗位</label><input class="in" id="wz-dg-role" value="' + esc(state.draft.cohort ? state.draft.cohort + ' 学员' : '') + '" placeholder="如：新任中层管理者" /></div>' +
      '<div class="field"><label>想解决的 business 问题</label><textarea class="in" id="wz-dg-needs" rows="3" placeholder="如：跨部门协同低效、决策质量不稳定">' + esc(state.draft.needs) + '</textarea></div>' +
      '<div class="field"><label>课程资料（可选 · txt / md）</label><input type="file" id="wz-dg-file" accept=".txt,.md,.json" /></div>' +
      '<div class="wz-ai-foot"><button class="btn btn-ghost btn-sm" id="wz-dg-cancel">取消</button>' +
      '<button class="btn btn-primary btn-sm" id="wz-dg-go">生成草稿</button></div>' +
      '<div class="wz-dg-status" id="wz-dg-status"></div>' +
      '</div>';
    box.classList.add('show');
    el('wz-dg-x').onclick = closeAi;
    el('wz-dg-cancel').onclick = closeAi;
    el('wz-dg-go').onclick = function () {
      var input = {
        theme: el('wz-dg-theme').value.trim(),
        role: el('wz-dg-role').value.trim(),
        needs: el('wz-dg-needs').value.trim(),
        files: []
      };
      var st = el('wz-dg-status');
      var run = function () {
        st.textContent = '正在生成…（约 10–30 秒）';
        el('wz-dg-go').disabled = true;
        ai.generateConfigDraft(input, state.draft.aiConfig).then(function (mapped) {
          (mapped.scenarios || []).forEach(function (sc) { state.draft.scenarios.push(sc); });
          if (mapped.evidenceChain) state.draft.evidenceChain = mapped.evidenceChain;
          if (!state.draft.theme && input.theme) state.draft.theme = input.theme;
          if (!state.draft.needs && input.needs) state.draft.needs = input.needs;
          closeAi();
          renderBody();
          toast('AI 已生成 ' + mapped.scenarios.length + ' 个场景草稿，请逐项确认', 'ok');
        }).catch(function (err) {
          st.textContent = '生成失败：' + err.message;
          el('wz-dg-go').disabled = false;
        });
      };
      var f = el('wz-dg-file') && el('wz-dg-file').files[0];
      if (f) {
        var r = new FileReader();
        r.onload = function () { input.files = [String(r.result || '')]; run(); };
        r.onerror = function () { st.textContent = '资料读取失败，已忽略继续生成'; run(); };
        r.readAsText(f);
      } else { run(); }
    };
  }
  function closeAi() { var box = el('wz-ai'); box.classList.remove('show'); box.innerHTML = ''; }

  /* ---------- 完成 ---------- */
  function finish() {
    var d = state.draft;
    if (!d.client || !d.cohort || !d.theme) { toast('请先回到第 1 步填写客户 / 班次 / 主题', 'err'); state.step = 0; render(); return; }
    if (collectDrafts().length) { toast('请先确认或删除 AI 草稿（第 7 步）', 'err'); state.step = STEPS.length - 1; render(); return; }
    // 关键行为 2 条、微行为 8 条（上限）；节奏固定窗口
    var micros = [], keys = [];
    (d.scenarios || []).forEach(function (sc) { (sc.behaviors || []).forEach(function (b) { if ((b.kind || 'micro') === 'key') keys.push(b); else micros.push(b); }); });
    if (keys.length < 1) { toast('至少需要 1 条关键行为', 'err'); state.step = 2; render(); return; }
    // 生成正式 course（带正确 sku），覆盖草稿数据
    var cfg = ALV2.createBlank({ client: d.client, cohort: d.cohort, theme: d.theme, needs: d.needs, note: d.note });
    cfg.scenarios = d.scenarios.map(cleanScenario);
    cfg.evidenceChain = d.evidenceChain || cfg.evidenceChain;
    cfg.rhythm = {
      windowWorkdays: 15,
      totalActions: micros.length + keys.length,
      microCount: micros.length,
      keyCount: keys.length,
      keySlots: [2, 10].slice(0, keys.length),
      freeDays: d.rhythm.freeDays && d.rhythm.freeDays.length ? d.rhythm.freeDays : [4, 7, 9, 12, 14],
      startMode: d.rhythm.startMode || 'cohort',
      startOffsetDays: d.rhythm.startOffsetDays != null ? d.rhythm.startOffsetDays : 1,
      skipWeekend: d.rhythm.skipWeekend !== false
    };
    cfg.aiConfig = d.aiConfig;
    ALV2.store.set(cfg.sku, 'config', cfg);
    close();
    state.onDone(cfg.sku);
  }
  function cleanScenario(sc) {
    var o = JSON.parse(JSON.stringify(sc));
    delete o._draft;
    (o.behaviors || []).forEach(function (b) { delete b._draft; if (!b.kind) b.kind = 'micro'; });
    (o.methods || []).forEach(function (m) { delete m._draft; });
    if (o.metric) delete o.metric._draft;
    return o;
  }

  global.WZ = {
    open: open,
    close: close,
    _state: state,
    _collectDrafts: collectDrafts
  };
})(window);
