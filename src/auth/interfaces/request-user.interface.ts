export interface RequestUser {
  userId: string;
  email: string;
  username: string;
  tenantId: string;
  isSuperAdmin: boolean;
  sessionId: string;
}
