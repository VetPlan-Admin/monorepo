import { Suspense } from "react";
import Link from "next/link";
import { HomeScreen } from "@vet-plan/app";
import { getCurrentUser } from "@/lib/session";

export default function Home() {
  return (
    <HomeScreen
      session={
        <Suspense fallback={<p className="text-brand-yellow/70">Loading…</p>}>
          <SessionPanel />
        </Suspense>
      }
    />
  );
}

/** Web-only: the session lives in an HTTP-only cookie read on the server. */
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
