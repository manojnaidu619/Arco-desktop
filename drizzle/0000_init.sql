-- Baseline migration. Uses `IF NOT EXISTS` so it applies cleanly to databases
-- that were created before migrations existed (their tables already exist).
-- This is intentional and ONLY for migration 0000 — later migrations are
-- generated normally by `npm run db:generate` and need no edits.
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`layout` integer DEFAULT 4 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`slot` integer DEFAULT 0 NOT NULL,
	`model_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`seq` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
