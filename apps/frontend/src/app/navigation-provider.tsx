"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { NavigationProvider } from "@vet-plan/app";
import type { LinkProps } from "@vet-plan/app";

function WebLink({ href, children }: LinkProps) {
  return <NextLink href={href}>{children}</NextLink>;
}

/** Lets shared screens (@vet-plan/app) navigate with Next.js routing. */
export function WebNavigationProvider({ children }: { children: ReactNode }) {
  return <NavigationProvider link={WebLink}>{children}</NavigationProvider>;
}
