// Agent 详情编辑面（#485，r3 §4 实测形态）：团队页点 Agent 卡进
// `/app/resources/agents/<id>?name=<名>`，三 tab 概览 / 记忆 / 权限。
//
// 为什么详情页不骑 members 读面：团队页的 `GET members` 投影出的是展示用
// TeamAgentCard（只有 displayName/model/role），职责、provider、权限四组都
// 不在其中；编辑面要的是全记录，故直取 `GET agents/{aid}`（r3 §4 词表内，
// 与 PATCH 同路径）。
//
// 数据面纪律与仓内其它 resource 页同律：`live ? 查询真值 : fixture 记录`
// （两组形状同源 = shared AgentRecord），fixture 面无后端，提交落本地覆盖
// 记录承载「提交后回显」——live 面则是 S8 律（mutation → invalidateAll 重取）。
//
// 本面明确不做的三件（均因证据/结构缺口，不发明）：
// · `创建于 …` 状态行——AgentRecord 与 DB agent 表都无 createdAt 列；
// · 思考强度选择器——全仓唯一档位枚举在 daemon（pi 七档），无 server/web
//   暴露面，跨缝复制常量等于把 daemon 的私有词表冻进 web；故作只读值行；
// · 删除 Agent——无 DELETE 端点，且原版二次确认文案未观测，不凭空造破坏性面。

import {
  AGENT_PERMISSION_COPY,
  AGENT_TOOL_COPY,
  AGENT_TOOL_SWITCHES,
  type AgentRecord,
  MEMORY_EMPTY_COPY,
  type PatchAgentBody,
} from '@pacman/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import {
  useAgent,
  useApiMutations,
  useMcpServers,
  useMemories,
  useModelSources,
  useProviders,
  useSecrets,
  useSkills,
} from '../api/hooks.js';
import { RUNTIME_LABELS, toChiefModelOptions } from '../api/mappers.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { Switch } from '../components/ui/switch.js';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.js';
import { resolveScenario } from '../fixtures/scenario.js';
import { useI18n } from '../i18n/provider.js';
import { ResourceShell } from '../resources/shell.js';
import { Avatar } from '../ui/avatar.js';
import './agent-detail.css';
import { AgentModelSelect } from './agent-model-select.js';

/** 资源族根路径（非侧栏行——原版命令面板「前往」清单里没有 Agents 行，
 *  r2 §8.4；本面只从团队页的卡进入）。 */
export const AGENTS_HREF = '/app/resources/agents';

type AgentTab = 'overview' | 'memory' | 'permissions';

/** 内置 runtime 的显示值（原版实测原文，Agent 详情概览的「运行时」行）。 */
const BUILTIN_RUNTIME_LABEL = '内置 (pi)';

const TAB_LABELS: { id: AgentTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'memory', label: '记忆' },
  { id: 'permissions', label: '权限' },
];

