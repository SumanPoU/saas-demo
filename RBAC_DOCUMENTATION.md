# RBAC (Role-Based Access Control) & Permissions Module Documentation

## Overview

This NestJS application includes a comprehensive Role-Based Access Control (RBAC) system with fine-grained permission management. The system consists of two main modules:

- **Roles Module** (`src/roles/`) - Manages roles and their assignment to users
- **Permissions Module** (`src/permissions/`) - Manages permissions and permission groups

## Architecture

### Database Models

#### Role
- `id`: UUID (Primary Key)
- `name`: Unique role identifier (e.g., "admin", "moderator", "user")
- `description`: Optional description
- `isDefault`: Boolean flag for default role assignment
- `createdAt`, `updatedAt`: Timestamps

#### Permission
- `id`: UUID (Primary Key)
- `name`: Unique permission identifier (e.g., "users:read", "roles:create")
- `description`: Optional description
- `createdBy`: User ID who created the permission
- `createdAt`, `updatedAt`: Timestamps

#### PermissionGroup
- `id`: UUID (Primary Key)
- `name`: Unique group identifier
- `description`: Optional description
- `createdBy`: User ID who created the group
- `createdAt`, `updatedAt`: Timestamps

#### RolePermission (Junction Table)
- `roleId`, `permissionId`: Composite primary key
- `assignedById`: User ID who assigned the permission
- `createdAt`, `updatedAt`: Timestamps

#### User Relationships
- `roles`: Many-to-many relationship with Role model
- `isSuperAdmin`: Boolean flag for superadmin access (bypasses all RBAC checks)

## API Endpoints

### Roles Management

#### Create Role
```http
POST /roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "moderator",
  "description": "Moderator role",
  "isDefault": false
}
```
**Required Permissions**: `roles:create`  
**Required Roles**: `admin`

#### Get All Roles
```http
GET /roles
Authorization: Bearer {token}
```
**Required Permissions**: `roles:read`  
**Required Roles**: `admin`

#### Get Role by ID
```http
GET /roles/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `roles:read`  
**Required Roles**: `admin`

#### Update Role
```http
PATCH /roles/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "updated-moderator",
  "description": "Updated description",
  "isDefault": true
}
```
**Required Permissions**: `roles:update`  
**Required Roles**: `admin`

#### Delete Role
```http
DELETE /roles/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `roles:delete`  
**Required Roles**: `admin`

#### Assign Permissions to Role
```http
POST /roles/{roleId}/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "permissionIds": ["perm-id-1", "perm-id-2"]
}
```
**Required Permissions**: `roles:update`  
**Required Roles**: `admin`

#### Remove Permissions from Role
```http
DELETE /roles/{roleId}/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "permissionIds": ["perm-id-1"]
}
```
**Required Permissions**: `roles:update`  
**Required Roles**: `admin`

#### Assign Role to Users
```http
POST /roles/{roleId}/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "userIds": ["user-id-1", "user-id-2"]
}
```
**Required Permissions**: `roles:assign`  
**Required Roles**: `admin`

#### Remove Role from Users
```http
DELETE /roles/{roleId}/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "userIds": ["user-id-1"]
}
```
**Required Permissions**: `roles:assign`  
**Required Roles**: `admin`

#### Get User Roles
```http
GET /roles/user/{userId}/roles
Authorization: Bearer {token}
```
**Required Permissions**: `roles:read`  
**Required Roles**: `admin`

### Permissions Management

#### Create Permission
```http
POST /permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "posts:delete",
  "description": "Permission to delete posts"
}
```
**Required Permissions**: `permissions:create`  
**Required Roles**: `admin`

#### Get All Permissions
```http
GET /permissions
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:read`  
**Required Roles**: `admin`

#### Get Permission by ID
```http
GET /permissions/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:read`  
**Required Roles**: `admin`

#### Update Permission
```http
PATCH /permissions/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "posts:update",
  "description": "Updated permission"
}
```
**Required Permissions**: `permissions:update`  
**Required Roles**: `admin`

#### Delete Permission
```http
DELETE /permissions/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:delete`  
**Required Roles**: `admin`

#### Assign Permission to Groups
```http
POST /permissions/{permissionId}/groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "groupIds": ["group-id-1", "group-id-2"]
}
```
**Required Permissions**: `permissions:update`  
**Required Roles**: `admin`

#### Remove Permission from Groups
```http
DELETE /permissions/{permissionId}/groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "groupIds": ["group-id-1"]
}
```
**Required Permissions**: `permissions:update`  
**Required Roles**: `admin`

### Permission Groups Management

#### Create Permission Group
```http
POST /permissions/groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "post-management",
  "description": "All post-related permissions"
}
```
**Required Permissions**: `permissions:create`  
**Required Roles**: `admin`

#### Get All Permission Groups
```http
GET /permissions/groups
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:read`  
**Required Roles**: `admin`

