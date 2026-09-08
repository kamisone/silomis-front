import type { SelectOption } from "@/components/admin/ui/Select";

export type AdminRole = "admin" | "superadmin";

/** What `GET /admins` returns — the Admin row minus its password hash. */
export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AdminRole;
  mfaEnabled: boolean;
  preferredMfaMethod: "email" | "sms";
  createdAt: string;
  updatedAt: string;
}

/**
 * Both roles reach the same screens today — nothing in the API branches on
 * `role`, so the descriptions say what the field is for rather than promising
 * a restriction that is not enforced.
 */
export const ADMIN_ROLES: SelectOption<AdminRole>[] = [
  { value: "admin", label: "Admin", description: "Full access to the dashboard." },
  { value: "superadmin", label: "Superadmin", description: "Same access, marked as an owner of the account." },
];

/** Superadmins get the accent badge, ordinary admins the neutral one. */
export function roleBadgeClass(role: AdminRole, ui: Record<string, string>): string {
  return role === "superadmin" ? ui.badgeActive : ui.badge;
}
