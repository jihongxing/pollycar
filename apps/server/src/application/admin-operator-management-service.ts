import { randomUUID } from "node:crypto";
import type {
  AdminDriver360,
  AdminOperator360,
  AdminOperatorCityCapability,
  AdminOperatorLifecycleState,
  AdminOperatorManagementCommand,
  AdminOperatorManagementCommandResult,
  AdminOperatorDirectoryItem,
  AdminOperatorOnboardingCase,
  AdminPrimaryOperatorMigrationCase,
  AdminPrimaryOperatorRelationship,
  AdminVehicle360,
} from "@pollycar/contracts";
import {
  type AdminAccessActor,
  AdminAccessService,
} from "./admin-access-service.js";

type MutableOperator = {
  operatorId: string;
  operatorName: string;
  syntheticReference: string;
  contactMasked: string;
  lifecycleState: AdminOperatorLifecycleState;
  resourceVersion: number;
  capabilities: AdminOperatorCityCapability[];
  activeDrivers: number;
  activeVehicles: number;
  pendingTasks: number;
  updatedAt: string;
};

type MutableOnboardingCase = {
  onboardingCaseId: string;
  operatorId: string;
  operatorName: string;
  state: AdminOperatorOnboardingCase["state"];
  resourceVersion: number;
  handledByInternalUserId: string;
  checks: AdminOperatorOnboardingCase["checks"];
};

type MutableMigration = {
  migrationCaseId: string;
  driverAccountId: string;
  vehicleId: string;
  cityCode: string;
  sourceOperatorId: string;
  sourceOperatorName: string;
  targetOperatorId: string;
  targetOperatorName: string;
  state: AdminPrimaryOperatorMigrationCase["state"];
  resourceVersion: number;
  sourceAcknowledged: boolean;
  targetAcknowledged: boolean;
  independentlyReviewed: boolean;
  effectiveAt?: string;
  blockers: AdminPrimaryOperatorMigrationCase["blockers"];
};

type SyntheticDriverVehicleFixture = Readonly<{
  driverAccountId: string;
  displayNameMasked: string;
  phoneMasked: string;
  eligibilityState: AdminDriver360["eligibilityState"];
  quotaSummary: string;
  vehicleId: string;
  plateMasked: string;
  vehicleSummary: string;
  reviewState: AdminVehicle360["review"]["state"];
  reviewVersion: number;
  expiringDocumentCount: number;
  operatorId: string;
  operatorName: string;
  relationshipId: string;
  effectiveFrom: string;
}>;

const syntheticFleetFixtures: readonly SyntheticDriverVehicleFixture[] = [
  {
    driverAccountId: "driver-synthetic-086",
    displayNameMasked: "陈*",
    phoneMasked: "138****7312",
    eligibilityState: "serviceable",
    quotaSummary: "本周剩余 3 次",
    vehicleId: "vehicle-synthetic-132",
    plateMasked: "沪A·7**21",
    vehicleSummary: "新能源五座轿车",
    reviewState: "approved",
    reviewVersion: 9,
    expiringDocumentCount: 2,
    operatorId: "operator-huhang",
    operatorName: "沪行出行服务",
    relationshipId: "relationship-synthetic-002",
    effectiveFrom: "2026-07-10T00:00:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-104",
    displayNameMasked: "周*",
    phoneMasked: "139****2048",
    eligibilityState: "restricted",
    quotaSummary: "材料补充完成前不可接单",
    vehicleId: "vehicle-synthetic-204",
    plateMasked: "沪B·3**08",
    vehicleSummary: "舒适型五座轿车",
    reviewState: "changes_requested",
    reviewVersion: 1,
    expiringDocumentCount: 1,
    operatorId: "operator-huhang",
    operatorName: "沪行出行服务",
    relationshipId: "relationship-synthetic-003",
    effectiveFrom: "2026-07-11T00:00:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-118",
    displayNameMasked: "顾*",
    phoneMasked: "137****6621",
    eligibilityState: "restricted",
    quotaSummary: "车辆准入审核中",
    vehicleId: "vehicle-synthetic-218",
    plateMasked: "沪C·9**16",
    vehicleSummary: "新能源五座轿车",
    reviewState: "under_review",
    reviewVersion: 1,
    expiringDocumentCount: 0,
    operatorId: "operator-shencheng",
    operatorName: "申城伙伴运营",
    relationshipId: "relationship-synthetic-004",
    effectiveFrom: "2026-07-11T00:00:00.000Z",
  },
  {
    driverAccountId: "driver-synthetic-126",
    displayNameMasked: "林*",
    phoneMasked: "136****5179",
    eligibilityState: "restricted",
    quotaSummary: "车辆准入审核中",
    vehicleId: "vehicle-synthetic-226",
    plateMasked: "沪D·5**73",
    vehicleSummary: "紧凑型五座轿车",
    reviewState: "under_review",
    reviewVersion: 1,
    expiringDocumentCount: 0,
    operatorId: "operator-haiwan",
    operatorName: "海湾城市服务",
    relationshipId: "relationship-synthetic-005",
    effectiveFrom: "2026-07-11T00:00:00.000Z",
  },
];

