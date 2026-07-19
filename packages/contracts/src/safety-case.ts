export type SafetyCaseState = "open_frozen" | "appealing" | "restored" | "upheld";

export type TemporaryChatView = Readonly<{
  tripId: string;
  state: "closed" | "open" | "frozen";
  messages: readonly Readonly<{
    messageId: string;
    senderAccountId: string;
    body: string;
    sentAt: string;
    synthetic: true;
  }>[];
  expiresAt?: string;
  synthetic: true;
}>;

export type SafetyCaseView = Readonly<{
  caseId: string;
  tripId: string;
  reporterAccountId: string;
  reportedAccountId: string;
  reasonCode: "unsafe_behavior" | "harassment" | "identity_concern";
  state: SafetyCaseState;
  version: number;
  appealReasonCode?: "context_missing" | "misunderstanding" | "new_evidence";
  resolutionCode?: "restore_access" | "uphold_freeze";
  createdAt: string;
  resolvedAt?: string;
  synthetic: true;
}>;

export type SafetyDashboard = Readonly<{
  chat?: TemporaryChatView;
  safetyCase?: SafetyCaseView;
  realChatEnabled: false;
  realEvidenceEnabled: false;
}>;

export type AdminSafetyCaseSummary = Readonly<{
  caseId: string;
  tripId: string;
  state: SafetyCaseState;
  reasonCode: SafetyCaseView["reasonCode"];
  createdAt: string;
  hasAppeal: boolean;
  synthetic: true;
}>;

export type AdminSafetyCaseDetail = AdminSafetyCaseSummary &
  Readonly<{
    reportedAccountReference: string;
    reporterAccountReference: string;
    appealReasonCode?: SafetyCaseView["appealReasonCode"];
    version: number;
    disclosure: Readonly<{
      chatBodyAvailable: false;
      rawEvidenceAvailable: false;
    }>;
  }>;

export interface AdminSafetyCaseClient {
  listCases(): Promise<readonly AdminSafetyCaseSummary[]>;
  getCase(caseId: string): Promise<AdminSafetyCaseDetail>;
  resolveCase(
    caseId: string,
    expectedVersion: number,
    outcome: "restore_access" | "uphold_freeze",
  ): Promise<AdminSafetyCaseDetail>;
}

export interface SafetyCaseClient {
  getDashboard(tripId: string): Promise<SafetyDashboard>;
  sendMessage(tripId: string, body: string): Promise<SafetyDashboard>;
  report(tripId: string, reasonCode: SafetyCaseView["reasonCode"]): Promise<SafetyDashboard>;
  appeal(caseId: string, expectedVersion: number): Promise<SafetyCaseView>;
}
