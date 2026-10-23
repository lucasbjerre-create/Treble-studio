CREATE TABLE `assignments` (
	`entry_id` integer PRIMARY KEY NOT NULL,
	`institution` text,
	`course` text,
	`role` text,
	`team` text,
	`public_summary` text,
	`document_key` text,
	`artifact_audience` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chapters_person_id_idx` ON `chapters` (`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_person_slug_unique` ON `chapters` (`person_id`,`slug`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`chapter_id` integer,
	`trip_id` integer,
	`place_id` integer,
	`slug` text NOT NULL,
	`format` text NOT NULL,
	`category` text NOT NULL,
	`arc_stage` text,
	`status` text NOT NULL,
	`audience` text DEFAULT 'family' NOT NULL,
	`original_lang` text NOT NULL,
	`title` text NOT NULL,
	`dek` text,
	`body_md` text,
	`occurred_at` text NOT NULL,
	`ended_at` text,
	`timezone` text NOT NULL,
	`publish_after` text,
	`consent_status` text DEFAULT 'not_needed' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`group_map_opt_in` integer DEFAULT false NOT NULL,
	`camera_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entries_person_occurred_idx` ON `entries` (`person_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `entries_status_published_idx` ON `entries` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `entries_chapter_id_idx` ON `entries` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `entries_trip_id_idx` ON `entries` (`trip_id`);--> statement-breakpoint
CREATE INDEX `entries_place_id_idx` ON `entries` (`place_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_person_slug_unique` ON `entries` (`person_id`,`slug`);--> statement-breakpoint
CREATE TABLE `entry_tags` (
	`entry_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`entry_id`, `tag_id`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_tags_tag_id_idx` ON `entry_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `entry_texts` (
	`entry_id` integer NOT NULL,
	`lang` text NOT NULL,
	`title` text,
	`dek` text,
	`body_md` text,
	`status` text DEFAULT 'draft' NOT NULL,
	PRIMARY KEY(`entry_id`, `lang`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`source` text NOT NULL,
	`text` text,
	`lat_private` real,
	`lon_private` real,
	`media_keys_json` text,
	`status` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inbox_items_owner_id_idx` ON `inbox_items` (`owner_id`);--> statement-breakpoint
CREATE TABLE `legs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`from_place_id` integer NOT NULL,
	`to_place_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`mode` text NOT NULL,
	`geometry_json` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `legs_trip_id_idx` ON `legs` (`trip_id`);--> statement-breakpoint
CREATE INDEX `legs_person_id_idx` ON `legs` (`person_id`);--> statement-breakpoint
CREATE INDEX `legs_from_place_id_idx` ON `legs` (`from_place_id`);--> statement-breakpoint
CREATE INDEX `legs_to_place_id_idx` ON `legs` (`to_place_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`kind` text NOT NULL,
	`key_thumb` text,
	`key_display` text,
	`key_large` text,
	`poster_key` text,
	`mime` text,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`bytes` integer,
	`captured_at` text,
	`caption` text,
	`alt_text` text,
	`sha256` text,
	`phash` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_entry_id_idx` ON `media` (`entry_id`);--> statement-breakpoint
CREATE INDEX `media_owner_id_idx` ON `media` (`owner_id`);--> statement-breakpoint
CREATE TABLE `media_texts` (
	`media_id` integer NOT NULL,
	`lang` text NOT NULL,
	`caption` text,
	`alt_text` text,
	`status` text DEFAULT 'draft' NOT NULL,
	PRIMARY KEY(`media_id`, `lang`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`role` text NOT NULL,
	`route_color` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_slug_unique` ON `people` (`slug`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`country_code` text,
	`lat_private` real,
	`lon_private` real,
	`lat_public` real,
	`lon_public` real,
	`precision` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`name` text,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_entry_id_idx` ON `questions` (`entry_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`entry_id` integer NOT NULL,
	`kind` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`entry_id`, `kind`),
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`actor_id` integer,
	`from_status` text,
	`to_status` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_events_entry_id_idx` ON `review_events` (`entry_id`);--> statement-breakpoint
CREATE INDEX `review_events_actor_id_idx` ON `review_events` (`actor_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `trip_participants` (
	`trip_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	PRIMARY KEY(`trip_id`, `person_id`),
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trip_participants_person_id_idx` ON `trip_participants` (`person_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`title` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`summary` text,
	`cover_media_id` integer,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trips_person_id_idx` ON `trips` (`person_id`);--> statement-breakpoint
CREATE INDEX `trips_cover_media_id_idx` ON `trips` (`cover_media_id`);