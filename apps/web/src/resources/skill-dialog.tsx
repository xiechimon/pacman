// 技能新建/编辑弹窗（XMON-114 S3，spec 13 回摆：技能页摘只读封印）。
// 表单化口径：frontmatter 的 name/description = 表单字段，SKILL.md 由
// shared buildSkillEntry 组装——用户只写正文，不手写 YAML 头。预填反向走
// splitSkillEntry（编辑面打开时 GET 入口文件拆开回填）。
// 客户端预检（同 shared 单源）：目录名安全域 SKILL_DIR_NAME_RE、单文件
// 字节闸 MAX_SKILL_FILE_BYTES、round-trip 对拍（引号包裹等解析器会改写
// 的形态不发请求）；server 仍是终闸——400/404/409 落内联错误行（headline
// 按 status 分译，server 原文作 detail 行，消息子串不作契约）。
// fixture 面 = accept 律（#148：提交即关），不发请求不读文件。
// #944 正典表执行（spec/22 §5.3/§5.4）：.dlg-form* 族类 → utility 等值
// 迁移、裸 button/textarea → Button brand / Textarea 件、Input 摘
// .dlg-form-input 老类（I3——件已是 components/ui，几何即正典 h-8）。
// SKILL.md 正文编辑框的 font-mono + min-h-[160px] 是消费面显式 override
// （textarea.tsx 头注口径）：markdown/YAML 源码编辑要等宽，正文要多行空间
// ——原 .dlg-skill-body 的行为理由原样承接。

import {
  buildSkillEntry,
  MAX_SKILL_FILE_BYTES,
  parseSkillFrontmatter,
  SKILL_DIR_NAME_RE,
  SKILL_ENTRY_FILE,
  splitSkillEntry,
} from '@pacman/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '../api/client.js';
import { useApiMutations, useSkillFile } from '../api/hooks.js';
import { useLiveData } from '../api/provider.js';
import { Button } from '../components/ui/button.js';
import { DialogShell } from '../components/ui/dialog-shell.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { useI18n } from '../i18n/provider.js';

/** .dlg-form-label 退役后的等值 rhythm（正典表 §5.4，create-secret-dialog
 *  同方）：9/8 外距 + 18 行盒；字号/字距 = c.css 定版 --label-size 12px /
 *  --label-spacing 0.01em——token 落后改 text-(--label-size)
 *  tracking-(--label-spacing)（§4-4）。 */
const LABEL_CLS = 'mt-[9px] mb-2 text-[12px] leading-[18px] tracking-[0.01em] text-(--foreground)';

/** 表单容器（.dlg-form 等值，§5.4）：flex 列 gap 12、16/16/12 垫。 */
const FORM_CLS = 'flex flex-col gap-3 px-4 pt-4 pb-3';

/** 错误行（prj-new-error / dlg-provider-oauth-error 同族配方）：
 *  12px/16px/--danger，role=alert 在元素侧；server 原文 detail 行次级色。 */
const ERROR_CLS = 'text-xs leading-4 break-words text-(--destructive)';

/** 编辑目标（行数据投影）；undefined = 新建。 */
export interface SkillEditTarget {
  id: string;
  name: string;
  description: string;
}

interface Fields {
  name: string;
  description: string;
  body: string;
}

/** 服务端错误 → 可读 headline（status 分译）+ 原文 detail。 */
function serverErrorCopy(
  err: unknown,
  t: (s: string) => string,
): { headline: string; detail: string } {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      return {
        headline: t('同名技能已存在——换个名称，或从列表打开它编辑。'),
        detail: err.message,
      };
    }
    if (err.status === 404) {
      return { headline: t('该技能已不存在——可能刚被移动或删除。'), detail: err.message };
    }
    if (err.status === 400) {
      return { headline: t('内容未通过校验。'), detail: err.message };
    }
    return { headline: t('保存失败，请重试。'), detail: err.message };
  }
  return { headline: t('保存失败，请重试。'), detail: String(err) };
}

