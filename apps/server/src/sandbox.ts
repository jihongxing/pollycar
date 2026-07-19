import { join } from "node:path";
import type { FeatureGates } from "@pollycar/contracts";
import { createInternalSandboxConfig } from "./config.js";
import { MemoryAuditLog } from "./adapters/memory-audit.js";
import { MemoryLogger, MemoryMetrics, MemoryTracer } from "./adapters/memory-observability.js";
import { MemoryRepository, MemoryTransaction } from "./adapters/memory-repository.js";
import { MemoryTaskQueue } from "./adapters/memory-tasks.js";
import { SyntheticIdentityProvider } from "./adapters/synthetic-identity.js";
import { HealthService } from "./health/service.js";
import { VehicleReviewService, type VehicleReviewRecord } from "./application/vehicle-review-service.js";
import { AdminReviewTaskService } from "./application/admin-review-task-service.js";
import { MemoryReviewTaskRepository } from "./adapters/memory-review-task-repository.js";
import { OutboxAuditLog } from "./adapters/outbox-audit.js";
import { MemoryOutbox } from "./adapters/memory-outbox.js";
import { createPostgresRuntime } from "./persistence/postgres-runtime.js";
import type { AuditLog } from "./ports/audit.js";
import type { ReviewTaskRecord, ReviewTaskRepository } from "./ports/review-tasks.js";
import type { Repository, Transaction } from "./ports/storage.js";
import {
  FreeFlexTrialService,
  type FreeFlexTrialRecord,
} from "./application/free-flex-trial-service.js";
import { PostgresRepository } from "./persistence/postgres-repository.js";
import {
  SyntheticTripService,
  type SyntheticTripRecord,
} from "./application/synthetic-trip-service.js";
import {
  GoodwillCancellationService,
  type GoodwillCancellationRecord,
} from "./application/goodwill-cancellation-service.js";
import {
  MobilityService,
  type CompletionIntentRecord,
  type DriverAvailabilityRecord,
} from "./application/mobility-service.js";
import {
  SafetyCaseService,
  type ChatRecord,
  type SafetyCaseRecord,
} from "./application/safety-case-service.js";
import {
  CommunicationService,
  type MessageCenterRecord,
  type TripChatRecord,
} from "./application/communication-service.js";
import {
  RealNameVerificationService,
  type RealNameVerificationRecord,
} from "./application/real-name-verification-service.js";
import {
  TrustProfileService,
  type TripRatingRecord,
  type TrustProfileRecord,
} from "./application/trust-profile-service.js";
import {
  AccountSessionService,
  type AccountSessionRecord,
} from "./application/account-session-service.js";
import { DataLifecycleService, type LocationLifecycleRecord } from "./application/data-lifecycle-service.js";
import { PhoneAuthenticationService, type DeviceRecord, type PhoneAccountRecord, type PhoneChallengeRecord, type RefreshSessionRecord } from "./application/phone-authentication-service.js";
import { SyntheticSmsDelivery } from "./adapters/synthetic-sms-delivery.js";
import {
  SyntheticChatTransport,
  SyntheticNotificationDelivery,
} from "./adapters/synthetic-communication-delivery.js";
import {
  StrictCoordinateTransformer,
  SyntheticMapProvider,
} from "./adapters/synthetic-map-provider.js";
import { AmapWebServiceProvider } from "./adapters/amap-web-service-provider.js";
import { EnvironmentSecretProvider } from "./adapters/environment-secret-provider.js";
import {
  MapLocationService,
  MemoryMapQuotaUsage,
} from "./application/map-location-service.js";
import {
  VehicleLocationService,
  type VehicleLocationRecord,
} from "./application/vehicle-location-service.js";
import {
  DispatchService,
  type DispatchOfferRecord,
  type DriverDispatchPresenceRecord,
} from "./application/dispatch-service.js";
import { AdminAccessService } from "./application/admin-access-service.js";
import { AdminAuthenticationService } from "./application/admin-authentication-service.js";
import {
  AdminOperatorManagementService,
  InMemorySyntheticPrimaryOperatorRelationshipGateway,
} from "./application/admin-operator-management-service.js";
import { AdminTripCaseManagementService } from "./application/admin-trip-case-management-service.js";
import { AdminFinanceOperationsService } from "./application/admin-finance-operations-service.js";
import { ExecutiveDashboardQueryService } from "./application/executive-dashboard-query-service.js";
import {
  EncryptedFileExecutiveExportArtifactStore,
  FileAdminAuditEventStore,
  FileExecutiveGovernanceStateStore,
} from "./persistence/admin-governance-file-store.js";

