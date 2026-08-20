CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(96) NOT NULL,
	`actorUserId` int NOT NULL,
	`actorRole` enum('SYSTEM_ADMIN','DOCTOR','ASSISTANT') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`outcome` enum('ALLOWED','DENIED','FAILED') NOT NULL,
	`requestId` varchar(100) NOT NULL,
	`metadata` varchar(1000),
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hn` varchar(24) NOT NULL,
	`firstName` varchar(120) NOT NULL,
	`lastName` varchar(120) NOT NULL,
	`dateOfBirth` date NOT NULL,
	`gender` enum('MALE','FEMALE','OTHER','UNSPECIFIED') NOT NULL DEFAULT 'UNSPECIFIED',
	`phone` varchar(32),
	`address` text,
	`allergySummary` varchar(1000),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`),
	CONSTRAINT `patients_hn_unique` UNIQUE(`hn`)
);
--> statement-breakpoint
CREATE TABLE `queueEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`queueDate` date NOT NULL,
	`queueNumber` int NOT NULL,
	`status` enum('WAITING','CALLED','IN_CONSULT','COMPLETED','CANCELLED') NOT NULL DEFAULT 'WAITING',
	`assignedTo` int,
	`calledAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queueEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `queueEntries_visitId_unique` UNIQUE(`visitId`),
	CONSTRAINT `queue_date_number_unique` UNIQUE(`queueDate`,`queueNumber`)
);
--> statement-breakpoint
CREATE TABLE `triageRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`bloodPressureSystolic` int,
	`bloodPressureDiastolic` int,
	`pulse` int,
	`temperatureCelsius` decimal(4,1),
	`oxygenSaturation` int,
	`weightKg` decimal(5,2),
	`heightCm` decimal(5,2),
	`triageNote` varchar(2000),
	`urgency` enum('ROUTINE','PRIORITY','URGENT') NOT NULL DEFAULT 'ROUTINE',
	`performedBy` int NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `triageRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `triageRecords_visitId_unique` UNIQUE(`visitId`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`visitDate` date NOT NULL,
	`chiefComplaint` varchar(2000) NOT NULL,
	`status` enum('REGISTERED','TRIAGED','WAITING_DOCTOR','IN_CONSULT','DISPENSING','BILLED','CLOSED','CANCELLED') NOT NULL DEFAULT 'REGISTERED',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_actor_time_idx` ON `auditEvents` (`actorUserId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditEvents` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `patients_name_idx` ON `patients` (`lastName`,`firstName`);--> statement-breakpoint
CREATE INDEX `queue_date_status_idx` ON `queueEntries` (`queueDate`,`status`);--> statement-breakpoint
CREATE INDEX `triage_performed_at_idx` ON `triageRecords` (`performedAt`);--> statement-breakpoint
CREATE INDEX `visits_patient_idx` ON `visits` (`patientId`);--> statement-breakpoint
CREATE INDEX `visits_date_status_idx` ON `visits` (`visitDate`,`status`);