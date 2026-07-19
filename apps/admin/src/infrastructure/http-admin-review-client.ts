import type {
  ApproveVehicleReviewAdminCommand,
  AdminReviewAuditEntry,
  AdminReviewClient,
  AdminReviewMaterialPreview,
  AdminReviewMaterialReason,
  AdminReviewTaskDetail,
  AdminReviewTaskSummary,
  ApiErrorResponse,
  ClaimAdminReviewTaskCommand,
  ReleaseAdminReviewTaskCommand,
  RejectVehicleReviewAdminCommand,
  RenewAdminReviewTaskCommand,
  RequestVehicleMaterialAdminCommand,
} from "@pollycar/contracts";

export class HttpAdminReviewClient implements AdminReviewClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  public listTasks(): Promise<readonly AdminReviewTaskSummary[]> {
    return this.request("/v1/internal-sandbox/admin/review-tasks");
  }

  public claimTask(command: ClaimAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/claim`,
      command.idempotencyKey,
      { expectedTaskVersion: command.expectedTaskVersion },
    );
  }

  public getTask(taskId: string): Promise<AdminReviewTaskDetail> {
    return this.request(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(taskId)}`,
    );
  }

  public renewTask(command: RenewAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/lease/renew`,
      command.idempotencyKey,
      { expectedTaskVersion: command.expectedTaskVersion },
    );
  }

  public releaseTask(command: ReleaseAdminReviewTaskCommand): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/release`,
      command.idempotencyKey,
      {
        reasonCode: command.reasonCode,
        expectedTaskVersion: command.expectedTaskVersion,
      },
    );
  }

  public previewMaterial(
    taskId: string,
    reason: AdminReviewMaterialReason,
  ): Promise<AdminReviewMaterialPreview> {
    return this.previewRequest(taskId, reason);
  }

  public requestMaterial(
    command: RequestVehicleMaterialAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/material-request`,
      command.idempotencyKey,
      {
        reason: command.reason,
        previewConfirmed: command.previewConfirmed,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
      },
    );
  }

  public approveVehicle(
    command: ApproveVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/approve`,
      command.idempotencyKey,
      {
        reasonCode: command.reasonCode,
        previewConfirmed: command.previewConfirmed,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
      },
    );
  }

  public rejectVehicle(
    command: RejectVehicleReviewAdminCommand,
  ): Promise<AdminReviewTaskDetail> {
    return this.write(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(command.taskId)}/reject`,
      command.idempotencyKey,
      {
        reasonCode: command.reasonCode,
        previewConfirmed: command.previewConfirmed,
        expectedTaskVersion: command.expectedTaskVersion,
        expectedVehicleReviewVersion: command.expectedVehicleReviewVersion,
      },
    );
  }

  public listAudit(taskId: string): Promise<readonly AdminReviewAuditEntry[]> {
    return this.request(
      `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(taskId)}/audit`,
    );
  }

  public async recoverResult(
    idempotencyKey: string,
  ): Promise<AdminReviewTaskDetail | undefined> {
    try {
      return await this.request(
        `/v1/internal-sandbox/admin/idempotency-results/${encodeURIComponent(idempotencyKey)}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "IDEMPOTENT_RESULT_NOT_FOUND") return undefined;
      throw error;
    }
  }

  private async write<TResult>(
    path: string,
    idempotencyKey: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<TResult> {
    try {
      return await this.request(path, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof TypeError) throw new Error("UNKNOWN_RESULT");
      throw error;
    }
  }

  private async previewRequest(
    taskId: string,
    reason: AdminReviewMaterialReason,
  ): Promise<AdminReviewMaterialPreview> {
    try {
      return await this.request(
        `/v1/internal-sandbox/admin/review-tasks/${encodeURIComponent(taskId)}/material-request-preview`,
        {
          method: "POST",
          headers: { "Idempotency-Key": `preview-${taskId}-${reason}` },
          body: JSON.stringify({ reason }),
        },
      );
    } catch (error) {
      if (error instanceof TypeError) throw new Error("SERVICE_UNAVAILABLE");
      throw error;
    }
  }

  private async request<TResult>(
    path: string,
    init: RequestInit = {},
  ): Promise<TResult> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: "Sandbox synthetic-reviewer-001",
          "Content-Type": "application/json",
          "X-Correlation-Id": createCorrelationId(),
          ...init.headers,
        },
      });
    } catch (error) {
      if (init.method === "POST") throw error;
      throw new Error("SERVICE_UNAVAILABLE");
    }
    if (!response.ok) {
      const text = await response.text();
      if (text) {
        let payload: ApiErrorResponse | undefined;
        try {
          payload = JSON.parse(text) as ApiErrorResponse;
        } catch {}
        if (payload?.error?.code) throw new Error(payload.error.code);
      }
      throw new Error(response.status >= 500 ? "SERVICE_UNAVAILABLE" : "INTERNAL_UNEXPECTED_ERROR");
    }
    return await response.json() as TResult;
  }
}

function createCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `admin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
