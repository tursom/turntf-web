export type {
  ClusterNode,
  Event,
  LoggedInUser,
  Message,
  OperationsStatus,
  Subscription,
  User,
  UserRef
} from "@tursom/turntf-web-sdk";

export interface AuthUser {
  nodeId: string;
  userId: string;
  username: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface HealthStatus {
  status: string;
}
