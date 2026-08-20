CREATE TABLE `clinicalNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`subjective` text,
	`objective` text,
	`assessment` text,
	`plan` text,
	`status` enum('DRAFT','SIGNED') NOT NULL DEFAULT 'DRAFT',
	`revision` int NOT NULL DEFAULT 1,
	`authoredBy` int NOT NULL,
	`signedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinicalNotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinicalNotes_visitId_unique` UNIQUE(`visitId`)
);
--> statement-breakpoint
CREATE TABLE `visitDiagnoses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`code` varchar(32),
	`display` varchar(1000) NOT NULL,
	`rank` int NOT NULL,
	`enteredBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visitDiagnoses_id` PRIMARY KEY(`id`),
	CONSTRAINT `visit_diagnoses_rank_unique` UNIQUE(`visitId`,`rank`)
);
--> statement-breakpoint
ALTER TABLE `visits` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `clinical_notes_author_status_idx` ON `clinicalNotes` (`authoredBy`,`status`);--> statement-breakpoint
CREATE INDEX `visit_diagnoses_visit_idx` ON `visitDiagnoses` (`visitId`);