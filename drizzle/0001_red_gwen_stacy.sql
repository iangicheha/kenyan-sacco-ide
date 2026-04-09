CREATE TABLE `auditLogs` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(255) NOT NULL,
	`operationId` varchar(64),
	`details` json NOT NULL,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversationHistory` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` enum('xlsx','csv','pdf','docx') NOT NULL,
	`fileSize` int,
	`s3Key` varchar(512),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flaggedCells` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`address` varchar(64) NOT NULL,
	`sheet` varchar(255) NOT NULL DEFAULT 'Sheet1',
	`flagType` enum('ghost_account','phantom_savings','unremitted_deduction','compliance_breach','data_anomaly') NOT NULL,
	`rationale` text NOT NULL,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flaggedCells_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pendingOperations` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`tool` varchar(64) NOT NULL,
	`address` varchar(64) NOT NULL,
	`sheet` varchar(255) NOT NULL DEFAULT 'Sheet1',
	`oldValue` text,
	`oldFormula` text,
	`newValue` text,
	`newFormula` text,
	`rationale` text NOT NULL,
	`affectedCells` json NOT NULL DEFAULT ('[]'),
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`decidedBy` varchar(64),
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pendingOperations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('active','archived','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spreadsheetGraphs` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`documentId` varchar(64) NOT NULL,
	`graphData` longtext NOT NULL,
	`activeSheet` varchar(255) NOT NULL DEFAULT 'Sheet1',
	`rowCount` int NOT NULL DEFAULT 0,
	`colCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spreadsheetGraphs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`versionNumber` int NOT NULL,
	`graphSnapshot` longtext NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','analyst','reviewer') NOT NULL DEFAULT 'analyst';--> statement-breakpoint
ALTER TABLE `users` ADD `institution` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `institutionType` enum('sacco','bank','microfinance','insurance','investment','other');