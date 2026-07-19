import { afterEach, describe, expect, it, vi } from "vitest";

import { createRideDraft, selectDestination, suggestedPlaces, timingFromSlot } from "./ride-model";
import { clearRideDraft, loadRideDraft, saveRideDraft } from "./ride-draft-storage";

describe("行程草稿持久化", () => {
  const values = new Map<string, string>();

  afterEach(() => {
    values.clear();
    vi.unstubAllGlobals();
  });

  it("刷新后恢复地点、人数、场景和预约时间", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const draft = {
      ...selectDestination(createRideDraft(), suggestedPlaces[2]!),
      passengerCount: 3 as const,
      scene: "airport" as const,
      timing: timingFromSlot(
        {
          startsAt: "2026-07-13T07:00:00.000Z",
          endsAt: "2026-07-13T07:10:00.000Z",
          available: true,
        },
        "quick_slot",
      ),
    };

    saveRideDraft(draft);
    expect(loadRideDraft()).toEqual(draft);
    clearRideDraft();
    expect(loadRideDraft()).toBeUndefined();
  });
});
