// whats_new record——02 §6.1：GET /api/whats-new「形状保留、内容自选」
// （引导「新功能/核心功能」弹层归素材；changelog 全量 = 形状保留、内容自写
// 或空，素材替换计划 §3.4）。wire 形状未实测——开放记录，M2 实现期自定
// 内容 [设计]。

import { z } from 'zod';

export const whatsNewRecordSchema = z.record(z.string(), z.unknown());
export type WhatsNewRecord = z.infer<typeof whatsNewRecordSchema>;
