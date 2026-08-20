CREATE TABLE `clinicalOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`status` enum('DRAFT','SIGNED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`revision` int NOT NULL DEFAULT 1,
	`createdBy` int NOT NULL,
	`signedBy` int,
	`signedAt` timestamp,
	`signRequestId` varchar(100),
	`cancelledBy` int,
	`cancelledAt` timestamp,
	`cancelReason` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clinicalOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `clinicalOrders_visitId_unique` UNIQUE(`visitId`),
	CONSTRAINT `clinicalOrders_signRequestId_unique` UNIQUE(`signRequestId`)
);
--> statement-breakpoint
CREATE TABLE `dispensationItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispensationId` int NOT NULL,
	`medicationOrderItemId` int NOT NULL,
	`inventoryLotId` int NOT NULL,
	`quantityDispensed` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dispensationItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `dispense_item_order_unique` UNIQUE(`dispensationId`,`medicationOrderItemId`)
);
--> statement-breakpoint
CREATE TABLE `dispensations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`clinicalOrderId` int NOT NULL,
	`status` enum('PENDING','COMPLETED','VOIDED') NOT NULL DEFAULT 'PENDING',
	`requestId` varchar(100),
	`dispensedBy` int,
	`completedAt` timestamp,
	`voidedBy` int,
	`voidedAt` timestamp,
	`voidReason` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dispensations_id` PRIMARY KEY(`id`),
	CONSTRAINT `dispensations_visitId_unique` UNIQUE(`visitId`),
	CONSTRAINT `dispensations_clinicalOrderId_unique` UNIQUE(`clinicalOrderId`),
	CONSTRAINT `dispensations_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `inventoryLots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`medicationId` int NOT NULL,
	`lotNumber` varchar(120) NOT NULL,
	`expiryDate` date NOT NULL,
	`receivedQuantity` int NOT NULL,
	`remainingQuantity` int NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`receivedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryLots_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_lot_unique` UNIQUE(`medicationId`,`lotNumber`)
);
--> statement-breakpoint
CREATE TABLE `invoiceLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`sourceType` varchar(64) NOT NULL,
	`sourceId` varchar(64) NOT NULL,
	`descriptionSnapshot` varchar(1000) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceSatang` int NOT NULL,
	`lineTotalSatang` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceLines_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_line_source_unique` UNIQUE(`invoiceId`,`sourceType`,`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `invoiceVoids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`reason` varchar(500) NOT NULL,
	`voidedBy` int NOT NULL,
	`voidedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceVoids_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoiceVoids_invoiceId_unique` UNIQUE(`invoiceId`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` int NOT NULL,
	`invoiceNumber` varchar(48) NOT NULL,
	`status` enum('DRAFT','ISSUED','PAID','VOID') NOT NULL DEFAULT 'DRAFT',
	`totalSatang` int NOT NULL DEFAULT 0,
	`issuedBy` int NOT NULL,
	`issuedAt` timestamp,
	`paidAt` timestamp,
	`voidedBy` int,
	`voidedAt` timestamp,
	`voidReason` varchar(500),
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_visitId_unique` UNIQUE(`visitId`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `medicationOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicalOrderId` int NOT NULL,
	`medicationId` int NOT NULL,
	`medicationNameSnapshot` varchar(600) NOT NULL,
	`dosageFormSnapshot` varchar(120) NOT NULL,
	`strengthSnapshot` varchar(120) NOT NULL,
	`dose` varchar(255) NOT NULL,
	`frequency` varchar(255) NOT NULL,
	`duration` varchar(255),
	`quantityPrescribed` int NOT NULL,
	`instructions` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicationOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicationPrices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`medicationId` int NOT NULL,
	`unitPriceSatang` int NOT NULL,
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`effectiveTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicationPrices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`genericName` varchar(255) NOT NULL,
	`tradeName` varchar(255),
	`dosageForm` varchar(120) NOT NULL,
	`strength` varchar(120) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medications_id` PRIMARY KEY(`id`),
	CONSTRAINT `medications_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`paymentMethod` enum('CASH','EXTERNAL_REFERENCE') NOT NULL,
	`amountSatang` int NOT NULL,
	`externalReference` varchar(255),
	`idempotencyKey` varchar(100) NOT NULL,
	`receivedBy` int NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryLotId` int NOT NULL,
	`movementType` enum('RECEIVE','DISPENSE','ADJUST','RETURN','VOID') NOT NULL,
	`quantityDelta` int NOT NULL,
	`referenceType` varchar(64) NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`idempotencyKey` varchar(100) NOT NULL,
	`performedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`),
	CONSTRAINT `stockMovements_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE INDEX `clinical_orders_status_idx` ON `clinicalOrders` (`status`,`signedAt`);--> statement-breakpoint
CREATE INDEX `dispense_items_lot_idx` ON `dispensationItems` (`inventoryLotId`);--> statement-breakpoint
CREATE INDEX `dispensations_status_idx` ON `dispensations` (`status`,`completedAt`);--> statement-breakpoint
CREATE INDEX `inventory_lots_available_idx` ON `inventoryLots` (`medicationId`,`expiryDate`,`remainingQuantity`);--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice_idx` ON `invoiceLines` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `invoices_status_issued_idx` ON `invoices` (`status`,`issuedAt`);--> statement-breakpoint
CREATE INDEX `medication_order_items_order_idx` ON `medicationOrderItems` (`clinicalOrderId`);--> statement-breakpoint
CREATE INDEX `medication_order_items_medication_idx` ON `medicationOrderItems` (`medicationId`);--> statement-breakpoint
CREATE INDEX `medication_prices_lookup_idx` ON `medicationPrices` (`medicationId`,`isActive`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `medications_active_name_idx` ON `medications` (`isActive`,`genericName`);--> statement-breakpoint
CREATE INDEX `payments_invoice_time_idx` ON `payments` (`invoiceId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `stock_movements_lot_time_idx` ON `stockMovements` (`inventoryLotId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `stock_movements_reference_idx` ON `stockMovements` (`referenceType`,`referenceId`);