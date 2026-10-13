-- The label of an entry becomes the name of its counterparty (supplier, sponsor, school…).
ALTER TABLE "treasury_transaction" RENAME COLUMN "label" TO "counterparty";
