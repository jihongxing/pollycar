import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadPlacePreferences, rememberRecentPlace, saveNamedPlace } from "./place-storage";

const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

describe("地点偏好存储", () => {
  it("保存家和公司并在重新加载后恢复", () => {
    const place = {
      id: "place-home",
      label: "静安寺",
      address: "南京西路",
      kind: "search" as const,
      synthetic: false,
    };
    saveNamedPlace("home", place);
    expect(loadPlacePreferences().saved.home).toMatchObject({
      id: "place-home",
      kind: "home",
    });
  });

  it("最近地点去重并保持最新项在前", () => {
    const place = {
      id: "place-recent",
      label: "虹桥站",
      address: "虹桥枢纽",
      kind: "search" as const,
      synthetic: false,
    };
    rememberRecentPlace(place);
    rememberRecentPlace({ ...place, label: "上海虹桥站" });
    expect(loadPlacePreferences().recent).toHaveLength(1);
    expect(loadPlacePreferences().recent[0]?.label).toBe("上海虹桥站");
  });
});
