"use client";

import { hasPermission, ROLES, minRoleFor } from "@/lib/permissions";

/**
 * Permission gate wrapper.
 * Renders children only if the user's role has the required permission.
 * Shows a lock message for gated content (optional).
 *
 * Usage:
 *   <PermissionGate role={userRole} permission="edit_compliance">
 *     <ComplianceMatrix editable />
 *   </PermissionGate>
 */
export default function PermissionGate({ role, permission, children, fallback, showLock = false }) {
  const allowed = hasPermission(role, permission);

  if (allowed) return children;

  if (fallback) return fallback;

  if (showLock) {
    const requiredRole = minRoleFor(permission);
    const requiredLabel = ROLES[requiredRole]?.label || "higher";
    return (
      <div className="p-5 rounded-2xl text-center" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-primary)" }}>
        <svg className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <p className="text-sm font-medium mb-1">Access Restricted</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          This action requires {requiredLabel} role or above.
        </p>
      </div>
    );
  }

  return null;
}

/**
 * Role badge for display in headers/user sections.
 */
export function RoleBadge({ role }) {
  const config = ROLES[role];
  if (!config) return null;
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}
