export type AppRecoveryTrigger = "startup" | "foreground" | "reconnected" | "manual";

export type AppRecoveryState =
  | "idle"
  | "offline"
  | "syncing"
  | "synced"
  | "failed"
  | "session_expired";

export type AppRecoverySnapshot = Readonly<{
  state: AppRecoveryState;
  trigger?: AppRecoveryTrigger;
  lastSyncedAt?: string;
  automaticWriteReplay: false;
  synthetic: true;
}>;