export function SkillDialog({
  open,
  onClose,
  skill,
}: {
  open: boolean;
  onClose: () => void;
  skill?: SkillEditTarget;
}) {
  const { t } = useI18n();
  const { live, teamId } = useLiveData();
  const mutations = useApiMutations(teamId);
  const qc = useQueryClient();
  const editing = skill !== undefined;
  const [fields, setFields] = useState<Fields | null>(null);
  const [error, setError] = useState<{ headline: string; detail: string } | null>(null);

  // 编辑面（live）预填读：弹窗开着才发；404 = 目标刚被移除（一等错误态）。
  const fileQ = useSkillFile(teamId, skill?.id, open && live && editing);

  // 开/关初始化：关 = 清场；开 = 新建空表 / fixture 编辑取行投影 / live 编辑
  // 等文件读回（下方 effect 回填）。
  useEffect(() => {
    if (!open) {
      setFields(null);
      setError(null);
      return;
    }
    if (!editing) {
      setFields({ name: '', description: '', body: '' });
    } else if (!live) {
      setFields({ name: skill.name, description: skill.description, body: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在开/关沿初始化
  }, [open]);

  useEffect(() => {
    if (!open || !editing || !live || fields !== null) return;
    if (fileQ.data === undefined) return;
    const split = splitSkillEntry(fileQ.data.content);
    setFields({
      name: split.name ?? skill.name,
      description: split.description ?? skill.description,
      body: split.body,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fields===null 是装载闸
  }, [open, editing, live, fields, fileQ.data]);

  // 预填读 404：列错误行 + 列表失效（行应随之消失）。
  useEffect(() => {
    if (!open || !(fileQ.error instanceof ApiError)) return;
    if (fileQ.error.status === 404) {
      void qc.invalidateQueries({ queryKey: ['skills'] });
    }
    setError(serverErrorCopy(fileQ.error, t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 错误对象换实例才重算
  }, [open, fileQ.error]);

  const entry =
    fields === null
      ? ''
      : buildSkillEntry(fields.name.trim(), fields.description.trim(), fields.body);
  const entryBytes = new TextEncoder().encode(entry).length;
  const nameBad = fields !== null && fields.name !== '' && !SKILL_DIR_NAME_RE.test(fields.name);
  const tooLarge = fields !== null && entryBytes > MAX_SKILL_FILE_BYTES;
  const roundTripBad =
    fields !== null &&
    fields.name.trim() !== '' &&
    fields.description.trim() !== '' &&
    (() => {
      const fm = parseSkillFrontmatter(entry);
      return fm.name !== fields.name.trim() || fm.description !== fields.description.trim();
    })();
  const submittable =
    fields !== null &&
    fields.name.trim() !== '' &&
    !nameBad &&
    fields.description.trim() !== '' &&
    !tooLarge &&
    !roundTripBad &&
    !mutations.createSkill.isPending &&
    !mutations.updateSkill.isPending;

  const submit = () => {
    if (fields === null || !submittable) return;
    const body = {
      name: fields.name.trim(),
      description: fields.description.trim(),
      files: [{ path: SKILL_ENTRY_FILE, content: entry }],
    };
    if (!live) {
      onClose(); // fixture accept 律
      return;
    }
    setError(null);
    const onError = (err: unknown) => {
      if (err instanceof ApiError && err.status === 404) {
        void qc.invalidateQueries({ queryKey: ['skills'] });
      }
      setError(serverErrorCopy(err, t));
    };
    if (editing) {
      mutations.updateSkill.mutate({ id: skill.id, body }, { onSuccess: onClose, onError });
    } else {
      mutations.createSkill.mutate(body, { onSuccess: onClose, onError });
    }
  };

  return (
    <DialogShell
      title={editing ? t('编辑技能') : t('新建技能')}
      open={open}
      onClose={onClose}
      width={560}
      footer={
        <div className="flex flex-col px-4 pb-4">
          <Button variant="brand" className="w-full" disabled={!submittable} onClick={submit}>
            {editing ? t('保存') : t('新建技能')}
          </Button>
        </div>
      }
    >
      {/* 编辑面（live）预填读失败 = 表单整体让位错误块——拿不到原 SKILL.md
          时绝不让用户盲写覆写（PUT 覆写语义，空表单提交会抹掉正文）。 */}
      {error !== null && fields === null ? (
        <div className={FORM_CLS}>
          <div className={ERROR_CLS} role="alert">
            {error.headline}
            {error.detail !== '' && (
              <span className="mt-0.5 block text-(--text-tertiary)">{error.detail}</span>
            )}
          </div>
        </div>
      ) : fields === null ? (
        <div className={FORM_CLS}>
          <p className="text-xs leading-4 text-(--text-tertiary)">{t('正在读取 SKILL.md…')}</p>
        </div>
      ) : (
        <div className={FORM_CLS}>
          <label className={LABEL_CLS} htmlFor="dlg-skill-name">
            {t('名称')}
          </label>
          <Input
            id="dlg-skill-name"
            value={fields?.name ?? ''}
            onChange={(event) => setFields((f) => f && { ...f, name: event.target.value })}
            placeholder="deploy-to-prod"
          />
          {nameBad && (
            <div className={ERROR_CLS} role="alert">
              {t('名称须以字母或数字开头，只能含字母、数字、点、横杠、下划线，最长 64 字符。')}
            </div>
          )}
          <label className={LABEL_CLS} htmlFor="dlg-skill-desc">
            {t('描述')}
          </label>
          <Input
            id="dlg-skill-desc"
            value={fields?.description ?? ''}
            onChange={(event) => setFields((f) => f && { ...f, description: event.target.value })}
            placeholder={t('这个技能做什么、什么时候用它。')}
          />
          {roundTripBad && (
            <div className={ERROR_CLS} role="alert">
              {t('描述不要用引号整体包裹——写进 frontmatter 后引号会被剥去，与表单值不一致。')}
            </div>
          )}
          <label className={LABEL_CLS} htmlFor="dlg-skill-body">
            {t('SKILL.md 正文')}
          </label>
          <Textarea
            id="dlg-skill-body"
            className="min-h-[160px] font-mono"
            value={fields?.body ?? ''}
            onChange={(event) => setFields((f) => f && { ...f, body: event.target.value })}
          />
          <p className="text-xs leading-4 text-(--text-tertiary)">
            {editing
              ? t('frontmatter（name/description）由上方表单生成；未在此编辑的文件保持原样。')
              : t('frontmatter（name/description）由上方表单生成，这里只写正文。')}
          </p>
          {tooLarge && (
            <div className={ERROR_CLS} role="alert">
              {t('内容超出单文件上限（{limit} KB）。', {
                limit: Math.round(MAX_SKILL_FILE_BYTES / 1000),
              })}
            </div>
          )}
          {error !== null && (
            <div className={ERROR_CLS} role="alert">
              {error.headline}
              {error.detail !== '' && (
                <span className="mt-0.5 block text-(--text-tertiary)">{error.detail}</span>
              )}
            </div>
          )}
        </div>
      )}
    </DialogShell>
  );
}
