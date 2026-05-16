/**
 * Role-based permissions framework for Bidlyze.
 *
 * Currently operates per-user (owner gets admin role).
 * When team collaboration is added, this module will check
 * team membership and assigned roles from the database.
 *
 * Roles are hierarchical: Admin > Approver > Reviewer > Contributor > Viewer
 */

export const ROLES = {
  viewer: { level: 0, label: "Viewer", color: "bg-gray-500/10 text-gray-400" },
  contributor: { level: 1, label: "Contributor", color: "bg-blue-500/10 text-blue-400" },
  reviewer: { level: 2, label: "Reviewer", color: "bg-purple-500/10 text-purple-400" },
  approver: { level: 3, label: "Approver", color: "bg-amber-500/10 text-amber-400" },
  admin: { level: 4, label: "Admin", color: "bg-emerald-500/10 text-emerald-400" },
};

/**
 * Permission definitions.
 * Each permission maps to the minimum role level required.
 */
const PERMISSIONS = {
  // Viewing
  view_analysis: 0,
  view_compliance: 0,
  view_actions: 0,
  view_decisions: 0,
  view_comments: 0,

  // Editing
  edit_compliance: 1,      // Contributor+
  edit_actions: 1,         // Contributor+
  add_comments: 1,         // Contributor+
  delete_own_comments: 1,  // Contributor+
  edit_notes: 1,           // Contributor+

  // Review
  change_decision_draft: 2,    // Reviewer+
  submit_for_approval: 2,      // Reviewer+
  delete_any_comments: 2,      // Reviewer+

  // Approval
  approve_decision: 3,    // Approver+
  reject_decision: 3,     // Approver+
  finalize_workspace: 3,  // Approver+

  // Admin
  export_reports: 1,       // Contributor+ (can be gated higher later)
  manage_roles: 4,         // Admin only
  delete_workspace: 4,     // Admin only
};

/**
 * Get the user's role for a given analysis/workspace.
 * Currently: owner = admin. When teams are added, this will
 * check the team_members table for the user's assigned role.
 */
export function getUserRole(userId, analysisOwnerId) {
  // For now, the owner of the record is always admin
  if (userId === analysisOwnerId) return "admin";
  // Future: query team_members table for role
  return "viewer";
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role, permission) {
  const roleConfig = ROLES[role];
  const requiredLevel = PERMISSIONS[permission];
  if (roleConfig === undefined || requiredLevel === undefined) return false;
  return roleConfig.level >= requiredLevel;
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return [];
  return Object.entries(PERMISSIONS)
    .filter(([, level]) => roleConfig.level >= level)
    .map(([perm]) => perm);
}

/**
 * Find the lowest-level role key that satisfies a permission.
 * Returns "admin" if the permission name is unknown.
 */
export function minRoleFor(permission) {
  const requiredLevel = PERMISSIONS[permission];
  if (requiredLevel === undefined) return "admin";
  const ordered = Object.entries(ROLES).sort((a, b) => a[1].level - b[1].level);
  for (const [key, cfg] of ordered) {
    if (cfg.level >= requiredLevel) return key;
  }
  return "admin";
}

/**
 * Approval workflow states.
 */
export const APPROVAL_STATES = {
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-400", icon: "draft" },
  under_review: { label: "Under Review", color: "bg-blue-500/10 text-blue-400", icon: "review" },
  approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-400", icon: "approved" },
  rejected: { label: "Needs Revision", color: "bg-red-500/10 text-red-400", icon: "rejected" },
};
