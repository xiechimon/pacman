// 派发技能注入的纯选择层（#1106）——selectSkillsForTask 契约。粗分发 = 规则
// 匹配（关键词/域分组起步，不引向量检索）：显式点名（任务文本报出已授予技能
// 的 id/name，精度最高）+ 域分组双信号（任务文本与技能 id/name/description
// 命中同一域的关键词）。第一失败方式 = 无关技能混进任务 brief（噪声回到
// 「全注入」的老病）；第二失败方式 = 零命中任务被当成故障（必须 [] 不抛）。
import { describe, expect, it } from 'vitest';
import { type SkillInjectCandidate, selectSkillsForTask } from '../src/index.js';

/** 20+ 技能的授予集（验收 1 的量级）：跨域各若干 + 明确无关若干。 */
const granted: SkillInjectCandidate[] = [
  {
    id: 'tdd',
    name: 'tdd',
    description: 'Test-driven development: red-green-refactor, integration tests',
  },
  {
    id: 'better-typography',
    name: 'better-typography',
    description: '产品 UI 排版工程：字号阶梯、字距、换行与截断',
  },
  {
    id: 'better-colors',
    name: 'better-colors',
    description: '颜色系统：ramp 生成、语义 token、对比度实测',
  },
  {
    id: 'diagnosing-bugs',
    name: 'diagnosing-bugs',
    description: 'Diagnosis loop for hard bugs and regressions',
  },
  { id: 'ask-matt', name: 'ask-matt', description: 'Ask which skill or flow fits your situation' },
  {
    id: 'great-resume',
    name: 'great-resume',
    description: '中文求职经历提升：岗位定位、简历要点、HR 开场白',
  },
  { id: 'offer', name: 'offer', description: '中文秋招求职进度管理：投递、筛选、面试进度表' },
  {
    id: 'kami',
    name: 'kami',
    description: '用 Kami 模板排版专业文档：简历、白皮书、信函，产出 PDF',
  },
  { id: 'interview', name: 'interview', description: '中文简历驱动的面试预测、模拟追问和复练技能' },
  { id: 'wiki', name: 'wiki', description: '个人知识沉淀库：存进 wiki、处理 inbox、体检 wiki' },
  { id: 'aihot', name: 'aihot', description: '查 AIHOT 中文 AI 资讯、热点、日报' },
  { id: 'archify', name: 'archify', description: '出架构/流程/时序/数据流/状态图，独立 HTML' },
  {
    id: 'job-apply',
    name: 'job-apply',
    description: '中文求职申请自动填写：读取简历逐项填写招聘网站',
  },
  { id: 'job-match', name: 'job-match', description: '中文岗位匹配分析：JD 对比简历、投递建议' },
  { id: 'evidence-recap', name: 'evidence-recap', description: '把 AI 编程对话复盘为九段证据链' },
  { id: 'project-guide', name: 'project-guide', description: '中文项目导学、源码课程与项目面经' },
  {
    id: 'writing-dna-skill',
    name: 'writing-dna-skill',
    description: '从完整文章蒸馏可复用写作 DNA',
  },
  { id: 'humanizer-zh', name: 'humanizer-zh', description: '编辑中文文章的空话与模板化表达' },
  { id: 'make-resume', name: 'make-resume', description: '中文可编辑简历制作：ASu 模板 HTML/PDF' },
  {
    id: 'scaffold-exercises',
    name: 'scaffold-exercises',
    description: '生成课程练习目录结构并通过 lint',
  },
  {
    id: 'contributor',
    name: 'contributor',
    description: 'GitHub 开源贡献辅助：发现项目、准备 PR、跟踪 CI',
  },
];

describe('零命中（第一出口：[] 不抛，零注入不是故障）', () => {
  it('空任务文本 / 空白 = 零命中', () => {
    expect(selectSkillsForTask('', granted)).toEqual([]);
    expect(selectSkillsForTask('   \n\t ', granted)).toEqual([]);
  });
  it('候选集为空 = 零命中', () => {
    expect(selectSkillsForTask('给登录页补 e2e 测试', [])).toEqual([]);
  });
  it('文本与任何授予技能既不同域也无点名 = 零命中', () => {
    expect(selectSkillsForTask('把首页轮播图换成静态图', granted)).toEqual([]);
  });
  it('description 为 null 的技能不炸、不因空描述误配', () => {
    expect(
      selectSkillsForTask('修一个 bug', [{ id: 'bare', name: 'bare', description: null }]),
    ).toEqual([]);
  });
});

