ALTER TABLE `agent` ADD `fallbackModels` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `step` ADD `attempts` text;--> statement-breakpoint
ALTER TABLE `step` ADD `failureKind` text;