CREATE TABLE IF NOT EXISTS `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `models_author_slug_unique` ON `models` (`author`,`slug`);
