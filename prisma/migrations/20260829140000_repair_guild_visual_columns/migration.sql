-- Repara bancos onde a migration de funcionalidades já foi marcada como aplicada
-- antes das colunas visuais serem adicionadas ao arquivo original.
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#5865F2';
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "backgroundUrl" TEXT;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "slowmodeSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;
