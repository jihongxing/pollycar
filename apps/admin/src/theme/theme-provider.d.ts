import { type ReactNode } from "react";
type Theme = "light" | "dark";
export declare function ThemeProvider({ children }: Readonly<{
    children: ReactNode;
}>): import("react").JSX.Element;
export declare function useTheme(): Readonly<{
    theme: Theme;
    toggle(): void;
}>;
export {};