export function AgentDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const { search } = useLocation();
  const fixture = resolveScenario(new URLSearchParams(search));
  const { live, teamId } = useLiveData();

  const agentQ = useAgent(teamId, agentId, live);
  const memoriesQ = useMemories(teamId, agentId, live);
  const providersQ = useProviders(teamId, live);
  const modelSourcesQ = useModelSources(teamId, live);
  const skillsQ = useSkills(teamId, live);
  const secretsQ = useSecrets(teamId, live);
  const mcpQ = useMcpServers(teamId, live);
  const mutations = useApiMutations(teamId);

  const [tab, setTab] = useState<AgentTab>('overview');
  // fixture 面没有后端：本地覆盖记录承载「提交后回显」（live 面恒空，走
  // invalidateAll 重取）。字段语义与 patchAgent body 同。
  const [localPatch, setLocalPatch] = useState<Partial<AgentRecord>>({});
  /** fixture 面的记忆删除：没有 DELETE 后端，落本地已删集（live 面恒空）。 */
  const [removedMemories, setRemovedMemories] = useState<string[]>([]);

  const fixtureAgent = fixture.agents?.find((row) => row.id === agentId);
  const source = live ? agentQ.data : fixtureAgent;
  const agent: AgentRecord | undefined =
    source === undefined ? undefined : { ...source, ...localPatch };

  const patch = useCallback(
    (body: PatchAgentBody) => {
      if (agentId === undefined) return;
      if (live) {
        mutations.patchAgent.mutate({ id: agentId, body });
      } else {
        setLocalPatch((prev) => ({ ...prev, ...body }));
      }
    },
    [agentId, live, mutations.patchAgent],
  );

  // 模型候选：live = providers ∪ model-sources 真值；fixture = 场景行集。
  // 投影单源 = toChiefModelOptions（与总管压缩模型选择器同一份）。
  const modelOptions = live
    ? toChiefModelOptions(providersQ.data?.providers ?? [], modelSourcesQ.data?.sources ?? [])
    : toChiefModelOptions(
        fixture.resources?.providers ?? [],
        fixture.resources?.providerSources ?? [],
      );

  // 技能候选：live 的 SkillRecord.id 与 fixture SkillRow.name 同值域
  // （skillRecordSchema：id = frontmatter name 回落目录名）。
  const skillOptions = live
    ? (skillsQ.data ?? []).map((row) => ({ id: row.id, name: row.name }))
    : (fixture.resources?.skills ?? []).map((row) => ({ id: row.name, name: row.name }));

  const memories = (live ? (memoriesQ.data ?? []) : (fixture.resources?.memories ?? [])).filter(
    (row) => row.agentId === agentId && !removedMemories.includes(row.id),
  );

  const secretOptions = live
    ? (secretsQ.data ?? []).map((row) => ({ id: row.id, name: row.name }))
    : (fixture.resources?.secrets ?? []).map((row) => ({ id: row.id, name: row.name }));
  const mcpOptions = live
    ? (mcpQ.data ?? []).map((row) => ({ id: row.id, name: row.label }))
    : (fixture.resources?.mcpServers ?? []).map((row) => ({ id: row.name, name: row.name }));

  if (agent === undefined) {
    return (
      <ResourceShell
        title={t('Agent')}
        href={AGENTS_HREF}
        backHref="/app/team"
        hideNew
        fixture={fixture}
      >
        <div className="agent-detail">
          <p className="agent-missing">{t('找不到该 Agent。它可能已被删除。')}</p>
        </div>
      </ResourceShell>
    );
  }

  const toggleTool = (label: string, on: boolean) => {
    const next = on
      ? [...agent.tools, label].filter((v, i, all) => all.indexOf(v) === i)
      : agent.tools.filter((v) => v !== label);
    patch({ tools: next });
  };
  /** 团队密钥是**全有全无**（#510；实测原版：密钥在场时权限 tab 仍是一行聚合
   *  开关，不展开逐个密钥行）：开 = 写回团队全部密钥 id，关 = 空集。 */
  const toggleAllSecrets = (on: boolean) => {
    patch({ secrets: on ? secretOptions.map((secret) => secret.id) : [] });
  };
  const toggleMcp = (id: string, on: boolean) => {
    const next = on ? [...agent.mcpServers, id] : agent.mcpServers.filter((v) => v !== id);
    patch({ mcpServers: next });
  };

  const defaultSkill = agent.skills[0] ?? null;
  const runtimeLabel =
    agent.provider == null || agent.provider === 'pi'
      ? t(BUILTIN_RUNTIME_LABEL)
      : agent.provider === 'claude-code'
        ? RUNTIME_LABELS['claude-code']
        : agent.provider;

  return (
    <ResourceShell
      title={agent.displayName}
      href={AGENTS_HREF}
      backHref="/app/team"
      hideNew
      fixture={fixture}
    >
      <div className="agent-detail">
        <Tabs value={tab} onValueChange={(value) => setTab(value as AgentTab)}>
          <TabsList variant="line" className="agent-tabs" aria-label={t('Agent')}>
            {TAB_LABELS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="agent-tab">
                {t(item.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab === 'overview' && (
          <div className="agent-overview">
            <div className="agent-head">
              <Avatar
                name={agent.displayName}
                src={agent.avatarUrl}
                fallback="/avatar-robot-1.svg"
              />
            </div>
            <NameRow value={agent.displayName} onCommit={(displayName) => patch({ displayName })} />
            <RoleRow value={agent.description} onCommit={(description) => patch({ description })} />
            <div className="agent-field">
              <div className="agent-field-head">
                <span className="agent-field-label">{t('默认 skill')}</span>
              </div>
              <select
                className="agent-skill-select"
                value={defaultSkill ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  patch({ skills: value === '' ? [] : [value] });
                }}
              >
                <option value="">{t('未设置')}</option>
                {skillOptions.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
              <p className="agent-field-hint">{t(AGENT_PERMISSION_COPY.defaultSkill)}</p>
            </div>
            <div className="agent-field">
              {/* 运行时（原版概览在模型之上有这一档，实测值形如 `内置 (pi)`）。
                  本仓 wire 没有独立 runtime 字段——它就是 provider 位：null/pi
                  = 内置 pi runtime，claude-code = 本机 Claude Code，其余 =
                  custom provider 的 id。故只读呈现：做成选择器要落 provider
                  槽并与下面的模型选择器耦合（换 runtime 得同时改或清 modelId），
                  且原版「内置」文案在本仓没有对应物——语义裁决见 #499。 */}
              <span className="agent-field-label">{t('运行时')}</span>
              <span className="agent-runtime">{runtimeLabel}</span>
            </div>
            <div className="agent-field">
              <div className="agent-field-head">
                <span className="agent-field-label">{t('模型')}</span>
              </div>
              <AgentModelSelect
                value={
                  agent.provider != null && agent.modelId != null
                    ? { provider: agent.provider, modelId: agent.modelId }
                    : null
                }
                options={modelOptions}
                onPick={(next) =>
                  patch(
                    next === null
                      ? { provider: null, modelId: null }
                      : { provider: next.provider, modelId: next.modelId },
                  )
                }
                prefix="agent-model"
              />
            </div>
            <div className="agent-field">
              <span className="agent-field-label">{t('思考强度')}</span>
              <span className="agent-thinking">{agent.thinkingLevel ?? t('默认')}</span>
            </div>
            <div className="agent-field">
              <span className="agent-field-label">{t('状态')}</span>
              <span className="agent-status">{agent.status}</span>
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div className="agent-memories">
            {/* 空态文案 = shared MEMORY_EMPTY_COPY（02 §4.4/r5 §6 canon，总管
                设置记忆 tab 同文），经 t() 消费、不作字面量出现。 */}
            {memories.length === 0 ? (
              <p className="agent-memory-empty">{t(MEMORY_EMPTY_COPY)}</p>
            ) : (
              memories.map((memory) => (
                <div key={memory.id} className="agent-memory-row">
                  <span className="agent-memory-text">
                    <span className="agent-memory-title">{memory.title}</span>
                    <span className="agent-memory-content">{memory.content}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="agent-memory-del"
                    onClick={() => {
                      if (agentId === undefined) return;
                      if (live) mutations.deleteMemory.mutate({ agentId, memoryId: memory.id });
                      else setRemovedMemories((prev) => [...prev, memory.id]);
                    }}
                  >
                    {t('删除')}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'permissions' && (
          <div className="agent-perms">
            <section className="agent-perm-group">
              <h3 className="agent-perm-title">{t('工具')}</h3>
              {AGENT_TOOL_SWITCHES.map((label) => (
                <div key={label} className="agent-perm-row">
                  <span className="agent-perm-text">
                    <span className="agent-perm-name">{t(label)}</span>
                    {/* 六档各带说明副文案（AGENT_TOOL_COPY 单源；原文实测自
                        参考产品的权限 tab，r3 §4 那份清单只记了远程 shell）。 */}
                    <span className="agent-perm-hint">{t(AGENT_TOOL_COPY[label])}</span>
                  </span>
                  <Switch
                    className="agent-tool-switch"
                    aria-label={t(label)}
                    checked={agent.tools.includes(label)}
                    onCheckedChange={(checked) => toggleTool(label, checked)}
                  />
                </div>
              ))}
            </section>

            <section className="agent-perm-group">
              <h3 className="agent-perm-title">{t('密钥')}</h3>
              {/* 一行总开关，不逐条列密钥（#510，实测原版语义）。零密钥时不出开关：
                  没有对象可授，出了就是死控件——原版那时也渲染开关，但它开关的
                  是什么不可观测，不复刻一个看不出语义的控件。 */}
              {secretOptions.length === 0 ? (
                <p className="agent-perm-empty">{t('暂无团队密钥。')}</p>
              ) : (
                <div className="agent-perm-row">
                  <span className="agent-perm-text">
                    <span className="agent-perm-name">{t('团队密钥')}</span>
                    <span className="agent-perm-hint">{t(AGENT_PERMISSION_COPY.secrets)}</span>
                  </span>
                  <Switch
                    className="agent-secret-switch"
                    aria-label={t('团队密钥')}
                    checked={agent.secrets.length > 0}
                    onCheckedChange={toggleAllSecrets}
                  />
                </div>
              )}
            </section>

            <section className="agent-perm-group">
              <h3 className="agent-perm-title">{t('MCP 服务器')}</h3>
              <p className="agent-perm-hint">{t(AGENT_PERMISSION_COPY.mcpServers)}</p>
              {mcpOptions.length === 0 ? (
                <p className="agent-perm-empty">{t('暂无 MCP 服务器。')}</p>
              ) : (
                mcpOptions.map((server) => (
                  <div key={server.id} className="agent-perm-row agent-mcp-row">
                    <span className="agent-perm-name">{server.name}</span>
                    <Switch
                      className="agent-mcp-switch"
                      aria-label={server.name}
                      checked={agent.mcpServers.includes(server.id)}
                      onCheckedChange={(checked) => toggleMcp(server.id, checked)}
                    />
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </ResourceShell>
  );
}

/** 进输入态即聚焦。聚焦走 ref + effect 而非 autoFocus：biome 的
 *  a11y/noAutofocus 在本仓是 error 档，composer / mention-picker 同法。 */
function useEditorFocus<T extends HTMLElement>(editing: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  return ref;
}

/** 名称行内编辑（r3 §4：名称（行内编辑））——点文本进输入态，Enter 或失焦
 *  提交，Esc 放弃。空串不算提交（displayName 有 min(1) 约束）。 */
function NameRow({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useEditorFocus<HTMLInputElement>(draft !== null);
  if (draft === null) {
    return (
      <div className="agent-field">
        <span className="agent-field-label">{t('名称')}</span>
        <button type="button" className="agent-name" onClick={() => setDraft(value)}>
          {value}
        </button>
      </div>
    );
  }
  const commit = () => {
    const next = draft.trim();
    if (next !== '' && next !== value) onCommit(next);
    setDraft(null);
  };
  return (
    <div className="agent-field">
      <span className="agent-field-label">{t('名称')}</span>
      <input
        id="agent-name-input"
        ref={inputRef}
        className="agent-name-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
      />
    </div>
  );
}

/** 职责编辑（r3 §4 原文注：「用一两句话说明该 Agent 的职责。…」）。未设置时
 *  出 canon 空态文案（团队页卡同一串）。 */
function RoleRow({
  value,
  onCommit,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useEditorFocus<HTMLTextAreaElement>(draft !== null);
  return (
    <div className="agent-field">
      <span className="agent-field-label">{t('职责')}</span>
      {draft === null ? (
        <>
          <span className="agent-role-text">{value ?? t('未设置职责')}</span>
          <div className="agent-role-actions">
            <Button
              variant="ghost"
              size="sm"
              className="agent-role-edit"
              onClick={() => setDraft(value ?? '')}
            >
              {t('编辑')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <textarea
            id="agent-role-input"
            ref={inputRef}
            className="agent-role-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="agent-role-actions">
            <Button
              variant="brand"
              size="sm"
              className="agent-role-save"
              onClick={() => {
                const next = draft.trim();
                onCommit(next === '' ? null : next);
                setDraft(null);
              }}
            >
              {t('保存')}
            </Button>
          </div>
        </>
      )}
      <p className="agent-field-hint">{t(AGENT_PERMISSION_COPY.responsibility)}</p>
    </div>
  );
}