export interface PrimaryOperatorRelationshipGateway {
  getActive(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
  }>): AdminPrimaryOperatorRelationship | undefined;
  listForDriver(driverAccountId: string): readonly AdminPrimaryOperatorRelationship[];
  migrate(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    sourceOperatorId: string;
    targetOperatorId: string;
    targetOperatorName: string;
    effectiveAt: string;
  }>): AdminPrimaryOperatorRelationship;
}

export class InMemorySyntheticPrimaryOperatorRelationshipGateway
  implements PrimaryOperatorRelationshipGateway
{
  private readonly relationships: AdminPrimaryOperatorRelationship[] = [
    createRelationship({
      relationshipId: "relationship-synthetic-001",
      driverAccountId: "driver-synthetic-086",
      vehicleId: "vehicle-synthetic-132",
      cityCode: "CN-SH",
      operatorId: "operator-shencheng",
      operatorName: "申城伙伴运营",
      state: "ended",
      effectiveFrom: "2026-05-01T00:00:00.000Z",
      effectiveTo: "2026-07-10T00:00:00.000Z",
    }),
    createRelationship({
      relationshipId: "relationship-synthetic-002",
      driverAccountId: "driver-synthetic-086",
      vehicleId: "vehicle-synthetic-132",
      cityCode: "CN-SH",
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      state: "active",
      effectiveFrom: "2026-07-10T00:00:00.000Z",
    }),
    ...syntheticFleetFixtures.slice(1).map((fixture) =>
      createRelationship({
        relationshipId: fixture.relationshipId,
        driverAccountId: fixture.driverAccountId,
        vehicleId: fixture.vehicleId,
        cityCode: "CN-SH",
        operatorId: fixture.operatorId,
        operatorName: fixture.operatorName,
        state: "active",
        effectiveFrom: fixture.effectiveFrom,
      })),
  ];

  public getActive(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
  }>): AdminPrimaryOperatorRelationship | undefined {
    return this.relationships.find(
      (relationship) =>
        relationship.driverAccountId === input.driverAccountId &&
        relationship.cityCode === input.cityCode &&
        relationship.vehicleId === input.vehicleId &&
        relationship.state === "active",
    );
  }

  public listForDriver(
    driverAccountId: string,
  ): readonly AdminPrimaryOperatorRelationship[] {
    return Object.freeze(
      this.relationships.filter(
        (relationship) =>
          relationship.driverAccountId === driverAccountId,
      ),
    );
  }

  public migrate(input: Readonly<{
    driverAccountId: string;
    cityCode: string;
    vehicleId: string;
    sourceOperatorId: string;
    targetOperatorId: string;
    targetOperatorName: string;
    effectiveAt: string;
  }>): AdminPrimaryOperatorRelationship {
    const activeIndex = this.relationships.findIndex(
      (relationship) =>
        relationship.driverAccountId === input.driverAccountId &&
        relationship.cityCode === input.cityCode &&
        relationship.vehicleId === input.vehicleId &&
        relationship.operatorId === input.sourceOperatorId &&
        relationship.state === "active",
    );
    if (activeIndex < 0) throw new Error("ADMIN_OPERATOR_MIGRATION_BLOCKED");
    const active = this.relationships[activeIndex]!;
    this.relationships[activeIndex] = createRelationship({
      relationshipId: active.relationshipId,
      driverAccountId: active.driverAccountId,
      vehicleId: active.vehicleId,
      cityCode: active.cityCode,
      operatorId: active.operatorId,
      operatorName: active.operatorName,
      state: "ended",
      effectiveFrom: active.effectiveFrom,
      effectiveTo: input.effectiveAt,
    });
    const created = createRelationship({
      relationshipId: randomUUID(),
      driverAccountId: input.driverAccountId,
      vehicleId: input.vehicleId,
      cityCode: input.cityCode,
      operatorId: input.targetOperatorId,
      operatorName: input.targetOperatorName,
      state: "active",
      effectiveFrom: input.effectiveAt,
    });
    this.relationships.push(created);
    return created;
  }
}

