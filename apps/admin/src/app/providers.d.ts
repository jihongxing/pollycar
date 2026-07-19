import type { ReactNode } from "react";
import type { AdminReviewClient } from "@pollycar/contracts";
export declare function Providers({ children, client }: Readonly<{
    children: ReactNode;
    client?: AdminReviewClient | undefined;
}>): import("react").JSX.Element;
