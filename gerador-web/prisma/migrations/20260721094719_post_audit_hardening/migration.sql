-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "AuthConfig" ADD COLUMN     "ldapCaCert" TEXT,
ADD COLUMN     "ldapTlsAllowSelfSigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BackupCode" ADD COLUMN     "prefix" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Invite" ALTER COLUMN "invitedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "ThemeConfig" ADD COLUMN     "loginPillText" TEXT DEFAULT 'Bem-vindo ao Sistema',
ADD COLUMN     "loginSubtitleText" TEXT DEFAULT 'Plataforma corporativa de autenticação e gestão de acessos com segurança avançada.',
ADD COLUMN     "loginTitleText" TEXT DEFAULT 'Acesso centralizado para a sua organização.';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorLastCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "assignedBy" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "BackupCode_prefix_idx" ON "BackupCode"("prefix");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
