"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import * as ReactNativeWeb from "react-native-web";

// StyleSheet.getSheet() exists at runtime in react-native-web 0.21, but @types/react-native-web
// only declares StyleSheet as a type, so describe the one method used here
const { StyleSheet: sheetSource } = ReactNativeWeb as unknown as {
  StyleSheet: { getSheet(): { id: string; textContent: string } };
};

/**
 * Server-renders react-native-web's base styles so shared components don't flash unstyled
 * before hydration. Wrapped in the lowest cascade layer (`rnw`, see globals.css) and given its
 * own id, so react-native-web's client sheet and Tailwind utilities always take precedence.
 */
export function StylesProvider({ children }: { children: ReactNode }) {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) {
      return null;
    }
    inserted.current = true;
    const { textContent } = sheetSource.getSheet();
    return <style id="rnw-ssr" dangerouslySetInnerHTML={{ __html: `@layer rnw {${textContent}}` }} />;
  });

  return <>{children}</>;
}
