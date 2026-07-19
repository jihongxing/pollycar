import { useState } from "react";
import { TextInput, View } from "react-native";

import { useAdultEligibility } from "../../application/adult-eligibility-context";
import {
  AppV2ApplicationProgress,
  AppV2FieldFrame,
  AppV2ReadinessList,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { PrimaryButton } from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";
import {
  adultEligibilityPresentation,
  failureText,
} from "./adult-eligibility-presentation";

export function AdultEligibilityScreen({
  navigate,
}: {
  navigate: (screen: string) => void;
}) {
  const {
    verification,
    loading,
    error,
    authorize,
    startAutomaticVerification,
    refreshProviderResult,
    refresh,
  } = useAdultEligibility();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError(undefined);
    try {
      await action();
    } catch {
      setActionError("当前操作没有完成，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !verification) {
    return (
      <MobilityPage
        title="我的实名"
        accessibilityLabel="正在准备实名信息"
      >
        <AppV2StageHeader
          eyebrow="账户 · 使用条件"
          title="正在准备实名信息"
          description="请稍候，正在读取当前进展。"
        />
        <AppV2StatusPanel
          title="正在加载"
          description="完成后会自动显示下一步。"
          tone="passenger"
        />
      </MobilityPage>
    );
  }

  if (!verification) {
    return (
      <MobilityPage
        title="我的实名"
        accessibilityLabel="实名信息暂时无法加载"
        actions={
          <PrimaryButton
            label="重新加载"
            loading={busy}
            onPress={() => void run(refresh)}
          />
        }
      >
        <AppV2StageHeader
          eyebrow="账户 · 使用条件"
          title="暂时无法读取实名信息"
          description={
            error === "AUTHENTICATION_REQUIRED"
              ? "登录状态已经失效，请重新登录后继续。"
              : "请检查网络后重试，已经完成的步骤不会丢失。"
          }
          tone="safety"
        />
      </MobilityPage>
    );
  }

  const presentation = adultEligibilityPresentation(verification);
  const needsRetry =
    verification.state === "needs_retry" ||
    verification.state === "rejected" ||
    verification.state === "expired" ||
    verification.state === "suspended" ||
    verification.state === "revoked";
  const allowedActions = verification.allowedActions ?? [];
  const canRetry = allowedActions.includes("retry_capture");
  const canAppeal = allowedActions.includes("submit_appeal");
  const waiting =
    verification.state === "processing" || verification.state === "needs_review";
  const authorized = verification.consent.identityProcessingAuthorized;

  return (
    <MobilityPage
      title="我的实名"
      accessibilityLabel="我的实名与成年条件"
      tone={presentation.tone === "safety" ? "neutral" : "passenger"}
      onBack={
        verification.state === "verified"
          ? () => navigate("account")
          : undefined
      }
      actions={
        verification.state === "verified" ? (
          <>
            <PrimaryButton label="进入乘客首页" onPress={() => navigate("ride-home")} />
            <PrimaryButton
              label="返回我的账户"
              variant="text"
              onPress={() => navigate("account")}
            />
          </>
        ) : !authorized ? (
          <PrimaryButton
            label="了解并继续"
            loading={busy}
            onPress={() => void run(authorize)}
          />
        ) : waiting ? (
          <PrimaryButton
            label="查看最新结果"
            variant="secondary"
            loading={busy}
            onPress={() => void run(refreshProviderResult)}
          />
        ) : needsRetry ? (
          <>
            {canRetry ? (
              <PrimaryButton
                label="重新完成实名确认"
                loading={busy}
                onPress={() => void run(refresh)}
              />
            ) : null}
            {canAppeal ? (
              <PrimaryButton
                label="提交复核说明"
                variant={canRetry ? "secondary" : "primary"}
                onPress={() => navigate("adult-eligibility-appeal")}
              />
            ) : null}
          </>
        ) : (
          <PrimaryButton
            label="开始实名确认"
            loading={busy}
            onPress={() => void run(startAutomaticVerification)}
          />
        )
      }
    >
      <AppV2StageHeader
        eyebrow={presentation.eyebrow}
        title={presentation.title}
        description={presentation.description}
        tone={presentation.tone}
      />
      <AppV2ApplicationProgress
        steps={["了解用途", "完成确认", "开始使用"]}
        currentStep={presentation.currentStep}
        tone="passenger"
      />
      {!authorized ? (
        <>
          <AppV2ReadinessList
            items={[
              {
                icon: "account",
                title: "确认成年条件",
                description: "需要使用有效身份证件确认符合使用年龄",
                status: "pending",
              },
              {
                icon: "privacy",
                title: "确认由本人操作",
                description: "通过活体和人证一致性确认保护账户安全",
                status: "pending",
              },
              {
                icon: "safety",
                title: "只用于必要判断",
                description: "结果用于使用条件、安全和责任处理",
                status: "pending",
              },
            ]}
          />
          <AppV2StatusPanel
            title="开始前请了解"
            description="证件信息和生物识别信息可能由经批准的实名服务处理。继续即表示同意相关处理和隐私说明。"
          />
        </>
      ) : verification.state === "verified" ? (
        <>
          <AppV2SummaryList
            items={[
              { label: "成年条件", value: "已确认", emphasized: true },
              { label: "本人操作", value: "已确认" },
              {
                label: "身份信息",
                value: verification.result?.legalNameMasked ?? "已保护",
              },
            ]}
          />
          <AppV2StatusPanel
            title="结果已保存"
            description="实名只确认账户本人和成年使用条件，不会自动通过车辆、参与资格或车主安全限制。"
            tone="passenger"
          />
        </>
      ) : waiting ? (
        <AppV2StatusPanel
          title="当前无需重复提交"
          description="可以稍后返回查看；结果更新前不会开放需要实名的功能。"
          tone="passenger"
        />
      ) : needsRetry ? (
        <AppV2StatusPanel
          title={presentation.statusLabel}
          description={failureText(verification.failureCode)}
          tone="safety"
        />
      ) : (
        <>
          <AppV2ReadinessList
            items={[
              {
                icon: "account",
                title: "拍摄有效证件",
                description: "按页面引导完成证件正反面拍摄",
                status: "pending",
              },
              {
                icon: "privacy",
                title: "完成本人验证",
                description: "在光线充足的环境中按提示操作",
                status: "pending",
              },
              {
                icon: "clock",
                title: "等待确认结果",
                description: "大多数情况会连续完成，无需重复提交",
                status: "pending",
              },
            ]}
          />
          <AppV2StatusPanel
            title="确认会连续完成"
            description="打开后将依次完成证件拍摄、信息识别和本人验证。"
          />
        </>
      )}
      {actionError ? (
        <AppV2StatusPanel
          title="暂时无法继续"
          description={actionError}
          tone="safety"
        />
      ) : null}
    </MobilityPage>
  );
}

export function AdultEligibilityAppealScreen({
  navigate,
}: {
  navigate: (screen: string) => void;
}) {
  const { verification, submitAppeal } = useAdultEligibility();
  const { theme } = useAppTheme();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (busy || reason.trim().length < 4) return;
    setBusy(true);
    setError(undefined);
    try {
      await submitAppeal(reason.trim());
    } catch {
      setError("复核说明暂时没有提交成功，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MobilityPage
      title="复核说明"
      accessibilityLabel="实名复核说明"
      onBack={() => navigate("adult-eligibility")}
      actions={
        <>
          <PrimaryButton
            label={verification?.appeal ? "返回我的实名" : "提交复核说明"}
            loading={busy}
            disabled={!verification?.appeal && reason.trim().length < 4}
            onPress={
              verification?.appeal
                ? () => navigate("adult-eligibility")
                : () => void submit()
            }
          />
          {!verification?.appeal ? (
            <PrimaryButton
              label="暂不提交"
              variant="text"
              onPress={() => navigate("adult-eligibility")}
            />
          ) : null}
        </>
      }
    >
      <AppV2StageHeader
        eyebrow="账户 · 我的实名"
        title={verification?.appeal ? "复核说明已提交" : "说明需要协助的情况"}
        description={
          verification?.appeal
            ? "处理结果更新后会显示在我的实名页面。"
            : "适用于结果长期无法确认、验证流程无法完成或身份信息需要更正。"
        }
        tone={verification?.appeal ? "passenger" : "neutral"}
      />
      {verification?.appeal ? (
        <AppV2StatusPanel
          title="正在等待处理"
          description="复核不会跳过成年条件和本人确认要求，当前无需重复提交。"
          tone="passenger"
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <AppV2FieldFrame icon="help" label="情况说明">
            <TextInput
              accessibilityLabel="复核说明"
              multiline
              value={reason}
              onChangeText={(value) => {
                setReason(value);
                setError(undefined);
              }}
              placeholder="请说明遇到的情况，以及希望核对的信息"
              placeholderTextColor={theme.colors.textSecondary}
              style={{
                minHeight: 140,
                paddingTop: theme.spacing.sm,
                color: theme.colors.text,
                textAlignVertical: "top",
              }}
            />
          </AppV2FieldFrame>
          <AppV2StatusPanel
            title="复核适用范围"
            description="处理人员可以核对流程和信息问题，但不能绕过成年条件、本人确认或安全限制。"
          />
        </View>
      )}
      {error ? (
        <AppV2StatusPanel title="暂时无法提交" description={error} tone="safety" />
      ) : null}
    </MobilityPage>
  );
}
