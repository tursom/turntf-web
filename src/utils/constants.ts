export const ROLES = {
  User: "user",
  Admin: "admin",
  SuperAdmin: "super_admin",
  Channel: "channel",
} as const;

export function isAdminRole(role: string): boolean {
  return role === ROLES.Admin || role === ROLES.SuperAdmin;
}

export const ROUTES = {
  Login: "/login",
  Chat: "/chat",
  Contacts: "/contacts",
  Settings: "/settings",
  AdminDashboard: "/admin",
  AdminUsers: "/admin/users",
  AdminUserDetail: "/admin/users/:nodeId/:userId",
  AdminMessages: "/admin/messages/:nodeId/:userId",
  AdminEvents: "/admin/events",
  AdminCluster: "/admin/cluster",
  AdminMetrics: "/admin/metrics",
} as const;

export const STORAGE_KEYS = {
  Token: "turntf_auth_token",
  User: "turntf_auth_user",
  RealtimePassword: "turntf_realtime_password",
} as const;

export const REFETCH_INTERVALS = {
  Dashboard: 10_000,
  Users: 30_000,
  Messages: 15_000,
  Events: 30_000,
  Cluster: 15_000,
  LoggedInUsers: 10_000,
  Metrics: 60_000,
  Health: 10_000,
} as const;
