const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.permission.count();
  console.log('Total Permissions:', count);

  if (count === 0) {
    console.log('Seeding permissions...');
    await prisma.permission.createMany({
      data: [
        { resource: 'users', action: 'read', description: 'Visualizar usuários' },
        { resource: 'users', action: 'manage', description: 'Gerenciar usuários' },
        { resource: 'roles', action: 'read', description: 'Visualizar grupos de permissão' },
        { resource: 'roles', action: 'manage', description: 'Gerenciar grupos e permissões' },
        { resource: 'settings', action: 'read', description: 'Visualizar configurações do sistema' },
        { resource: 'settings', action: 'manage', description: 'Alterar configurações do sistema' },
        { resource: 'audit', action: 'read', description: 'Visualizar logs de auditoria' },
      ]
    });
    console.log('Seeded permissions.');
    
    // Check if Owner role exists, if not, create it
    let ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: {
          name: 'Owner',
          description: 'Acesso total ao sistema',
          isSystem: true,
        }
      });
      console.log('Created Owner role.');
    }

    // Assign all permissions to Owner role
    const perms = await prisma.permission.findMany();
    for (const p of perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: ownerRole.id, permissionId: p.id }
      });
    }
    console.log('Assigned all permissions to Owner.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
