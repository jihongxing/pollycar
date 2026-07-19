import type { AdminReviewAuditEntry, AdminReviewClient, AdminReviewMaterialPreview, AdminReviewMaterialReason, AdminReviewTaskDetail, AdminReviewTaskSummary, ClaimAdminReviewTaskCommand, ReleaseAdminReviewTaskCommand, RenewAdminReviewTaskCommand, RequestVehicleMaterialAdminCommand } from "@pollycar/contracts";
export declare class SyntheticAdminReviewClient implements AdminReviewClient {
    private readonly tasks;
    private readonly audit;
    private readonly results;
    listTasks(): Promise<readonly AdminReviewTaskSummary[]>;
    claimTask(command: ClaimAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
    getTask(taskId: string): Promise<AdminReviewTaskDetail>;
    renewTask(command: RenewAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
    releaseTask(command: ReleaseAdminReviewTaskCommand): Promise<AdminReviewTaskDetail>;
    previewMaterial(reason: AdminReviewMaterialReason): Promise<AdminReviewMaterialPreview>;
    requestMaterial(command: RequestVehicleMaterialAdminCommand): Promise<AdminReviewTaskDetail>;
    listAudit(taskId: string): Promise<readonly AdminReviewAuditEntry[]>;
    recoverResult(idempotencyKey: string): Promise<AdminReviewTaskDetail | undefined>;
    private require;
    private requireOwned;
    private append;
}
