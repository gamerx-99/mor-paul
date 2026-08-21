CREATE TABLE `clinicalPresets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`doctorId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(500),
	`diagnosesJson` text NOT NULL,
	`medicationsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinicalPresets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dailyCloseouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`closeoutDate` date NOT NULL,
	`closedBy` int NOT NULL,
	`totalCashExpectedSatang` int NOT NULL,
	`totalCashCountedSatang` int NOT NULL,
	`cashDifferenceSatang` int NOT NULL,
	`totalPromptPaySatang` int NOT NULL,
	`totalOtherSatang` int NOT NULL,
	`totalRevenueSatang` int NOT NULL,
	`totalInvoicesCount` int NOT NULL,
	`notes` varchar(500),
	`closedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyCloseouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyCloseouts_closeoutDate_unique` UNIQUE(`closeoutDate`)
);
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `paymentMethod` enum('CASH','PROMPTPAY','EXTERNAL_REFERENCE','CREDIT_CARD') NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `subtotalSatang` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountSatang` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountReason` varchar(500);--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountApprovedBy` int;--> statement-breakpoint
ALTER TABLE `medications` ADD `minStockThreshold` int DEFAULT 10 NOT NULL;--> statement-breakpoint
CREATE INDEX `clinical_presets_doctor_idx` ON `clinicalPresets` (`doctorId`);--> statement-breakpoint
CREATE INDEX `daily_closeouts_date_idx` ON `dailyCloseouts` (`closeoutDate`);