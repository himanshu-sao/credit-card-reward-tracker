CREATE TABLE `benefit` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer,
	`value_descriptor` text NOT NULL,
	`cadence` text NOT NULL,
	`reset_anchor` text NOT NULL,
	`rules` text NOT NULL,
	`enrollment_required` integer NOT NULL,
	`status` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`source_url` text NOT NULL,
	`last_verified_at` text NOT NULL,
	`verification` text NOT NULL,
	`note` text,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `benefit_card_idx` ON `benefit` (`card_id`);--> statement-breakpoint
CREATE TABLE `benefit_instance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`user_card_id` text NOT NULL,
	`benefit_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`amount_available` integer NOT NULL,
	`amount_used` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`expiry_notified_at` text,
	FOREIGN KEY (`user_card_id`) REFERENCES `user_card`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`benefit_id`) REFERENCES `benefit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `benefit_instance_user_card_idx` ON `benefit_instance` (`user_card_id`);--> statement-breakpoint
CREATE INDEX `benefit_instance_benefit_idx` ON `benefit_instance` (`benefit_id`);--> statement-breakpoint
CREATE TABLE `card` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`name` text NOT NULL,
	`fee_cents` integer NOT NULL,
	`network` text NOT NULL,
	`currency_id` text NOT NULL,
	`source_url` text NOT NULL,
	`last_verified_at` text NOT NULL,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `catalog_change` (
	`id` text PRIMARY KEY NOT NULL,
	`benefit_id` text NOT NULL,
	`change_type` text NOT NULL,
	`before` text,
	`after` text,
	`effective_date` text NOT NULL,
	`source_url` text,
	`reviewed_by` text,
	FOREIGN KEY (`benefit_id`) REFERENCES `benefit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `catalog_change_benefit_idx` ON `catalog_change` (`benefit_id`);--> statement-breakpoint
CREATE TABLE `currency` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`default_cents_per_point` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `overlap_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`benefit_ids` text NOT NULL,
	`rule_type` text NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`benefit_instance_id` text NOT NULL,
	`send_at` text NOT NULL,
	`channel` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`benefit_instance_id`) REFERENCES `benefit_instance`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminder_instance_idx` ON `reminder` (`benefit_instance_id`);--> statement-breakpoint
CREATE TABLE `threshold_tracker` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`user_card_id` text NOT NULL,
	`benefit_id` text,
	`calendar_year` text NOT NULL,
	`spend_to_date` integer DEFAULT 0 NOT NULL,
	`threshold` integer NOT NULL,
	`awarded_at` text,
	FOREIGN KEY (`user_card_id`) REFERENCES `user_card`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`benefit_id`) REFERENCES `benefit`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `threshold_tracker_user_card_idx` ON `threshold_tracker` (`user_card_id`);--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`account_id` text,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`merchant` text,
	`category` text,
	`raw_description` text
);
--> statement-breakpoint
CREATE TABLE `usage_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`benefit_instance_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`transaction_id` text,
	`confidence` integer,
	FOREIGN KEY (`benefit_instance_id`) REFERENCES `benefit_instance`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `usage_event_instance_idx` ON `usage_event` (`benefit_instance_id`);--> statement-breakpoint
CREATE TABLE `user_card` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`card_id` text NOT NULL,
	`open_date` text NOT NULL,
	`anniversary_date` text,
	`fee_date` text,
	`nickname` text,
	`is_authorized_user` integer DEFAULT false NOT NULL,
	`linked_account_id` text,
	`last_four` text(4),
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_valuation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'local' NOT NULL,
	`benefit_id` text,
	`currency_id` text,
	`value_pct_bp` integer,
	`cents_per_point` integer,
	FOREIGN KEY (`benefit_id`) REFERENCES `benefit`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`currency_id`) REFERENCES `currency`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_valuation_unique` ON `user_valuation` (`user_id`,`benefit_id`,`currency_id`);