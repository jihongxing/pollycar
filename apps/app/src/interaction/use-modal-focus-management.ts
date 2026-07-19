import { type RefObject, useEffect } from "react";
import { Platform, type View } from "react-native";

type FocusStrategy = "first" | "last";

export function useModalFocusManagement({
  visible,
  containerRef,
  onEscape,
  initialFocus = "first",
}: {
  visible: boolean;
  containerRef: RefObject<View | null>;
  onEscape: () => void;
  initialFocus?: FocusStrategy;
}) {
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return undefined;

    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    const appRoots = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="app-shell-root"]'),
    )
      .filter((root) => !root.contains(container))
      .map((root) => ({
        root,
        ariaHidden: root.getAttribute("aria-hidden"),
        inert: root.inert,
      }));
    for (const { root } of appRoots) {
      root.inert = true;
      root.setAttribute("aria-hidden", "true");
    }

    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));
    const focusInitial = () => {
      const elements = focusable();
      const target = initialFocus === "last" ? elements.at(-1) : elements[0];
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && currentIndex <= 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && currentIndex === elements.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      for (const { root, ariaHidden, inert } of appRoots) {
        root.inert = inert;
        if (ariaHidden === null) {
          root.removeAttribute("aria-hidden");
        } else {
          root.setAttribute("aria-hidden", ariaHidden);
        }
      }
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [containerRef, initialFocus, onEscape, visible]);
}
