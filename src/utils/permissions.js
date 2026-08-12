// Admins always have full access. For everyone else, a `null`/empty
// `permissions` array means "not yet restricted" (full access) so existing
// users keep seeing everything they already do until an admin opts them
// into a restricted set of pages.
export function canAccessPage(user, pageKey) {
  if (!user) return false;
  // Owners have their own separate /owner portal and must never fall through
  // to the staff "unrestricted by default" rule below.
  if (user.role === 'owner') return false;
  if (user.role === 'admin') return true;
  if (!user.permissions || user.permissions.length === 0) return true;
  return user.permissions.includes(pageKey);
}
