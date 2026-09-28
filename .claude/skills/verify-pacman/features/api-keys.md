# API 密钥

用户在 `/app/api-keys` 生成接入凭证:空态点「新建密钥」得到一次性明文(`pacman_…`,仅显示一次)与列表掩码行;该密钥用于机器注册(`pacman start --api-key …`)与 MCP Bearer。存侧只落 keyHash,不存明文(02 §8 护栏)。

## Sub-features

- `keys-empty` 全新库空态(图标瓦片 + 「尚无 API 密钥。」+ 新建/文档钮)。
- `keys-create` `.keys-create` 直发 POST(已建屏无名称/白名单表单面——默认权限位,后票)。
- `keys-once` 一次性明文块 `.keys-once-value` + 「请立即复制密钥,它仅显示一次。」;刷新即消失。
- `keys-masked` 列表行 `.keys-row` 显示掩码(`pacman_afe07565…` 形态)。
- `keys-hash` SQLite `api_key` 表存 `keyHash`,明文不入库。

## How to get to it (user POV)

- 侧栏进「API 密钥」页(`/app/api-keys`,secondary shell)。

## Driving it with verify-pacman

Preconditions:

- `launch.mjs` 全新库(建密钥按钮**只在空态**;复用已建过密钥的栈会看不到按钮——重验先重 launch)。
- `doctor.mjs` 全 PASS。

- **建密钥。** 空态点「新建密钥」。Run `node <skill>/scripts/drive.mjs api-key`。链路:空态就绪 → 点 `.keys-create` → `.keys-once-value` 出现且 `pacman_` 前缀 → `.keys-row` ≥1 → `GET /api/teams/<teamId>/api-keys` 返回掩码行 → SQLite `SELECT id,name,masked,keyHash FROM api_key` 有行且 keyHash 非空。证据 `01-keys-empty.png` / `02-keys-once.png` + `result.json`(apiKeyMasked/dbApiKey 字段)。
- **一次性语义。** probe 后手动补:reload `/app/api-keys`,`.keys-once-value` 消失、`.keys-row` 掩码仍在。
- **消费凭证。**(超出本 map)机器注册流程见 README「未入图面」。

## Gotchas

- 二次进入页面没有「新建」入口(列表态无该钮)——别把「按钮不在」当死按钮报 bug,那是空态专属。
- 明文只在创建响应出现一次:截图/断言要在响应当帧;之后任何视图都只有掩码。
- 断言「存哈希非明文」要看 DB 列 `keyHash` 与明文**不等**,不是只看列存在。
- teamId 取 `GET /api/teams[0].id`(单用户单团队恒一行)。
