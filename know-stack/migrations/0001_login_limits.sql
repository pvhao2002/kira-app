CREATE TABLE `login_failures` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visits_ip_created` ON `visits` (`ip`,`created_at`);