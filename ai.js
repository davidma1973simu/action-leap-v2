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
    '- scenarios：1~3 个真实工作场景，每个场景含 name（场景名）、challenge（学员在该场景下面临的具体挑战，大白话）、\n' +
    '  behaviors（学员要练的 8~10 条高绩效行为，其中恰好 2 条标记为 key（关键行为，需深度复盘），其余为 micro（微行为，30 秒可完成））、\n' +
    '  methods（1~2 个方法工具 name+desc）、metric（该场景要改善的绩效指标 label+target）。\n' +
    '- 每条 behavior 含：kind（"micro" 或 "key"）、scene（这条行为发生在哪个具体工作场景）、\n' +
    '  challenge（在该场景下学员面对的具体挑战）、action（学员要采取的具体行动/行为，大白话）、\n' +
    '  expectedResult（练成后预期带来的结果，一句话）。\n' +
    '- evidenceChain：spentWhat/changedWhat/producedWhat/earnedWhat 四句话，串起"培训投入→行为改变→业务产出→绩效贡献"。\n' +
    '约束：不要编造学员姓名；行为总数控制在 8~10 条（含 2 条 key）；语言口语、简洁、对甲方有用。\n' +
    'JSON 结构：\n' +
    '{"scenarios":[{"name":"","challenge":"","behaviors":[{"kind":"micro","scene":"","challenge":"","action":"","expectedResult":""}],"methods":[{"name":"","desc":""}],"metric":{"label":"","target":""}}],' +
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

  /* 把 LLM 返回的 JSON 映射成 ALV2 内部草稿结构（scenario.behaviors 六字段），并打 draft 标记 */
  function mapDraft(parsed, ctx) {
    ctx = ctx || {};
    function tag(obj) { obj._draft = true; return obj; }
    var scs = (parsed && parsed.scenarios) || [];
    var out = {
      scenarios: scs.map(function (sc) {
        return tag({
          id: ALV2.uid('scene'),
          name: sc.name || '',
          challenge: sc.challenge || '',
          methods: (sc.methods || []).map(function (m) {
            return tag({ id: ALV2.uid('method'), name: m.name || '', desc: m.desc || '' });
          }),
          behaviors: (sc.behaviors || []).map(function (b, i) {
            return tag({
              id: ALV2.uid('behavior'),
              kind: (b.kind === 'key') ? 'key' : 'micro',
              scene: b.scene || sc.name || '',
              challenge: (b.challenge != null ? b.challenge : (sc.challenge || '')),
              action: (b.action || b.desc || '') + '',
              expectedResult: b.expectedResult || '',
              order: i
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

  /* ---------- 学员即时反馈（内容感知 · 三段式）---------- */
  var SYSTEM_FEEDBACK =
    '你是学员的 AI 陪练。学员刚把课堂所学用到了一次真实工作场景里，并写下了"结果和影响"。' +
    '请基于他填写的具体内容（场景、挑战、他采取的行动、带来的结果）给一段有温度、具体的反馈，' +
    '严格按下面三段，用 ||| 分隔，不要编号、不要解释：\n' +
    '第一段＝具体认可：点出他这条记录里真实做到的、具体的点（别空泛夸，要呼应他写的场景与行动）。\n' +
    '第二段＝下一步小提示：结合他这一次的行动与遇到的困难，给一个明天就能做的小动作。\n' +
    '第三段＝连回全局：说明这一步正在推动哪个业务指标/大目标，让他看到"树木之外的森林"。\n' +
    '每段不超过 45 字，口语、真诚；若他填了"未来应用"，第二段可呼应先前规划。';

  /* ctx：{kind, scene, challenge, action, edited, resultImpact, difficulty, futureApplication, metricLabel} */
  function studentFeedback(ctx, aiConfig) {
    ctx = ctx || {};
    var user = '学员刚完成一次学习迁移行动。\n' +
      '行为类型：' + (ctx.kind === 'key' ? '关键行为（深度复盘）' : '微行为') + '\n' +
      '所在场景：' + (ctx.scene || '（未填）') + '\n' +
      '面对的挑战：' + (ctx.challenge || '（未填）') + '\n' +
      '他采取的行为：' + (ctx.action || '（未填）') + '\n' +
      (ctx.edited ? '（场景/挑战/行为是学员自己改写过的，更贴近他的真实工作）\n' : '') +
      '带来的结果和影响：' + (ctx.resultImpact || '（未填）') + '\n' +
      (ctx.difficulty ? '遇到的困难：' + ctx.difficulty + '\n' : '') +
      (ctx.futureApplication ? '未来打算怎么用：' + ctx.futureApplication + '\n' : '') +
      '这一步推动的指标/目标：' + (ctx.metricLabel || '（无）');
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

  /* ---------- 复盘辅助（讲师/HR 用）---------- */
  var SYSTEM_REVIEW =
    '你是企业培训的复盘教练。讲师/HR 要对学员的"学习迁移"做针对性复盘。' +
    '学员在真实工作里完成了若干高绩效行为，每条都带有：场景、挑战、他采取的行为、结果和影响、困难、未来应用。' +
    '请严格返回一个 JSON 对象，不要输出解释文字：\n' +
    '{\n' +
    '  "keyFeedback": [ {"behaviorId":"","text":"针对这条关键行为的具体复盘反馈（点出他真实做到/没做到的、结合他写的结果与困难）","rating":"A|B|C"} ],\n' +
    '  "microSummary": "对 8 条微行为的整体复盘（肯定共性亮点 + 1 条可改进的方向，口语、具体）"\n' +
    '}\n' +
    'keyFeedback 必须逐条对应传入的关键行为；微行为不逐条，只给整体复盘。语气专业、对甲方有用、不空泛。';

  /* reviewCtx：{keyBehaviors:[{behaviorId,scene,challenge,action,submission}], microSubmissions:[...], metricLabel} */
  function reviewAssist(reviewCtx, aiConfig) {
    reviewCtx = reviewCtx || {};
    var user = '课程指标/目标：' + (reviewCtx.metricLabel || '（无）') + '\n\n' +
      '【关键行为（逐条复盘）】\n' +
      (reviewCtx.keyBehaviors || []).map(function (kb, i) {
        var s = kb.submission || {};
        return (i + 1) + '. [' + kb.behaviorId + '] 场景：' + (kb.scene || '') +
          '；挑战：' + (kb.challenge || '') + '；行为：' + (kb.action || '') +
          '\n   学员结果和影响：' + (s.resultImpact || '（未填）') +
          (s.difficulty ? '；困难：' + s.difficulty : '') +
          (s.futureApplication ? '；未来应用：' + s.futureApplication : '') + '\n';
      }).join('\n') + '\n\n' +
      '【微行为（整体复盘，共 ' + (reviewCtx.microSubmissions || []).length + ' 条）】\n' +
      (reviewCtx.microSubmissions || []).map(function (s, i) {
        return '  · ' + (s.resultImpact || '（未填结果）');
      }).join('\n');
    return callChat(aiConfig,
      [{ role: 'system', content: SYSTEM_REVIEW }, { role: 'user', content: user }],
      { json: true, temperature: 0.5 }
    ).then(function (txt) {
      var parsed;
      try {
        var m = txt.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : txt);
      } catch (e) {
        throw new Error('AI 复盘返回无法解析：' + e.message);
      }
      return {
        keyFeedback: parsed.keyFeedback || [],
        microSummary: parsed.microSummary || ''
      };
    });
  }

  ALV2.ai = {
    callChat: callChat,
    generateConfigDraft: generateConfigDraft,
    studentFeedback: studentFeedback,
    reviewAssist: reviewAssist,
    mapDraft: mapDraft,
    _SYSTEM_DRAFT: SYSTEM_DRAFT,
    _SYSTEM_FEEDBACK: SYSTEM_FEEDBACK,
    _SYSTEM_REVIEW: SYSTEM_REVIEW
  };
})(window);
