# O RBAC estava no schema e nunca havia sido ligado ao servidor

Cinquenta achados. Quatro caminhos independentes levavam ao comprometimento total sem credencial alguma. Todos remediados em quatro fases — e a causa raiz, que não era descuido pontual, foi eliminada.

## Situação final · quatro fases concluídas

49 achados remediados e verificados em código; 1 formalmente aceito como risco documentado. As quatro cadeias de comprometimento total estão fechadas. O motor de permissões está ligado, com resolução única, e o `npm run build` encadeia um teste que invoca toda server action sem sessão e reprova a compilação se alguma responder com dados.

O schema corrigido está numa migration versionada e legível — qualquer sistema derivado deste kit herda o estado pós-auditoria, não o anterior.

- **8/8 Críticos:** remediados
- **14/14 Altos:** remediados
- **18/18 Médios:** remediados
- **9+1 Baixos:** 9 remediados · 1 aceito

## O mal-entendido que gerava quase tudo

Toda função async exportada de um arquivo 'use server' é um endpoint HTTP público. O Next.js atribui a ela um Action ID que vai no bundle JavaScript entregue ao navegador; qualquer pessoa monta um POST com o header Next-Action e a executa. A tela de administração é um dos caminhos até a função — não é o portão.

O `proxy.ts` não fecha essa porta, e nem deveria: a documentação do Next 16 descreve o proxy como *optimistic check* e diz explicitamente que não é solução de autorização. Ele roda antes das páginas, não antes das actions.

Vinte server actions estavam abertas para a internet. Entre elas, `resetUserPassword`, que devolvia a senha temporária no corpo da resposta — três chamadas anônimas bastavam para assumir a conta do proprietário.

A correção não foi adicionar vinte verificações. Foi tornar o esquecimento impossível: os wrappers `withAuth` e `withPermission` envolvem toda server action, e um teste no build enumera `src/actions/**` para garantir que nenhuma escape. Uma action nova escrita daqui a seis meses, por outra pessoa, quebra o build se não passar pelo wrapper.

## As quatro cadeias, e por que fecharam

| Cadeia | O que a fechou | Estado |
|---|---|---|
| **Tomada da conta Owner sem credencial.** `getUsers()` anônimo dava a base inteira; `resetUserPassword()` devolvia a senha em claro. | Sessão e permissão em todas as actions; o reset passou a enviar link por e-mail em rota dedicada que valida `PASSWORD_RESET`. | Fechada |
| **Takeover via OAuth (nOAuth).** Vinculação por e-mail não verificado; tenant Azure common aceitava qualquer diretório do mundo. | Auto-link bloqueado — a vinculação só ocorre a partir do painel autenticado. Tenant exigido explicitamente. PKCE implementado. | Fechada |
| **XSS armazenado por upload anônimo.** Extensão vinda do nome do arquivo, MIME lido do cabeçalho do cliente, SVG na allowlist. | Sessão de Owner; `detectImageType` compartilhado entre as duas superfícies; extensão derivada da assinatura binária; SVG removido. CSP com nonce como segunda camada. | Fechada |
| **Exfiltração de todos os segredos.** Getters de configuração devolviam a linha inteira do Prisma, com segredos OAuth, SMTP e Turnstile em texto claro. | Leituras exigem permissão; segredos cifrados em repouso com AES-256-GCM, atrás de um módulo único de leitura e escrita. | Fechada |
| **Força bruta no segundo fator.** `verify2FALogin` sem rate limit, sem anti-replay, backup codes de 32 bits em SHA-256 sem salt. | Rate limit alimentando o lockout; contador TOTP monotônico com update condicional atômico; backup codes de 80 bits em Argon2id com busca por prefixo; `usedAt` preservando a trilha. | Fechada |

## O padrão estrutural — o achado mais durável

Sete pares de lógica de segurança duplicada foram encontrados ao longo da auditoria. Em todos eles, uma cópia havia sido corrigida e a outra ficou para trás — em três casos, a divergência foi criada na mesma rodada em que outra duplicação era eliminada.

- **Dois motores de permissão** — o `can()` correto e nunca chamado, e uma checagem inline no wrapper que comparava contra um campo inexistente. Unificados em `checkPermission`.
- **Dois validadores de upload** — a rota de API e a server action. Três rodadas: cada uma corrigiu uma cópia e deixou a outra. Unificados em `detectImageType`.
- **Dois vocabulários de permissão** — o seed usava `write`, o motor esperava `manage`. Permissões concedidas não concediam nada. Harmonizados e o parâmetro passou a ser tipado.
- **Duas implementações de token de magic link** — uma com hash, outra gravando em texto claro. A duplicata foi deletada.
- **Dois arquivos de borda** — um `middleware.ts` criado ao lado do `proxy.ts`, quebrando o build e duplicando headers sem o guard de sessão. Fundidos.
- **Dois caminhos de cifra** — a escrita passou a cifrar sem que a leitura descriptografasse, e o instalador gravava em claro enquanto o leitor descriptografava. Centralizados em `secrets-config.ts`.
- **Duas fontes de verdade sobre a instalação** — cookie no proxy contra banco na página, produzindo um loop infinito de redirecionamento que impedia qualquer navegador sem o cookie de acessar o sistema. A decisão foi movida para onde há acesso ao banco.

