import type { AdminReviewMaterialPreview, AdminReviewMaterialReason } from "@pollycar/contracts";
export declare function RequestMaterialDialog({ reason, preview, busy, onReason, onPreview, onSubmit, onClose }: Readonly<{
    reason: AdminReviewMaterialReason;
    preview?: AdminReviewMaterialPreview | undefined;
    busy: boolean;
    onReason(reason: AdminReviewMaterialReason): void;
    onPreview(): void;
    onSubmit(): void;
    onClose(): void;
}>): import("react").JSX.Element;
