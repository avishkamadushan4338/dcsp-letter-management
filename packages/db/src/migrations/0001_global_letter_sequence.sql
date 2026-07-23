DROP TABLE `letter_sequence`;--> statement-breakpoint
CREATE TABLE `letter_sequence` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
