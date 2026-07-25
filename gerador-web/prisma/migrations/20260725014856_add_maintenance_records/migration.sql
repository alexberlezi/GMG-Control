-- CreateEnum
CREATE TYPE "TipoManutencao" AS ENUM ('ABASTECIMENTO', 'TROCA_OLEO', 'ADITIVO', 'BATERIA', 'LIMPEZA', 'DEFEITO_AVARIA', 'OUTRO');

-- CreateTable
CREATE TABLE "RegistroManutencao" (
    "id" TEXT NOT NULL,
    "tipo" "TipoManutencao" NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "responsavelId" TEXT,
    "quantidade" DECIMAL(65,30),
    "unidadeMedida" TEXT,
    "custo" DECIMAL(65,30),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoManutencao" (
    "id" TEXT NOT NULL,
    "registroManutencaoId" TEXT NOT NULL,
    "caminhoArquivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnexoManutencao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroManutencao_dataHora_idx" ON "RegistroManutencao"("dataHora");

-- CreateIndex
CREATE INDEX "RegistroManutencao_tipo_idx" ON "RegistroManutencao"("tipo");

-- CreateIndex
CREATE INDEX "AnexoManutencao_registroManutencaoId_idx" ON "AnexoManutencao"("registroManutencaoId");

-- AddForeignKey
ALTER TABLE "RegistroManutencao" ADD CONSTRAINT "RegistroManutencao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoManutencao" ADD CONSTRAINT "AnexoManutencao_registroManutencaoId_fkey" FOREIGN KEY ("registroManutencaoId") REFERENCES "RegistroManutencao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
