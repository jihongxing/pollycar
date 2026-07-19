import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(resolveInitialReducedMotion);

  useEffect(() => {
    let active = true;
    const media =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : undefined;
    const updateFromMedia = () => setReduced(Boolean(media?.matches));
    if (media) {
      updateFromMedia();
      media.addEventListener?.("change", updateFromMedia);
    } else {
      void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
        if (active) setReduced(enabled);
      });
    }
    const subscription =
      Platform.OS === "web"
        ? undefined
        : AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);

    return () => {
      active = false;
      subscription?.remove();
      media?.removeEventListener?.("change", updateFromMedia);
    };
  }, []);

  return reduced;
}

function resolveInitialReducedMotion(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
