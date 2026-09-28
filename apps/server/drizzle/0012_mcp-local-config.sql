DROP TABLE `mcp_server`;--> statement-breakpoint
-- spec 13 (#368): agent.mcpServers 旧值 = mcp_server 表 slug,随登记制撤除失效——
-- 清空死引用(重新勾选走本地 config 源);旧行已由 db/legacy-export.ts 在 drop 前
-- 导出至 ~/.pacman/legacy-export-<ts>.json。
UPDATE `agent` SET `mcpServers` = '[]';
