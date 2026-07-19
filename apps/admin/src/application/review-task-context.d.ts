import type { AdminReviewClient } from "@pollycar/contracts";
import { type ReactNode } from "react";
export declare function ReviewTaskProvider({ children, client }: Readonly<{
    children: ReactNode;
    client?: AdminReviewClient | undefined;
}>): import("react").JSX.Element;
export declare function useReviewTaskClient(): AdminReviewClient;
