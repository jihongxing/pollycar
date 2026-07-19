import type { AdminReviewTaskDetail } from "@pollycar/contracts";
export declare function TaskDetailPage({ task, onBack, onRequestMaterial, onAudit }: Readonly<{
    task: AdminReviewTaskDetail;
    onBack(): void;
    onRequestMaterial(): void;
    onAudit(): void;
}>): import("react").JSX.Element;
