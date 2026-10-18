import { Suspense } from "react";
import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { OAuthProvider } from "@vet-plan/shared";
import { API_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Sign in · Vet Plan",
};

const PROVIDERS = [
  { id: OAuthProvider.GOOGLE, label: "Google" },
  { id: OAuthProvider.LINKEDIN, label: "LinkedIn" },
  { id: OAuthProvider.FACEBOOK, label: "Facebook" },
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  provider_unavailable: "That sign-in option isn't available yet. Try another one.",
  oauth_failed: "Sign-in didn't complete. Please try again.",
  missing_code: "Sign-in didn't complete. Please try again.",
  exchange_failed: "Your sign-in link expired. Please try again.",
  backend_unavailable: "Vet Plan is unreachable right now. Please try again shortly.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-brand-yellow/20 p-8 shadow-2xl">
      <h1 className="text-3xl font-bold text-brand-yellow">Vet Plan</h1>
      <p className="mt-2 text-sm text-brand-yellow/80">
        Orthopedic surgical planning for veterinary clinics
      </p>

      {/* searchParams is request data, so it streams in behind a boundary */}
      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>

      <div className="mt-8 flex flex-col gap-3">
        {PROVIDERS.map((provider) => (
          <a
            key={provider.id}
            href={`${API_URL}/auth/oauth/${provider.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand-yellow px-5 font-semibold text-brand-purple transition-opacity hover:opacity-90"
          >
            <LogIn aria-hidden className="size-4" />
            Continue with {provider.label}
          </a>
        ))}
      </div>
    </div>
  );
}

async function LoginError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) {
    return null;
  }
  return (
    <p
      role="alert"
      className="mt-6 rounded-lg bg-brand-yellow/10 px-4 py-3 text-sm text-brand-yellow"
    >
      {ERROR_MESSAGES[code] ?? ERROR_MESSAGES.oauth_failed}
    </p>
  );
}