describe('显式点名（精度最高，优先于域规则）', () => {
  it('任务文本报出技能 id/name = 命中该技能', () => {
    const hits = selectSkillsForTask('用 tdd 技能给购物车模块补测试', granted);
    expect(hits.map((h) => h.id)).toContain('tdd');
    const tdd = hits.find((h) => h.id === 'tdd');
    expect(tdd?.rule).toBe('explicit-mention');
    expect(tdd?.reason).toContain('tdd');
  });
  it('中文名同样命中（含 frontmatter name 为中文的技能）', () => {
    const zh = [{ id: 's1', name: '周报助手', description: '帮你写周报' }];
    const hits = selectSkillsForTask('喊周报助手出来写一下本周周报', zh);
    expect(hits.map((h) => h.id)).toEqual(['s1']);
    expect(hits[0]?.rule).toBe('explicit-mention');
  });
  it('单字名不参与点名（防单字误配，#823 同律）', () => {
    const one = [{ id: 'x', name: 'x', description: '占位' }];
    expect(selectSkillsForTask('x 是什么', one)).toEqual([]);
  });
  it('点名未授予的名字不命中（不编造，授予集是候选边界）', () => {
    expect(selectSkillsForTask('用 pdf-polish 排一下版', granted).map((h) => h.id)).not.toContain(
      'pdf-polish',
    );
  });
});

describe('域分组双信号（任务与技能命中同一域）', () => {
  it('前端域任务 = 前端域技能注入，求职/知识库等无关技能零注入', () => {
    const hits = selectSkillsForTask('修复看板卡片的字号过小与换行溢出问题', granted);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('better-typography');
    // 域粒度 = 同域技能都进（better-colors 是前端域：颜色/对比度）——
    // 「无关」的裁决单位是域，不是技能内子主题。
    expect(ids).toContain('better-colors');
    for (const id of ['great-resume', 'offer', 'wiki', 'interview', 'job-apply', 'aihot']) {
      expect(ids).not.toContain(id);
    }
    const typo = hits.find((h) => h.id === 'better-typography');
    expect(typo?.rule).toBe('domain');
    expect(typo?.reason).toContain('前端');
    expect(typo?.reason).toContain('字号');
  });
  it('英文任务文本同样走域匹配（token 级，子串不算）', () => {
    const hits = selectSkillsForTask('Add vitest coverage for the claim API endpoint', granted);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('tdd');
    expect(ids).not.toContain('better-typography');
    // contest 之类子串不得当 test 命中：这里借 skill id 名确保 token 匹配不误配。
    expect(
      selectSkillsForTask('run the contest', [
        { id: 'tdd', name: 'tdd', description: 'Test-driven development' },
      ]),
    ).toEqual([]);
  });
  it('测试域中文任务（验收 1 同形）', () => {
    const hits = selectSkillsForTask('给购物车结算流程补单测与回归断言', granted);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('tdd');
    expect(ids).not.toContain('ask-matt');
  });
  it('多域命中 = 并集（任务跨域时各域技能都注入）', () => {
    const hits = selectSkillsForTask('给部署脚本补安全扫描的单元测试', granted);
    const ids = hits.map((h) => h.id);
    expect(ids).toContain('tdd');
    expect(ids).toContain('contributor');
  });
});

describe('输出形状（确定性 + 可解释）', () => {
  it('确定性：同输入两次调用逐字节等价，按 id 字典序', () => {
    const a = selectSkillsForTask('用 tdd 给字号问题补测试', granted);
    const b = selectSkillsForTask('用 tdd 给字号问题补测试', granted);
    expect(a).toEqual(b);
    const ids = a.map((h) => h.id);
    expect([...ids].sort((x, y) => x.localeCompare(y))).toEqual(ids);
  });
  it('同一技能只出一条（显式点名优先于域，不重复）', () => {
    const hits = selectSkillsForTask('用 tdd 技能给购物车模块补单元测试', granted);
    expect(hits.filter((h) => h.id === 'tdd').length).toBe(1);
  });
  it('每条命中都带规则与 reason（验收 4：至少规则命中原因一条）', () => {
    const hits = selectSkillsForTask('修复看板卡片的字号过小', granted);
    for (const h of hits) {
      expect(['explicit-mention', 'domain']).toContain(h.rule);
      expect(h.reason.length).toBeGreaterThan(0);
    }
  });
  it('全半角标点/大小写归一后同样命中（NFKC 同律）', () => {
    expect(selectSkillsForTask('修复看板卡片的字号过小', granted).map((h) => h.id)).toEqual(
      selectSkillsForTask('修复看板卡片（字号）过小！！', granted).map((h) => h.id),
    );
    expect(selectSkillsForTask('Add Vitest Coverage', granted).map((h) => h.id)).toEqual(
      selectSkillsForTask('add VITEST coverage', granted).map((h) => h.id),
    );
  });
});

describe('20+ 技能噪声闸（票面验收 1 的负例清单）', () => {
  it('求职/知识库/导学族技能在任何工程任务里零注入', () => {
    const engineering = [
      '重构 dispatch 模块并补 vitest 覆盖',
      '修复 claim 端点报错：404 排查',
      '给按钮组件加动效与暗色适配',
    ];
    for (const text of engineering) {
      const ids = selectSkillsForTask(text, granted).map((h) => h.id);
      for (const id of [
        'great-resume',
        'offer',
        'interview',
        'job-apply',
        'job-match',
        'make-resume',
        'wiki',
        'aihot',
        'project-guide',
        'evidence-recap',
        'writing-dna-skill',
        'humanizer-zh',
      ]) {
        expect(ids).not.toContain(id);
      }
    }
  });
});