export function createInternalSandbox(
  now: () => Date = () => new Date(0),
  options: Readonly<{
    featureGates?: Partial<FeatureGates>;
    allowedOrigins?: readonly string[];
    executiveStateDir?: string;
  }> = {},
) {
  const config = createInternalSandboxConfig(
    {
      ...(options.featureGates ? { featureGates: options.featureGates } : {}),
      ...(options.allowedOrigins ? { allowedOrigins: options.allowedOrigins } : {}),
    },
  );
  if (
    config.featureGates.syntheticAdminExecutiveDashboard &&
    !options.executiveStateDir
  ) {
    throw new Error("ADMIN_EXECUTIVE_STATE_DIR_REQUIRED");
  }
  const memoryAudit = new MemoryAuditLog();
  const repository = new MemoryRepository<unknown>();
  const postgres =
    config.persistence.mode === "postgres" && config.persistence.databaseUrl
      ? createPostgresRuntime(config.persistence.databaseUrl)
      : undefined;
  const vehicleReviewRepository: Repository<VehicleReviewRecord> =
    postgres?.vehicleReviewRepository ?? new MemoryRepository<VehicleReviewRecord>();
  const freeFlexTrialRepository: Repository<FreeFlexTrialRecord> = postgres
    ? new PostgresRepository<FreeFlexTrialRecord>("free_flex_trial", postgres.transaction)
    : new MemoryRepository<FreeFlexTrialRecord>();
  const syntheticTripRepository: Repository<SyntheticTripRecord> = postgres
    ? postgres.syntheticTrips
    : new MemoryRepository<SyntheticTripRecord>();
  const driverAvailabilityRepository = new MemoryRepository<DriverAvailabilityRecord>();
  const completionIntentRepository = new MemoryRepository<CompletionIntentRecord>();
  const vehicleLocationRepository = new MemoryRepository<VehicleLocationRecord>();
  const temporaryChatRepository: Repository<ChatRecord> = postgres
    ? postgres.temporaryChats
    : new MemoryRepository<ChatRecord>();
  const safetyCaseRepository: Repository<SafetyCaseRecord> = postgres
    ? postgres.safetyCases
    : new MemoryRepository<SafetyCaseRecord>();
  const tripChatRepository: Repository<TripChatRecord> =
    postgres?.tripChats ?? new MemoryRepository<TripChatRecord>();
  const messageCenterRepository: Repository<MessageCenterRecord> =
    postgres?.messageCenters ?? new MemoryRepository<MessageCenterRecord>();
  const driverDispatchPresenceRepository: Repository<DriverDispatchPresenceRecord> =
    postgres?.driverDispatchPresences ?? new MemoryRepository<DriverDispatchPresenceRecord>();
  const dispatchOfferRepository: Repository<DispatchOfferRecord> =
    postgres?.dispatchOffers ?? new MemoryRepository<DispatchOfferRecord>();
  const locationLifecycleRepository: Repository<LocationLifecycleRecord> =
    postgres?.locationLifecycle ?? new MemoryRepository<LocationLifecycleRecord>();
  const adultEligibilityRepository: Repository<RealNameVerificationRecord> =
    postgres?.identityVerifications ?? new MemoryRepository<RealNameVerificationRecord>();
  const trustProfileRepository = new MemoryRepository<TrustProfileRecord>();
  const tripRatingRepository = new MemoryRepository<TripRatingRecord>();
  const goodwillCancellationRepository: Repository<GoodwillCancellationRecord> =
    postgres?.goodwillCancellations ?? new MemoryRepository<GoodwillCancellationRecord>();
  const accountSessionRepository: Repository<AccountSessionRecord> =
    postgres?.accountSessions ?? new MemoryRepository<AccountSessionRecord>();
  const phoneAccountRepository: Repository<PhoneAccountRecord> =
    postgres?.phoneAccounts ?? new MemoryRepository<PhoneAccountRecord>();
  const phoneChallengeRepository: Repository<PhoneChallengeRecord> =
    postgres?.phoneChallenges ?? new MemoryRepository<PhoneChallengeRecord>();
  const authDeviceRepository: Repository<DeviceRecord> =
    postgres?.authDevices ?? new MemoryRepository<DeviceRecord>();
  const refreshSessionRepository: Repository<RefreshSessionRecord> =
    postgres?.refreshSessions ?? new MemoryRepository<RefreshSessionRecord>();
  const transaction: Transaction = postgres?.transaction ?? new MemoryTransaction();
  const coordinateTransformer = new StrictCoordinateTransformer();
  const mapProvider = config.featureGates.amapWebService
    ? new AmapWebServiceProvider(true, new EnvironmentSecretProvider(), globalThis.fetch, now)
    : new SyntheticMapProvider(now);
  const mapQuotaUsage = new MemoryMapQuotaUsage();
  const mapLocations = new MapLocationService(mapProvider, mapQuotaUsage, now);
  const outbox = postgres?.outbox ?? new MemoryOutbox();
  const audit: AuditLog = new OutboxAuditLog(postgres?.audit ?? memoryAudit, outbox);
  const vehicleLocations = new VehicleLocationService(vehicleLocationRepository, audit, now);
  const tasks = postgres?.createTaskQueue(audit, now) ?? new MemoryTaskQueue(audit, now);
  const identity = new SyntheticIdentityProvider({
    "synthetic-admin-token": {
      subjectId: "synthetic-admin",
      roles: ["system_admin"],
      realNameVerified: true,
      synthetic: true,
    },
  });
  const logger = new MemoryLogger();
  const metrics = new MemoryMetrics();
  const tracer = new MemoryTracer();
  const health = new HealthService([
    { name: "configuration", check: async () => ({ status: config.dataMode === "synthetic" ? "up" : "down" }) },
    {
      name: "repository",
      check: async () => {
        if (!postgres) return { status: "up" };
        try {
          await postgres.pool.query("SELECT 1");
          return { status: "up" };
        } catch {
          return { status: "down", detail: "postgres_unavailable" };
        }
      },
    },
    { name: "task_queue", check: async () => ({ status: "up" }) },
  ]);
  const trustProfiles = new TrustProfileService(
    trustProfileRepository,
    tripRatingRepository,
    syntheticTripRepository,
    audit,
    now,
  );
  const decoratePublicProfile = async (profile: import("@pollycar/contracts").TripPartyPublicProfile) => {
    const trust = await trustProfiles.getProfile(profile.accountId);
    return {
      ...profile,
      ...(trust.avatar.publicUrl ? { avatarUrl: trust.avatar.publicUrl } : {}),
      ...(trust.rating ? { rating: trust.rating } : {}),
    };
  };
  const vehicleReviews = new VehicleReviewService(
    vehicleReviewRepository,
    transaction,
    tasks,
    audit,
    logger,
    metrics,
    tracer,
    now,
  );
  const freeFlexTrial = new FreeFlexTrialService(
    freeFlexTrialRepository,
    transaction,
    audit,
    now,
  );
  const accountSessions = new AccountSessionService(
    accountSessionRepository,
    transaction,
    async (accountId) => {
      const verification = await adultEligibility.get(accountId);
      const vehicle = await vehicleReviews.get("vehicle-application-7", accountId);
      return {
        adultEligibilityState: verification.state,
        businessAccessAllowed: verification.businessAccessAllowed,
        driverAvailable:
          accountId === "synthetic-account-7" ||
          vehicle.ownerIdentityAvailable ||
          vehicle.status === "approved",
      };
    },
    now,
  );
  const phoneAuthentication = new PhoneAuthenticationService(
    phoneAccountRepository,
    phoneChallengeRepository,
    authDeviceRepository,
    refreshSessionRepository,
    accountSessions,
    new SyntheticSmsDelivery(),
    transaction,
    audit,
    now,
  );
  const resolveDriverEligibility = async (accountId: string) => {
    const vehicle = await vehicleReviews.get("vehicle-application-7", accountId);
    if (!vehicle.ownerIdentityAvailable) return undefined;
    const trial = await freeFlexTrial.get(accountId);
    return {
      quotaPolicy: trial.state === "active" ? "flex" as const : "base" as const,
      maxPassengerCount: vehicle.maxPassengerCount,
      vehicle: {
        vehicleId: "synthetic-vehicle-application-7",
        color: "深空灰",
        make: "合成品牌",
        model: vehicle.vehicleType ?? "合成车型",
        licensePlate: "沪A·TEST",
        maxPassengerCount: vehicle.maxPassengerCount,
        synthetic: true as const,
      },
    };
  };
  const goodwillCancellations = new GoodwillCancellationService(
    goodwillCancellationRepository,
    transaction,
    now,
  );
  const syntheticTrips = new SyntheticTripService(
    syntheticTripRepository,
    transaction,
    audit,
    resolveDriverEligibility,
    now,
    async () => {},
    () => false,
    goodwillCancellations,
    postgres ? (accountId) => postgres.driverQuota.listCountedHistory(accountId) : undefined,
  );
  const mobility = new MobilityService(
    syntheticTripRepository,
    driverAvailabilityRepository,
    completionIntentRepository,
    transaction,
    audit,
    resolveDriverEligibility,
    now,
    decoratePublicProfile,
    goodwillCancellations,
  );
  const notificationDelivery = new SyntheticNotificationDelivery();
  const dispatch = new DispatchService(
    syntheticTripRepository,
    driverDispatchPresenceRepository,
    dispatchOfferRepository,
    transaction,
    audit,
    outbox,
    notificationDelivery,
    (accountId) => mobility.listAvailableTrips(accountId),
    (accountId, tripId, expectedVersion, idempotencyKey) =>
      syntheticTrips.accept(accountId, tripId, expectedVersion, idempotencyKey),
    async (accountId, state, idempotencyKey) => {
      await mobility.setAvailability(accountId, state, true, idempotencyKey);
    },
    now,
  );
  const dataLifecycle = new DataLifecycleService(
    tripChatRepository,
    locationLifecycleRepository,
    transaction,
    audit,
    now,
  );
  const safetyCases = new SafetyCaseService(
    syntheticTripRepository,
    temporaryChatRepository,
    safetyCaseRepository,
    transaction,
    audit,
    now,
    (actorId, tripId, correlationId) =>
      dataLifecycle.setChatEvidenceHold(actorId, tripId, true, correlationId),
  );
  const communications = new CommunicationService(
    syntheticTripRepository,
    safetyCaseRepository,
    tripChatRepository,
    messageCenterRepository,
    transaction,
    audit,
    now,
    new SyntheticChatTransport(),
    notificationDelivery,
  );
  const adultEligibility = new RealNameVerificationService(
    adultEligibilityRepository,
    audit,
    now,
  );
  const seedReviewTasks: readonly ReviewTaskRecord[] = [
    {
      taskId: "task-001",
      applicationId: "application-001",
      accountReference: "合成账户 · 001",
      status: "available",
      submittedAt: "2026-07-11T08:00:00.000Z",
      vehicleCategory: "舒适型轿车",
      insuranceExpiryStatus: "incomplete",
      authorizationEvidenceStatus: "complete",
      attachmentValidationStatus: "valid",
      taskVersion: 1,
      vehicleReviewVersion: 1,
      synthetic: true,
    },
    {
      taskId: "task-002",
      applicationId: "application-002",
      accountReference: "合成账户 · 002",
      status: "available",
      submittedAt: "2026-07-11T08:18:00.000Z",
      vehicleCategory: "新能源轿车",
      insuranceExpiryStatus: "complete",
      authorizationEvidenceStatus: "incomplete",
      attachmentValidationStatus: "invalid",
      taskVersion: 1,
      vehicleReviewVersion: 1,
      synthetic: true,
    },
    {
      taskId: "task-003",
      applicationId: "application-003",
      accountReference: "合成账户 · 003",
      status: "available",
      submittedAt: "2026-07-11T08:32:00.000Z",
      vehicleCategory: "紧凑型轿车",
      insuranceExpiryStatus: "complete",
      authorizationEvidenceStatus: "complete",
      attachmentValidationStatus: "valid",
      taskVersion: 1,
      vehicleReviewVersion: 1,
      synthetic: true,
    },
  ];
  const reviewTasks: ReviewTaskRepository =
    postgres?.reviewTasks ?? new MemoryReviewTaskRepository(seedReviewTasks);
  const seedVehicleReview = async (
    applicationId: string,
    accountId: string,
    vehicleType: string,
  ) =>
    vehicleReviewRepository.put(
      applicationId,
      {
        applicationId,
        accountId,
        status: "under_review",
        ownerIdentityAvailable: false,
        maxPassengerCount: 1,
        vehicleType,
        insuranceExpiresOn: "2027-07-11",
        syntheticAttachmentId: `synthetic-${applicationId}`,
        requestedMaterialCodes: [],
        events: [
          { code: "submitted", occurredAt: "2026-07-11T08:00:00.000Z" },
          { code: "review_started", occurredAt: "2026-07-11T08:01:00.000Z" },
        ],
        processedKeys: [],
        synthetic: true,
      },
      0,
    );
  const ready = Promise.all([
    ...seedReviewTasks.map((record) => reviewTasks.create(record)),
    seedVehicleReview("application-001", "account-001", "舒适型轿车").catch(ignoreExistingSeed),
    seedVehicleReview("application-002", "account-002", "新能源轿车").catch(ignoreExistingSeed),
    seedVehicleReview("application-003", "account-003", "紧凑型轿车").catch(ignoreExistingSeed),
    seedSyntheticTrip(syntheticTripRepository).catch(ignoreExistingSeed),
    seedAcceptedCommunicationTrip(syntheticTripRepository).catch(ignoreExistingSeed),
    adultEligibility.seedSyntheticVerified("synthetic-account-7", "male"),
    adultEligibility.seedSyntheticVerified("synthetic-passenger-8", "female"),
  ]);
  const adminReviews = new AdminReviewTaskService(
    reviewTasks,
    {
      requestMaterial: async (input) => {
        await ready;
        const view = await vehicleReviews.requestMaterial({
          reviewerId: input.reviewerId,
          applicationId: input.applicationId,
          materialCodes: [input.reason],
          expectedVersion: input.expectedVehicleReviewVersion,
          idempotencyKey: input.idempotencyKey,
        });
        return { vehicleReviewVersion: view.version };
      },
      approve: async (input) => {
        await ready;
        return vehicleReviews.approve(input);
      },
      reject: async (input) => {
        await ready;
        return vehicleReviews.reject(input);
      },
    },
    audit,
    logger,
    metrics,
    tracer,
    now,
  );
  const adminAccess = new AdminAccessService(
    config.featureGates.syntheticAdminMultiOrganization,
    config.featureGates.syntheticAdminOperatorManagement,
    config.featureGates.syntheticAdminTripOperations,
    config.featureGates.syntheticAdminCaseManagement,
    config.featureGates.syntheticAdminFinanceOperations,
    config.featureGates.syntheticAdminExecutiveDashboard,
    now,
  );
  const adminAuthentication = new AdminAuthenticationService(
    config.featureGates.syntheticAdminAuthentication,
    config.featureGates.syntheticAdminRoleAccessMatrix,
    now,
    config.featureGates.syntheticAdminOperatorManagement,
    config.featureGates.syntheticAdminDriverVehicle,
    config.featureGates.syntheticAdminTripOperations,
    config.featureGates.syntheticAdminCaseManagement,
    config.featureGates.syntheticAdminFinanceOperations,
    config.featureGates.syntheticAdminExecutiveDashboard,
    undefined,
    config.featureGates.syntheticAdminAuditSystem,
    config.featureGates.syntheticAdminDataReports,
    config.featureGates.syntheticAdminOrganizationAccounts,
  );
  const executiveStateDirectory = options.executiveStateDir;
  if (config.featureGates.syntheticAdminExecutiveDashboard) {
    adminAccess.attachAuditEventStore(
      new FileAdminAuditEventStore(
        join(executiveStateDirectory!, "audit-events.json"),
      ),
    );
  }
  const adminOperatorManagement = new AdminOperatorManagementService(
    config.featureGates.syntheticAdminOperatorManagement,
    adminAccess,
    new InMemorySyntheticPrimaryOperatorRelationshipGateway(),
    now,
  );
  const adminTripCaseManagement = new AdminTripCaseManagementService(
    config.featureGates.syntheticAdminTripOperations,
    config.featureGates.syntheticAdminCaseManagement,
    adminAccess,
    now,
  );
  const adminFinanceOperations = new AdminFinanceOperationsService(
    config.featureGates.syntheticAdminFinanceOperations,
    adminAccess,
  );
  const executiveDashboard = new ExecutiveDashboardQueryService(
    config.featureGates.syntheticAdminExecutiveDashboard,
    adminAccess,
    undefined,
    now,
    config.featureGates.syntheticAdminExecutiveDashboard
      ? new FileExecutiveGovernanceStateStore(
          join(executiveStateDirectory!, "governance-state.json"),
        )
      : undefined,
    config.featureGates.syntheticAdminExecutiveDashboard
      ? new EncryptedFileExecutiveExportArtifactStore(
          join(executiveStateDirectory!, "exports"),
        )
      : undefined,
  );

  return Object.freeze({
    config,
    audit,
    outbox,
    repository,
    vehicleReviewRepository,
    transaction,
    tasks,
    identity,
    logger,
    metrics,
    tracer,
    health,
    vehicleReviews,
    freeFlexTrial,
    syntheticTripRepository,
    syntheticTrips,
    accountSessions,
    phoneAuthentication,
    mobility,
    dispatch,
    safetyCases,
    communications,
    dataLifecycle,
    adultEligibility,
    trustProfiles,
    coordinateTransformer,
    mapProvider,
    mapQuotaUsage,
    mapLocations,
    vehicleLocationRepository,
    vehicleLocations,
    reviewTasks,
    adminReviews,
    adminAccess,
    adminAuthentication,
    adminOperatorManagement,
    adminTripCaseManagement,
    adminFinanceOperations,
    executiveDashboard,
    ready,
    persistence: config.persistence.mode,
    close: () => postgres?.close() ?? Promise.resolve(),
  });
}

