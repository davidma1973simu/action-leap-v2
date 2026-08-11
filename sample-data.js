/* ============================================================
 * Action Leap V2 · 不可删示范样例（松下电机 · 战略执行沙盘）
 * 全链路：1 场景 + 10 高绩效行为（8 微 + 2 关，每条带六字段） + 方法工具 + 绩效指标 + 证据链
 * 这门课用于"看样例"与新手引导，locked=true，删不掉、改不了；
 * 「复制为我的课程」可一键克隆成可编辑副本。
 * 学员提交记录（submissions）由 index.html 的注入逻辑调用 buildSubmissions 生成。
 * ============================================================ */
(function (global) {
  'use strict';
  var SAMPLE_SKU = '松下电机_战略执行沙盘班_v1';

  function build() {
    return {
      sku: SAMPLE_SKU,
      client: '松下电机（中国）',
      cohort: '战略执行沙盘班',
      theme: '战略执行与全局经营沙盘模拟',
      needs: '建立商业全局观，清晰组织战略构建与价值创造过程，做出高质量商业决策，跨部门协同构建执行方案并建立评价体系优化迭代。财务与经营业务分析。最终承担更大商业结果性目标的能力。',
      note: '松下电机中国公司 · 中层管理者后备经理 · 战略执行与全局经营沙盘模拟',
      rhythm: {
        windowWorkdays: 15,
        totalActions: 10,
        microCount: 8,
        keyCount: 2,
        keySlots: [2, 10],
        freeDays: [4, 7, 9, 12, 14],
        startMode: 'cohort',
        startOffsetDays: -7,   // 相对今天往前 7 天，使示范课自带三周窗口内的真实迁移历史
        skipWeekend: true
      },
      aiConfig: { provider: 'openai-compatible', baseURL: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
      sample: { isSample: true, locked: true, cloneFrom: '' },
      scenarios: [
        {
          id: 's1',
          name: '年度业务规划与关键任务会议',
          challenge: '各部门各说各话、目标与资源脱节，战略难以落地。',
          methods: [
            {
              id: 'm1',
              name: '战略规划的全局流程',
              desc: '将战略从洞察到执行落地的端到端方法，贯穿六环节。',
              steps: ['准备事实 / 假设 / 未知三类信息', '制定三年量化战略目标', '将目标落实到职能·任务·产出·资源·责任人', '规划未来三年现金流与销售目标', '跨部门协同确认关键人物与依赖', '建立过程性评估指标'],
              output: '一份可执行的战略规划与执行计划书',
              supports: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10']
            }
          ],
          behaviors: [
            /* —— 8 条微行为（30 秒，场景/挑战/行动由讲师预设，学员锁定只填结果） —— */
            { id: 'b1', kind: 'micro', order: 0,
              scene: '会议准备区', challenge: '决策常凭感觉、拿不准依据',
              action: '每次重大决策前，先列一张「事实 / 假设 / 未知」三类信息清单',
              expectedResult: '决策有据可依，汇报时底气更足' },
            { id: 'b2', kind: 'micro', order: 1,
              scene: '战略工作坊', challenge: '战略目标写得很空、没法衡量',
              action: '为每条战略写下至少一个三年量化数字（如市场份额 +3pp）',
              expectedResult: '目标可衡量、可追踪' },
            { id: 'b3', kind: 'micro', order: 2,
              scene: '办公桌', challenge: '战略落地时责任不清、互相推',
              action: '给每个战略目标配一张「职能 · 任务 · 产出 · 资源 · 责任人」拆解表',
              expectedResult: '责任到人，执行有人盯' },
            { id: 'b4', kind: 'micro', order: 3,
              scene: '财务部对齐会', challenge: '只看年终结果、过程黑箱',
              action: '每季度更新一次三年现金流与销售测算表',
              expectedResult: '财务节奏可预期，提前预警' },
            { id: 'b5', kind: 'micro', order: 4,
              scene: '周协同会', challenge: '跨部门依赖卡住没人跟',
              action: '每周与一个协同部门确认一次关键依赖与责任人',
              expectedResult: '依赖透明，卡点早发现' },
            { id: 'b6', kind: 'micro', order: 5,
              scene: '月度经营会', challenge: '缺乏领先指标，出事才发现',
              action: '为一项关键任务设一个领先指标（而非只看结果）',
              expectedResult: '过程可管理，问题早干预' },
            { id: 'b7', kind: 'micro', order: 6,
              scene: '会议前', challenge: '汇报没重点、听的人累',
              action: '用「结论 — 依据 — 请求」三段式汇报',
              expectedResult: '沟通高效，决策快' },
            { id: 'b8', kind: 'micro', order: 7,
              scene: '复盘会', challenge: '同样的坑反复踩',
              action: '每次踩坑后写一条「根因 + 对策」便签',
              expectedResult: '不再重复踩坑，经验沉淀' },
            /* —— 2 条关键行为（≤5 分钟，场景/挑战/行动学员可改写，填完整六字段） —— */
            { id: 'b9', kind: 'key', order: 8,
              scene: '年度业务规划会议', challenge: '各部门各说各话、目标与资源脱节，战略难以落地',
              action: '用「战略规划的全局流程」六步，独立完成本业务单元的战略规划与执行计划书',
              expectedResult: '产出可落地的战略方案，被高层直接看见' },
            { id: 'b10', kind: 'key', order: 9,
              scene: '跨部门协同推进会', challenge: '关键协同节点卡住、无人牵头',
              action: '牵头拉通 3 个部门，用一张「依赖 — 责任人 — 时限」表推动卡点解决',
              expectedResult: '卡点清零、协同闭环，拿到可复盘的结果' }
          ],
          metric: {
            name: '战略执行计划完成度',
            label: '战略执行计划完成度',
            baseline: '首期试点，训前自评 55 分',
            target: '100% 完成战略目标的六步拆解与执行计划书（自评 ≥ 90 分）',
            desc: '衡量学员能否独立产出可落地的战略与执行方案。',
            unit: '分',
            caliber: '学员所在业务单元对「战略→执行」闭环质量的自评（0–100 分）',
            series: [
              { label: '训前基线', value: 55, note: '试点前自评' },
              { label: '第 2 周', value: 68, note: '' },
              { label: '第 4 周', value: 82, note: '' },
              { label: '第 8 周', value: 93, note: '达成目标' }
            ]
          }
        }
      ],
      evidenceChain: {
        spentWhat: '战略执行和全局经营沙盘模拟（2天高强度沙盘演练），覆盖战略从制定到拆解到财务规划到跨部门协同的全流程。',
        changedWhat: '10 个高绩效行为被学员在实际工作中采用——从"拍脑袋定战略"变为用事实信息支撑判断、从"各自为政"变为主动跨部门确认依赖关系。',
        producedWhat: '年度规划会议产出了完整的、可执行的战略规划与执行计划书（含三年现金流、跨部门责任人、过程评估指标），不再是空泛的方向性口号。',
        earnedWhat: '这批后备经理具备了承担更大商业结果性目标的能力——他们不再只是"听懂了战略"，而是能独立带领团队完成从战略到执行的全链条工作。',
        links: [
          '沙盘模拟在低风险环境中让学员反复演练战略制定的完整流程，肌肉记忆形成后自然迁移到真实工作场景。',
          '10 个行为直接对应规划会议中的关键动作（准备信息→设定目标→拆解落实→财务规划→协同确认→过程评估），每一步都有明确的场景触发点。',
          '当所有行为在会议中被系统性地执行，产出的自然是一份可落地的战略方案——这不是额外的工作量，而是更高效的做事方式。'
        ],
        expectedEvidence: [
          '学员完成沙盘模拟训练并产出练习方案（课堂产物）',
          '10 个行为在年度规划会议中被实际采用（观察记录 / 学员提交）',
          '会议产出可执行的战略规划与执行计划书（文档证据）',
          '学员未来能独立承担更大商业结果性目标（后续晋升 / 项目任命等客观事实）'
        ]
      },
      consensus: { status: 'live', approver: '培训负责人', approvedAt: '2026-08-11' },
      createdAt: '2026-08-11T00:00:00.000Z'
    };
  }

  function students() {
    return [
      { id: 's_a', name: '陈一航', profile: 'persist' },
      { id: 's_b', name: '林晓楠', profile: 'wave' },
      { id: 's_c', name: '王志远', profile: 'slow' },
      { id: 's_d', name: '赵敏', profile: 'lead' },
      { id: 's_e', name: '周文博', profile: 'observe' }
    ];
  }

  /* 为某个学员生成 10 条提交记录（围绕 sample 行为）。profile 仅用于让文案略有差异，制造真实感。 */
  function buildSubmissions(course, student) {
    var sc = (course.scenarios || [])[0];
    if (!sc) return [];
    var beh = sc.behaviors || [];
    var results = {
      b1: ['周会上一个并购议题，我先甩出三类信息清单，老板当场说"这次有依据了"。', '把季度预算争议拆成事实/假设/未知，争论一下就收敛了。'],
      b2: ['给"提升区域覆盖"写死三年数字：覆盖城市 +8、份额 +3pp。', '把品牌目标量化成"认知度 60→75"，团队知道往哪使劲。'],
      b3: ['给新业务线做了拆解表，老板一眼看到谁负责什么。', '战略会前把三张目标拆成责任人表，没人再踢皮球。'],
      b4: ['拉了三年现金流测算，发现 Q3 会有缺口，提前做了预案。', '季度更新销售测算，被财务夸"终于能对上了"。'],
      b5: ['这周和供应链对齐了一次依赖，卡了两周的料终于动了。', '和研发约了周同步，关键路径不再黑箱。'],
      b6: ['给新品上市设了"首周试用率"领先指标，提前两周发现苗头不对。', '设了过程指标后，月度会不再只盯结果救火。'],
      b7: ['用三段式汇报，5 分钟拿下审批，以前要扯半小时。', '结论先行后，跨部门会议效率明显高。'],
      b8: ['复盘会记了一条"根因=接口定义不清"，这周类似问题直接套对策。', '踩坑便签攒了一沓，团队开始主动防。'],
      b9: ['独立用六步写出了本单元战略计划书，高层会上点了名。', '把沙盘里的全局流程搬进真实规划，方案一次过评审。'],
      b10: ['拉通研发/供应链/销售，用依赖表把三个卡点全清零。', '牵头推了一次跨部协同，老板说"这才是经营者"。']
    };
    var diff = {
      b9: '六步里"跨部门确认"最费劲，得一个个去磨。',
      b10: '有个部门一直不回话，最后请老板出面才推动。'
    };
    var future = {
      b9: '下季度把这套流程复用到子公司的规划里。',
      b10: '把依赖表做成例会固定动作，长期固化。'
    };
    var out = [];
    beh.forEach(function (b, i) {
      var arr = results[b.id] || ['（示例）把课堂方法用到了真实工作里。'];
      var pick = arr[student.profile === 'wave' ? (i % arr.length) : 0] || arr[0];
      var sub = {
        behaviorId: b.id,
        scene: b.scene,
        challenge: b.challenge,
        action: b.action,
        edited: false,
        resultImpact: pick,
        difficulty: diff[b.id] || '',
        futureApplication: future[b.id] || '',
        ts: Date.now() - (12 - i) * 86400000
      };
      out.push(sub);
    });
    return out;
  }

  /* 一份示范复盘（供桌面 P3 直接展示）—— 针对学员 s_a 的两条关键行为 + 微行为整体 */
  function sampleReview() {
    return {
      keyFeedback: {
        b9: { text: '你独立用六步写出了本单元战略计划书，并且在高层会上被点名——这说明你已能把沙盘里练的全局流程真正落地。下一步可把"跨部门确认"这步前置，别等写完了才去磨。', rating: 'A' },
        b10: { text: '你牵头拉通三个部门、用依赖表清零卡点，这正是经营者该有的主动。唯一可改进：有个部门不回话时，别等到最后一刻才请老板出面，可更早升级。', rating: 'B' }
      },
      microSummary: '8 条微行为整体完成度高，尤其"事实/假设/未知清单"和"三段式汇报"已变成你的自然反应，沟通效率提升明显。可改进方向：财务测算（b4）目前偏被动，建议把它从"季度"往前移到"月度跟踪"。',
      overall: { A: 9, B: 8, C: 6, feedback: '战略落地能力强；跨部门协同主动；财务节奏感待加强' }
    };
  }

  global.ALV2_SAMPLE = {
    SAMPLE_SKU: SAMPLE_SKU,
    build: build,
    students: students,
    buildSubmissions: buildSubmissions,
    sampleReview: sampleReview
  };
})(window);
