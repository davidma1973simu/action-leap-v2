/* Action Leap V2 · 全局 AI 设置模块
 * 全产品共用一份 AI 配置（不挂在课程下）：选主流大模型 + 填一次 Key。
 * 配置起草 / 学员陪练 / 复盘建议 / 高层简报 都读 ALV2.getAIConfig()。
 * 本文件被 index.html（后台）与 student.html（学员端）共用。
 *
 * 设计语言（2026-08-17 翻新 · 对齐消费品级审美）：
 *   · 单列大卡片式单选，左侧品牌色图标方块 + 标题/副标题，右侧大圆点
 *   · 选中态：边框 + 图标方块 同步点亮（用 --primary 珊瑚橙，DeepSeek 蓝作为示例色）
 *   · API Key 输入框大圆角胶囊 + 底部「返回 / 保存设置」一组按钮
 */
(function (global) {
  'use strict';
  var ALV2 = global.ALV2 || (global.ALV2 = {});
  var mounted = false;
  var selectedPid = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function $(id) { return document.getElementById(id); }

  function currentCfg() { return ALV2.getAIConfig() || ALV2.defaultAiConfig(); }

  /* 构建弹窗 DOM（只建一次）*/
  function mount() {
    if (mounted) return;
    var overlay = document.createElement('div');
    overlay.className = 'overlay ai-set-overlay';
    overlay.id = 'ai-set-overlay';
    overlay.innerHTML =
      '<div class="modal ai-set-modal" role="dialog" aria-label="AI 设置">' +
        '<button class="x-btn" data-close="ai-set-overlay" aria-label="关闭">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
        '</button>' +
        '<div class="ai-set-header">' +
          '<h2>AI 设置</h2>' +
          '<p class="ai-set-sub">选一个模型品牌，填入你的 API Key 即可使用。</p>' +
        '</div>' +
        '<div class="ai-set-body">' +
          '<div class="ai-set-label">模型品牌</div>' +
          '<div class="ai-prov-list" id="ai-prov-grid"></div>' +
          '<div class="ai-set-label" style="margin-top:24px">API Key</div>' +
          '<div class="ai-set-input-row">' +
            '<input id="ai-set-key" type="password" class="in ai-set-input" placeholder="sk-..." autocomplete="off" spellcheck="false" />' +
            '<button type="button" class="btn btn-test" id="ai-set-test-btn">先测试连接</button>' +
          '</div>' +
          '<div class="ai-set-test" id="ai-set-test"></div>' +
          '<details class="ai-adv">' +
            '<summary>高级（自定义接口与模型）</summary>' +
            '<div class="ai-adv-grid">' +
              '<div class="field"><label>接口地址（OpenAI 兼容 /chat/completions）</label><input id="ai-set-url" class="in" placeholder="https://api.openai.com/v1" /></div>' +
              '<div class="field"><label>模型</label><select id="ai-set-model" class="in"></select></div>' +
            '</div>' +
          '</details>' +
        '</div>' +
        '<div class="ai-set-foot">' +
          '<span class="ai-set-status" id="ai-set-status"></span>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn-ghost btn-back" data-close="ai-set-overlay">返回</button>' +
          '<button class="btn btn-primary btn-save" id="ai-set-save">保存设置</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 关闭：点遮罩 / 关闭按钮 / 返回
    overlay.addEventListener('click', function (e) {
      var closeId = e.target.dataset && e.target.dataset.close;
      if (e.target === overlay || closeId === 'ai-set-overlay') close();
    });
    $('ai-set-save').onclick = save;
    $('ai-set-test-btn').onclick = testConn;
    // 输入 URL 时标记手动改过
    var urlEl = $('ai-set-url');
    if (urlEl) urlEl.oninput = function () { urlEl.dataset.touched = '1'; };
    mounted = true;
  }

  function renderProviders() {
    var grid = $('ai-prov-grid');
    if (!grid) return;
    var provs = (ALV2.ai && ALV2.ai.PROVIDERS) || [];
    grid.innerHTML = provs.map(function (p) {
      return '<button type="button" class="ai-prov" data-pid="' + esc(p.id) + '" style="--pc:' + esc(p.color || '#777') + '">' +
        '<span class="ai-prov-ic">' + (p.icon || '') + '</span>' +
        '<span class="ai-prov-text">' +
          '<span class="ai-prov-name">' + esc(p.name) + '</span>' +
          '<span class="ai-prov-desc">' + esc(p.desc || '') + '</span>' +
        '</span>' +
        '<span class="ai-prov-check" aria-hidden="true">' +
          '<span class="ai-prov-check-dot"></span>' +
        '</span>' +
      '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.ai-prov'), function (btn) {
      btn.onclick = function () { selectProvider(btn.getAttribute('data-pid')); };
    });
  }

  function selectProvider(pid) {
    selectedPid = pid;
    var prov = (ALV2.ai && ALV2.ai.providerById) ? ALV2.ai.providerById(pid) : null;
    var grid = $('ai-prov-grid');
    if (grid) Array.prototype.forEach.call(grid.querySelectorAll('.ai-prov'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-pid') === pid);
    });
    if (prov) {
      var sel = $('ai-set-model');
      sel.innerHTML = prov.models.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join('');
      // 默认填该服务商的接口地址（除非用户已手动改过）
      var url = $('ai-set-url');
      if (url && (!url.value || url.dataset.touched !== '1')) url.value = prov.baseURL;
    }
  }

  function populate() {
    var cfg = currentCfg();
    renderProviders();
    var key = $('ai-set-key');
    key.value = cfg.apiKey || '';
    var url = $('ai-set-url');
    url.value = cfg.baseURL || '';
    url.dataset.touched = '0';
    $('ai-set-test').textContent = '';
    $('ai-set-test').className = 'ai-set-test';
    // 选中当前 provider
    var pid = cfg.provider;
    var provs = (ALV2.ai && ALV2.ai.PROVIDERS) || [];
    if ((!pid || pid === 'openai-compatible') && provs.length) {
      // 尝试按 baseURL 匹配
      for (var i = 0; i < provs.length; i++) if (provs[i].baseURL === (cfg.baseURL || '')) { pid = provs[i].id; break; }
      if (!pid) pid = provs[0].id;
    }
    if (pid) selectProvider(pid);
    var sel = $('ai-set-model');
    if (cfg.model) {
      var opt = Array.prototype.find ? Array.prototype.find.call(sel.options, function (o) { return o.value === cfg.model; }) : null;
      if (opt) sel.value = cfg.model; else { var o = document.createElement('option'); o.value = cfg.model; o.textContent = cfg.model + '（自定义）'; sel.appendChild(o); sel.value = cfg.model; }
    }
  }

  function save() {
    var pid = selectedPid;
    var prov = (ALV2.ai && ALV2.ai.providerById) ? ALV2.ai.providerById(pid) : null;
    var url = $('ai-set-url').value.trim() || (prov ? prov.baseURL : 'https://api.openai.com/v1');
    var cfg = {
      provider: pid || (prov ? prov.id : 'openai-compatible'),
      baseURL: url,
      model: $('ai-set-model').value.trim() || (prov ? prov.models[0] : 'gpt-4o-mini'),
      apiKey: $('ai-set-key').value.trim()
    };
    ALV2.setAIConfig(cfg);
    refresh();
    close();
    if (global.toast) global.toast('AI 配置已保存 · 全产品共用', 'ok');
  }

  function testConn() {
    var pid = selectedPid;
    var prov = (ALV2.ai && ALV2.ai.providerById) ? ALV2.ai.providerById(pid) : null;
    var cfg = {
      provider: pid || (prov ? prov.id : 'openai-compatible'),
      baseURL: $('ai-set-url').value.trim() || (prov ? prov.baseURL : ''),
      model: $('ai-set-model').value.trim() || (prov ? prov.models[0] : ''),
      apiKey: $('ai-set-key').value.trim()
    };
    var box = $('ai-set-test');
    if (!cfg.apiKey) { box.textContent = '请先填写 API Key'; box.className = 'ai-set-test err'; return; }
    box.textContent = '正在测试连接…'; box.className = 'ai-set-test';
    ALV2.ai.callChat(cfg, [{ role: 'user', content: 'ping' }], { temperature: 0, timeout: 20000 })
      .then(function (t) {
        box.textContent = '✓ 连接成功（' + (String(t || '').slice(0, 24) || 'ok') + '）';
        box.className = 'ai-set-test ok';
      })
      .catch(function (e) {
        box.textContent = '✗ ' + (e && e.message ? e.message : '连接失败');
        box.className = 'ai-set-test err';
      });
  }

  function open() {
    mount();
    populate();
    $('ai-set-overlay').classList.add('show');
  }
  function close() {
    var o = $('ai-set-overlay');
    if (o) o.classList.remove('show');
  }

  /* 刷新各处状态指示（侧栏按钮 / HERO / 学员顶栏）*/
  function refresh() {
    var on = ALV2.hasAI();
    var cfg = on ? currentCfg() : null;
    var label = on ? ('已启用 · ' + (cfg.model || '')) : '未配置';

    ['ai-settings-btn', 'ai-settings-btn-m'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var dot = el.querySelector('.dot');
      if (dot) dot.className = 'dot' + (on ? ' on' : '');
      var t = el.querySelector('.t');
      if (t) t.textContent = on ? ('AI · ' + (cfg.model || '')) : 'AI 设置';
    });
    var hero = $('ai-hero-status');
    if (hero) {
      hero.className = 'ai-hero-status ' + (on ? 'on' : 'off');
      hero.innerHTML = on
        ? '<span class="dot on"></span> AI 已启用 · ' + esc(cfg.model || '') + '（全产品共用）'
        : '<span class="dot"></span> 尚未配置 AI · 点此开启';
    }
    var st = $('ai-set-status');
    if (st) { st.textContent = on ? ('当前：' + (cfg.model || '') + ' 已启用') : '当前：未配置'; }
  }

  ALV2.aiSettings = { open: open, close: close, refresh: refresh, mount: mount };
  global.openAISettings = open; // wizard 委托用
})(window);
