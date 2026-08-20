CREATE TABLE `serviceCharges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`detail` varchar(1000),
	`quantity` int NOT NULL,
	`unitPriceSatang` int NOT NULL,
	`status` enum('PENDING','INVOICED','VOID') NOT NULL DEFAULT 'PENDING',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceCharges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `issueRequestId` varchar(100);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_issueRequestId_unique` UNIQUE(`issueRequestId`);--> statement-breakpoint
CREATE INDEX `service_charges_visit_status_idx` ON `serviceCharges` (`visitId`,`status`);