-- Categories now live in inventory_category (moved by 0023).
ALTER TABLE "inventory_item" DROP COLUMN "category";