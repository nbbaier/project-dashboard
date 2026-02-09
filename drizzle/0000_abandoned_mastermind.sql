CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goals_name_unique` ON `goals` (`name`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `index_notes_on_project_id_and_created_at` ON `notes` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`goal_id` integer NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_project_goals_on_project_id_and_goal_id` ON `project_goals` (`project_id`,`goal_id`);--> statement-breakpoint
CREATE INDEX `index_project_goals_on_goal_id` ON `project_goals` (`goal_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`last_commit_date` text NOT NULL,
	`last_commit_message` text,
	`metadata` text,
	`is_fork` integer DEFAULT false NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`last_viewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `index_projects_on_name` ON `projects` (`name`);--> statement-breakpoint
CREATE INDEX `index_projects_on_last_commit_date` ON `projects` (`last_commit_date`);--> statement-breakpoint
CREATE INDEX `index_projects_on_last_viewed_at` ON `projects` (`last_viewed_at`);--> statement-breakpoint
CREATE TABLE `taggings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `index_taggings_on_project_id_and_tag_id` ON `taggings` (`project_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `index_taggings_on_tag_id` ON `taggings` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TRIGGER trg_projects_updated_at AFTER UPDATE ON `projects`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `projects` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;--> statement-breakpoint
CREATE TRIGGER trg_tags_updated_at AFTER UPDATE ON `tags`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `tags` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;--> statement-breakpoint
CREATE TRIGGER trg_taggings_updated_at AFTER UPDATE ON `taggings`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `taggings` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;--> statement-breakpoint
CREATE TRIGGER trg_notes_updated_at AFTER UPDATE ON `notes`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `notes` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;--> statement-breakpoint
CREATE TRIGGER trg_goals_updated_at AFTER UPDATE ON `goals`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `goals` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;--> statement-breakpoint
CREATE TRIGGER trg_project_goals_updated_at AFTER UPDATE ON `project_goals`
WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN UPDATE `project_goals` SET `updated_at` = unixepoch() WHERE `id` = NEW.`id`; END;