import { useEffect, useRef, useState } from "react";
import type { AdminNavigationItem } from "@pollycar/contracts";

export function GlobalSearch({
  items,
  onNavigate,
}: Readonly<{
  items: readonly AdminNavigationItem[];
  onNavigate(page: AdminNavigationItem["id"]): void;
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape" && open) {
        setQuery("");
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const results = items
    .filter((item) => item.availability === "available")
    .filter((item) => !query || item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="global-search">
      <button
        ref={triggerRef}
        type="button"
        className="global-search-trigger"
        aria-expanded={open}
        aria-controls="global-search-panel"
        onClick={() => setOpen(true)}
      >
        全局搜索 <kbd>/</kbd>
      </button>
      {open ? (
        <div id="global-search-panel" className="global-search-panel" role="dialog" aria-modal="true">
          <input
            ref={inputRef}
            aria-label="全局搜索"
            placeholder="搜索工作页面"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="global-search-results">
            {results.length > 0 ? (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  onClick={() => {
                    onNavigate(item.id);
                    setQuery("");
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>打开工作页面</span>
                </button>
              ))
            ) : (
              <p>没有找到匹配的工作页面</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
