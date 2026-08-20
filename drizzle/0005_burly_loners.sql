ALTER TABLE `patients` ADD `nationalIdCiphertext` varchar(512);--> statement-breakpoint
ALTER TABLE `patients` ADD `nationalIdLookupHash` varchar(64);--> statement-breakpoint
ALTER TABLE `patients` ADD `nationalIdSetAt` timestamp;--> statement-breakpoint
ALTER TABLE `patients` ADD `nationalIdSetBy` int;--> statement-breakpoint
ALTER TABLE `patients` ADD CONSTRAINT `patients_national_id_hash_unique` UNIQUE(`nationalIdLookupHash`);