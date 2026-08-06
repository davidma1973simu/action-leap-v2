/* Action Leap V2 · AI 模块
 * 职责：统一封装讲师自有 LLM 调用（OpenAI 兼容协议）
 *   - aiConfig.apiKey 仅存浏览器本地，绝不上传、绝不进入导出/分享包
 *   - 配置起草：课程主题/学员岗位/问题(+可选文件) → 结构化草稿
 *   - 学员即时反馈：打卡一句话 → 三段式陪练反馈
 * 设计原则：纯前端；调用失败不影响主线；所有 AI 产出必须带回"草稿"标记由人确认。
 */
(function (global) {
  'use strict';
  var ALV2 = global.ALV2 || (global.ALV2 = {});
  ALV2.ai = {};

  /* 调用 OpenAI 兼容对话接口，返回 assistant 文本 */
  function callChat(aiConfig, messages, opts) {
    opts = opts || {};
    if (!aiConfig || !aiConfig.apiKey) {
      return Promise.reject(new Error('尚未配置 API Key（设置 → AI 起草）'));
    }
    var base = (aiConfig.baseURL || '').replace(/\/+$/, '');
    var url = base + '/chat/completions';
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeout || 60000);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + aiConfig.apiKey
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-4o-mini',
        messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.7,
        response_format: opts.json ? { type: 'json_object' } : undefined
      }),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('接口返回 ' + r.status + '：' + t.slice(0, 240));
        });
      }
      return r.json();
    }).then(function (j) {
      return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    });
  }

  /* ---------- 配置起草 ---------- */
  var SYSTEM_DRAFT =
    '你是"培训成效与行为迁移"设计专家。我会给你一门培训课程的主题、学员岗位、想解决的' +
    '业务问题，有时还有课程资料。请输出一份结构化的"课后行为迁移配置"，严格按下面的 JSON 格式，' +
    '不要输出任何解释文字，只输出 JSON。\n' +
    '字段说明：\n' +
    '- scenarios：1~3 个真实工作场景，每个场景含 challenge（学员在该场景下面临的具体挑战，大白话）、' +
    '  tasks（1~3 个学员要做的微行动）、metric（该场景要改善的绩效指标 label + target）。\n' +
    '- 每个 task 含 title（微行动一句话）、why（为什么做它对学员有价值，大白话）、' +
    '  methods（1~2 个方法工具 name+desc）、behaviors（1~3 条高绩效行为 desc）。\n' +
    '- evidenceChain：spentWhat/changedWhat/producedWhat/earnedWhat 四句话，串起"培训投入→行为改变→业务产出→绩效贡献"。\n' +
    '约束：不要编造学员姓名；总任务数控制在 6~8 个；语言口语、简洁、对甲方有用。\n' +
    'JSON 结构：\n' +
    '{"scenarios":[{"title":"","challenge":"","tasks":[{"title":"","why":"","methods":[{"name":"","desc":""}],"behaviors":[{"desc":""}]}],"metric":{"label":"","target":""}}],' +
    '"evidenceChain":{"spentWhat":"","changedWhat":"","producedWhat":"","earnedWhat":""}}';

  function buildDraftMessages(input) {
    var files = (input.files && input.files.length)
      ? '\n\n学员/讲师附带的资料摘要：\n' + input.files.join('\n') : '';
    var user = '课程主题：' + (input.theme || '（未填）') + '\n' +
      '学员岗位：' + (input.role || '（未填）') + '\n' +
      '想解决的 business 问题：' + (input.needs || '（未填）') + files;
    return [
      { role: 'system', content: SYSTEM_DRAFT },
      { role: 'user', content: user }
    ];
  }

  /* 把 LLM 返回的 JSON 映射成 ALV2 内部草稿结构，并打 draft 标记 */
  function mapDraft(parsed, ctx) {
    ctx = ctx || {};
    function tag(obj) { obj._draft = true; return obj; }
    var scs = (parsed && parsed.scenarios) || [];
    var out = {
      scenarios: scs.map(function (sc) {
        return tag({
          id: ALV2.uid('scene'),
          title: sc.title || '',
          challenge: sc.challenge || '',
          tasks: (sc.tasks || []).map(function (tk) {
            return tag({
              id: ALV2.uid('task'),
              title: tk.title || '',
              why: tk.why || '',
              plan: { times: 2 },
              methods: (tk.methods || []).map(function (m) {
                return tag({ id: ALV2.uid('method'), name: m.name || '', desc: m.desc || '' });
              }),
              behaviors: (tk.behaviors || []).map(function (b) {
                return tag({ id: ALV2.uid('behavior'), desc: (b.desc || b) || '' });
              })
            });
          }),
          metric: {
            label: (sc.metric && sc.metric.label) || '',
            target: (sc.metric && sc.metric.target) || '',
            _draft: true
          }
        });
      }),
      evidenceChain: {
        spentWhat: (parsed.evidenceChain && parsed.evidenceChain.spentWhat) || '',
        changedWhat: (parsed.evidenceChain && parsed.evidenceChain.changedWhat) || '',
        producedWhat: (parsed.evidenceChain && parsed.evidenceChain.producedWhat) || '',
        earnedWhat: (parsed.evidenceChain && parsed.evidenceChain.earnedWhat) || '',
        links: ['', '', ''],
        expectedEvidence: ['', '', '', ''],
        _draft: true
      }
    };
    return out;
  }

  function generateConfigDraft(input, aiConfig) {
    var msgs = buildDraftMessages(input);
    return callChat(aiConfig, msgs, { json: true, temperature: 0.7 }).then(function (txt) {
      var parsed;
      try {
        var m = txt.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : txt);
      } catch (e) {
        throw new Error('AI 返回的内容无法解析为配置（' + e.message + '）');
      }
      return mapDraft(parsed, input);
    });
  }

  /* ---------- 学员即时反馈（三段式）---------- */
  var SYSTEM_FEEDBACK =
    '你是学员的 AI 陪练。学员刚完成一次课后微行动打卡，写下一句话。请给一段有温度、具体、' +
    '能激励继续行动的反馈，严格按下面三段，用 ||| 分隔，不要编号、不要解释：\n' +
    '第一段＝具体认可：点出他这句话里真实做到的、具体的点（别空泛夸）。\n' +
    '第二段＝下一步小提示：结合他正在练的方法工具，给一个明天就能做的小动作。\n' +
    '第三段＝连回全局：说明这一步正在推动哪个业务指标/大目标，让他看到"树木之外的森林"。\n' +
    '每段不超过 40 字，口语、真诚。';

  function studentFeedback(note, ctx, aiConfig) {
    var user = '学员打卡：' + (note || '（未写内容）') + '\n' +
      '他正在练的行动：' + (ctx.taskTitle || '') + '\n' +
      '对应方法工具：' + (ctx.methodDesc || '（无）') + '\n' +
      '这一步推动的指标/目标：' + (ctx.metricLabel || '（无）') + '\n' +
      '所在场景挑战：' + (ctx.scenarioChallenge || '（无）');
    return callChat(aiConfig,
      [{ role: 'system', content: SYSTEM_FEEDBACK }, { role: 'user', content: user }],
      { temperature: 0.8 }
    ).then(function (txt) {
      var parts = txt.split('|||').map(function (s) { return s.trim(); });
      return {
        praise: parts[0] || txt,
        next: parts[1] || '',
        bigPic: parts[2] || ''
      };
    });
  }

  ALV2.ai = {
    callChat: callChat,
    generateConfigDraft: generateConfigDraft,
    studentFeedback: studentFeedback,
    mapDraft: mapDraft,
    _SYSTEM_DRAFT: SYSTEM_DRAFT,
    _SYSTEM_FEEDBACK: SYSTEM_FEEDBACK
  };
})(window);
