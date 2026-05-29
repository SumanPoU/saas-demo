import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create or Update Roles
  console.log('🔑 Seeding roles...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: {},
    create: {
      name: 'SuperAdmin',
      description: 'Super Administrator with full system access and permissions.',
      isDefault: false,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Administrator with access to manage users and view audit trails.',
      isDefault: false,
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: {
      name: 'User',
      description: 'Standard system user with basic access privileges.',
      isDefault: true,
    },
  });

  console.log(`Roles created/verified: SuperAdmin (${superAdminRole.id}), Admin (${adminRole.id}), User (${userRole.id})`);

  // 2. Create or Update Permission Groups and Permissions
  console.log('📦 Seeding permission groups and permissions...');
  
  const permGroups = [
    {
      name: 'User Management',
      description: 'Permissions related to user accounts, profiles, and registration.',
      permissions: [
        { name: 'users:create', description: 'Allows creating new user accounts' },
        { name: 'users:read', description: 'Allows viewing user lists and profile details' },
        { name: 'users:update', description: 'Allows modifying user accounts and profile details' },
        { name: 'users:delete', description: 'Allows disabling or deleting user accounts' },
      ],
    },
    {
      name: 'Access Control',
      description: 'Permissions related to role management and security permissions.',
      permissions: [
        { name: 'roles:create', description: 'Allows creating roles' },
        { name: 'roles:read', description: 'Allows viewing roles and role assignments' },
        { name: 'roles:update', description: 'Allows modifying roles and role permission assignments' },
        { name: 'roles:delete', description: 'Allows deleting roles' },
        { name: 'permissions:read', description: 'Allows viewing available system permissions' },
        { name: 'permissions:create', description: 'Allows creating permissions and permission groups' },
        { name: 'permissions:update', description: 'Allows modifying permissions and permission groups' },
        { name: 'permissions:delete', description: 'Allows deleting permissions and permission groups' },
        { name: 'roles:assign', description: 'Allows assigning roles to users' },
      ],
    },
    {
      name: 'Audit Trail',
      description: 'Permissions related to viewing audit trails and activity logs.',
      permissions: [
        { name: 'audit:read', description: 'Allows viewing system-wide activity and audit logs' },
      ],
    },
    {
      name: 'System Settings',
      description: 'Permissions related to global configurations and system state.',
      permissions: [
        { name: 'settings:manage', description: 'Allows modifying global system configurations' },
      ],
    },
  ];

  const allPermissions: { id: string; name: string }[] = [];

  for (const groupData of permGroups) {
    const group = await prisma.permissionGroup.upsert({
      where: { name: groupData.name },
      update: { description: groupData.description },
      create: {
        name: groupData.name,
        description: groupData.description,
      },
    });

    for (const permData of groupData.permissions) {
      const permission = await prisma.permission.upsert({
        where: { name: permData.name },
        update: { description: permData.description },
        create: {
          name: permData.name,
          description: permData.description,
          groups: {
            connect: { id: group.id },
          },
        },
      });
      allPermissions.push(permission);
    }
  }

  console.log(`Successfully seeded ${permGroups.length} permission groups and ${allPermissions.length} permissions.`);

  // 3. Assign Permissions to Roles (RolePermission Join Table)
  console.log('🔗 Mapping permissions to roles...');

  // SuperAdmin gets ALL permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Admin gets user, access-control, and audit permissions required by protected controllers.
  const adminPermissions = allPermissions.filter((p) =>
    [
      'users:create',
      'users:read',
      'users:update',
      'roles:create',
      'roles:read',
      'roles:update',
      'roles:delete',
      'roles:assign',
      'permissions:create',
      'permissions:read',
      'permissions:update',
      'permissions:delete',
      'audit:read',
    ].includes(p.name)
  );

  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  console.log('Role permission assignments completed.');

  // 4. Create Default SuperAdmin User
  console.log('👤 Creating default SuperAdmin user...');
  const adminEmail = 'admin@demo.com';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('SuperAdminPassword123!', saltRounds);

  const superAdminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      isActive: true,
      isSuperAdmin: true,
    },
    create: {
      email: adminEmail,
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash,
      isActive: true,
      isSuperAdmin: true,
      emailVerified: true,
      roles: {
        connect: { id: superAdminRole.id },
      },
    },
  });

  console.log(`Default SuperAdmin user verified/created: ${superAdminUser.email}`);

  // 5. Create Default regular user for development/testing
  console.log('👤 Creating default test user...');
  const userEmail = 'user@demo.com';
  const userPasswordHash = await bcrypt.hash('UserPassword123!', saltRounds);

  const regularUser = await prisma.user.upsert({
    where: { email: userEmail },
    update: {
      passwordHash: userPasswordHash,
      isActive: true,
    },
    create: {
      email: userEmail,
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: userPasswordHash,
      isActive: true,
      isSuperAdmin: false,
      emailVerified: true,
      roles: {
        connect: { id: userRole.id },
      },
    },
  });

  console.log(`Default regular user verified/created: ${regularUser.email}`);

  // 6. Create Global Configurations
  console.log('⚙️ Seeding global configurations...');
  const defaultConfigs = [
    {
      key: 'auth_settings',
      value: {
        mfaRequired: false,
        passwordMinLength: 8,
        sessionTimeoutMinutes: 60,
      },
    },
    {
      key: 'system_branding',
      value: {
        appName: 'NestJS Enterprise Demo',
        primaryColor: '#6366f1',
        logoUrl: '/assets/logo.svg',
      },
    },
  ];

  for (const config of defaultConfigs) {
    await prisma.globalConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: {
        key: config.key,
        value: config.value,
      },
    });
  }

  console.log('Global configurations seeded.');
  console.log('🎉 Seeding database completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error while seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
