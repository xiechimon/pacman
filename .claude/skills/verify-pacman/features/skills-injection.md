# skills 执行面注入(daemon)

daemon 每次创建 agent 会话前扫描 `PACMAN_SKILLS_DIR`(缺省 `~/.agents/skills`),把 `<available_skills>` catalog(name + description + location XML)追加到 session systemPrompt 末尾(不覆盖既有段);agent 按 description 匹配时用内建 `read` 工具经 location 绝对路径按需读 SKILL.md 全文。catalog 是索引不全文——token 预算与 skills 数量线性,与 skills 总长度无关(#371,spec 14)。

**daemon 侧行为,无 web UI 面**(spec 14:web 无改动)——验证走 integration 真栈(server + 真 daemon + 真 pi 会话 + stub LLM 捕获),不走 launch.mjs UI 探针。

## Sub-features

- `skills-catalog-inject` 会话 systemPrompt 末尾追加 catalog XML;既有段(agent 职责/记忆)保留——追加非覆盖。
- `skills-read-through` catalog location = SKILL.md 绝对路径;agent `read` 该路径不被拒(连通性硬验收——catalog 不能是装饰品)。
- `skills-dir-env` `PACMAN_SKILLS_DIR` 覆写扫描根;缺省 `~/.agents/skills`;目录缺失/为空 = 空 catalog,非致命。
- `skills-cap` catalog 总数 > 50 截顶;单 description > 200 字符截断 + `…`;两者各落 cap 日志。
- `skills-log` `[skills] <type>: <msg>` 行族落 daemon.log(type ∈ loaded / collision / invalid-frontmatter / missing-skill-md / cap / invalid)。

## How to get to it (user POV)

- 用户把 skills 放 `~/.agents/skills/<name>/SKILL.md`(frontmatter `name` + `description`;缺 name 回落目录名)→ daemon 起来后派任何任务 → agent 会话自动带 catalog,按需 read。
- 自托管:`PACMAN_SKILLS_DIR=/path/to/other` 启动 daemon,从那处加载。
- UI 可配性(account 页输入框)= 后票,当前无入口。

## Driving it with integration harness

Preconditions:

- worktree 已 `pnpm install`;integration 面无固定端口(全 ephemeral),与其它车道无端口冲突。

- **canonical 探针(真 daemon + 真 pi 会话 + stub LLM 捕获)。** Run `cd integration && pnpm exec vitest run test/skills-inject-e2e.test.ts`。链路:fixture skills 目录(单 skill 带正文 marker)→ `loadDaemonConfig({skillsDir})` → `runMachine` 真 daemon → seed 任务派工 → 断言三件套:① stub 捕获的 LLM 请求 messages 含 `<available_skills>` + `<name>demo-skill</name>` + location 绝对路径 + 既有职责文本(追加不覆盖);② stub 第一轮发 `read` toolCall 指向 SKILL.md → 工具结果(正文 marker)经 relay 落库 message 表(连通性实证);③ daemon.log 落 `[skills] loaded: 1 skills from` 行。
- **单元面(五输入态 + cap 双闸 + 日志行族)。** Run `cd apps/daemon && pnpm exec vitest run test/skills-catalog.test.ts test/config-state.test.ts`。覆盖:目录不存在 / 空目录 / 无 SKILL.md / 正常 skill / frontmatter 缺 name 回落 / name 碰撞 winner 裁决 / 51 skills 截顶 / 250 字符 description 截断 / `PACMAN_SKILLS_DIR` 优先级(显式 > env > 默认)。

## Gotchas

- **read 工具无沙箱是 pi 事实**:pi 0.86 的 `read` 工具解析任意绝对路径(`resolveReadPathAsync`),daemon 侧不存在路径白名单——「白名单扩 skillsDir」不需要改码,连通性由 ② 的落库断言实证。别去找不存在的 allowlist 缝。
- **每次会话创建重扫**:catalog 无缓存无 watcher,daemon 不重启也会话会话之间生效;改 SKILL.md 后派新任务即可见。
- **开发机默认目录是真数据**:缺省 `~/.agents/skills` 在本机存在且 >50 skills——integration 其它用例(m3a/m4b)跑在默认 skillsDir 上会真注入 catalog(cap 截顶),containment 断言不受影响,但 daemon.log 会出现 `[skills] cap:` 行,不是 bug。
- **`disable-model-invocation: true` 的 skill 不入 catalog**(pi `formatSkillsForPrompt` 过滤)——只能 `/skill:` 明面触发,按需读通路对它不适用。
- machine-loop 测试注入 `opts.backend` 时不走 PiBackend → 无 skills 注入;要验注入必须走 `createPiBackend` 真路径(integration harness 即此形态)。