export class AdminOperatorManagementService {
  private readonly operators = new Map<string, MutableOperator>();
  private readonly onboardingCases = new Map<string, MutableOnboardingCase>();
  private readonly migrations = new Map<string, MutableMigration>();
  private readonly commandResults = new Map<
    string,
    AdminOperatorManagementCommandResult
  >();

  public constructor(
    private readonly enabled: boolean,
    private readonly access: AdminAccessService,
    private readonly relationships: PrimaryOperatorRelationshipGateway,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.seed();
  }

  public getOperator360(
    actor: AdminAccessActor,
    operatorId: string,
  ): AdminOperator360 {
    this.requireEnabled();
    const operator = this.requireOperator(operatorId);
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.profile.read",
      module: "operator_management",
      resourceType: "operator",
      resourceId: operatorId,
      operatorId,
    });
    this.recordView(actor, "operator_profile_viewed", "operator", operatorId);
    return Object.freeze({
      context: session.context,
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      syntheticReference: operator.syntheticReference,
      contactMasked: operator.contactMasked,
      lifecycleState: operator.lifecycleState,
      resourceVersion: operator.resourceVersion,
      updatedAt: operator.updatedAt,
      capabilities: Object.freeze([...operator.capabilities]),
      metrics: Object.freeze({
        activeDrivers: operator.activeDrivers,
        activeVehicles: operator.activeVehicles,
        pendingTasks: operator.pendingTasks,
      }),
      blockers: Object.freeze(
        operatorId === "operator-huhang"
          ? [
              Object.freeze({
                blockerType: "vehicle_document" as const,
                summary: "3 辆车证照将在 30 天内到期",
                blocking: false,
              }),
            ]
          : [],
      ),
      financeReadOnly: true,
      sensitiveFieldsMasked: true,
      realAccountsEnabled: false,
      productionEnabled: false,
      synthetic: true,
    });
  }

  public listOperatorDirectory(
    actor: AdminAccessActor,
  ): readonly AdminOperatorDirectoryItem[] {
    this.requireEnabled();
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.directory.read",
      module: "operator_management",
      resourceType: "operator_directory",
      resourceId: "operators",
    });
    const allowedOperators = new Set(session.context.operatorScopes);
    return Object.freeze(
      [...this.operators.values()]
        .filter((operator) => allowedOperators.has(operator.operatorId))
        .map(toDirectoryItem),
    );
  }

  public getOperatorDirectoryItem(
    actor: AdminAccessActor,
    operatorId: string,
  ): AdminOperatorDirectoryItem {
    this.requireEnabled();
    const operator = this.requireOperator(operatorId);
    this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.profile.read",
      module: "operator_management",
      resourceType: "operator",
      resourceId: operatorId,
      operatorId,
    });
    return toDirectoryItem(operator);
  }

  public getOnboardingCase(
    actor: AdminAccessActor,
    onboardingCaseId: string,
  ): AdminOperatorOnboardingCase {
    this.requireEnabled();
    const onboardingCase = this.requireOnboarding(onboardingCaseId);
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.onboarding.manage",
      module: "operator_onboarding",
      resourceType: "onboarding_case",
      resourceId: onboardingCaseId,
      operatorId: onboardingCase.operatorId,
      platformOnly: true,
    });
    return Object.freeze({
      context: session.context,
      onboardingCaseId: onboardingCase.onboardingCaseId,
      operatorId: onboardingCase.operatorId,
      operatorName: onboardingCase.operatorName,
      state: onboardingCase.state,
      resourceVersion: onboardingCase.resourceVersion,
      handledByInternalUserId: onboardingCase.handledByInternalUserId,
      checks: Object.freeze([...onboardingCase.checks]),
      realMaterialsAllowed: false,
      synthetic: true,
    });
  }

  public getDriver360(
    actor: AdminAccessActor,
    driverAccountId: string,
  ): AdminDriver360 {
    this.requireEnabled();
    const fixture = syntheticFleetFixtures.find(
      (candidate) => candidate.driverAccountId === driverAccountId,
    );
    if (!fixture) {
      throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    }
    const active = this.requireActiveRelationship(
      driverAccountId,
      "CN-SH",
      fixture.vehicleId,
    );
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.driver_360.read",
      module: "driver_directory",
      resourceType: "driver",
      resourceId: driverAccountId,
      operatorId: active.operatorId,
    });
    this.recordView(actor, "entity_360_viewed", "driver", driverAccountId);
    return Object.freeze({
      context: session.context,
      driverAccountId,
      displayNameMasked: fixture.displayNameMasked,
      phoneMasked: fixture.phoneMasked,
      eligibilityState: fixture.eligibilityState,
      quotaSummary: fixture.quotaSummary,
      primaryOperatorRelationship: active,
      relationshipHistory: this.relationships.listForDriver(driverAccountId),
      vehicles: Object.freeze([
        Object.freeze({
          vehicleId: fixture.vehicleId,
          plateMasked: fixture.plateMasked,
          reviewState: fixture.reviewState,
        }),
      ]),
      sensitiveFieldsMasked: true,
      synthetic: true,
    });
  }

  public getVehicle360(
    actor: AdminAccessActor,
    vehicleId: string,
  ): AdminVehicle360 {
    this.requireEnabled();
    const fixture = syntheticFleetFixtures.find(
      (candidate) => candidate.vehicleId === vehicleId,
    );
    if (!fixture) {
      throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    }
    const active = this.requireActiveRelationship(
      fixture.driverAccountId,
      "CN-SH",
      vehicleId,
    );
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.vehicle_360.read",
      module: "vehicle_directory",
      resourceType: "vehicle",
      resourceId: vehicleId,
      operatorId: active.operatorId,
    });
    this.recordView(actor, "entity_360_viewed", "vehicle", vehicleId);
    return Object.freeze({
      context: session.context,
      vehicleId,
      plateMasked: fixture.plateMasked,
      vehicleSummary: fixture.vehicleSummary,
      driverAccountId: fixture.driverAccountId,
      driverNameMasked: fixture.displayNameMasked,
      review: Object.freeze({
        state: fixture.reviewState,
        resourceVersion: fixture.reviewVersion,
        authoritativeSource: "spec/domain/vehicle-review.yaml",
      }),
      primaryOperatorRelationship: active,
      expiringDocumentCount: fixture.expiringDocumentCount,
      directReviewMutationAllowed: false,
      sensitiveFieldsMasked: true,
      synthetic: true,
    });
  }

  public getMigrationCase(
    actor: AdminAccessActor,
    migrationCaseId: string,
  ): AdminPrimaryOperatorMigrationCase {
    this.requireEnabled();
    const migration = this.requireMigration(migrationCaseId);
    const session = this.access.authorizeOperatorManagement(actor, {
      action: "admin_operator.primary_relationship.read",
      module: "primary_operator_relationships",
      resourceType: "migration_case",
      resourceId: migrationCaseId,
      operatorIds: [
        migration.sourceOperatorId,
        migration.targetOperatorId,
      ],
    });
    return Object.freeze({
      context: session.context,
      migrationCaseId: migration.migrationCaseId,
      driverAccountId: migration.driverAccountId,
      vehicleId: migration.vehicleId,
      cityCode: migration.cityCode,
      sourceOperatorId: migration.sourceOperatorId,
      sourceOperatorName: migration.sourceOperatorName,
      targetOperatorId: migration.targetOperatorId,
      targetOperatorName: migration.targetOperatorName,
      state: migration.state,
      resourceVersion: migration.resourceVersion,
      sourceAcknowledged: migration.sourceAcknowledged,
      targetAcknowledged: migration.targetAcknowledged,
      independentlyReviewed: migration.independentlyReviewed,
      ...(migration.effectiveAt
        ? { effectiveAt: migration.effectiveAt }
        : {}),
      blockers: Object.freeze([...migration.blockers]),
      rollbackAllowed: false,
      synthetic: true,
    });
  }

  public executeCommand(
    actor: AdminAccessActor,
    idempotencyKey: string,
    command: AdminOperatorManagementCommand,
  ): AdminOperatorManagementCommandResult {
    this.requireEnabled();
    const existing = this.commandResults.get(idempotencyKey);
    if (existing) return existing;
    const result = this.applyCommand(actor, command);
    this.commandResults.set(idempotencyKey, result);
    return result;
  }

  public listAuditEvents(actor: AdminAccessActor) {
    return this.access.listAuditEvents(actor);
  }

  private applyCommand(
    actor: AdminAccessActor,
    command: AdminOperatorManagementCommand,
  ): AdminOperatorManagementCommandResult {
    switch (command.type) {
      case "request_onboarding_changes":
        return this.requestOnboardingChanges(actor, command);
      case "approve_onboarding":
        return this.approveOnboarding(actor, command);
      case "grant_city_capability":
        return this.grantCapability(actor, command);
      case "change_operator_lifecycle":
        return this.changeLifecycle(actor, command);
      default:
        return this.applyMigrationCommand(actor, command);
    }
  }

  private requestOnboardingChanges(
    actor: AdminAccessActor,
    command: Extract<
      AdminOperatorManagementCommand,
      { type: "request_onboarding_changes" }
    >,
  ): AdminOperatorManagementCommandResult {
    const onboardingCase = this.requireOnboarding(command.onboardingCaseId);
    this.authorizePlatformCommand(
      actor,
      "admin_operator.onboarding.manage",
      "operator_onboarding",
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      onboardingCase.operatorId,
    );
    requireVersion(onboardingCase.resourceVersion, command.resourceVersion);
    onboardingCase.state = "changes_requested";
    onboardingCase.resourceVersion += 1;
    this.recordCommand(
      actor,
      "onboarding_decision_recorded",
      command.type,
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      "changes_requested",
    );
    return resultFor(
      command.type,
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      onboardingCase.resourceVersion,
      onboardingCase.state,
    );
  }

  private approveOnboarding(
    actor: AdminAccessActor,
    command: Extract<
      AdminOperatorManagementCommand,
      { type: "approve_onboarding" }
    >,
  ): AdminOperatorManagementCommandResult {
    const onboardingCase = this.requireOnboarding(command.onboardingCaseId);
    const session = this.authorizePlatformCommand(
      actor,
      "admin_operator.onboarding.review",
      "operator_onboarding",
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      onboardingCase.operatorId,
    );
    requireVersion(onboardingCase.resourceVersion, command.resourceVersion);
    if (session.internalUserId === onboardingCase.handledByInternalUserId) {
      throw new Error("AUTHORIZATION_SEPARATION_OF_DUTIES");
    }
    onboardingCase.state = "approved";
    onboardingCase.resourceVersion += 1;
    const operator = this.requireOperator(onboardingCase.operatorId);
    operator.lifecycleState = "pending_activation";
    operator.resourceVersion += 1;
    operator.updatedAt = this.now().toISOString();
    this.recordCommand(
      actor,
      "onboarding_decision_recorded",
      command.type,
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      "approved",
    );
    return resultFor(
      command.type,
      "onboarding_case",
      onboardingCase.onboardingCaseId,
      onboardingCase.resourceVersion,
      onboardingCase.state,
    );
  }

  private grantCapability(
    actor: AdminAccessActor,
    command: Extract<
      AdminOperatorManagementCommand,
      { type: "grant_city_capability" }
    >,
  ): AdminOperatorManagementCommandResult {
    const operator = this.requireOperator(command.operatorId);
    this.authorizePlatformCommand(
      actor,
      "admin_operator.city_capability.manage",
      "operator_management",
      "operator",
      operator.operatorId,
      operator.operatorId,
    );
    requireVersion(operator.resourceVersion, command.resourceVersion);
    if (command.cityCode === "*") {
      throw new Error("ADMIN_OPERATOR_WILDCARD_SCOPE_FORBIDDEN");
    }
    operator.capabilities.push(
      Object.freeze({
        capabilityId: randomUUID(),
        cityCode: command.cityCode,
        cityName: command.cityCode === "CN-SH" ? "上海" : command.cityCode,
        capabilityType: command.capabilityType,
        state: "active",
        effectiveFrom: this.now().toISOString(),
        ruleVersion: "operator-capability-v1",
        approvalCaseId: "onboarding-synthetic-021",
        synthetic: true,
      }),
    );
    operator.resourceVersion += 1;
    operator.updatedAt = this.now().toISOString();
    this.recordCommand(
      actor,
      "city_capability_changed",
      command.type,
      "operator",
      operator.operatorId,
    );
    return resultFor(
      command.type,
      "operator",
      operator.operatorId,
      operator.resourceVersion,
      operator.lifecycleState,
    );
  }

  private changeLifecycle(
    actor: AdminAccessActor,
    command: Extract<
      AdminOperatorManagementCommand,
      { type: "change_operator_lifecycle" }
    >,
  ): AdminOperatorManagementCommandResult {
    const operator = this.requireOperator(command.operatorId);
    this.authorizePlatformCommand(
      actor,
      "admin_operator.lifecycle.propose",
      "operator_management",
      "operator",
      operator.operatorId,
      operator.operatorId,
    );
    requireVersion(operator.resourceVersion, command.resourceVersion);
    if (
      !lifecycleTransitions[operator.lifecycleState].includes(
        command.targetState,
      )
    ) {
      throw new Error("ADMIN_OPERATOR_INVALID_TRANSITION");
    }
    operator.lifecycleState = command.targetState;
    operator.resourceVersion += 1;
    operator.updatedAt = this.now().toISOString();
    this.recordCommand(
      actor,
      "operator_lifecycle_changed",
      command.type,
      "operator",
      operator.operatorId,
      command.reason,
    );
    return resultFor(
      command.type,
      "operator",
      operator.operatorId,
      operator.resourceVersion,
      operator.lifecycleState,
    );
  }

  private applyMigrationCommand(
    actor: AdminAccessActor,
    command: Exclude<
      AdminOperatorManagementCommand,
      | { type: "request_onboarding_changes" }
      | { type: "approve_onboarding" }
      | { type: "grant_city_capability" }
      | { type: "change_operator_lifecycle" }
    >,
  ): AdminOperatorManagementCommandResult {
    const migration = this.requireMigration(command.migrationCaseId);
    const acknowledgement =
      command.type === "acknowledge_primary_operator_migration";
    const session = this.access.authorizeOperatorManagement(actor, {
      action: acknowledgement
        ? "admin_operator.migration.acknowledge"
        : command.type === "review_primary_operator_migration"
          ? "admin_operator.migration.review"
          : "admin_operator.migration.manage",
      module: "primary_operator_relationships",
      resourceType: "migration_case",
      resourceId: migration.migrationCaseId,
      ...(acknowledgement
        ? {
            operatorId:
              command.side === "source"
                ? migration.sourceOperatorId
                : migration.targetOperatorId,
          }
        : { platformOnly: true }),
    });
    requireVersion(migration.resourceVersion, command.resourceVersion);
    if (acknowledgement) {
      if (command.side === "source") migration.sourceAcknowledged = true;
      else migration.targetAcknowledged = true;
      migration.state = migration.sourceAcknowledged
        ? migration.targetAcknowledged
          ? "awaiting_independent_review"
          : "awaiting_target_acknowledgement"
        : "awaiting_source_acknowledgement";
      migration.resourceVersion += 1;
      this.recordCommand(
        actor,
        "migration_acknowledged",
        command.type,
        "migration_case",
        migration.migrationCaseId,
        command.side,
      );
    } else if (command.type === "review_primary_operator_migration") {
      if (!migration.sourceAcknowledged || !migration.targetAcknowledged) {
        throw new Error("ADMIN_OPERATOR_MIGRATION_BLOCKED");
      }
      if (session.internalUserId === "internal-platform-ops-001") {
        migration.independentlyReviewed = true;
      }
      migration.resourceVersion += 1;
      this.recordCommand(
        actor,
        "migration_reviewed",
        command.type,
        "migration_case",
        migration.migrationCaseId,
      );
    } else if (command.type === "schedule_primary_operator_migration") {
      if (
        migration.blockers.some((blocker) => blocker.blocking) ||
        !migration.independentlyReviewed
      ) {
        this.recordCommand(
          actor,
          "migration_blocked",
          command.type,
          "migration_case",
          migration.migrationCaseId,
          "ADMIN_OPERATOR_MIGRATION_BLOCKED",
        );
        throw new Error("ADMIN_OPERATOR_MIGRATION_BLOCKED");
      }
      if (new Date(command.effectiveAt) <= this.now()) {
        throw new Error("ADMIN_OPERATOR_EFFECTIVE_TIME_INVALID");
      }
      migration.state = "scheduled";
      migration.effectiveAt = command.effectiveAt;
      migration.resourceVersion += 1;
      this.recordCommand(
        actor,
        "migration_scheduled",
        command.type,
        "migration_case",
        migration.migrationCaseId,
      );
    } else {
      if (migration.state !== "scheduled" || !migration.effectiveAt) {
        throw new Error("ADMIN_OPERATOR_MIGRATION_BLOCKED");
      }
      this.relationships.migrate({
        driverAccountId: migration.driverAccountId,
        cityCode: migration.cityCode,
        vehicleId: migration.vehicleId,
        sourceOperatorId: migration.sourceOperatorId,
        targetOperatorId: migration.targetOperatorId,
        targetOperatorName: migration.targetOperatorName,
        effectiveAt: migration.effectiveAt,
      });
      migration.state = "effective";
      migration.resourceVersion += 1;
      this.recordCommand(
        actor,
        "migration_effective",
        command.type,
        "migration_case",
        migration.migrationCaseId,
      );
    }
    return resultFor(
      command.type,
      "migration_case",
      migration.migrationCaseId,
      migration.resourceVersion,
      migration.state,
    );
  }

  private authorizePlatformCommand(
    actor: AdminAccessActor,
    action: string,
    module:
      | "operator_management"
      | "operator_onboarding"
      | "primary_operator_relationships",
    resourceType: string,
    resourceId: string,
    operatorId: string,
  ) {
    return this.access.authorizeOperatorManagement(actor, {
      action,
      module,
      resourceType,
      resourceId,
      operatorId,
      platformOnly: true,
    });
  }

  private recordView(
    actor: AdminAccessActor,
    eventType: "operator_profile_viewed" | "entity_360_viewed",
    resourceType: string,
    resourceId: string,
  ): void {
    this.access.recordOperatorManagementEvent(actor, {
      eventType,
      action: `${resourceType}.read`,
      resourceType,
      resourceId,
    });
  }

  private recordCommand(
    actor: AdminAccessActor,
    eventType:
      | "onboarding_decision_recorded"
      | "operator_lifecycle_changed"
      | "city_capability_changed"
      | "migration_acknowledged"
      | "migration_reviewed"
      | "migration_scheduled"
      | "migration_effective"
      | "migration_blocked",
    action: string,
    resourceType: string,
    resourceId: string,
    reasonCode?: string,
  ): void {
    this.access.recordOperatorManagementEvent(actor, {
      eventType,
      action,
      resourceType,
      resourceId,
      ...(reasonCode ? { reasonCode } : {}),
    });
  }

  private requireActiveRelationship(
    driverAccountId: string,
    cityCode: string,
    vehicleId: string,
  ): AdminPrimaryOperatorRelationship {
    const relationship = this.relationships.getActive({
      driverAccountId,
      cityCode,
      vehicleId,
    });
    if (!relationship) throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    return relationship;
  }

  private requireOperator(operatorId: string): MutableOperator {
    const operator = this.operators.get(operatorId);
    if (!operator) throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    return operator;
  }

  private requireOnboarding(
    onboardingCaseId: string,
  ): MutableOnboardingCase {
    const onboardingCase = this.onboardingCases.get(onboardingCaseId);
    if (!onboardingCase) throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    return onboardingCase;
  }

  private requireMigration(migrationCaseId: string): MutableMigration {
    const migration = this.migrations.get(migrationCaseId);
    if (!migration) throw new Error("ADMIN_OPERATOR_RESOURCE_NOT_FOUND");
    return migration;
  }

  private requireEnabled(): void {
    if (!this.enabled) throw new Error("FEATURE_DISABLED");
  }

  private seed(): void {
    this.operators.set("operator-huhang", {
      operatorId: "operator-huhang",
      operatorName: "沪行出行服务",
      syntheticReference: "OP-SH-00018",
      contactMasked: "赵** · 138****2041",
      lifecycleState: "active",
      resourceVersion: 18,
      capabilities: [
        createCapability("capability-huhang-driver", "driver_operations"),
        createCapability("capability-huhang-vehicle", "vehicle_operations"),
        createCapability("capability-huhang-trip", "trip_coordination"),
      ],
      activeDrivers: 128,
      activeVehicles: 132,
      pendingTasks: 7,
      updatedAt: "2026-07-15T08:00:00.000Z",
    });
    this.operators.set("operator-shencheng", {
      operatorId: "operator-shencheng",
      operatorName: "申城伙伴运营",
      syntheticReference: "OP-SH-00021",
      contactMasked: "钱** · 139****1183",
      lifecycleState: "onboarding_review",
      resourceVersion: 3,
      capabilities: [],
      activeDrivers: 96,
      activeVehicles: 101,
      pendingTasks: 4,
      updatedAt: "2026-07-15T09:30:00.000Z",
    });
    this.onboardingCases.set("onboarding-synthetic-021", {
      onboardingCaseId: "onboarding-synthetic-021",
      operatorId: "operator-shencheng",
      operatorName: "申城伙伴运营",
      state: "under_review",
      resourceVersion: 4,
      handledByInternalUserId: "internal-platform-onboarding-001",
      checks: Object.freeze([
        createCheck("identity", "主体身份摘要", "passed", "合成登记信息一致"),
        createCheck("city", "申请城市与能力", "passed", "上海 · 车主与车辆运营"),
        createCheck("safety", "安全协作准备度", "pending", "缺少夜间升级联系人"),
      ]),
    });
    this.migrations.set("migration-synthetic-009", {
      migrationCaseId: "migration-synthetic-009",
      driverAccountId: "driver-synthetic-086",
      vehicleId: "vehicle-synthetic-132",
      cityCode: "CN-SH",
      sourceOperatorId: "operator-huhang",
      sourceOperatorName: "沪行出行服务",
      targetOperatorId: "operator-shencheng",
      targetOperatorName: "申城伙伴运营",
      state: "checks_pending",
      resourceVersion: 5,
      sourceAcknowledged: false,
      targetAcknowledged: false,
      independentlyReviewed: false,
      blockers: Object.freeze([
        Object.freeze({
          blockerType: "active_trip" as const,
          summary: "存在 1 笔预约行程，预计 16:40 完成",
          blocking: true,
        }),
      ]),
    });
  }
}