**A lição operacional para os próximos sistemas:** quando dois lugares precisam concordar sobre uma regra de segurança, eles vão divergir. Não é questão de disciplina — é questão de tempo. A defesa é estrutural: uma implementação, importada por todos os consumidores, de modo que a divergência deixe de ser possível em vez de ser improvável.

## Risco formalmente aceito

**Aceito:** 5 vulnerabilidades moderadas em dependências transitivas (`postcss` via `next` e `@hono/node-server` via `@prisma/dev`). 
Ambas são ferramentas de build e desenvolvimento — nenhuma está no caminho de execução de uma aplicação implantada, o que torna a exposição em produção praticamente nula.

A correção automática do `npm` faria downgrade de `next` para a versão 9 e de `prisma` para a 6, destruindo o projeto. Decisão: manter as versões, documentar o risco e reavaliar quando os mantenedores publicarem correções sem breaking change.

## O que já estava bem feito

Vale registrar, porque define o ponto de partida: o problema nunca foi falta de competência técnica. Era uma camada que não havia sido conectada. Estes pontos foram examinados na auditoria original e estavam corretos desde o início.

- Argon2id com 64 MB, timeCost 3, parallelism 4 — acima do mínimo recomendado pela OWASP, com verificação falhando fechada.
- Sessões opacas — token de 32 bytes de randomBytes, persistido como SHA-256, cookie httpOnly + sameSite: lax, expiração verificada com limpeza da linha e checagem de conta ativa.
- Motor RBAC fail-closed — a lógica estava certa, incluindo hierarquia manage e wildcard. O defeito era não ser chamada.
- Segredo TOTP — 160 bits via CSPRNG conforme RFC 4226, cifrado antes de persistir, com o binding pré-autenticação corretamente derivado do JWT assinado.
- Modelagem do banco — índices únicos em todos os tokens, composto em OAuthAccount, cascades corretos nos dependentes e SET NULL nas trilhas de auditoria.
- Validação estrita de tipo de token em `/auth/verify`, preservada durante a correção do fluxo de reset — um token de redefinição nunca serve como credencial de login.
- CSRF no OAuth, logout apenas por POST, ausência de SQL cru e de eval, `.env` fora do versionamento.

## Roteiro executado

### Fases 1–2: Bloqueio crítico e infraestrutura de autorização
Wrappers sobre todas as server actions com `checkPermission` como ponto único de verdade. Gate de build enumerando `src/actions/**`. As quatro cadeias iniciais fechadas. Auditoria passou a registrar ator e alvo. `AUTH_SECRET` falha ruidosamente. Seed corrigido. TOCTOU do setup resolvido.

### Fase 3: MFA, criptografia e CSP
Rate limit em PostgreSQL com upsert atômico, evitando dependência de Redis. Anti-replay do TOTP e endurecimento dos backup codes. PKCE. Oráculos de senha selados. CSP com nonce em `script-src`, validada com o nonce chegando às tags de script.

### Fase 4: LDAP, segredos em repouso e governança
TLS estrito com CA corporativa configurável, escape de filtro RFC 4515 e rejeição de bind vazio. Segredos cifrados em repouso atrás de módulo único. Autorização SSR nas páginas. IP real extraído da direita para a esquerda no `X-Forwarded-For`. Confirmação de posse na troca de e-mail. Migration versionada garantindo a propagação do schema.

## Para carregar aos sistemas derivados

O valor deste kit é ser a base dos próximos sistemas. Cinco controles instalados aqui é que fazem a segurança sobreviver à rotatividade de quem escreve o código:

1. **O gate de build.** Nenhuma server action nova chega a produção sem verificação de autorização — o build reprova antes. É o único controle da lista que não depende de alguém lembrar.
2. **Uma implementação por regra.** Sete duplicações produziram sete falhas. Antes de escrever a segunda cópia de qualquer lógica de segurança, importe a primeira.
3. **Verificar em execução, não só no código.** O loop de redirecionamento passou por auditoria estática, build, gate e cinco rodadas de revisão. Apareceu quando alguém carregou uma URL.
4. **Migrations, nunca db push,** para qualquer mudança que precise chegar a outro ambiente. E confira o encoding do arquivo gerado no Windows.
5. **Fallbacks silenciosos são dívida com juros.** Todo catch que devolve o valor cru precisa gritar no log e ter data de remoção — foi o padrão por trás de três achados distintos.
