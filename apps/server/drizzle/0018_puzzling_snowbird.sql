PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_agent` (
	`id` text PRIMARY KEY NOT NULL,
	`teamId` text NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`avatarUrl` text,
	`provider` text,
	`modelId` text,
	`thinkingLevel` text,
	`tools` text,
	`secrets` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`mcpServers` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`teamId`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_agent`("id", "teamId", "displayName", "description", "status", "avatarUrl", "provider", "modelId", "thinkingLevel", "tools", "secrets", "skills", "mcpServers") SELECT "id", "teamId", "displayName", "description", "status", "avatarUrl", "provider", "modelId", "thinkingLevel", "tools", "secrets", "skills", "mcpServers" FROM `agent`;--> statement-breakpoint
DROP TABLE `agent`;--> statement-breakpoint
ALTER TABLE `__new_agent` RENAME TO `agent`;--> statement-breakpoint
PRAGMA foreign_keys=ON;