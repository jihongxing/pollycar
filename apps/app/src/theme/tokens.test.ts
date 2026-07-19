import { describe, expect, it } from "vitest";

import { resolveTheme } from "./tokens";

describe("App 主题令牌", () => {
  it("明暗主题保持相同身份语义", () => {
    const light = resolveTheme("light");
    const dark = resolveTheme("dark");

    expect(light.colors.passenger).not.toBe(light.colors.owner);
    expect(dark.colors.passenger).not.toBe(dark.colors.owner);
    expect(light.spacing.lg).toBe(dark.spacing.lg);
    expect(light.radius.large).toBe(dark.radius.large);
  });

  it("暗色主题提供独立背景而不是简单反色", () => {
    const dark = resolveTheme("dark");

    expect(dark.dark).toBe(true);
    expect(dark.colors.background).toBe("#0D1420");
    expect(dark.colors.surface).toBe("#151F2E");
  });

  it("地图舞台与浮层拥有跨主题语义颜色", () => {
    const light = resolveTheme("light");
    const dark = resolveTheme("dark");

    expect(light.colors.mapSurface).not.toBe(light.colors.surface);
    expect(dark.colors.mapSurface).not.toBe(dark.colors.surface);
    expect(light.colors.floatingSurface).toContain("rgba");
    expect(dark.colors.sheetBackdrop).toContain("rgba");
  });

  it("深色行动在明暗主题下均使用可读前景色", () => {
    const light = resolveTheme("light");
    const dark = resolveTheme("dark");

    expect(contrastRatio(light.colors.deepSurface, light.colors.onDeepSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark.colors.deepSurface, dark.colors.onDeepSurface)).toBeGreaterThanOrEqual(4.5);
    expect(dark.colors.onDeepSurface).not.toBe(dark.colors.deepSurface);
  });
});

function contrastRatio(background: string, foreground: string): number {
  const backgroundLuminance = relativeLuminance(background);
  const foregroundLuminance = relativeLuminance(foreground);
  return (
    (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
    (Math.min(backgroundLuminance, foregroundLuminance) + 0.05)
  );
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
