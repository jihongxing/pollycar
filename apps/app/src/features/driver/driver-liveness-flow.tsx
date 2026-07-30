import type {
  DriverLivenessChallenge,
  DriverLivenessResult,
} from "@pollycar/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AppV2StatusPanel } from "../../components/app-v2-components";
import { AppText, PrimaryButton } from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";
import {
  SyntheticDriverLivenessCameraAdapter,
  type DriverLivenessCameraAdapter,
} from "./driver-liveness-camera-adapter";
import {
  advanceDriverLivenessAction,
  driverLivenessActionTimeoutMs,
  driverLivenessErrorPresentation,
} from "./driver-liveness-flow-model";

type Phase =
  | "permission"
  | "loading"
  | "actions"
  | "submitting"
  | "success"
  | "error";

export function DriverLivenessFlow({
  visible,
  onClose,
  onCreateChallenge,
  onCompleteChallenge,
  camera,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateChallenge: () => Promise<DriverLivenessChallenge>;
  onCompleteChallenge: (
    challengeId: string,
  ) => Promise<DriverLivenessResult>;
  camera?: DriverLivenessCameraAdapter;
}) {
  const { theme } = useAppTheme();
  const [cameraAdapter] = useState<DriverLivenessCameraAdapter>(
    () => camera ?? new SyntheticDriverLivenessCameraAdapter(),
  );
  const [phase, setPhase] = useState<Phase>("permission");
  const [challenge, setChallenge] = useState<DriverLivenessChallenge>();
  const [actionIndex, setActionIndex] = useState(0);
  const [errorCode, setErrorCode] = useState<string>();

  const start = async () => {
    setPhase("permission");
    setErrorCode(undefined);
    setChallenge(undefined);
    setActionIndex(0);
    const permission = await cameraAdapter.prepare();
    if (permission !== "granted") {
      setErrorCode("CAMERA_PERMISSION_DENIED");
      setPhase("error");
      return;
    }
    setPhase("loading");
    try {
      setChallenge(await onCreateChallenge());
      setPhase("actions");
    } catch (error) {
      setErrorCode(readErrorCode(error));
      setPhase("error");
      await cameraAdapter.release();
    }
  };

  useEffect(() => {
    if (!visible) return;
    void start();
    return () => {
      void cameraAdapter.release();
    };
  }, [visible]);

  const currentAction = challenge?.actions[actionIndex];
  const progress = useMemo(
    () =>
      challenge
        ? `${Math.min(actionIndex + 1, challenge.actions.length)} / ${challenge.actions.length}`
        : undefined,
    [actionIndex, challenge],
  );

  useEffect(() => {
    if (phase !== "actions" || !currentAction) return;
    const timeout = globalThis.setTimeout(() => {
      setErrorCode("DRIVER_LIVENESS_ACTION_TIMEOUT");
      setPhase("error");
      void cameraAdapter.release();
    }, driverLivenessActionTimeoutMs(currentAction.timeoutSeconds));
    return () => globalThis.clearTimeout(timeout);
  }, [cameraAdapter, currentAction, phase]);

  const close = async () => {
    await cameraAdapter.release();
    onClose();
  };

  const finishAction = async () => {
    if (!challenge || !currentAction) return;
    const progress = advanceDriverLivenessAction(
      actionIndex,
      challenge.actions.length,
    );
    if (!progress.completed) {
      setActionIndex(progress.nextIndex);
      return;
    }
    setPhase("submitting");
    try {
      const result = await onCompleteChallenge(challenge.challengeId);
      if (!result.authorizationIssued) {
        throw new Error("DRIVER_LIVENESS_REQUIRED");
      }
      setPhase("success");
      await cameraAdapter.release();
    } catch (error) {
      setErrorCode(readErrorCode(error));
      setPhase("error");
      await cameraAdapter.release();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => void close()}
    >
      <View
        style={[
          styles.screen,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <AppText size="caption" tone="owner" weight="bold">
              上线前安全确认
            </AppText>
            <AppText size="title1" family="display" weight="bold">
              确认是你本人
            </AppText>
            <AppText tone="secondary">
              按顺序完成屏幕动作。检测结束后摄像头会立即关闭，本流程不会上传或保存照片、视频。
            </AppText>
          </View>

          <View
            accessibilityLabel="人脸活体检测相机区域"
            style={[
              styles.camera,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.faceGuide,
                { borderColor: theme.colors.owner },
              ]}
            />
            <AppText size="caption" tone="secondary">
              请保持面部位于框内，环境光线充足
            </AppText>
          </View>

          {phase === "permission" ? (
            <AppV2StatusPanel
              tone="neutral"
              title="正在请求相机权限"
              description="仅在本次上线确认期间使用前置摄像头。"
            />
          ) : phase === "loading" ? (
            <AppV2StatusPanel
              tone="neutral"
              title="正在准备检测"
              description="即将显示本次随机动作。"
            />
          ) : phase === "actions" && currentAction ? (
            <View style={styles.actionArea}>
              <AppText size="caption" tone="secondary">
                动作进度 {progress}
              </AppText>
              <AppText size="title2" weight="bold">
                {currentAction.instruction}
              </AppText>
              <AppText tone="secondary">
                请在 {currentAction.timeoutSeconds} 秒内自然、缓慢地完成动作，完成后继续下一步。
              </AppText>
              <PrimaryButton
                label={
                  actionIndex === challenge.actions.length - 1
                    ? "完成检测并上线"
                    : "已完成，继续"
                }
                variant="owner"
                onPress={() => void finishAction()}
              />
            </View>
          ) : phase === "submitting" ? (
            <AppV2StatusPanel
              tone="neutral"
              title="正在确认检测结果"
              description="确认完成前你会保持离线。"
            />
          ) : phase === "success" ? (
            <View style={styles.actionArea}>
              <AppV2StatusPanel
                tone="driver"
                title="检测完成，已上线"
                description="现在可以浏览附近订单。下线后再次上线需要重新检测。"
              />
              <PrimaryButton
                label="返回车主工作台"
                variant="owner"
                onPress={() => void close()}
              />
            </View>
          ) : phase === "error" ? (
            <View style={styles.actionArea}>
              <AppV2StatusPanel
                tone="safety"
                title={driverLivenessErrorPresentation(errorCode).title}
                description={
                  driverLivenessErrorPresentation(errorCode).description
                }
              />
              <PrimaryButton
                label="重新检测"
                variant="owner"
                onPress={() => void start()}
              />
            </View>
          ) : null}

          {phase !== "submitting" && phase !== "success" ? (
            <PrimaryButton
              label="暂不上线"
              variant="text"
              onPress={() => void close()}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function readErrorCode(error: unknown): string {
  return error instanceof Error ? error.message : "SERVICE_UNAVAILABLE";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
    gap: 24,
  },
  heading: {
    gap: 8,
  },
  camera: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 28,
    gap: 20,
    overflow: "hidden",
  },
  faceGuide: {
    width: 176,
    height: 224,
    borderWidth: 3,
    borderRadius: 88,
  },
  actionArea: {
    gap: 16,
  },
});
