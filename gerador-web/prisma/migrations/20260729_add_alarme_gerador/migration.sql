-- CreateEnum
CREATE TYPE "NivelAlarme" AS ENUM ('CRITICO', 'AVISO', 'INFO');

-- CreateEnum
CREATE TYPE "TipoAlarme" AS ENUM ('TEMPERATURA_ALTA', 'TEMPERATURA_SENSOR_ERRO', 'COMBUSTIVEL_BAIXO', 'BATERIA_BAIXA', 'FREQUENCIA_FORA_ESPECIFICACAO', 'TENSAO_REDE_FORA_ESPECIFICACAO', 'TENSAO_GERADOR_FORA_ESPECIFICACAO', 'CORRENTE_ALTA', 'FALHA_REDE', 'MANUTENCAO_NECESSARIA', 'SENSOR_ERRO', 'OUTRO');

-- CreateTable
CREATE TABLE "AlarmeGerador" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlarme" NOT NULL,
    "nivel" "NivelAlarme" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(65,30),
    "unidade" TEXT,
    "acionadoEm" TIMESTAMP(3) NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvidoEm" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlarmeGerador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlarmeGerador_acionadoEm_idx" ON "AlarmeGerador"("acionadoEm");

-- CreateIndex
CREATE INDEX "AlarmeGerador_tipo_idx" ON "AlarmeGerador"("tipo");

-- CreateIndex
CREATE INDEX "AlarmeGerador_nivel_idx" ON "AlarmeGerador"("nivel");

-- CreateIndex
CREATE INDEX "AlarmeGerador_resolvido_idx" ON "AlarmeGerador"("resolvido");
