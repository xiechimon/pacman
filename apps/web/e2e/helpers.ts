import type { Page } from '@playwright/test';

// e2e 共享测试工具（非断言面）。放这里的判据 = 多个 spec 逐字节复用同一段
// 桩；单 spec 专用的桩仍留在各自文件（house pattern）。

declare global {
  interface Window {
    /** stubNotification 的 requestPermission() 调用计数——通知面 spec 断言用。 */
    __permCalls: number;
  }
}

/** 替换 window.Notification：permission 读 `initial`，直到 requestPermission()
 *  把它落到 `resolution`（镜像真 API——属性反映授权决定），调用次数计入
 *  window.__permCalls。headless chromium 的真权限 API 不可靠（grantPermissions
 *  不翻 Notification.permission、requestPermission 恒 resolve default），桩是
 *  稳定表达 granted/denied/default 三态的唯一通道。
 *  通知面三 spec 共用（notify-banner / account-team-cleanse /
 *  account-controls）——曾是逐字节相同的三份副本，抽成单源防漂移。 */
export function stubNotification(
  page: Page,
  initial: string,
  resolution: string,
): Promise<void> {
  return page.addInitScript(
    ({ p, r }) => {
      let perm = p;
      window.__permCalls = 0;
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          get permission() {
            return perm;
          },
          requestPermission() {
            window.__permCalls++;
            perm = r;
            return Promise.resolve(r);
          },
        },
      });
    },
    { p: initial, r: resolution },
  );
}
