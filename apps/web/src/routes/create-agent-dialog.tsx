// 创建 Agent dialog (issue #170, r2 §8.1 capture 20): rides DialogShell
// (#68 family law — X / Esc / backdrop close, no self-built overlay). The
// form is name-first: avatar row / 名称 input / model slot / 创建 primary.
// Live submit = mutations.createAgent (POST /api/teams/:id/agents → 201
// {id}, r5 §1); fixture follows the accept-dialog precedent (#148: close on
// submit, no backend). The 更换 ink beside the avatar is removed (#307
// wontfix, spec 08 档 4): the avatar is the static robot asset and no upload
// face exists — this item's #148 capture-verbatim-chrome verdict is
// re-adjudicated 移除 (the account-swap twin stays with 档 3, out of this
// ticket).
//
// B2 · secondary 面（XMON-20）：弹窗内两件控件（提交钮、名称输入）全走
// components/ui 件；几何仍由 ui/dialog.css 的 .dlg-agent-create / .dlg-form-input
// 承载（域 css unlayered 压 utility），类名 alias 原样保留（#411 别名优先）。
//
// #485 模型槽两态（原版两处实测：r2 §8.1 capture 20 = 尚未配置服务商时的
// 告警行 + `配置服务商` 外链；r3 §2 = 服务商配好后同一弹窗的「模型」下拉）：
// 候选非空 → 弹窗内两级选（t-0024：先运行时/服务商、再它名下的模型；POST
// body 的 provider/modelId 两字段带上，全程不跳页）；候选空 → 保留告警行与
// 外链（不存在的服务商没法"在弹窗内选"，外链是唯一出路）。改前的单平铺下拉
// 把 provider 与模型混在一列（用户原话「全部混杂在一起」），两级化后行标签
// 只出模型名——原版的 `· 128k` 是原版内置模型目录的上下文窗口，pacman 是本
// 地 BYOK，没有这个数据源。

import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import type { ModelOption } from '../fixtures/records.js';
import { useI18n } from '../i18n/provider.js';
import { PROVIDERS_HREF } from '../resources/providers-page.js';
import { AgentModelSelect, AgentRuntimeSelect } from './agent-model-select.js';

/** POST agents body 的创建面字段（reason = 词表最小形 + #485 的模型槽）。 */
export interface CreateAgentInput {
  displayName: string;
  provider?: string | null;
  modelId?: string | null;
}

interface CreateAgentDialogProps {
  /** #73 retained-mount open flag. */
  open?: boolean;
  onClose: () => void;
  /** M5 live 面：创建 = POST agents（displayName + #485 选定的模型槽）；
   *  缺省 = fixture 律（创建即关，#148 accept-dialog 先例）。 */
  onCreate?: (input: CreateAgentInput) => void;
  /** #485: 模型候选（custom providers models[] ∪ model-sources 非 pi 段，
   *  投影单源 = api/mappers.ts toModelOptions）。非空 = 出模型选择器；
   *  空 = 出「尚未配置模型服务商」告警行 + 配置外链（原版 r2 §8.1 capture
   *  20 与 r3 §2 两态：服务商配好后同一弹窗出「模型」下拉）。 */
  modelOptions?: ModelOption[];
}

export function CreateAgentDialog({
  open,
  onClose,
  onCreate,
  modelOptions = [],
}: CreateAgentDialogProps) {
  const { t } = useI18n();
  // the link carries the scenario string along so dev/fixture
  // selection survives the hop (#121)
  const { search } = useLocation();
  const [name, setName] = useState('');
  // t-0024 两级：一级 provider 位与二级 modelId 分开持（POST body 本就是两
  // 字段）。换一级清二级——modelId 只在 provider 内有意义，跨 provider 带过去
  // 是脏值（概览 tab 同律）。
  const [provider, setProvider] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const submit = () => {
    const displayName = name.trim();
    if (displayName === '') return;
    if (onCreate != null) {
      onCreate({ displayName, provider, modelId });
    } else {
      onClose();
    }
    setName('');
    setProvider(null);
    setModelId(null);
  };
  return (
    <DialogShell
      title={t('创建 agent')}
      open={open}
      onClose={onClose}
      // B2 · secondary 面（XMON-20）：底座 = components/ui/Button brand 档，与
      // ui/dialog.css 的 .dlg-agent-create 同形（--card-button 实底 + 白字、
      // 禁用换 --primary-disabled）；per-face 几何仍住 dialog.css（域 css
      // unlayered 压 utility）。差额并项——散写形字重 400、无按下位移。
      footer={
        <div className="dlg-form-foot">
          <Button
            variant="brand"
            className="dlg-agent-create px-0 font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            disabled={name.trim() === ''}
            onClick={submit}
          >
            {t('创建')}
          </Button>
        </div>
      }
    >
      <div className="dlg-form">
        <div className="dlg-agent-avatar">
          {/* #387: 头像行 = 名称种子的 dicebear 预览——随输入即所得（创建后
              同名恒同像）；空名退回静态机器人资产。「更换」钮全除（#307
              wontfix）：栈内无上传面。 */}
          <SeededAvatar name={name.trim()} fallback="/avatar-robot-1.svg" />
        </div>
        <label className="dlg-form-label" htmlFor="dlg-agent-name">
          {t('名称')}
        </label>
        <Input
          id="dlg-agent-name"
          className="dlg-form-input placeholder:text-current/50"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('输入 Agent 名称')}
        />
        {/* #485 两态：有服务商 → 弹窗内两级选（运行时/服务商 → 它名下的模型，
            不跳页）；无服务商 → 告警行 + 配置外链（capture 20 原样）。 */}
        {modelOptions.length > 0 ? (
          <>
            <div className="dlg-agent-slot-row">
              <span className="dlg-form-label">{t('运行时')}</span>
              <AgentRuntimeSelect
                value={provider}
                options={modelOptions}
                onPick={(next) => {
                  if (next !== provider) setModelId(null);
                  setProvider(next);
                }}
                prefix="dlg-agent-runtime"
              />
            </div>
            <div className="dlg-agent-slot-row">
              <span className="dlg-form-label">{t('模型')}</span>
              <AgentModelSelect
                provider={provider}
                modelId={modelId}
                options={modelOptions}
                onPick={setModelId}
                prefix="dlg-agent-model"
              />
            </div>
          </>
        ) : (
          <div className="dlg-agent-warn">
            <span>{t('尚未配置模型服务商')}</span>
            <Link className="dlg-agent-configure" to={{ pathname: PROVIDERS_HREF, search }}>
              {t('配置服务商')}
            </Link>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
