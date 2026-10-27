CREATE TABLE `media_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_id` integer NOT NULL,
	`name` text NOT NULL,
	`box_x` real NOT NULL,
	`box_y` real NOT NULL,
	`box_w` real NOT NULL,
	`box_h` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_people_media_id_idx` ON `media_people` (`media_id`);
