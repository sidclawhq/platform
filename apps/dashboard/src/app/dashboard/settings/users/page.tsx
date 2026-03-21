'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

interface UsersResponse {
  data: UserRow[];
  pagination: { total: number; limit: number; offset: number };
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { isAdmin } = usePermissions();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const result = await api.get<UsersResponse>('/api/v1/users');
      setUsers(result.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin, fetchUsers]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-text-secondary">Admin access required</p>
        <p className="mt-1 text-xs text-text-muted">
          Contact an admin to access user management.
        </p>
      </div>
    );
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/api/v1/users/${userId}`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to update role');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setUpdatingId(userId);
    try {
      await api.delete(`/api/v1/users/${userId}`);
      toast.success('User removed');
      setConfirmDeleteId(null);
      fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to remove user');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Users</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage team members and their roles.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface-1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                Email
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                Last Login
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isCurrentUser = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-sm text-foreground">
                      {u.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-text-muted">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      {isCurrentUser ? (
                        <span className="text-sm text-text-secondary capitalize">{u.role}</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          disabled={updatingId === u.id}
                          className="rounded border border-border bg-surface-0 px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted font-mono">
                      {formatRelativeTime(u.last_login_at)}
                    </td>
                    <td className="px-4 py-3">
                      {isCurrentUser ? (
                        <span className="text-xs text-text-muted">&mdash;</span>
                      ) : confirmDeleteId === u.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            disabled={updatingId === u.id}
                            className="text-xs text-accent-red hover:underline disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(u.id)}
                          className="text-xs text-accent-red hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
