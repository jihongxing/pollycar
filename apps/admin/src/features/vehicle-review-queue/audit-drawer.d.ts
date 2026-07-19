import type { AdminReviewAuditEntry } from "@pollycar/contracts";
export declare function AuditDrawer({ entries, onClose }: Readonly<{
    entries: readonly AdminReviewAuditEntry[];
    onClose(): void;
}>): import("react").JSX.Element;
