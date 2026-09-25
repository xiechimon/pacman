// bundle external 清单（build.mjs 与 scripts/smoke-pack.mjs 单源共享）：pi 系
// 保持 external = 包依赖面（M3a 口径，vendor 全内嵌的发行形态归发布票）。
// 冒烟的「manifest 声明全部 external」断言据此派生——加新 external 两侧
// 自动同步，不会静默漏守卫。
export const EXTERNALS = [
  '@earendil-works/pi-ai',
  '@earendil-works/pi-coding-agent',
  '@earendil-works/pi-agent-core',
];
