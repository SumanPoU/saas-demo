import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  LEGACY_RUNTIME_CONFIG_KEY,
  LEGACY_RUNTIME_CONFIG_MAP,
  RuntimeConfigDomainKey,
  RUNTIME_CONFIG_DEFINITIONS,
  RUNTIME_CONFIG_DOMAIN_KEYS,
} from '../src/config/runtime-config.constants';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

function coerceRuntimeConfigValue(
  defaultValue: string | number,
  value: unknown,
) {
  if (typeof defaultValue !== 'number') {
    return String(value);
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function buildRuntimeConfigSeed(
  key: RuntimeConfigDomainKey,
  legacyRuntimeSettings: Record<string, unknown>,
) {
  const definition = RUNTIME_CONFIG_DEFINITIONS[key];

  return Object.entries(definition.defaults).reduce<
    Record<string, string | number>
  >((config, [field, defaultValue]) => {
    const envKey = definition.env[field as keyof typeof definition.env];
    const legacyKey = Object.entries(LEGACY_RUNTIME_CONFIG_MAP).find(
      ([, mapping]) => mapping.key === key && mapping.field === field,
    )?.[0];
    const legacyValue = legacyKey
      ? legacyRuntimeSettings[legacyKey]
      : undefined;
    const envValue = process.env[envKey];
    const value =
      legacyValue !== undefined && legacyValue !== ''
        ? legacyValue
        : envValue !== undefined && envValue !== ''
          ? envValue
          : defaultValue;

    config[field] = coerceRuntimeConfigValue(defaultValue, value);
    return config;
  }, {});
}

function mergeMissingRuntimeConfigValues(
  key: RuntimeConfigDomainKey,
  currentValue: unknown,
  defaultValue: Record<string, string | number>,
) {
  if (
    !currentValue ||
    typeof currentValue !== 'object' ||
    Array.isArray(currentValue)
  ) {
    return defaultValue;
  }

  const current = currentValue as Record<string, unknown>;
  return Object.entries(defaultValue).reduce<Record<string, string | number>>(
    (value, [field, fallback]) => {
      const currentFieldValue = current[field];
      value[field] =
        currentFieldValue === undefined ||
        currentFieldValue === null ||
        currentFieldValue === ''
          ? fallback
          : coerceRuntimeConfigValue(
              RUNTIME_CONFIG_DEFINITIONS[key].defaults[
                field as keyof (typeof RUNTIME_CONFIG_DEFINITIONS)[typeof key]['defaults']
              ],
              currentFieldValue,
            );
      return value;
    },
    {},
  );
}

async function seedGlobalConfigurations() {
  console.log('⚙️ Seeding global configurations...');
  const legacyRuntimeConfig = await prisma.globalConfig.findFirst({
    where: { key: LEGACY_RUNTIME_CONFIG_KEY },
  });
  const legacyRuntimeSettings =
    legacyRuntimeConfig &&
    typeof legacyRuntimeConfig.value === 'object' &&
    !Array.isArray(legacyRuntimeConfig.value)
      ? (legacyRuntimeConfig.value as Record<string, unknown>)
      : {};
  const defaultConfigs = [
    ...RUNTIME_CONFIG_DOMAIN_KEYS.map((key) => ({
      key,
      category: RUNTIME_CONFIG_DEFINITIONS[key].category,
      value: buildRuntimeConfigSeed(key, legacyRuntimeSettings),
    })),
    {
      key: 'auth_settings',
      category: 'auth',
      value: {
        mfaRequired: false,
        passwordMinLength: 8,
        sessionTimeoutMinutes: 60,
      },
    },
    {
      key: 'system_branding',
      category: 'system',
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
      update: { category: config.category },
      create: {
        key: config.key,
        category: config.category,
        value: config.value,
      },
    });
  }

  for (const key of RUNTIME_CONFIG_DOMAIN_KEYS) {
    const current = await prisma.globalConfig.findFirst({ where: { key } });
    await prisma.globalConfig.update({
      where: { key },
      data: {
        category: RUNTIME_CONFIG_DEFINITIONS[key].category,
        value: mergeMissingRuntimeConfigValues(
          key,
          current?.value,
          buildRuntimeConfigSeed(key, legacyRuntimeSettings),
        ),
      },
    });
  }

  console.log('Global configurations seeded.');
}

async function main() {
  console.log('🌱 Starting database seeding...');
  await seedGlobalConfigurations();

  const adminPassword = process.env.SEED_SUPERADMIN_PASSWORD;
  const userPassword = process.env.SEED_USER_PASSWORD;

  // 1. Create or Update Roles
  console.log('🔑 Seeding roles...');
  const superAdminRole = await prisma.role.findFirst({ where: { name: 'SuperAdmin', tenantId: null } })
    || await prisma.role.create({
      data: {
        name: 'SuperAdmin',
        description: 'Super Administrator with full system access and permissions.',
        isDefault: false,
        tenantId: null,
      },
    });

  const adminRole = await prisma.role.findFirst({ where: { name: 'Admin', tenantId: null } })
    || await prisma.role.create({
      data: {
        name: 'Admin',
        description: 'Administrator with access to manage users and view audit trails.',
        isDefault: false,
        tenantId: null,
      },
    });

  const userRole = await prisma.role.findFirst({ where: { name: 'User', tenantId: null } })
    || await prisma.role.create({
      data: {
        name: 'User',
        description: 'Standard system user with basic access privileges.',
        isDefault: true,
        tenantId: null,
      },
    });

  console.log('Roles created/verified.');

  // 2. Create or Update Permission Groups and Permissions
  console.log('📦 Seeding permission groups and permissions...');

  const permGroups = [
    {
      name: 'User Management',
      description:
        'Permissions related to user accounts, profiles, and registration.',
      permissions: [
        {
          name: 'users:create',
          description: 'Allows creating new user accounts',
        },
        {
          name: 'users:read',
          description: 'Allows viewing user lists and profile details',
        },
        {
          name: 'users:update',
          description: 'Allows modifying user accounts and profile details',
        },
        {
          name: 'users:delete',
          description: 'Allows disabling or deleting user accounts',
        },
      ],
    },
    {
      name: 'Access Control',
      description:
        'Permissions related to role management and security permissions.',
      permissions: [
        { name: 'roles:create', description: 'Allows creating roles' },
        {
          name: 'roles:read',
          description: 'Allows viewing roles and role assignments',
        },
        {
          name: 'roles:update',
          description: 'Allows modifying roles and role permission assignments',
        },
        { name: 'roles:delete', description: 'Allows deleting roles' },
        {
          name: 'permissions:read',
          description: 'Allows viewing available system permissions',
        },
        {
          name: 'permissions:create',
          description: 'Allows creating permissions and permission groups',
        },
        {
          name: 'permissions:update',
          description: 'Allows modifying permissions and permission groups',
        },
        {
          name: 'permissions:delete',
          description: 'Allows deleting permissions and permission groups',
        },
        {
          name: 'roles:assign',
          description: 'Allows assigning roles to users',
        },
      ],
    },
    {
      name: 'Audit Trail',
      description:
        'Permissions related to viewing audit trails and activity logs.',
      permissions: [
        {
          name: 'audit:read',
          description: 'Allows viewing system-wide activity and audit logs',
        },
      ],
    },
    {
      name: 'System Settings',
      description:
        'Permissions related to global configurations and system state.',
      permissions: [
        {
          name: 'settings:manage',
          description: 'Allows modifying global system configurations',
        },
      ],
    },
  ];

  const allPermissions: { id: string; name: string }[] = [];

  for (const groupData of permGroups) {
    let group = await prisma.permissionGroup.findFirst({ where: { name: groupData.name, tenantId: null } });
    if (!group) {
      group = await prisma.permissionGroup.create({
        data: {
          name: groupData.name,
          description: groupData.description,
          tenantId: null,
        },
      });
    } else {
      group = await prisma.permissionGroup.update({
        where: { id: group.id },
        data: { description: groupData.description },
      });
    }

    for (const permData of groupData.permissions) {
      let permission = await prisma.permission.findFirst({ where: { name: permData.name, tenantId: null } });
      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            name: permData.name,
            description: permData.description,
            tenantId: null,
            groups: {
              connect: { id: group.id },
            },
          },
        });
      } else {
        permission = await prisma.permission.update({
          where: { id: permission.id },
          data: { description: permData.description },
        });
      }
      allPermissions.push(permission);
    }
  }

  console.log(
    `Successfully seeded ${permGroups.length} permission groups and ${allPermissions.length} permissions.`,
  );

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
      'settings:manage',
    ].includes(p.name),
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
  if (!adminPassword || !userPassword) {
    throw new Error(
      'Missing SEED_SUPERADMIN_PASSWORD or SEED_USER_PASSWORD. Global configurations, roles, permissions, and role permissions were seeded, but user seeding was skipped.',
    );
  }

  const adminEmail = 'admin@demo.com';
  const bcryptDefaults = RUNTIME_CONFIG_DEFINITIONS.bcrypt.defaults;
  const saltRounds = Number.parseInt(
    process.env.BCRYPT_SALT_ROUNDS ?? String(bcryptDefaults.saltRounds),
    10,
  );
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  await prisma.user.upsert({
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

  console.log('Default SuperAdmin user verified/created.');

  // 5. Create Default regular user for development/testing
  console.log('👤 Creating default test user...');
  const userEmail = 'user@demo.com';
  const userPasswordHash = await bcrypt.hash(userPassword, saltRounds);

  await prisma.user.upsert({
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

  console.log('Default regular user verified/created.');

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
