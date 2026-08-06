/* Action Leap V2 · 七步配置向导（Phase 2）
 * 职责：把"场景驱动闭环"的配置拆成一条有序问答线，降低讲师认知负荷。
 *   - 新建课程强制走向导；走完生成正式 course 并进入"配置构建器"（专家模式）。
 *   - 每步一个大白话问题；含 AI 起草与「确认关卡」（所有 AI 草稿必须人工确认才可发布）。
 *   - 共享 ALV2 数据模型；纯前端无后端。
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
    { key: 'shell',  t: '课程外壳',   q: '这门课服务谁？什么班次、什么主题？',                h: '先填三项基础信息，后面的框架细节逐步补充。' },
    { key: 'scene',  t: '关键场景',   q: '学员回到工作后，最常在哪几个真实场景"卡住"？',     h: '写 1–3 个真实工作场景，每个配一句挑战（大白话）。' },
    { key: 'task',   t: '学员任务',   q: '每个场景里，学员具体要做哪几件小事？',              h: '一个任务 = 一次微打卡。拆得越碎，越容易坚持。' },
    { key: 'method', t: '方法 + 行为', q: '做这些事用什么方法工具？要练成什么高绩效行为？',  h: '给每个任务挂方法工具与行为，学员才知道"怎么做得对"。' },
    { key: 'metric', t: '改善指标',   q: '每个场景要改善哪个业务指标？（可选）',             h: '填指标名 + 目标，用于最后的成果汇报。' },
    { key: 'rhythm', t: '两周节奏',   q: '节奏怎么排？工作日、每天上限、开始日？',            h: '默认 10 个工作日 × 每天最多 2 个 = 上限 20 次。' },
    { key: 'review', t: '预览发布',   q: '检查一遍——确认无误，就发布给学员。',              h: 'AI 帮你起草的内容，需要逐项确认后才算数。' }
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
    var fn = { shell: stepShell, scene: stepScene, task: stepTask, method: stepMethod,
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
      '    <span class="wz-ai-hint">填好你的模型 Key，可让 AI 一键起草下面的场景与任务</span>' +
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
      '<input class="in" data-sc-title="' + esc(sc.id) + '" value="' + esc(sc.title) + '" placeholder="场景名，如：跨部门需求评审会" />' +
      '<textarea class="in" data-sc-ch="' + esc(sc.id) + '" rows="2" placeholder="学员在这里面常遇到的挑战（大白话）">' + esc(sc.challenge) + '</textarea>' +
      '</div>';
  }

  /* ---------- 步骤 3：学员任务 ---------- */
  function stepTask() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先在「关键场景」里添加场景。</div>';
    var html = '';
    d.scenarios.forEach(function (sc) {
      html += '<div class="wz-group" data-scid="' + esc(sc.id) + '">' +
        '<div class="wz-group-t">▸ ' + esc(sc.title || '未命名场景') + '</div>' +
        '<div class="wz-sublist" data-tasks="' + esc(sc.id) + '">' +
        (sc.tasks || []).map(function (tk, i) { return taskRow(sc, tk, i); }).join('') +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-add-task="' + esc(sc.id) + '">+ 添加任务</button>' +
        '</div>';
    });
    return html;
  }
  function taskRow(sc, tk, i) {
    var draft = tk._draft ? ' draft' : '';
    return '<div class="wz-item' + draft + '" data-tkid="' + esc(tk.id) + '">' +
      '<div class="wz-item-h"><span class="wz-idx">任务 ' + (i + 1) + '</span>' +
      (tk._draft ? '<span class="wz-tag">AI 草稿</span>' : '') +
      '<button class="wz-del" data-del-task="' + esc(tk.id) + '">删除</button></div>' +
      '<input class="in" data-tk-title="' + esc(tk.id) + '" value="' + esc(tk.title) + '" placeholder="微行动一句话，如：给需求方写一封对齐邮件" />' +
      '<textarea class="in" data-tk-why="' + esc(tk.id) + '" rows="2" placeholder="为什么做它对学员有价值（大白话）">' + esc(tk.why) + '</textarea>' +
      '</div>';
  }

  /* ---------- 步骤 4：方法工具 + 行为 ---------- */
  function stepMethod() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先添加场景与任务。</div>';
    var html = '';
    d.scenarios.forEach(function (sc) {
      (sc.tasks || []).forEach(function (tk) {
        html += '<div class="wz-group" data-tkid="' + esc(tk.id) + '">' +
          '<div class="wz-group-t">▸ ' + esc(tk.title || '未命名任务') + '</div>' +
          '<div class="wz-sub-label">方法工具</div>' +
          '<div class="wz-sublist" data-methods="' + esc(tk.id) + '">' +
          (tk.methods || []).map(function (m, i) { return methodRow(tk, m, i); }).join('') +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" data-add-method="' + esc(tk.id) + '">+ 添加方法工具</button>' +
          '<div class="wz-sub-label">高绩效行为</div>' +
          '<div class="wz-sublist" data-behaviors="' + esc(tk.id) + '">' +
          (tk.behaviors || []).map(function (b, i) { return behRow(tk, b, i); }).join('') +
          '</div>' +
          '<button class="btn btn-ghost btn-sm" data-add-beh="' + esc(tk.id) + '">+ 添加行为</button>' +
          '</div>';
      });
    });
    return html || '<div class="wz-empty">先添加任务。</div>';
  }
  function methodRow(tk, m, i) {
    var draft = m._draft ? ' draft' : '';
    return '<div class="wz-item sm' + draft + '" data-mid="' + esc(m.id) + '">' +
      '<input class="in" data-m-name="' + esc(m.id) + '" value="' + esc(m.name) + '" placeholder="方法/工具名，如：5 Why" />' +
      '<input class="in" data-m-desc="' + esc(m.id) + '" value="' + esc(m.desc) + '" placeholder="怎么用（一句话）" />' +
      (m._draft ? '<span class="wz-tag sm">AI</span>' : '') +
      '<button class="wz-del" data-del-m="' + esc(m.id) + '">✕</button></div>';
  }
  function behRow(tk, b, i) {
    var draft = b._draft ? ' draft' : '';
    return '<div class="wz-item sm' + draft + '" data-bid="' + esc(b.id) + '">' +
      '<input class="in" data-b-desc="' + esc(b.id) + '" value="' + esc(b.desc) + '" placeholder="一条高绩效行为，如：先听再回应" />' +
      (b._draft ? '<span class="wz-tag sm">AI</span>' : '') +
      '<button class="wz-del" data-del-b="' + esc(b.id) + '">✕</button></div>';
  }

  /* ---------- 步骤 5：改善指标 ---------- */
  function stepMetric() {
    var d = state.draft;
    if (!d.scenarios.length) return '<div class="wz-empty">先添加场景。</div>';
    var html = '';
    d.scenarios.forEach(function (sc) {
      var m = sc.metric || {};
      var draft = m._draft ? ' draft' : '';
      html += '<div class="wz-item' + draft + '" data-scid="' + esc(sc.id) + '">' +
        '<div class="wz-item-h"><span class="wz-idx">▸ ' + esc(sc.title || '未命名场景') + '</span>' +
        (m._draft ? '<span class="wz-tag">AI 草稿</span>' : '') + '</div>' +
        '<div class="wz-row">' +
        '<input class="in" data-mt-label="' + esc(sc.id) + '" value="' + esc(m.label) + '" placeholder="指标名，如：需求返工率" />' +
        '<input class="in" data-mt-target="' + esc(sc.id) + '" value="' + esc(m.target) + '" placeholder="目标，如：下降 30%" />' +
        '</div></div>';
    });
    return html;
  }

  /* ---------- 步骤 6：两周节奏 ---------- */
  function stepRhythm() {
    var r = state.draft.rhythm || ALV2.defaultRhythm();
    var prev = renderRhythmPreview();
    return '' +
      '<div class="wz-form">' +
      '  <div class="wz-row">' +
      '    <div class="field"><label>工作日数</label><input class="in" type="number" min="2" max="20" id="wz-wd" value="' + (r.workdays) + '" /></div>' +
      '    <div class="field"><label>每日上限</label><input class="in" type="number" min="1" max="3" id="wz-pm" value="' + (r.perDayMax) + '" /></div>' +
      '  </div>' +
      '  <div class="wz-row">' +
      '    <div class="field"><label>开始方式</label><select class="in" id="wz-sm">' +
      '      <option value="cohort"' + (r.startMode === 'cohort' ? ' selected' : '') + '>全班统一开始日</option>' +
      '      <option value="individual"' + (r.startMode === 'individual' ? ' selected' : '') + '>学员各自首次打开</option>' +
      '    </select></div>' +
      '    <div class="field"><label>偏移天数</label><input class="in" type="number" min="0" max="14" id="wz-so" value="' + (r.startOffsetDays) + '" /></div>' +
      '  </div>' +
      '  <div class="wz-rhythm-prev" id="wz-rhprev">' + prev + '</div>' +
      '</div>';
  }
  function renderRhythmPreview() {
    var d = state.draft;
    var plan = ALV2.schedulePlan(d, { fromDate: new Date() });
    var total = plan.total, limit = plan.limit;
    var over = total > limit;
    var cells = plan.days.map(function (day) {
      var n = day.tasks.length;
      var cls = n >= (d.rhythm.perDayMax) ? 'full' : (n > 0 ? 'some' : '');
      return '<div class="wz-cell ' + cls + '"><span class="wz-cd">D' + (day.idx + 1) + '</span>' +
        '<span class="wz-cn">' + n + '</span></div>';
    }).join('');
    return '<div class="wz-prev-head">打卡机会 ' + total + ' / 上限 ' + limit +
      (over ? ' <span class="wz-warn">超出上限，请回到上方精简</span>' : ' <span class="wz-ok">余量充足</span>') +
      '</div><div class="wz-cells">' + cells + '</div>';
  }

  /* ---------- 步骤 7：预览 + 确认关卡 ---------- */
  function stepReview() {
    var d = state.draft;
    var sceneN = (d.scenarios || []).length;
    var taskN = 0; (d.scenarios || []).forEach(function (sc) { taskN += (sc.tasks || []).length; });
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
      '    <div class="wz-sum-row"><span>场景 / 任务</span><b>' + sceneN + ' 个场景 · ' + taskN + ' 个任务</b></div>' +
      '    <div class="wz-sum-row"><span>两周节奏</span><b>' + (d.rhythm.workdays) + ' 工作日 × 每日 ' + (d.rhythm.perDayMax) + ' = 上限 ' + (d.rhythm.workdays * d.rhythm.perDayMax) + '</b></div>' +
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
      if (sc._draft) out.push({ type: 'scene', id: sc.id, label: '场景', desc: sc.title || '（未命名）', obj: sc });
      (sc.tasks || []).forEach(function (tk) {
        if (tk._draft) out.push({ type: 'task', id: tk.id, label: '任务', desc: tk.title || '（未命名）', obj: tk });
        (tk.methods || []).forEach(function (m) { if (m._draft) out.push({ type: 'method', id: m.id, label: '方法工具', desc: m.name || m.desc || '（未命名）', obj: m }); });
        (tk.behaviors || []).forEach(function (b) { if (b._draft) out.push({ type: 'behavior', id: b.id, label: '行为', desc: b.desc || '（未命名）', obj: b }); });
      });
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

    // step 2
    if (el('wz-add-scene')) el('wz-add-scene').onclick = function () {
      if (d.scenarios.length >= 3) { toast('最多 3 个场景', 'err'); return; }
      d.scenarios.push({ id: ALV2.uid('scene'), title: '', challenge: '', tasks: [], metric: { label: '', target: '' } });
      renderBody();
    };
    if (el('wz-draft')) el('wz-draft').onclick = openDraftGen;
    bindGeneric(el('wz-scenes'), '[data-sc-title]', 'oninput', function (node) {
      var sc = findScene(node.dataset.scTitle); if (sc) sc.title = node.value;
    });
    bindGeneric(el('wz-scenes'), '[data-sc-ch]', 'oninput', function (node) {
      var sc = findScene(node.dataset.scCh); if (sc) sc.challenge = node.value;
    });
    bindGeneric(el('wz-scenes'), '[data-del-sc]', 'onclick', function (node) {
      d.scenarios = d.scenarios.filter(function (x) { return x.id !== node.dataset.delSc; });
      renderBody();
    });

    // step 3
    bindGeneric(el('wz-body'), '[data-add-task]', 'onclick', function (node) {
      var sc = findScene(node.dataset.addTask);
      if (sc) sc.tasks.push({ id: ALV2.uid('task'), title: '', why: '', plan: { times: 2 }, methods: [], behaviors: [] });
      renderBody();
    });
    bindGeneric(el('wz-body'), '[data-tk-title]', 'oninput', function (node) {
      var tk = findTask(node.dataset.tkTitle); if (tk) tk.title = node.value;
    });
    bindGeneric(el('wz-body'), '[data-tk-why]', 'oninput', function (node) {
      var tk = findTask(node.dataset.tkWhy); if (tk) tk.why = node.value;
    });
    bindGeneric(el('wz-body'), '[data-del-task]', 'onclick', function (node) {
      deleteTask(node.dataset.delTask); renderBody();
    });

    // step 4
    bindGeneric(el('wz-body'), '[data-add-method]', 'onclick', function (node) {
      var tk = findTask(node.dataset.addMethod); if (tk) tk.methods.push({ id: ALV2.uid('method'), name: '', desc: '' });
      renderBody();
    });
    bindGeneric(el('wz-body'), '[data-add-beh]', 'onclick', function (node) {
      var tk = findTask(node.dataset.addBeh); if (tk) tk.behaviors.push({ id: ALV2.uid('behavior'), desc: '' });
      renderBody();
    });
    bindGeneric(el('wz-body'), '[data-m-name]', 'oninput', function (node) {
      var m = findMethod(node.dataset.mName); if (m) m.name = node.value;
    });
    bindGeneric(el('wz-body'), '[data-m-desc]', 'oninput', function (node) {
      var m = findMethod(node.dataset.mDesc); if (m) m.desc = node.value;
    });
    bindGeneric(el('wz-body'), '[data-b-desc]', 'oninput', function (node) {
      var b = findBehavior(node.dataset.bDesc); if (b) b.desc = node.value;
    });
    bindGeneric(el('wz-body'), '[data-del-m]', 'onclick', function (node) {
      deleteMethod(node.dataset.delM); renderBody();
    });
    bindGeneric(el('wz-body'), '[data-del-b]', 'onclick', function (node) {
      deleteBehavior(node.dataset.delB); renderBody();
    });

    // step 5
    bindGeneric(el('wz-body'), '[data-mt-label]', 'oninput', function (node) {
      var sc = findScene(node.dataset.mtLabel); if (sc) { sc.metric = sc.metric || {}; sc.metric.label = node.value; }
    });
    bindGeneric(el('wz-body'), '[data-mt-target]', 'oninput', function (node) {
      var sc = findScene(node.dataset.mtTarget); if (sc) { sc.metric = sc.metric || {}; sc.metric.target = node.value; }
    });

    // step 6
    if (el('wz-wd')) el('wz-wd').oninput = function () { d.rhythm.workdays = clampInt(this.value, 2, 20, 10); refreshRhythm(); };
    if (el('wz-pm')) el('wz-pm').oninput = function () { d.rhythm.perDayMax = clampInt(this.value, 1, 3, 2); refreshRhythm(); };
    if (el('wz-sm')) el('wz-sm').onchange = function () { d.rhythm.startMode = this.value; };
    if (el('wz-so')) el('wz-so').oninput = function () { d.rhythm.startOffsetDays = clampInt(this.value, 0, 14, 1); };

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
  function refreshRhythm() {
    var box = el('wz-rhprev'); if (box) box.innerHTML = renderRhythmPreview();
  }

  function clampInt(v, min, max, def) {
    var n = parseInt(v, 10); if (isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  /* ---------- 查找辅助 ---------- */
  function findScene(id) { return (state.draft.scenarios || []).filter(function (s) { return s.id === id; })[0] || null; }
  function findTask(id) {
    var out = null;
    (state.draft.scenarios || []).forEach(function (sc) { (sc.tasks || []).forEach(function (t) { if (t.id === id) out = t; }); });
    return out;
  }
  function findMethod(id) {
    var out = null; (state.draft.scenarios || []).forEach(function (sc) { (sc.tasks || []).forEach(function (t) {
      (t.methods || []).forEach(function (m) { if (m.id === id) out = m; }); }); }); return out;
  }
  function findBehavior(id) {
    var out = null; (state.draft.scenarios || []).forEach(function (sc) { (sc.tasks || []).forEach(function (t) {
      (t.behaviors || []).forEach(function (b) { if (b.id === id) out = b; }); }); }); return out;
  }
  function deleteTask(id) {
    (state.draft.scenarios || []).forEach(function (sc) { sc.tasks = sc.tasks.filter(function (t) { return t.id !== id; }); });
  }
  function deleteMethod(id) {
    (state.draft.scenarios || []).forEach(function (sc) { (sc.tasks || []).forEach(function (t) {
      t.methods = t.methods.filter(function (m) { return m.id !== id; }); }); });
  }
  function deleteBehavior(id) {
    (state.draft.scenarios || []).forEach(function (sc) { (sc.tasks || []).forEach(function (t) {
      t.behaviors = t.behaviors.filter(function (b) { return b.id !== id; }); }); });
  }
  function deleteDraftItem(x) {
    if (x.type === 'scene') state.draft.scenarios = state.draft.scenarios.filter(function (s) { return s.id !== x.id; });
    else if (x.type === 'task') deleteTask(x.id);
    else if (x.type === 'method') deleteMethod(x.id);
    else if (x.type === 'behavior') deleteBehavior(x.id);
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
      '<p class="wz-ai-note">最少只需三句话。也可附上课程资料（txt / md），AI 会据此生成场景、任务、方法、行为与指标，全部标记为草稿待你确认。</p>' +
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
    // 生成正式 course（带正确 sku），覆盖草稿数据
    var cfg = ALV2.createBlank({ client: d.client, cohort: d.cohort, theme: d.theme, needs: d.needs, note: d.note });
    cfg.scenarios = d.scenarios.map(cleanScenario);
    cfg.evidenceChain = d.evidenceChain || cfg.evidenceChain;
    cfg.rhythm = d.rhythm;
    cfg.aiConfig = d.aiConfig;
    ALV2.store.set(cfg.sku, 'config', cfg);
    close();
    state.onDone(cfg.sku);
  }
  function cleanScenario(sc) {
    var o = JSON.parse(JSON.stringify(sc));
    delete o._draft;
    (o.tasks || []).forEach(function (t) {
      delete t._draft;
      (t.methods || []).forEach(function (m) { delete m._draft; });
      (t.behaviors || []).forEach(function (b) { delete b._draft; });
    });
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
