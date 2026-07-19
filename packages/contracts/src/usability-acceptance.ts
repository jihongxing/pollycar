export type UsabilityJourney =
  | "first_time_user"
  | "passenger"
  | "owner"
  | "exception_recovery";

export type UsabilityAcceptanceCriterion = Readonly<{
  criterionId: string;
  journey: UsabilityJourney;
  description: string;
  maximumPrimaryActions?: number;
  requiredOutcome: string;
  syntheticOnly: true;
}>;

export type UsabilityAcceptanceResult = Readonly<{
  journey: UsabilityJourney;
  passed: boolean;
  completedCriteria: readonly string[];
  blockingIssueCodes: readonly string[];
  synthetic: true;
}>;

export const usabilityAcceptanceCriteria = Object.freeze([
  {
    criterionId: "UA-FIRST-001",
    journey: "first_time_user",
    description: "首次进入即可识别内部沙箱、单 App 双身份和主要入口。",
    maximumPrimaryActions: 3,
    requiredOutcome: "用户可找到创建合成行程、我的、通知和车主申请入口。",
    syntheticOnly: true,
  },
  {
    criterionId: "UA-PASSENGER-001",
    journey: "passenger",
    description: "乘客可完成创建、零金额支付前置、匹配和确认取消。",
    maximumPrimaryActions: 5,
    requiredOutcome: "每一步均展示当前状态、下一步和可恢复路径。",
    syntheticOnly: true,
  },
  {
    criterionId: "UA-OWNER-001",
    journey: "owner",
    description: "已通过合成审核的账户可切换车主身份并理解资格与接单边界。",
    maximumPrimaryActions: 4,
    requiredOutcome: "用户可找到审核、资格、配额和待接行程，且真实接单保持关闭。",
    syntheticOnly: true,
  },
  {
    criterionId: "UA-RECOVERY-001",
    journey: "exception_recovery",
    description: "慢网、离线和会话过期时页面保持可理解并提供安全恢复动作。",
    maximumPrimaryActions: 2,
    requiredOutcome: "恢复只读取最新状态，不自动重复写入。",
    syntheticOnly: true,
  },
] as const satisfies readonly UsabilityAcceptanceCriterion[]);
