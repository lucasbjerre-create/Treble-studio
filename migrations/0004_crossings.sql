CREATE TABLE `crossings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`place_id` integer NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crossing_participants` (
	`crossing_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`confirmed_at` text,
	PRIMARY KEY(`crossing_id`, `person_id`),
	FOREIGN KEY (`crossing_id`) REFERENCES `crossings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `crossing_participants_person_id_idx` ON `crossing_participants` (`person_id`);
