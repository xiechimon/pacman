// provider 服务面（02 §6.2 record 形状 = r3 §2 实测原样 + §8 密钥纪律）。
// API 面纪律（02 §8）：apiKey 只写不读——record 投影刻意不含 apiKey 字段
// （shared providerRecordSchema 同判），值经 SecretBox 密封落 [内部]
// apiKeyCipher 列；keyfile 丢失 = 存量 provider key 报废需重录（README 护栏）。
// presets[] 38 项目录单源 = shared PROVIDER_PRESET_IDS/OAUTH/XAI 常量（r3 §2）。

import {
  PROVIDER_OAUTH_PRESET_IDS,
  PROVIDER_PRESET_IDS,
  PROVIDER_XAI_PRESET,
  type ProviderPreset,
  type ProviderRecord,
  type SecretBox,
} from '@pacman/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { provider } from '../db/schema.js';
import { conflict, notFound } from '../lib/errors.js';
import { newRecordId, nowMs } from '../lib/ids.js';

export interface ProviderDeps {
  db: Db;
  box: SecretBox;
}

type ProviderRow = typeof provider.$inferSelect;

/** GET 封套的 presets[] 段（r3 §2：auth:"oauth" 仅二项 + xai 双通道
 * oauthLabel，其余 api_key；目录外字段未采 [推断] 不发明）。 */
export function providerPresets(): ProviderPreset[] {
  const oauthIds: readonly string[] = PROVIDER_OAUTH_PRESET_IDS;
  return PROVIDER_PRESET_IDS.map((id) => ({
    id,
    auth: oauthIds.includes(id) ? ('oauth' as const) : ('api_key' as const),
    ...(id === PROVIDER_XAI_PRESET.id ? { oauthLabel: PROVIDER_XAI_PRESET.oauthLabel } : {}),
  }));
}

export function toProviderRecord(row: ProviderRow): ProviderRecord {
  return {
    // 表内仅 custom 行（内置 built-in provider 走 Pro，不在复刻范围，02 §2.4）。
    kind: 'custom',
    providerId: row.providerId,
    label: row.label,
    baseUrl: row.baseUrl,
    api: row.api,
    authHeader: row.authHeader,
    compat: row.compat,
    models: row.models,
    id: row.id,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface ProviderBody {
  providerId: string;
  label: string;
  baseUrl: string;
  api: ProviderRecord['api'];
  authHeader?: boolean;
  compat?: { supportsDeveloperRole: boolean };
  models?: { id: string; name: string }[];
  /** 只写位（02 §8）：string = 密封存储；null = 清除（「可以替换或删除」）。 */
  apiKey?: string | null;
}

function getRow(deps: ProviderDeps, teamId: string, id: string): ProviderRow | undefined {
  return deps.db
    .select()
    .from(provider)
    .where(and(eq(provider.id, id), eq(provider.teamId, teamId)))
    .get();
}

function assertProviderIdFree(
  deps: ProviderDeps,
  teamId: string,
  providerId: string,
  exceptId?: string,
): void {
  // providerId 团队内唯一 [设计]：机器日志 `using model <provider>/<modelId>`
  // 与 per-step 凭证解析都按 providerId 寻址（r3 §1.5/§2）。
  const dup = deps.db
    .select({ id: provider.id })
    .from(provider)
    .where(and(eq(provider.teamId, teamId), eq(provider.providerId, providerId)))
    .all()
    .find((r) => r.id !== exceptId);
  if (dup) throw conflict(`provider ${providerId} already exists`);
}

export function listProviders(deps: ProviderDeps, teamId: string): ProviderRecord[] {
  return deps.db
    .select()
    .from(provider)
    .where(eq(provider.teamId, teamId))
    .orderBy(asc(provider.createdAt))
    .all()
    .map(toProviderRecord);
}

/** GET /api/teams/{id}/providers 封套 [推断]：presets[] 字段实测在位
 * （r3 §2），与 custom 记录同封套并列的包络形未采到。 */
export function getProvidersEnvelope(
  deps: ProviderDeps,
  teamId: string,
): { presets: ProviderPreset[]; providers: ProviderRecord[] } {
  return { presets: providerPresets(), providers: listProviders(deps, teamId) };
}

export function createProvider(
  deps: ProviderDeps,
  input: { teamId: string; body: ProviderBody; createdBy: string },
): ProviderRecord {
  const { body } = input;
  assertProviderIdFree(deps, input.teamId, body.providerId);
  const now = nowMs();
  const id = newRecordId();
  deps.db
    .insert(provider)
    .values({
      id,
      teamId: input.teamId,
      kind: 'custom',
      providerId: body.providerId,
      label: body.label,
      baseUrl: body.baseUrl,
      api: body.api,
      authHeader: body.authHeader ?? true, // Bearer 复选默认勾（r3 §2 样本值）
      compat: body.compat ?? { supportsDeveloperRole: false }, // 样本值默认 [推断]
      models: body.models ?? [],
      apiKeyCipher: body.apiKey ? deps.box.seal(body.apiKey) : null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const row = getRow(deps, input.teamId, id);
  if (!row) throw new Error('provider missing after insert');
  return toProviderRecord(row);
}

export function updateProvider(
  deps: ProviderDeps,
  teamId: string,
  id: string,
  patch: Partial<ProviderBody>,
): ProviderRecord {
  const row = getRow(deps, teamId, id);
  if (!row) throw notFound(`provider ${id}`);
  if (patch.providerId !== undefined && patch.providerId !== row.providerId) {
    assertProviderIdFree(deps, teamId, patch.providerId, id);
  }
  deps.db
    .update(provider)
    .set({
      ...(patch.providerId !== undefined ? { providerId: patch.providerId } : {}),
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
      ...(patch.api !== undefined ? { api: patch.api } : {}),
      ...(patch.authHeader !== undefined ? { authHeader: patch.authHeader } : {}),
      ...(patch.compat !== undefined ? { compat: patch.compat } : {}),
      ...(patch.models !== undefined ? { models: patch.models } : {}),
      // 只写位三态：undefined 保持 / null 清除 / string 重密封（02 §8）。
      ...(patch.apiKey !== undefined
        ? { apiKeyCipher: patch.apiKey === null ? null : deps.box.seal(patch.apiKey) }
        : {}),
      updatedAt: nowMs(),
    })
    .where(eq(provider.id, id))
    .run();
  const updated = getRow(deps, teamId, id);
  if (!updated) throw new Error('provider missing after update');
  return toProviderRecord(updated);
}

export function deleteProvider(deps: ProviderDeps, teamId: string, id: string): boolean {
  const row = getRow(deps, teamId, id);
  if (!row) return false;
  deps.db.delete(provider).where(eq(provider.id, id)).run();
  return true;
}

/** per-step 下发读点（02 §8 运行时层）：按 providerId 解出密钥明文——
 * 只进内存（executor 持有，不落盘 [推断] r3 注记沿用），调用面 =
 * services/credentials.ts（M3 `/api/machine/token/{stepId}` 挂接）。 */
export function openProviderKey(
  deps: ProviderDeps,
  teamId: string,
  providerId: string,
): { row: ProviderRow; apiKey: string | null } | null {
  const row = deps.db
    .select()
    .from(provider)
    .where(and(eq(provider.teamId, teamId), eq(provider.providerId, providerId)))
    .get();
  if (!row) return null;
  return { row, apiKey: row.apiKeyCipher === null ? null : deps.box.open(row.apiKeyCipher) };
}
