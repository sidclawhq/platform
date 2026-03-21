import { useAuth } from './auth-context';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';

  return {
    canApprove: role === 'reviewer' || role === 'admin',
    canManageAgents: role === 'admin',
    canManagePolicies: role === 'admin',
    canManageSettings: role === 'admin',
    canExportTraces: role === 'reviewer' || role === 'admin',
    isAdmin: role === 'admin',
    role,
  };
}
