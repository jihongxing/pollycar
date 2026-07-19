import type { AdminReviewTaskSummary } from "@pollycar/contracts";
export declare function QueuePage({ tasks, loading, error, onRefresh, onClaim }: Readonly<{
    tasks: readonly AdminReviewTaskSummary[];
    loading: boolean;
    error?: string | undefined;
    onRefresh(): void;
    onClaim(task: AdminReviewTaskSummary): void;
}>): import("react").JSX.Element;
