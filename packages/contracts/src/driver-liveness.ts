export type DriverLivenessActionId =
  | "turn_head_left"
  | "turn_head_right"
  | "open_mouth"
  | "blink"
  | "nod"
  | "follow_target";

export type DriverLivenessChallengeState =
  | "created"
  | "in_progress"
  | "passed"
  | "failed"
  | "expired"
  | "cancelled"
  | "result_unknown";

export type DriverLivenessResultCategory =
  | "passed"
  | "action_mismatch"
  | "spoof_suspected"
  | "face_not_detected"
  | "camera_denied"
  | "provider_timeout"
  | "provider_unavailable"
  | "result_unknown";

export type DriverLivenessAction = Readonly<{
  actionId: DriverLivenessActionId;
  sequence: number;
  instruction: string;
  timeoutSeconds: number;
}>;

export type DriverLivenessChallenge = Readonly<{
  challengeId: string;
  state: DriverLivenessChallengeState;
  policyVersion: string;
  actions: readonly DriverLivenessAction[];
  createdAt: string;
  expiresAt: string;
  resultCategory?: DriverLivenessResultCategory;
  realBiometricDataEnabled: false;
  productionEnabled: false;
  synthetic: true;
}>;

export type DriverLivenessResult = Readonly<{
  challenge: DriverLivenessChallenge;
  authorizationIssued: boolean;
  livenessAuthorizationToken?: string;
  authorizationExpiresAt?: string;
  productionEnabled: false;
  synthetic: true;
}>;