const lifecycleTransitions: Record<
  AdminOperatorLifecycleState,
  readonly AdminOperatorLifecycleState[]
> = {
  candidate: ["onboarding_review"],
  onboarding_review: ["pending_activation", "candidate"],
  pending_activation: ["active", "restricted", "suspended"],
  active: ["restricted", "suspended", "exit_pending"],
  restricted: ["active", "suspended", "exit_pending"],
  suspended: ["restricted", "active", "exit_pending"],
  exit_pending: ["exited", "restricted", "suspended"],
  exited: [],
};

function toDirectoryItem(
  operator: MutableOperator,
): AdminOperatorDirectoryItem {
  return Object.freeze({
    operatorId: operator.operatorId,
    operatorName: operator.operatorName,
    syntheticReference: operator.syntheticReference,
    lifecycleState: operator.lifecycleState,
    cityNames: Object.freeze([
      ...new Set(operator.capabilities.map((capability) => capability.cityName)),
    ]),
    activeDrivers: operator.activeDrivers,
    activeVehicles: operator.activeVehicles,
    pendingTasks: operator.pendingTasks,
    resourceVersion: operator.resourceVersion,
    updatedAt: operator.updatedAt,
    synthetic: true,
  });
}

function createRelationship(
  input: Omit<
    AdminPrimaryOperatorRelationship,
    "authoritativeSource" | "synthetic"
  >,
): AdminPrimaryOperatorRelationship {
  return Object.freeze({
    ...input,
    authoritativeSource: "pollycar_finance.driver_operator_memberships",
    synthetic: true,
  });
}

function createCapability(
  capabilityId: string,
  capabilityType: AdminOperatorCityCapability["capabilityType"],
): AdminOperatorCityCapability {
  return Object.freeze({
    capabilityId,
    cityCode: "CN-SH",
    cityName: "上海",
    capabilityType,
    state: "active",
    effectiveFrom: "2026-07-10T00:00:00.000Z",
    ruleVersion: "operator-capability-v1",
    approvalCaseId: "onboarding-synthetic-018",
    synthetic: true,
  });
}

function createCheck(
  checkId: string,
  label: string,
  state: "passed" | "pending" | "failed",
  summary: string,
) {
  return Object.freeze({ checkId, label, state, summary });
}

function resultFor(
  commandType: AdminOperatorManagementCommand["type"],
  resourceType: AdminOperatorManagementCommandResult["resourceType"],
  resourceId: string,
  resourceVersion: number,
  state: string,
): AdminOperatorManagementCommandResult {
  return Object.freeze({
    commandType,
    resourceType,
    resourceId,
    resourceVersion,
    state,
    synthetic: true,
  });
}

function requireVersion(current: number, supplied: number): void {
  if (current !== supplied) throw new Error("STORAGE_CONCURRENT_MODIFICATION");
}
