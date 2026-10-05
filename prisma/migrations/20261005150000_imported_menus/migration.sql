ALTER TABLE "restaurants"
ADD COLUMN "country" TEXT,
ADD COLUMN "rating" INTEGER,
ADD COLUMN "usdToKztRate" DECIMAL(10, 2),
ADD COLUMN "rateDate" TIMESTAMP(3),
ADD COLUMN "importKey" TEXT;

ALTER TABLE "restaurants"
ALTER COLUMN "ownerId" DROP NOT NULL;

ALTER TABLE "dishes"
ADD COLUMN "description" TEXT,
ADD COLUMN "priceUsd" INTEGER,
ADD COLUMN "importKey" TEXT;

CREATE UNIQUE INDEX "restaurants_importKey_key" ON "restaurants"("importKey");
CREATE UNIQUE INDEX "dishes_importKey_key" ON "dishes"("importKey");
