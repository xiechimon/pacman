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
// components/ui 件。#952（正典表 §5.3/§5.4，ui/dialog.css 退役）：.dlg-form*
// 族类 → utility 等值迁移（单源同 #944 的 LABEL_CLS 律）、.dlg-form-input 摘类
// （几何即件正典 h-8，36px 不存续）、.dlg-agent-create → Button brand + w-full
// （§2.6-3 迁移位；散写形差额并项——字重 400、无按下位移——原样承接）。
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
import {
  AGENT_SELECT_MENU_NARROW_CLS,
  AgentModelSelect,
  AgentRuntimeSelect,
  DLG_AGENT_SELECT_MENU_CLS,
  DLG_AGENT_SELECT_TRIGGER_CLS,
} from './agent-model-select.js';

/** .dlg-form-label 退役后的等值 rhythm（正典表 §5.4，#944 的 LABEL_CLS 同律）：
 *  9/8 外距 + 18 行盒；字号/字距 = c.css 定版 --label-size 12px /
 *  --label-spacing 0.01em——#915 落 token 后改 text-(--label-size)
 *  tracking-(--label-spacing)（§4-4）。 */
const LABEL_CLS = 'mt-[9px] mb-2 text-[12px] leading-[18px] tracking-[0.01em] text-(--foreground)';

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
  /** #485: 模型候选（model-sources 非 pi 段，#770 起 providers 段已除；
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
      // 底座 = components/ui/Button brand 档（--card-button 实底 + on-accent 字、
      // 禁用换 --spot-disabled，原 .dlg-agent-create 同形）；w-full = 钉底独占
      // （§5.4）。差额并项——散写形字重 400、无按下位移。
      footer={
        <div className="flex flex-col px-4 pb-4">
          <Button
            variant="brand"
            className="w-full px-0 font-normal leading-[inherit] active:not-aria-[haspopup]:translate-y-0"
            disabled={name.trim() === ''}
            onClick={submit}
          >
            {t('创建')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        {/* #951（detail/overlays.css 清零）：.dlg-agent-avatar 律等值迁
            utility——行 12 gap；img 40×40 圆（per-face 容器是 img 几何正本，
            SeededAvatar 契约）。testid = 二级载体（img 在 loaded 前被 registry
            keepMounted 置 aria-hidden，role 钉不到；dead-buttons /
            avatar-dicebear 的定位面，#910 裁定 1）。 */}
        <div className="flex items-center gap-3" data-testid="agent-avatar">
          {/* #387: 头像行 = 名称种子的 dicebear 预览——随输入即所得（创建后
              同名恒同像）；空名退回静态机器人资产。「更换」钮全除（#307
              wontfix）：栈内无上传面。 */}
          <SeededAvatar
            name={name.trim()}
            fallback="/avatar-robot-1.svg"
            className="[&_img]:size-10 [&_img]:rounded-full"
          />
        </div>
        <label className={LABEL_CLS} htmlFor="dlg-agent-name">
          {t('名称')}
        </label>
        <Input
          id="dlg-agent-name"
          className="placeholder:text-current/50"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('输入 Agent 名称')}
        />
        {/* #485 两态：有服务商 → 弹窗内两级选（运行时/服务商 → 它名下的模型，
            不跳页）；无服务商 → 告警行 + 配置外链（capture 20 原样）。 */}
        {modelOptions.length > 0 ? (
          <>
            {/* #951：.dlg-agent-slot-row 律等值迁 utility（标签与选择器纵向
                排布，6 gap）；#952：选择器本体几何走 DLG_AGENT_SELECT_* 常量
                （agent-model-select.tsx 单源，agent-detail.css 退役）。 */}
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>{t('运行时')}</span>
              <AgentRuntimeSelect
                value={provider}
                options={modelOptions}
                onPick={(next) => {
                  if (next !== provider) setModelId(null);
                  setProvider(next);
                }}
                prefix="dlg-agent-runtime"
                triggerClassName={DLG_AGENT_SELECT_TRIGGER_CLS}
                menuClassName={`${DLG_AGENT_SELECT_MENU_CLS} ${AGENT_SELECT_MENU_NARROW_CLS}`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={LABEL_CLS}>{t('模型')}</span>
              <AgentModelSelect
                provider={provider}
                modelId={modelId}
                options={modelOptions}
                onPick={setModelId}
                prefix="dlg-agent-model"
                triggerClassName={DLG_AGENT_SELECT_TRIGGER_CLS}
                menuClassName={DLG_AGENT_SELECT_MENU_CLS}
              />
            </div>
          </>
        ) : (
          // #951：.dlg-agent-warn/-configure 律等值迁 utility——告警行 8 圆角
          // card-border 描边 surface 底 8/12 垫 13/16 secondary 墨；外链
          // ml-auto 右锚（spec 载体 = link 文案一级，agent-create-model /
          // team-create-agent 同 PR 重钉）。
          <div className="flex items-center gap-2 rounded-[8px] border border-(--border) bg-(--card) px-3 py-2 text-[13px] leading-4 text-(--text-secondary)">
            <span>{t('尚未配置模型服务商')}</span>
            <Link
              className="ml-auto text-[13px] leading-4"
              to={{ pathname: PROVIDERS_HREF, search }}
            >
              {t('配置服务商')}
            </Link>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
