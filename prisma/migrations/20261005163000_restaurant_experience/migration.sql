CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

ALTER TABLE "restaurants"
ADD COLUMN "description" TEXT,
ADD COLUMN "chefName" TEXT,
ADD COLUMN "chefVideoUrl" TEXT,
ADD COLUMN "translations" JSONB;

ALTER TABLE "dishes"
ADD COLUMN "story" TEXT,
ADD COLUMN "chefVideoUrl" TEXT,
ADD COLUMN "season" TEXT,
ADD COLUMN "dayPeriod" TEXT,
ADD COLUMN "translations" JSONB;

CREATE TABLE "wine_pairings" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "producer" TEXT,
    "intensity" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wine_pairings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingredient_origins" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "ingredient" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "supplier" TEXT,
    "story" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    CONSTRAINT "ingredient_origins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_tables" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 50,
    "y" INTEGER NOT NULL DEFAULT 50,
    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL,
    "note" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dinner_timeline_events" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "dinner_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wine_pairings_dishId_name_key" ON "wine_pairings"("dishId", "name");
CREATE UNIQUE INDEX "restaurant_tables_restaurantId_name_key" ON "restaurant_tables"("restaurantId", "name");
CREATE INDEX "reservations_restaurantId_startsAt_idx" ON "reservations"("restaurantId", "startsAt");
CREATE INDEX "reservations_tableId_startsAt_idx" ON "reservations"("tableId", "startsAt");

ALTER TABLE "wine_pairings"
ADD CONSTRAINT "wine_pairings_dishId_fkey"
FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ingredient_origins"
ADD CONSTRAINT "ingredient_origins_dishId_fkey"
FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "restaurant_tables"
ADD CONSTRAINT "restaurant_tables_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "reservations_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "reservations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dinner_timeline_events"
ADD CONSTRAINT "dinner_timeline_events_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
