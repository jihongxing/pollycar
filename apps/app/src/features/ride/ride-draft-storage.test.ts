import { afterEach, describe, expect, it, vi } from "vitest";

import { createRideDraft, selectDestination, suggestedPlaces, timingFromSlot } from "./ride-model";
import { clearRideDraft, loadRideDraft, saveRideDraft } from "./ride-draft-storage";

describe("行程草稿持久化", () => {
  const values = new Map<string, string>();

  afterEach(() => {
    clearRideDraft();
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

  it("迁移旧版草稿并清理不再合法的可选字段", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const draft = selectDestination(createRideDraft(), suggestedPlaces[2]!);
    values.set(
      "rego.ride.draft.v1",
      JSON.stringify({
        ...draft,
        scene: "legacy-scene",
        timing: {
          mode: "immediate",
          timezone: "Asia/Shanghai",
          selectionSource: "legacy-source",
        },
      }),
    );

    expect(loadRideDraft()).toEqual(draft);
    expect(values.has("rego.ride.draft.v1")).toBe(false);
    expect(values.has("rego.ride.draft.v2")).toBe(true);
  });

  it("丢弃无法安全迁移的旧版草稿", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    values.set(
      "rego.ride.draft.v1",
      JSON.stringify({
        origin: { address: "缺少必要地点字段" },
        passengerCount: 4,
        timing: { mode: "scheduled" },
      }),
    );

    expect(loadRideDraft()).toBeUndefined();
    expect(values.has("rego.ride.draft.v1")).toBe(false);
    expect(values.has("rego.ride.draft.v2")).toBe(false);
  });
});
