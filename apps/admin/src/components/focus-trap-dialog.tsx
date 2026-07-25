import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export function FocusTrapDialog({
  titleId,
  busy = false,
  initialFocusRef,
  onClose,
  children,
}: Readonly<{
  titleId: string;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose(): void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  busyRef.current = busy;
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const backdrop = dialog.closest(".modal-backdrop");
    const container = backdrop?.parentElement ?? document.body;
    const siblings = Array.from(container.children).filter(
      (element) => element !== backdrop,
    );
    const inertTargets = siblings.flatMap((element) => [
      element,
      ...Array.from(
        element.querySelectorAll(
          "aside, header, main, nav, section, button, input, select, textarea, a, [tabindex]",
        ),
      ),
    ]);
    const addedInert = inertTargets.filter(
      (element) => !element.hasAttribute("inert"),
    );
    addedInert.forEach((element) => element.setAttribute("inert", ""));
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
    const first = initialFocusRef?.current ?? focusable()[0] ?? dialog;
    first.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      addedInert.forEach((element) => element.removeAttribute("inert"));
      previouslyFocused.current?.focus();
    };
  }, [initialFocusRef]);

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
