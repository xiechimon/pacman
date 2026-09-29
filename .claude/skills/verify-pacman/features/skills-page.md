# 技能页(只读本地目录面)

用户在 server 机器的技能目录(验证栈 = `<RUN_DIR>/home/skills`,launch 已按 `PACMAN_SKILLS_DIR` 隔离)里放一个含 `SKILL.md` 的子目录,刷新 pacman 技能页(`/app/resources/skills`)就能看到它——没有导入动作、没有新建按钮。技能行可授予 Agent(`agent.skills[]` 存 skill id);删目录即删技能,页面无删除面。规格源:spec 13 资源面本地化(#367)。

## Sub-features

- `live-scan` 技能列表 = 每次 `GET /api/skills?teamId=` 现扫目录(无缓存不入库):放目录→刷新即现,删目录→刷新即消。
- `identity` 行身份 id = `SKILL.md` frontmatter `name`,无 frontmatter/无 name 回落目录名(2026-09-29 合同修订,对齐 spec 14);`name`/`description` 同取 frontmatter,缺省回落目录名/null。
- `read-only` 页面无 `.res-new` 新建钮、无导入路由(`/app/resources/skills/import` 重定向回 `/app`);空态文案指路技能目录(`~/.agents/skills` 缺省显示)。
- `agent-grant` Agent 行 `skills[]` 只认现扫已知 id:携带已删目录的旧 id 静默滤除,不报错。

## How to get to it (user POV)

- 侧栏「资源 → 技能」→ `/app/resources/skills`。
- 空态:scratch 技能目录为空时列表页即空态(文案含目录路径)。
- API 直证:`GET <api>/api/skills?teamId=<teamId>`。

## Driving it with playwright

Preconditions: `launch.mjs` 起栈(scratch 技能目录为空);从 `ports.json` 读 `skillsDir`/`serverPort`;teamId 经 `GET /api/teams` 取。

- 放一个技能目录 → 刷新技能页出现该行:
  `mkdir -p <skillsDir>/deploy && printf -- '---\nname: deployer\ndescription: 部署流程手册\n---\n# deploy\n' > <skillsDir>/deploy/SKILL.md`
  → 浏览器 reload `/app/resources/skills` → `.res-rowcard` 计数 1,行文本含 `deployer`(frontmatter name 优先于目录名 deploy)与描述。
- API 真值第二只眼:
  `curl -s <api>/api/skills?teamId=<teamId>` → `[{id:"deployer",name:"deployer",description:"部署流程手册",teamId:<teamId>}]`。
- 删目录 → 刷新即消:
  `rm -rf <skillsDir>/deploy` → reload → `.res-rowcard` 计数 0,空态 `.res-empty` 可见且文案含 `~/.agents/skills` 字样之外的**实际配置目录不显示**(空态 {dir} = 缺省常量显示位,见 Gotchas)。
- 只读面钉扎:
  `/app/resources/skills` 上 `.res-new` 计数 0;goto `/app/resources/skills/import` → URL 落 `/app`。
- 无 frontmatter 回落:
  `mkdir -p <skillsDir>/plain && echo '# plain' > <skillsDir>/plain/SKILL.md` → 行 id/name = `plain`,描述空。
- agent-grant 容忍(可选,API 面):
  `POST /api/teams/<teamId>/agents {displayName:"x",skills:["deployer","ghost"]}` → `GET agents/<id>` 的 `skills` = `["deployer"]`(ghost 静默滤除)。

## Gotchas

- **空态文案显示的是缺省路径常量 `~/.agents/skills`,不是 server 实际配置目录**——验证栈的 scratch 目录经 `PACMAN_SKILLS_DIR` 覆写,空态仍显示缺省值(web 侧 {dir} = shared SKILLS_DIR_DEFAULT 单源;env 覆写只在 server 生效)。别把这判成 bug,证据里注明即可。
- 大写敏感:`skill.md`(小写)不算技能(canon 名 `SKILL.md` 精确匹配,大小写不敏感文件系统上也强制精确)。
- 只扫一级子目录:`<skillsDir>/a/b/SKILL.md` 的 b 不会被发现;a 自带 SKILL.md 才收录 a。
- 符号链接目录收录且 realpath 去重(同一真实目录两个入口只出一条);双目录 frontmatter 声明同 name = 目录名字典序先者胜。
- 技能页排序钮/搜索行是纯前端面(fixture 与 live 同构),与数据源无关。
- 验证完把 scratch 技能目录清回空集再验空态(目录残留 = 空态永不出)。
