// bundle 形态标记（06 册 §11 W2-D2）：src 直跑（tsx/测试）= false；
// build.mjs 的 esbuild onLoad 插件把本模块整体替换为 true 打进单文件
// bundle——pino transport 需要盘上 worker/目标模块（thread-stream 从
// __dirname 起线程），单文件 bundle 永远无法承载，故 bundle 形态恒走纯
// JSON 日志（= 生产口径）。消费点 = index.ts logger 装配。

export const BUNDLED_FORM = false;
