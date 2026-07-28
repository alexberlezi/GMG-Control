// gerador-web/seed-generator-permissions.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

const NOVAS_PERMISSOES = [
  { resource: 'generator', action: 'read', description: 'Visualizar dashboard, manutenções e relatórios do gerador' },
  { resource: 'maintenance', action: 'create', description: 'Registrar nova manutenção do gerador' },
  { resource: 'maintenance', action: 'update', description: 'Editar registro de manutenção do gerador' },
  { resource: 'maintenance', action: 'delete', description: 'Excluir registro de manutenção do gerador' },
  { resource: 'reports', action: 'export', description: 'Exportar relatórios do gerador em PDF/Excel' },
];

async function main() {
  for (const perm of NOVAS_PERMISSOES) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log('Permissões do gerador seedadas/confirmadas.');

  let ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
  if (!ownerRole) {
    ownerRole = await prisma.role.create({
      data: { name: 'Owner', description: 'Acesso total ao sistema', isSystem: true }
    });
    console.log('Created Owner role.');
  }

  const perms = await prisma.permission.findMany({
    where: { resource: { in: ['generator', 'maintenance', 'reports'] } }
  });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: ownerRole.id, permissionId: p.id }
    });
  }
  console.log('Permissões do gerador atribuídas ao Owner.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
