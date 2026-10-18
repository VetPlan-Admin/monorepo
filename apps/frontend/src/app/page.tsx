import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

// Placeholder home until ROADMAP Phase 2 replaces it with HomeScreen from @vet-plan/app
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-brand-purple px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-brand-yellow">Vet Plan</h1>
      <Suspense fallback={<p className="text-brand-yellow/70">Loading…</p>}>
        <SessionPanel />
      </Suspense>
    </main>
  );
}

async function SessionPanel() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-brand-yellow px-6 py-3 font-semibold text-brand-purple transition-opacity hover:opacity-90"
      >
        Sign in
      </Link>
    );
  }

  const role = user.role.replace("_", " ").toLowerCase();
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-brand-yellow">
        Signed in as <strong>{user.displayName}</strong> · {role}
        {user.tenant ? ` · ${user.tenant.name}` : ""}
      </p>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-full border border-brand-yellow px-6 py-2 text-brand-yellow transition-colors hover:bg-brand-yellow hover:text-brand-purple"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
