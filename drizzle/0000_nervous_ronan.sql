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
CREATE INDEX `index_notes_on_project_id` ON `notes` (`project_id`);--> statement-breakpoint
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
CREATE INDEX `index_project_goals_on_project_id` ON `project_goals` (`project_id`);--> statement-breakpoint
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
CREATE INDEX `index_projects_on_is_fork` ON `projects` (`is_fork`);--> statement-breakpoint
CREATE INDEX `index_projects_on_last_commit_date` ON `projects` (`last_commit_date`);--> statement-breakpoint
CREATE INDEX `index_projects_on_last_viewed_at` ON `projects` (`last_viewed_at`);--> statement-breakpoint
CREATE INDEX `index_projects_on_pinned` ON `projects` (`pinned`);--> statement-breakpoint
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
CREATE INDEX `index_taggings_on_project_id` ON `taggings` (`project_id`);--> statement-breakpoint
CREATE INDEX `index_taggings_on_tag_id` ON `taggings` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);