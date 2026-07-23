PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_letter` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_number` text NOT NULL,
	`division` text,
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
INSERT INTO `__new_letter`("id", "reference_number", "division", "number", "subject", "from_whom", "received_date", "status", "created_by_role", "subject_officer_id", "relevant_officer_id", "reviewed_at", "subject_received_at", "subject_forwarded_at", "relevant_received_at", "action_taken_at", "action_notes", "created_at", "updated_at") SELECT "id", "reference_number", "division", "number", "subject", "from_whom", "received_date", "status", "created_by_role", "subject_officer_id", "relevant_officer_id", "reviewed_at", "subject_received_at", "subject_forwarded_at", "relevant_received_at", "action_taken_at", "action_notes", "created_at", "updated_at" FROM `letter`;--> statement-breakpoint
DROP TABLE `letter`;--> statement-breakpoint
ALTER TABLE `__new_letter` RENAME TO `letter`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `letter_reference_number_unique` ON `letter` (`reference_number`);--> statement-breakpoint
CREATE INDEX `letter_status_idx` ON `letter` (`status`);--> statement-breakpoint
CREATE INDEX `letter_division_idx` ON `letter` (`division`);--> statement-breakpoint
CREATE INDEX `letter_relevant_officer_idx` ON `letter` (`relevant_officer_id`);