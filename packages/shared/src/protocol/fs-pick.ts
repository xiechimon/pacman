// 原生文件夹选取 wire 契约（ADR 0003 / #440）：server 代弹 macOS choose
// folder 对话框，web 浏览钮消费。三态结局：选中 = {path}；取消 = {path:null}
// （正常结局，非错误面——web 静默 no-op）；能力缺失/单飞冲突 = {error,
// reason}（#386 reason code 三端单源模式，web 按 code 分译）。

/** `POST /api/fs/pick` 错误 reason 值域：unavailable = 平台/无 GUI 会话/
 *  spawn 失败/watchdog 超时（ADR 0003 D3/D4 降级面）；busy = 单飞冲突
 *  （D7，409）。 */
export const FS_PICK_ERROR_REASONS = ['unavailable', 'busy'] as const;
export type FsPickErrorReason = (typeof FS_PICK_ERROR_REASONS)[number];

/** 200 应答封套：path = 选中的绝对路径；null = 用户取消（S3）。 */
export type FsPickResult = { path: string | null };

/** reason → zh 分译键（web t() 的 zh-CN 权威键，en 词典以同键收编；
 *  LOCAL_ERROR_REASON_COPY 同构——键集恒等于词表，扩族漏译 = 编译期红）。
 *  unavailable 措辞为中性能力边界说明（非错误级），落 web 提示行而非
 *  danger 错误行（ADR 0003 D4）。 */
export const FS_PICK_ERROR_COPY: Record<FsPickErrorReason, string> = {
  unavailable: '此部署形态不支持系统对话框，请直接输入路径',
  busy: '已有一个选取对话框在进行中',
};
