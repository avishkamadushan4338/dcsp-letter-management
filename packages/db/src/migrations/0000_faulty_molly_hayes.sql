CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`current_subject_officer_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`current_subject_officer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `letter` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_number` text NOT NULL,
	`division` text NOT NULL,
	`number` integer NOT NULL,
	`subject` text NOT NULL,
	`from_whom` text NOT NULL,
	`received_date` integer NOT NULL,
	`status` text NOT NULL,
	`created_by_role` text NOT NULL,
	`subject_officer_id` text NOT NULL,
	`relevant_officer_id` text,
	`reviewed_at` integer,
	`subject_received_at` integer,
	`subject_forwarded_at` integer,
	`relevant_received_at` integer,
	`action_taken_at` integer,
	`action_notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`subject_officer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relevant_officer_id`) REFERENCES `officer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letter_reference_number_unique` ON `letter` (`reference_number`);--> statement-breakpoint
CREATE INDEX `letter_status_idx` ON `letter` (`status`);--> statement-breakpoint
CREATE INDEX `letter_division_idx` ON `letter` (`division`);--> statement-breakpoint
CREATE INDEX `letter_relevant_officer_idx` ON `letter` (`relevant_officer_id`);--> statement-breakpoint
CREATE TABLE `letter_link` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`letter_id` text NOT NULL,
	`role` text NOT NULL,
	`invalidated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`letter_id`) REFERENCES `letter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letter_link_token_unique` ON `letter_link` (`token`);--> statement-breakpoint
CREATE INDEX `letter_link_letter_idx` ON `letter_link` (`letter_id`);--> statement-breakpoint
CREATE TABLE `letter_reassignment` (
	`id` text PRIMARY KEY NOT NULL,
	`letter_id` text NOT NULL,
	`from_officer_id` text NOT NULL,
	`to_officer_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`letter_id`) REFERENCES `letter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_officer_id`) REFERENCES `officer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_officer_id`) REFERENCES `officer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `letter_reassignment_letter_idx` ON `letter_reassignment` (`letter_id`);--> statement-breakpoint
CREATE TABLE `letter_sequence` (
	`division` text PRIMARY KEY NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `officer` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`position` text NOT NULL,
	`division` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `officer_division_idx` ON `officer` (`division`);