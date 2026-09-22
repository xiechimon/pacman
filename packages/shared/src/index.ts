// @pacman/shared——复刻协议面的唯一契约源（03 ROADMAP M1）。
// canonical 词表全量落 TypeScript schema：executor/machine 协议（02 §5）+
// web REST/SSE（02 §6/§1.2）+ record 形状 24 表投影（02 §6.2/01 §6）+
// phase 九值枚举单源（02 §4.1）+ 品牌串命名常量表（02 §5.8/#44 §2）。
// 纪律：不发明 02 之外的字段形状（01 §6）；[推断]/[设计] 标注按 02 册原样
// 保留（04 §3 不判负口径），补采真值 → 回写 02 §11 后收紧。
// 消费方向（01 §3）：web / server / daemon → shared，三端互不依赖，shared 零反向。

export * from './brand.js';
export * from './git-ops.js';
export * from './phase.js';
export * from './protocol/index.js';
export * from './records/index.js';
export * from './scheduler.js';
export * from './secret-box.js';
export * from './tables.js';
