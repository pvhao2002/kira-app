CREATE TABLE `agent_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`log` text DEFAULT '' NOT NULL,
	`article_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`category_slug` text NOT NULL,
	`difficulty` text DEFAULT 'mid' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`read_minutes` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text DEFAULT 'human' NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`category_slug`) REFERENCES `categories`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_category` ON `articles` (`status`,`category_slug`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`user_id` integer NOT NULL,
	`article_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `article_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ip_geo` (
	`ip` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`country` text,
	`country_code` text,
	`region` text,
	`region_name` text,
	`city` text,
	`zip` text,
	`lat` real,
	`lon` real,
	`timezone` text,
	`isp` text,
	`org` text,
	`as_name` text,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`domain` text NOT NULL,
	`difficulty` text NOT NULL,
	`context` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`code_lang` text DEFAULT '' NOT NULL,
	`companies` text DEFAULT '[]' NOT NULL,
	`urgency` text DEFAULT 'standard' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`article_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text NOT NULL,
	`path` text NOT NULL,
	`article_id` integer,
	`user_id` integer,
	`referrer` text DEFAULT '' NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`scroll_pct` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `visits_created` ON `visits` (`created_at`);--> statement-breakpoint
CREATE INDEX `visits_article` ON `visits` (`article_id`);