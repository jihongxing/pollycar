import { Pool } from "pg";
import type { VehicleReviewRecord } from "../application/vehicle-review-service.js";
import type { TripChatRecord, MessageCenterRecord } from "../application/communication-service.js";
import type { LocationLifecycleRecord } from "../application/data-lifecycle-service.js";
import type { RealNameVerificationRecord } from "../application/real-name-verification-service.js";
import type { ChatRecord, SafetyCaseRecord } from "../application/safety-case-service.js";
import type { AuditLog } from "../ports/audit.js";
import type {
  DeviceRecord,
  PhoneAccountRecord,
  PhoneChallengeRecord,
  RefreshSessionRecord,
} from "../application/phone-authentication-service.js";
import type { AccountSessionRecord } from "../application/account-session-service.js";
import type { TrustProfileRecord } from "../application/trust-profile-service.js";
import { SyntheticLedgerTemplateService } from "../application/synthetic-ledger-template-service.js";
import { FinancialReconciliationService } from "../application/financial-reconciliation-service.js";
import { SyntheticOperatorFundsService } from "../application/synthetic-operator-funds-service.js";
import type {
  DispatchOfferRecord,
  DriverDispatchPresenceRecord,
} from "../application/dispatch-service.js";
import { PostgresAuditLog } from "./postgres-audit-log.js";
import { PostgresOutbox } from "./postgres-outbox.js";
import { PostgresRepository } from "./postgres-repository.js";
import { PostgresReviewTaskRepository } from "./postgres-review-task-repository.js";
import { PostgresTransaction } from "./postgres-transaction.js";
import { PostgresSyntheticTripRepository } from "./postgres-synthetic-trip-repository.js";
import { PostgresGoodwillCancellationRepository } from "./postgres-goodwill-cancellation-repository.js";
import { PostgresDriverQuotaRepository } from "./postgres-driver-quota-repository.js";
import { PostgresStructuredRepository } from "./postgres-structured-repository.js";
import { PostgresTaskQueue } from "./postgres-task-queue.js";
import { PostgresLedgerRepository } from "./postgres-ledger-repository.js";
import { PostgresReconciliationRepository } from "./postgres-reconciliation-repository.js";
import { PostgresOperatorFundsRepository } from "./postgres-operator-funds-repository.js";

export function createPostgresRuntime(connectionString: string) {
  if (!connectionString.includes("localhost") && !connectionString.includes("127.0.0.1")) {
    throw new Error("INTERNAL_SANDBOX_DATABASE_MUST_BE_LOCAL");
  }
  const pool = new Pool({
    connectionString,
    application_name: "pollycar-internal-sandbox",
    max: 5,
  });
  const transaction = new PostgresTransaction(pool);
  const ledger = new PostgresLedgerRepository(transaction);
  const reconciliation = new PostgresReconciliationRepository(transaction);
  const operatorFunds = new PostgresOperatorFundsRepository(transaction);
  const ledgerTemplates = new SyntheticLedgerTemplateService(ledger, transaction);
  const reconciliationService = new FinancialReconciliationService(
    reconciliation,
    transaction,
  );
  return Object.freeze({
    pool,
    transaction,
    vehicleReviewRepository: new PostgresRepository<VehicleReviewRecord>(
      "vehicle_review",
      transaction,
    ),
    syntheticTrips: new PostgresSyntheticTripRepository(transaction),
    goodwillCancellations: new PostgresGoodwillCancellationRepository(transaction),
    driverQuota: new PostgresDriverQuotaRepository(transaction),
    tripChats: new PostgresStructuredRepository<TripChatRecord>("pollycar_trip_chats", transaction),
    messageCenters: new PostgresStructuredRepository<MessageCenterRecord>(
      "pollycar_message_centers",
      transaction,
    ),
    locationLifecycle: new PostgresStructuredRepository<LocationLifecycleRecord>(
      "pollycar_location_lifecycle",
      transaction,
    ),
    identityVerifications: new PostgresStructuredRepository<RealNameVerificationRecord>(
      "pollycar_identity_verifications",
      transaction,
    ),
    trustProfiles: new PostgresStructuredRepository<TrustProfileRecord>(
      "pollycar_trust_profiles",
      transaction,
    ),
    safetyCases: new PostgresStructuredRepository<SafetyCaseRecord>(
      "pollycar_safety_cases",
      transaction,
    ),
    temporaryChats: new PostgresStructuredRepository<ChatRecord>(
      "pollycar_temporary_chats",
      transaction,
    ),
    phoneAccounts: new PostgresStructuredRepository<PhoneAccountRecord>(
      "pollycar_phone_accounts",
      transaction,
    ),
    phoneChallenges: new PostgresStructuredRepository<PhoneChallengeRecord>(
      "pollycar_phone_challenges",
      transaction,
    ),
    authDevices: new PostgresStructuredRepository<DeviceRecord>(
      "pollycar_auth_devices",
      transaction,
    ),
    refreshSessions: new PostgresStructuredRepository<RefreshSessionRecord>(
      "pollycar_refresh_sessions",
      transaction,
    ),
    accountSessions: new PostgresStructuredRepository<AccountSessionRecord>(
      "pollycar_account_sessions",
      transaction,
    ),
    driverDispatchPresences: new PostgresStructuredRepository<DriverDispatchPresenceRecord>(
      "pollycar_driver_dispatch_presence",
      transaction,
    ),
    dispatchOffers: new PostgresStructuredRepository<DispatchOfferRecord>(
      "pollycar_dispatch_offers",
      transaction,
    ),
    reviewTasks: new PostgresReviewTaskRepository(transaction),
    audit: new PostgresAuditLog(transaction),
    outbox: new PostgresOutbox(transaction),
    ledger,
    ledgerTemplates,
    reconciliation: reconciliationService,
    operatorFunds: new SyntheticOperatorFundsService(
      operatorFunds,
      ledgerTemplates,
      reconciliationService,
      transaction,
    ),
    createTaskQueue: (audit: AuditLog, now: () => Date) =>
      new PostgresTaskQueue(transaction, audit, now),
    close: () => pool.end(),
  });
}
