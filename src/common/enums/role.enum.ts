export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export const RoleHierarchy: Record<Role, Role[]> = {
  [Role.ADMIN]: [Role.ADMIN, Role.USER],
  [Role.USER]: [Role.USER],
};
