ALTER TABLE "Guild"
ADD COLUMN IF NOT EXISTS "discoverable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Guild_discoverable_idx"
ON "Guild"("discoverable");
