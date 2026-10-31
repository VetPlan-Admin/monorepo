import { connection } from "next/server";
import { FlaskConical } from "lucide-react";
import { Role } from "@vet-plan/shared";
import type { DevLoginOptionsDto } from "@vet-plan/shared";
import { API_URL, PUBLIC_API_URL } from "@/lib/api";

const ROLE_LABELS: Record<Role, string> = {
  [Role.CLINIC_ADMIN]: "Clinic admin",
  [Role.VETERINARIAN]: "Veterinarian",
  [Role.ASSISTANT]: "Assistant",
  [Role.SUPER_ADMIN]: "Platform admin (no clinical data)",
};

/** Roles the backend offers, or null when its dev login is off (404) or it's unreachable. */
async function fetchDevLoginRoles(): Promise<Role[] | null> {
  try {
    const response = await fetch(`${API_URL}/auth/dev/roles`);
    if (!response.ok) {
      return null;
    }
    return ((await response.json()) as DevLoginOptionsDto).roles;
  } catch {
    return null;
  }
}

/**
 * Local development sign-in (docs/ARCHITECTURE.md §1.1). Shown only when this server has
 * DEV_LOGIN_ENABLED=true and the backend serves its dev login, which it never does in production.
 */
export async function DevLogin() {
  // Read the switch and the backend per request, never at build time
  await connection();
  if (process.env.DEV_LOGIN_ENABLED !== "true") {
    return null;
  }
  const roles = await fetchDevLoginRoles();
  if (!roles?.length) {
    return null;
  }

  return (
    <section className="mt-8 border-t border-brand-yellow/20 pt-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-yellow">
        <FlaskConical aria-hidden className="size-4" />
        Development sign-in
      </h2>
      <p className="mt-1 text-xs text-brand-yellow/70">
        Local only, switched off in production. Clinic roles share one dev clinic.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {roles.map((role) => (
          <a
            key={role}
            href={`${PUBLIC_API_URL}/auth/dev/login/${role}`}
            className="flex h-10 items-center justify-center rounded-full border border-brand-yellow/40 px-4 text-sm font-medium text-brand-yellow transition-colors hover:bg-brand-yellow/10"
          >
            {ROLE_LABELS[role]}
          </a>
        ))}
      </div>
    </section>
  );
}
