export const baseTokens = Object.freeze({
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,
  },
  radius: {
    small: 10,
    medium: 16,
    large: 24,
    pill: 999,
  },
  typography: {
    display: 32,
    title1: 24,
    title2: 20,
    body: 15,
    bodySmall: 14,
    caption: 12,
    numeric: 28,
  },
});

export const lightColors = Object.freeze({
  background: "#F7F4EC",
  surface: "#FFFDF8",
  surfaceMuted: "#EFECE4",
  mapSurface: "#DDE8E3",
  mapRoad: "#FFFDF8",
  mapRoadMuted: "#C7D4CE",
  mapWater: "#B9D1D5",
  floatingSurface: "rgba(255, 253, 248, 0.94)",
  sheetBackdrop: "rgba(19, 36, 58, 0.16)",
  border: "#D9D7D0",
  text: "#13243A",
  textSecondary: "#52647A",
  inverseText: "#FFFFFF",
  onDeepSurface: "#FFFFFF",
  onPrimaryAction: "#13243A",
  onOwnerAction: "#FFFFFF",
  onDangerAction: "#FFFFFF",
  deepSurface: "#13243A",
  primary: "#E3A34A",
  primaryPressed: "#C88932",
  success: "#2F7464",
  passenger: "#3D8C92",
  owner: "#4B72B5",
  danger: "#B75D50",
  overlay: "rgba(19, 36, 58, 0.56)",
});

export const darkColors = Object.freeze({
  background: "#0D1420",
  surface: "#151F2E",
  surfaceMuted: "#202C3D",
  mapSurface: "#1A2932",
  mapRoad: "#33434B",
  mapRoadMuted: "#263841",
  mapWater: "#173A49",
  floatingSurface: "rgba(21, 31, 46, 0.94)",
  sheetBackdrop: "rgba(3, 7, 13, 0.42)",
  border: "#344156",
  text: "#F4F1EA",
  textSecondary: "#AAB4C4",
  inverseText: "#F4F1EA",
  onDeepSurface: "#F4F1EA",
  onPrimaryAction: "#111827",
  onOwnerAction: "#111827",
  onDangerAction: "#111827",
  deepSurface: "#080E17",
  primary: "#B9782C",
  primaryPressed: "#C9893A",
  success: "#5FA58F",
  passenger: "#70A5C3",
  owner: "#AE8AAA",
  danger: "#D87575",
  overlay: "rgba(3, 7, 13, 0.72)",
});

export type ThemeMode = "light" | "dark";
export type ThemeColors = typeof lightColors;

export function resolveTheme(mode: ThemeMode) {
  return {
    mode,
    dark: mode === "dark",
    colors: mode === "dark" ? darkColors : lightColors,
    ...baseTokens,
  };
}

export type AppTheme = ReturnType<typeof resolveTheme>;
