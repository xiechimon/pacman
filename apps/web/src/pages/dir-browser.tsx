// 应用内目录浏览器（ADR 0003 D5/D6，#441）：remote/headless 形态下
// POST /api/fs/pick 422 unavailable 的兜底——server readdir 只读投影
// （GET /api/fs/list，数据源单源 = shared FsListResult）经面包屑 + 逐级下钻
// 浏览，单击行「选择」回填。组件边界 = 「带浏览能力的路径输入框」的浏览面，
// 本票只接新建项目 localPath 一个消费点（ProjectNewPage），不铺第二消费者。
//
// 失败方式清单钉在 e2e/project-new-dir-browser.spec.ts（W 族）：
// - 起点 = localStorage lastDir（记住上次位置，W1）；无效则自动回落缺省
//   HOME（server 判 $HOME，web 无从知道，W2）——dir=null = 缺省请求。
// - 列表 500/网络错 = overlay 内错误行、overlay 不关、面包屑仍可导航重试（W3）；
//   面包屑真值走 lastGoodPath ref，错误面（无 data）不塌缩。
// - 快速连点导航 = queryKey 含 dir 按键隔离 + keepPreviousData 防塌缩闪烁（W4）。
// - dotfiles 默认隐藏 + toggle（aria-pressed 可断言，仿 macOS ⌘⇧.，W8）；
//   server 全量返回，隐藏/toggle 是本显示层语义（F16）。
// - 空目录空态、超大目录截断提示（truncated 旗标，W9/W10）。
// - localStorage 隐私模式抛 = 读写 try/catch 降级（缺省起点、不记住，W13）。
// 弹层家族法 #67/#127：FloatingShell + ClickCatcher（#656 起 Esc 归 Base UI
// layer 栈；gh-picker 同款）。

import { FS_LIST_MAX_ENTRIES } from '@pacman/shared';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client.js';
import { useFsList } from '../api/hooks.js';
import { Button } from '../components/ui/button.js';
import { FLOATING_POP_ANIM, FloatingShell } from '../components/ui/floating-shell.js';
import { useI18n } from '../i18n/provider.js';
import { ChevronRight, GitCommit } from '../icons/index.js';
import { ClickCatcher } from '../overlays/dismiss.js';

/** 记住上次位置的 localStorage 键（单租户单机，ADR 0003 D5）。 */
const LAST_DIR_KEY = 'pacman.dirBrowser.lastDir';

function readLastDir(): string | null {
  try {
    return window.localStorage.getItem(LAST_DIR_KEY);
  } catch {
    return null; // 隐私模式等抛 = 无记忆起点（W13）
  }
}

function writeLastDir(path: string): void {
  try {
    window.localStorage.setItem(LAST_DIR_KEY, path);
  } catch {
    // 写不进 = 不记住，浏览本身不受损（W13）
  }
}

/** 绝对路径 → 面包屑段（根 `/` 单段起，逐段累积 canonical 前缀）。 */
function breadcrumb(path: string): { label: string; path: string }[] {
  const segs = [{ label: '/', path: '/' }];
  let acc = '';
  for (const part of path.split('/')) {
    if (part === '') continue;
    acc += `/${part}`;
    segs.push({ label: part, path: acc });
  }
  return segs;
}

