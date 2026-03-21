export interface KeycloakProfile {
  sub: string;
  preferred_username: string;
  email: string;
  given_name?: string;
  family_name?: string;
  email_verified: boolean;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
  roles?: string[];
}

export interface KeycloakTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  'not-before-policy': number;
  session_state: string;
  scope: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface UserSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  user: AuthenticatedUser;
}

export interface AuthResult {
  sessionId: string;
  user: AuthenticatedUser;
}

export interface LoginResponse {
  message: string;
  user: AuthenticatedUser;
}

export interface KeycloakRole {
  id: string;
  name: string;
  description?: string;
  composite: boolean;
  clientRole: boolean;
  containerId: string;
}

export interface KeycloakAdminToken {
  access_token: string;
  expires_in: number;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}
