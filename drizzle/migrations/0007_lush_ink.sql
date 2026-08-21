create table "soapTemplates" (
  "id" serial primary key,
  "serviceType" varchar(40) not null,
  "name" varchar(120) not null,
  "subjectiveTemplate" text not null,
  "objectiveTemplate" text not null,
  "assessmentTemplate" text not null,
  "planTemplate" text not null,
  "isActive" boolean not null default true,
  "createdBy" integer not null,
  "createdAt" timestamp not null default now(),
  "updatedAt" timestamp not null default now()
);
create index "soap_templates_service_idx" on "soapTemplates" ("serviceType", "isActive");