export function DirBrowser({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  /** Escape / 点外部关闭（输入框值不动，弹层家族法）。 */
  onClose: () => void;
  /** 单击行「选择」：回填该目录 canonical 绝对路径（消费点接输入框）。 */
  onPick: (path: string) => void;
}) {
  const { t } = useI18n();
  const [dir, setDir] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [showDotfiles, setShowDotfiles] = useState(false);
  // #656：Esc 归 FloatingShell（Base UI layer 栈）。面板是 absolute top:100%，
  // 旧 containing block = 最近的非 static 祖先；Portal container 取同一个元素，
  // 几何逐像素不变（锚点 span 原位，向上走到第一个非 static 祖先）。
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [dockEl, setDockEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    let node = anchorRef.current?.parentElement ?? null;
    while (node !== null && getComputedStyle(node).position === 'static') {
      node = node.parentElement;
    }
    setDockEl(node);
  }, []);

  // 起点：open 翻真时同步 lastDir（记住上次位置，W1）+ armed 门——query 只在
  // dir 就位后 enabled，避免「缺省请求 + lastDir 请求」双发（W1）。
  useEffect(() => {
    if (open) {
      setDir(readLastDir());
      setShowDotfiles(false);
      setArmed(true);
    } else {
      setArmed(false);
    }
  }, [open]);

  const listQ = useFsList(dir, open && armed);

  // 面包屑/记住位置真值 = canonical path（非 placeholder 的成功数据）。错误面
  // （无 data）走 lastGoodPath ref 不塌缩（W3）；列表成功即写 lastDir（W6）。
  const lastGoodPath = useRef<string | null>(null);
  const dataPath = listQ.data && !listQ.isPlaceholderData ? listQ.data.path : null;
  useEffect(() => {
    if (dataPath !== null) {
      lastGoodPath.current = dataPath;
      writeLastDir(dataPath);
    }
  }, [dataPath]);
  const currentPath = dataPath ?? lastGoodPath.current;

  // W2 lastDir 失效（被删/变文件/不可读）= 自动回落缺省 HOME，不死端。dir=null
  // 缺省面自身错误不再回落（防 null→null 循环），落错误行（W3）。
  const reason = listQ.error instanceof ApiError ? listQ.error.reason : undefined;
  useEffect(() => {
    if (
      dir !== null &&
      (reason === 'not_found' || reason === 'not_dir' || reason === 'not_readable')
    ) {
      setDir(null);
    }
  }, [dir, reason]);

  const entries = listQ.data?.entries ?? [];
  const visible = showDotfiles ? entries : entries.filter((e) => !e.name.startsWith('.'));
  const crumbs = currentPath !== null ? breadcrumb(currentPath) : [];

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {dockEl !== null && (
        <FloatingShell
          open={open}
          onClose={onClose}
          container={dockEl}
          className="anchored-pop-shell"
        >
          <ClickCatcher onClose={onClose} />
          <div
            className={`dir-browser ${FLOATING_POP_ANIM}`}
            role="dialog"
            aria-label={t('浏览本地文件夹')}
          >
            <div className="dir-browser-bar">
              <nav className="dir-browser-crumbs">
                {crumbs.map((seg, i) => (
                  <span key={seg.path} className="dir-browser-crumb-wrap">
                    {i > 0 && (
                      <span className="dir-browser-crumb-sep" aria-hidden="true">
                        <ChevronRight width={12} height={12} />
                      </span>
                    )}
                    {/* XMON-25 收编：ghost；h-auto 保内容高（focus 环矩形 =
                    现行为）、shrink 保面包屑挤压可缩（base shrink-0 会改
                    溢出行为）。 */}
                    <Button
                      variant="ghost"
                      className="dir-browser-crumb h-auto shrink rounded-none font-normal active:not-aria-[haspopup]:translate-y-0"
                      // 末段 = 当前目录（不可再下钻到自己，仍渲染为钮保持一致性）。
                      aria-current={i === crumbs.length - 1 ? 'location' : undefined}
                      onClick={() => setDir(seg.path)}
                    >
                      {seg.label}
                    </Button>
                  </span>
                ))}
              </nav>
              {/* XMON-25 收编：ghost；aria-pressed 皮肤正本在 per-face
              [aria-pressed=true] 规则，unlayered 恒胜 base 的 aria-expanded 档。 */}
              <Button
                variant="ghost"
                className="dir-browser-dots h-auto font-normal active:not-aria-[haspopup]:translate-y-0"
                aria-pressed={showDotfiles}
                onClick={() => setShowDotfiles((v) => !v)}
              >
                {t('显示隐藏文件')}
              </Button>
            </div>
            <div className="dir-browser-list">
              {listQ.isError ? (
                <div className="dir-browser-error" role="alert">
                  {(listQ.error as Error).message}
                </div>
              ) : (
                visible.map((entry) => {
                  const base = currentPath ?? '/';
                  // canonical 绝对路径 + 目录名 → 子路径（base 恒以 `/` 开头无尾斜杠）。
                  const child = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`;
                  return (
                    <div className="dir-browser-row" key={entry.name}>
                      {/* XMON-25 收编：ghost；justify-start 对齐位（text-align:left
                      的 flex 等价）、h-auto 保 18px 内容高。 */}
                      <Button
                        variant="ghost"
                        className="dir-browser-name h-auto justify-start rounded-none font-normal active:not-aria-[haspopup]:translate-y-0"
                        onClick={() => setDir(child)}
                      >
                        {entry.name}
                      </Button>
                      {entry.git && (
                        <span className="dir-browser-git" role="img" aria-label={t('git 仓库')}>
                          <GitCommit width={13} height={13} />
                        </span>
                      )}
                      {/* XMON-25 收编：ghost；opacity 0→1（行 hover/focus）正本在
                      per-face，unlayered 恒胜。 */}
                      <Button
                        variant="ghost"
                        className="dir-browser-pick h-auto font-normal active:not-aria-[haspopup]:translate-y-0"
                        onClick={() => onPick(child)}
                      >
                        {t('选择')}
                      </Button>
                    </div>
                  );
                })
              )}
              {!listQ.isError &&
                !listQ.isPlaceholderData &&
                listQ.data !== undefined &&
                visible.length === 0 && (
                  <div className="dir-browser-empty">
                    {/* 真无子目录 vs 子目录全被 dotfiles 隐藏（toggle 是就近 affordance）
                    ——两态分译，不对「有但隐藏」谎称「没有」。 */}
                    {entries.length === 0 ? t('没有子目录') : t('子目录均已隐藏')}
                  </div>
                )}
            </div>
            {listQ.data?.truncated === true && (
              <div className="dir-browser-trunc">
                {t('目录条目过多，只列出前 {n} 条', { n: FS_LIST_MAX_ENTRIES })}
              </div>
            )}
          </div>
        </FloatingShell>
      )}
    </>
  );
}
