CREATE TABLE `app_settings` (
	`setting_key` text PRIMARY KEY NOT NULL,
	`setting_value` text
);
--> statement-breakpoint
CREATE TABLE `letter_reassignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`letter_id` integer NOT NULL,
	`from_officer_id` integer NOT NULL,
	`to_officer_id` integer NOT NULL,
	`note` text,
	`reassigned_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_reassign_letter` ON `letter_reassignments` (`letter_id`);--> statement-breakpoint
CREATE TABLE `letters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`letter_number` text NOT NULL,
	`division` text NOT NULL,
	`subject` text,
	`sender_name` text,
	`received_date` text,
	`subject_officer_id` integer,
	`relevant_officer_id` integer,
	`created_by_role` text DEFAULT 'dcs' NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`subject_officer_received_at` text,
	`sent_to_relevant_at` text,
	`relevant_officer_received_at` text,
	`action_taken_at` text,
	`action_notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `letters_letter_number_unique` ON `letters` (`letter_number`);--> statement-breakpoint
CREATE INDEX `idx_letters_division` ON `letters` (`division`);--> statement-breakpoint
CREATE INDEX `idx_letters_status` ON `letters` (`status`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`letter_id` integer NOT NULL,
	`officer_role` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_token_unique` ON `links` (`token`);--> statement-breakpoint
CREATE INDEX `idx_links_letter` ON `links` (`letter_id`);--> statement-breakpoint
CREATE TABLE `number_sequence` (
	`division` text PRIMARY KEY NOT NULL,
	`current_number` integer DEFAULT 0 NOT NULL,
	`year` integer NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `officers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`designation` text,
	`division` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uq_officers_email` ON `officers` (`email`);