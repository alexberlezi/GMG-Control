/**
 * 🚨 ATENÇÃO: FAÇA BACKUP DO BANCO ANTES DE RODAR ESTE SCRIPT! 🚨
 * 
 * Este script cifra segredos em texto claro (Backfill) e converte as tabelas
 * de configuração para o padrão Singleton (id: 'default').
 * 
 * Uso:
 * - Dry-run (Apenas leitura/Relatório): npx tsx scripts/migrate-secrets.ts --dry-run
 * - Executar e gravar: npx tsx scripts/migrate-secrets.ts
 */

import { config } from 'dotenv';
config();

import { db } from '../src/lib/db';
import { encrypt } from '../src/lib/auth/secrets';

function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return true; // null counts as "not needing encryption"
  return /^\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

async function migrateSecrets() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n=== MIGRATING SECRETS (DRY-RUN: ${dryRun}) ===\n`);

  if (!dryRun) {
    console.log('⚠️ AVISO: Executando alterações no banco de dados. Espera-se que você tenha um backup!\n');
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. AuthConfig
      console.log('--- Verificando AuthConfig ---');
      const authConfigs = await tx.authConfig.findMany();
      if (authConfigs.length > 1) {
        throw new Error('Múltiplas linhas de configuração detectadas na tabela AuthConfig. Esperado apenas 1.');
      }
      const authConfig = authConfigs[0];
    
      if (authConfig) {
      const authUpdates: any = {};
      let needsAuthUpdate = false;

      // Migrate ID to 'default'
      if (authConfig.id !== 'default') {
        console.log(`[AuthConfig] Renomeando ID de '${authConfig.id}' para 'default'`);
        authUpdates.id = 'default';
        needsAuthUpdate = true;
      }

      // Encrypt fields
      const authFields: (keyof typeof authConfig)[] = [
        'ldapBindPassword',
        'googleClientSecret',
        'githubClientSecret',
        'microsoftClientSecret',
        'facebookClientSecret',
        'turnstileSecretKey'
      ];

      for (const field of authFields) {
        const val = authConfig[field] as string | null;
        if (val && !isEncrypted(val)) {
          console.log(`[AuthConfig] Criptografando campo: ${field}`);
          authUpdates[field] = encrypt(val);
          needsAuthUpdate = true;
        }
      }

      if (needsAuthUpdate) {
        if (!dryRun) {
          // Note: Prisma might not allow updating the @id field directly via .update() 
          // So we use executeRaw for the ID change if needed, or recreate.
          // However, using raw SQL is safest for PK changes without cascades.
            if (authUpdates.id) {
              await tx.$executeRaw`UPDATE "AuthConfig" SET id = 'default' WHERE id = ${authConfig.id}`;
              delete authUpdates.id; // handled
            }
            if (Object.keys(authUpdates).length > 0) {
              await tx.authConfig.update({ where: { id: 'default' }, data: authUpdates });
            }
            console.log('[AuthConfig] Atualizado com sucesso.');
          } else {
            console.log('[AuthConfig] (Dry-run) Alterações puladas.');
          }
        } else {
          console.log('[AuthConfig] Nenhuma alteração necessária.');
        }
      } else {
        console.log('[AuthConfig] Tabela vazia.');
      }

      // 2. EmailConfig
      console.log('\n--- Verificando EmailConfig ---');
      const emailConfigs = await tx.emailConfig.findMany();
      if (emailConfigs.length > 1) {
        throw new Error('Múltiplas linhas de configuração detectadas na tabela EmailConfig. Esperado apenas 1.');
      }
      const emailConfig = emailConfigs[0];
      
      if (emailConfig) {
        const emailUpdates: any = {};
        let needsEmailUpdate = false;

        if (emailConfig.id !== 'default') {
          console.log(`[EmailConfig] Renomeando ID de '${emailConfig.id}' para 'default'`);
          emailUpdates.id = 'default';
          needsEmailUpdate = true;
        }

        const emailFields: (keyof typeof emailConfig)[] = ['smtpPass', 'apiKey'];
        for (const field of emailFields) {
          const val = emailConfig[field] as string | null;
          if (val && !isEncrypted(val)) {
            console.log(`[EmailConfig] Criptografando campo: ${field}`);
            emailUpdates[field] = encrypt(val);
            needsEmailUpdate = true;
          }
        }

        if (needsEmailUpdate) {
          if (!dryRun) {
            if (emailUpdates.id) {
              await tx.$executeRaw`UPDATE "EmailConfig" SET id = 'default' WHERE id = ${emailConfig.id}`;
              delete emailUpdates.id;
            }
            if (Object.keys(emailUpdates).length > 0) {
              await tx.emailConfig.update({ where: { id: 'default' }, data: emailUpdates });
            }
            console.log('[EmailConfig] Atualizado com sucesso.');
          } else {
            console.log('[EmailConfig] (Dry-run) Alterações puladas.');
          }
        } else {
          console.log('[EmailConfig] Nenhuma alteração necessária.');
        }
      } else {
        console.log('[EmailConfig] Tabela vazia.');
      }

      // 3. ThemeConfig
      console.log('\n--- Verificando ThemeConfig ---');
      const themeConfigs = await tx.themeConfig.findMany();
      if (themeConfigs.length > 1) {
        throw new Error('Múltiplas linhas de configuração detectadas na tabela ThemeConfig. Esperado apenas 1.');
      }
      const themeConfig = themeConfigs[0];
      
      if (themeConfig && themeConfig.id !== 'default') {
        console.log(`[ThemeConfig] Renomeando ID de '${themeConfig.id}' para 'default'`);
        if (!dryRun) {
          await tx.$executeRaw`UPDATE "ThemeConfig" SET id = 'default' WHERE id = ${themeConfig.id}`;
          console.log('[ThemeConfig] Atualizado com sucesso.');
        } else {
          console.log('[ThemeConfig] (Dry-run) Alterações puladas.');
        }
      } else {
        console.log('[ThemeConfig] Nenhuma alteração necessária.');
      }

      // 4. OAuth Accounts
      console.log('\n--- Verificando OAuthAccounts ---');
      const oauthAccounts = await tx.oAuthAccount.findMany();
      let oauthUpdated = 0;

      for (const acc of oauthAccounts) {
        const accUpdates: any = {};
        if (acc.accessToken && !isEncrypted(acc.accessToken)) accUpdates.accessToken = encrypt(acc.accessToken);
        if (acc.refreshToken && !isEncrypted(acc.refreshToken)) accUpdates.refreshToken = encrypt(acc.refreshToken);

        if (Object.keys(accUpdates).length > 0) {
          console.log(`[OAuthAccount] Criptografando tokens para conta ID: ${acc.id} (${acc.provider})`);
          if (!dryRun) {
            await tx.oAuthAccount.update({ where: { id: acc.id }, data: accUpdates });
          }
          oauthUpdated++;
        }
      }
      
      if (oauthUpdated === 0) {
        console.log('[OAuthAccount] Nenhuma alteração necessária.');
      } else {
        if (!dryRun) console.log(`[OAuthAccount] ${oauthUpdated} contas atualizadas com sucesso.`);
        else console.log(`[OAuthAccount] (Dry-run) ${oauthUpdated} contas seriam atualizadas.`);
      }

      console.log('\n=== MIGRATION COMPLETE ===\n');
    }, { timeout: 120000 }); // 2 min timeout

  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

migrateSecrets();
