CREATE TABLE `follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`person_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_email_person_unique` ON `follows` (`email`,`person_id`);--> statement-breakpoint
CREATE INDEX `follows_person_id_idx` ON `follows` (`person_id`);--> statement-breakpoint
CREATE TABLE `login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_codes_email_idx` ON `login_codes` (`email`);