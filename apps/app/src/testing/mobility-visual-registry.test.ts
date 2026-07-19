import { describe, expect, it } from "vitest";

import { mobilityVisualPages, mobilityVisualViewports } from "./mobility-visual-registry";

describe("移动端二十一页视觉回归清单", () => {
  it("完整覆盖 R01–R08、D01–D10、S01–S03", () => {
    expect(mobilityVisualPages).toHaveLength(21);
    expect(mobilityVisualPages.map((page) => page.id)).toEqual([
      "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10",
      "S01", "S02", "S03",
    ]);
  });

  it("页面编号和路由均不重复", () => {
    const ids = mobilityVisualPages.map((page) => page.id);
    const routes = mobilityVisualPages.map((page) => page.route);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("每页覆盖 390、430 和桌面视口", () => {
    const required = mobilityVisualViewports.map((viewport) => viewport.id);

    for (const page of mobilityVisualPages) {
      expect(page.viewports).toEqual(required);
      expect(page.fixture.length).toBeGreaterThan(0);
      expect(page.expectedAnchor.length).toBeGreaterThan(0);
    }
  });

  it("M3 激活全部二十一页基线", () => {
    expect(
      mobilityVisualPages
        .filter((page) => page.baselineState === "active")
        .map((page) => page.id),
    ).toEqual([
      "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10",
      "S01", "S02", "S03",
    ]);
  });
});