async function seedSyntheticTrip(repository: Repository<SyntheticTripRecord>) {
  return repository.put(
    "synthetic-trip-seed-1",
    {
      tripId: "synthetic-trip-seed-1",
      passengerAccountId: "synthetic-passenger-8",
      state: "paid_pending_match",
      originLabel: "静安寺 · 合成起点",
      destinationLabel: "徐家汇 · 合成终点",
      passengerCount: 1,
      createdAt: "2026-07-11T10:00:00.000Z",
      processedKeys: ["synthetic-seed-payment"],
      synthetic: true,
    },
    0,
  );
}

async function seedAcceptedCommunicationTrip(repository: Repository<SyntheticTripRecord>) {
  return repository.put(
    "synthetic-trip-chat-1",
    {
      tripId: "synthetic-trip-chat-1",
      passengerAccountId: "synthetic-passenger-8",
      driverAccountId: "synthetic-account-7",
      state: "accepted",
      originLabel: "静安寺 · 合成起点",
      destinationLabel: "徐家汇 · 合成终点",
      passengerCount: 1,
      createdAt: "2026-07-11T10:00:00.000Z",
      acceptedAt: "2026-07-11T10:02:00.000Z",
      processedKeys: ["synthetic-chat-seed"],
      synthetic: true,
    },
    0,
  );
}

function ignoreExistingSeed(error: unknown): void {
  if (error instanceof Error && error.message === "STORAGE_CONCURRENT_MODIFICATION") return;
  throw error;
}
