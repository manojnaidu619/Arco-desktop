-- Adds hex color to the models library table.
-- Models are keyed by author + slug (OpenRouter convention); full ID = `${author}/${slug}`.
ALTER TABLE `models` ADD COLUMN `color` text NOT NULL DEFAULT '#64748b';
