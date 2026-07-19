import type {
  AdminSafetyCaseClient,
  AdminSafetyCaseDetail,
  AdminSafetyCaseSummary,
} from "@pollycar/contracts";

const initialCase: AdminSafetyCaseDetail = {
  caseId: "safety-synthetic-trip-001",
  tripId: "synthetic-trip-001",
  state: "appealing",
  reasonCode: "unsafe_behavior",
  createdAt: "2026-07-11T09:00:00.000Z",
  hasAppeal: true,
  reporterAccountReference: "合成账户 · er-8",
  reportedAccountReference: "合成账户 · nt-7",
  appealReasonCode: "context_missing",
  version: 2,
  disclosure: {
    chatBodyAvailable: false,
    rawEvidenceAvailable: false,
  },
  synthetic: true,
};

export class SyntheticAdminSafetyClient implements AdminSafetyCaseClient {
  private safetyCase = initialCase;

  public async listCases(): Promise<readonly AdminSafetyCaseSummary[]> {
    return ["open_frozen", "appealing"].includes(this.safetyCase.state) ? [this.safetyCase] : [];
  }

  public async getCase(caseId: string): Promise<AdminSafetyCaseDetail> {
    if (caseId !== this.safetyCase.caseId) throw new Error("SAFETY_CASE_NOT_FOUND");
    return this.safetyCase;
  }

  public async resolveCase(
    caseId: string,
    expectedVersion: number,
    outcome: "restore_access" | "uphold_freeze",
  ): Promise<AdminSafetyCaseDetail> {
    if (caseId !== this.safetyCase.caseId) throw new Error("SAFETY_CASE_NOT_FOUND");
    if (expectedVersion !== this.safetyCase.version) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
    this.safetyCase = {
      ...this.safetyCase,
      state: outcome === "restore_access" ? "restored" : "upheld",
      hasAppeal: false,
      version: expectedVersion + 1,
    };
    return this.safetyCase;
  }
}