#### Get Permission Group by ID
```http
GET /permissions/groups/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:read`  
**Required Roles**: `admin`

#### Update Permission Group
```http
PATCH /permissions/groups/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "updated-group",
  "description": "Updated description"
}
```
**Required Permissions**: `permissions:update`  
**Required Roles**: `admin`

#### Delete Permission Group
```http
DELETE /permissions/groups/{id}
Authorization: Bearer {token}
```
**Required Permissions**: `permissions:delete`  
**Required Roles**: `admin`

## Access Control Decorators

### @Roles(...roleNames: string[])
Restricts endpoint access to users with specified roles.

```typescript
@Get('admin/dashboard')
@Roles('admin', 'superadmin')
async getAdminDashboard() {
  // Only accessible by admin or superadmin
}
```

### @Permissions(...permissionNames: string[])
Restricts endpoint access to users with all specified permissions (AND logic).

```typescript
@Post('posts')
@Permissions('posts:create', 'content:publish')
async createPost() {
  // User must have BOTH permissions
}
```

### @CurrentUser()
Injects the current authenticated user.

```typescript
@Post('profile')
async updateProfile(@CurrentUser() user: any) {
  // user contains id, username, email, roles, permissions, etc.
}
```

### Combining Decorators
You can combine role and permission decorators:

```typescript
@Delete('users/:id')
@Roles('admin')
@Permissions('users:delete')
async deleteUser(@Param('id') id: string) {
  // User must have admin role AND users:delete permission
}
```

## Authorization Logic (AuthGuard)

The `AuthGuard` enforces RBAC rules in this order:

1. **Public Routes**: Routes marked with `@Public()` bypass all checks
2. **Authentication**: Verifies JWT token and user existence
3. **Superadmin Bypass**: Users with `isSuperAdmin = true` bypass role/permission checks
4. **Role Check**: If roles are required, user must have at least one
5. **Permission Check**: If permissions are required, user must have ALL (AND logic)

## Permission Naming Conventions

Follow resource-based naming for consistency:

```
{resource}:{action}

Examples:
- users:read
- users:create
- users:update
- users:delete
- posts:publish
- roles:assign
- permissions:manage
```

## Common Use Cases

### 1. Setup Initial Admin Role with Permissions
```typescript
// Create admin role
const adminRole = await rolesService.createRole({
  name: 'admin',
  description: 'Administrator role',
  isDefault: false,
});

// Create permissions
const permissions = await Promise.all([
  permissionsService.createPermission({ name: 'users:read' }),
  permissionsService.createPermission({ name: 'users:create' }),
  permissionsService.createPermission({ name: 'roles:manage' }),
]);

// Assign permissions to admin role
await rolesService.assignPermissionsToRole(
  adminRole.id,
  permissions.map(p => p.id),
);

// Assign admin role to user
await rolesService.assignRoleToUsers(adminRole.id, [userId]);
```

### 2. Check User Permissions Programmatically
```typescript
// In a service
const hasPermission = user.permissions?.includes('posts:delete');
const hasRole = await rolesService.checkUserHasRole(userId, ['admin', 'moderator']);
```

### 3. Default Role Assignment
```typescript
// When creating new users, assign default role
const defaultRole = await rolesService.getDefaultRole();
if (defaultRole) {
  await rolesService.assignRoleToUsers(defaultRole.id, [newUserId]);
}
```

## Error Handling

The RBAC system provides clear error messages:

```
// Role already exists
BadRequestException: Role "admin" already exists

// Role not found
NotFoundException: Role with ID "xyz" not found

// Cannot delete role with assigned users
BadRequestException: Cannot delete role "moderator" because it is assigned to 5 user(s)

// Missing permissions
ForbiddenException: You do not have sufficient permissions to access this resource.

// Missing role
ForbiddenException: You do not have the required role to access this resource.
```

## Security Considerations

1. **Token Validation**: All protected endpoints require valid JWT tokens
2. **Superadmin Bypass**: Only use `isSuperAdmin` for system administrators
3. **Permission Granularity**: Define permissions at the most granular level needed
4. **Audit Trail**: All role and permission changes are tracked via `createdBy`/`assignedBy`
5. **Cascade Protection**: Roles with assigned users cannot be deleted

## Testing

Example test cases for RBAC:

```typescript
it('should deny access when user lacks permission', async () => {
  // Create user with limited permissions
  // Attempt to access restricted endpoint
  // Expect ForbiddenException
});

it('should allow access when user has required role', async () => {
  // Create admin user
  // Access admin endpoint
  // Expect 200 OK
});

it('should bypass RBAC for superadmin', async () => {
  // Create superadmin user
  // Access any endpoint without specific permissions
  // Expect access granted
});
```

## Next Steps

1. Seed initial roles and permissions in database migration
2. Create permission groups for related permissions
3. Add API documentation to Swagger/OpenAPI
4. Implement audit logging for role changes
5. Create dashboard for role/permission management
