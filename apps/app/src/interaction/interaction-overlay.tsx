import { useCallback, useEffect, useRef } from "react";
import { Modal, Platform, View } from "react-native";

import { AppText, PrimaryButton } from "../components/ui";
import { MotionView } from "../motion/motion-view";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { useAppTheme } from "../theme/theme-context";
import { useInteraction } from "./interaction-context";
import { useModalFocusManagement } from "./use-modal-focus-management";

export function InteractionOverlay() {
  const { theme } = useAppTheme();
  const { toast, confirmation, dismissToast, answerConfirmation } = useInteraction();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<View>(null);
  const closeConfirmation = useCallback(() => answerConfirmation(false), [answerConfirmation]);
  useModalFocusManagement({
    visible: Boolean(confirmation),
    containerRef: dialogRef,
    onEscape: closeConfirmation,
    initialFocus: "last",
  });
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(dismissToast, 4_000);
    return () => clearTimeout(timeout);
  }, [dismissToast, toast]);
  return (
    <>
      {toast ? (
        <MotionView
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLabel={`${toast.title}。${toast.message}`}
          style={{
            position: "absolute",
            zIndex: 20,
            left: theme.spacing.md,
            right: theme.spacing.md,
            top: 132,
            gap: theme.spacing.xxs,
            borderRadius: theme.radius.medium,
            borderWidth: 1,
            borderColor: toast.tone === "success" ? theme.colors.success : theme.colors.primary,
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
          }}
        >
          <AppText weight="bold">{toast.title}</AppText>
          <AppText size="small" tone="secondary">{toast.message}</AppText>
        </MotionView>
      ) : null}
      <Modal
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        visible={Boolean(confirmation)}
        onRequestClose={closeConfirmation}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.overlay,
          }}
        >
          <View
            ref={dialogRef}
            accessible
            accessibilityRole="alert"
            accessibilityViewIsModal
            {...(Platform.OS === "web"
              ? ({
                  role: "dialog",
                  "aria-modal": true,
                  "aria-label": confirmation?.title ?? "确认操作",
                  tabIndex: -1,
                } as object)
              : {})}
            style={{
              gap: theme.spacing.md,
              borderRadius: theme.radius.large,
              padding: theme.spacing.lg,
              backgroundColor: theme.colors.background,
            }}
          >
            <AppText size="title1" weight="bold">{confirmation?.title}</AppText>
            <AppText tone="secondary">{confirmation?.message}</AppText>
            <PrimaryButton
              label={confirmation?.confirmLabel ?? "确认"}
              variant={confirmation?.destructive ? "danger" : "primary"}
              onPress={() => answerConfirmation(true)}
            />
            <PrimaryButton label="返回" variant="text" onPress={closeConfirmation} />
          </View>
        </View>
      </Modal>
    </>
  );
}
