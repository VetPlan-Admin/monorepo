import { Link as ExpoLink, router } from "expo-router";
import type { Href } from "expo-router";
import { Pressable } from "react-native";
import type { LinkProps } from "@vet-plan/app";

/** Lets shared screens (@vet-plan/app) navigate with Expo Router. */
export function MobileLink({ href, children }: LinkProps) {
  return (
    // Shared screens use runtime URL strings that mirror the web routes, so they can't be
    // checked against Expo Router's generated typed routes
    <ExpoLink href={href as Href} asChild>
      <Pressable>{children}</Pressable>
    </ExpoLink>
  );
}

export function mobileNavigate(href: string): void {
  router.push(href as Href);
}
