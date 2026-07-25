import { useState } from "react";
import { TextInput, View } from "react-native";

import { useAdultEligibility } from "../../application/adult-eligibility-context";
import {
  AppV2FieldFrame,
  AppV2StageHeader,
} from "../../components/app-v2-components";
import { AuthAgreementGate } from "../../components/auth-agreement-gate";
import { AuthStepRail } from "../../components/auth-step-rail";
import {
  AuxiliaryDataRow,
  AuxiliaryGroup,
  AuxiliaryPage,
  AuxiliarySection,
  AuxiliaryState,
} from "../../components/auxiliary-page";
import { AppText, PrimaryButton } from "../../components/ui";
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
  const { theme } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [consentAccepted, setConsentAccepted] = useState(false);

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
      <AuxiliaryPage
        title="我的实名"
        accessibilityLabel="正在准备实名信息"
      >
        <AuxiliaryState
          icon="account"
          title="正在准备实名信息"
          description="请稍候。"
          tone="passenger"
        />
      </AuxiliaryPage>
    );
  }

  if (!verification) {
    return (
      <AuxiliaryPage
        title="我的实名"
        accessibilityLabel="实名信息暂时无法加载"
        onBack={() => navigate("account")}
      >
        <AuxiliaryState
          icon="account"
          title="暂时无法读取实名信息"
          description={
            error === "AUTHENTICATION_REQUIRED"
              ? "登录状态已经失效，请重新登录后继续。"
              : "请检查网络后重试。"
          }
          tone="danger"
          action={{
            label: "重新加载",
            loading: busy,
            onPress: () => void run(refresh),
          }}
        />
      </AuxiliaryPage>
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
  const verified = verification.state === "verified";

  return (
    <AuxiliaryPage
      title="我的实名"
      accessibilityLabel="我的实名与成年条件"
      tone={presentation.tone === "safety" ? "neutral" : "passenger"}
      onBack={() => navigate("account")}
      actions={
        verified ? (
          <PrimaryButton label="进入乘客首页" onPress={() => navigate("ride-home")} />
        ) : !authorized ? (
          <PrimaryButton
            label="同意并继续"
            loading={busy}
            disabled={!consentAccepted}
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
      {verified ? (
        <>
          <View style={{ alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
            <View
              style={{
                borderRadius: theme.radius.pill,
                backgroundColor: `${theme.colors.success}18`,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              }}
            >
              <AppText size="small" weight="bold" style={{ color: theme.colors.success }}>
                已确认
              </AppText>
            </View>
            <View accessibilityRole="header">
              <AppText family="display" size="title1" weight="bold">实名资料</AppText>
            </View>
          </View>
          <AuxiliarySection title="身份信息">
            <AuxiliaryGroup>
              <AuxiliaryDataRow
                label="姓名"
                value={verification.result?.legalNameMasked ?? "已保护"}
              />
              <AuxiliaryDataRow
                label="性别"
                value={legalGenderLabel(verification.result?.legalGender)}
              />
              <AuxiliaryDataRow
                label="证件号码"
                value={verification.result?.documentNumberMasked ?? "已保护"}
              />
              <AuxiliaryDataRow
                label="确认时间"
                value={formatVerifiedDate(verification.result?.verifiedAt)}
                last
              />
            </AuxiliaryGroup>
          </AuxiliarySection>
          <AppText size="small" tone="secondary">
            实名资料用于确认本人、成年条件以及必要的行程安全与责任处理。
          </AppText>
        </>
      ) : !authorized ? (
        <>
          <AuthStepRail
            steps={["准备", "核验", "完成"]}
            currentStep={0}
            tone="passenger"
          />
          <AppV2StageHeader
            eyebrow="第 1 步 · 身份确认"
            title="先阅读并同意身份确认说明"
            description="完成确认后，才能开始证件和本人验证。"
            tone="passenger"
          />
          <AuthAgreementGate
            agreements={[
              {
                id: "identity",
                icon: "account",
                title: "实名与成年条件",
                summary: "用于确认账户本人和乘车资格",
                detail: "平台会使用你提交的有效身份证件确认账户本人和成年条件，认证完成后才能继续使用乘客服务。",
              },
              {
                id: "biometric",
                icon: "privacy",
                title: "本人验证说明",
                summary: "需要完成一次活体或本人验证",
                detail: "本人验证用于确认当前操作由账户本人完成。请按页面指引完成，不要代替他人操作。",
              },
              {
                id: "privacy",
                icon: "safety",
                title: "信息处理与安全",
                summary: "了解认证材料的使用和保护范围",
                detail: "认证材料仅用于身份确认、乘车资格和必要的行程安全处理，平台会按适用规则控制访问和保存范围。",
              },
            ]}
            consentLabel="我已阅读并同意以上内容"
            consentAccepted={consentAccepted}
            onConsentChange={setConsentAccepted}
            tone="passenger"
          />
        </>
      ) : waiting ? (
        <>
          <AuthStepRail
            steps={["准备", "核验", "完成"]}
            currentStep={1}
            tone="passenger"
          />
          <AppV2StageHeader
            eyebrow="第 2 步 · 身份核验"
            title="正在确认你的身份信息"
            description="结果确认后会自动显示下一步。"
            tone="passenger"
          />
          <AuxiliaryState
            icon="account"
            title="当前无需操作"
            description="你可以离开页面，稍后回来查看结果。"
            tone="passenger"
          />
        </>
      ) : needsRetry ? (
        <>
          <AuthStepRail
            steps={["准备", "核验", "完成"]}
            currentStep={1}
            tone="passenger"
          />
          <AppV2StageHeader
            eyebrow="第 2 步 · 身份核验"
            title="需要重新完成身份核验"
            description="请按提示重新操作，或提交复核说明。"
            tone="passenger"
          />
          <AuxiliaryState
            icon="account"
            title={presentation.title}
            description={failureText(verification.failureCode)}
            tone="danger"
          />
        </>
      ) : (
        <>
          <AuthStepRail
            steps={["准备", "核验", "完成"]}
            currentStep={presentation.currentStep}
            tone="passenger"
          />
          <AppV2StageHeader
            eyebrow="第 2 步 · 身份核验"
            title="准备开始身份核验"
            description="按页面引导完成证件和本人验证。"
            tone="passenger"
          />
        </>
      )}
      {actionError ? (
        <AuxiliaryState
          icon="account"
          title="暂时无法继续"
          description={actionError}
          tone="danger"
          action={{
            label: "重新加载",
            loading: busy,
            onPress: () => void run(refresh),
          }}
        />
      ) : null}
    </AuxiliaryPage>
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

  if (!verification) {
    return (
      <AuxiliaryPage
        title="复核说明"
        accessibilityLabel="实名复核说明暂时不可用"
        onBack={() => navigate("adult-eligibility")}
      >
        <AuxiliaryState
          icon="account"
          title="暂时无法准备复核说明"
          description="请先返回我的实名查看当前结果，再选择可用的下一步。"
          action={{
            label: "返回我的实名",
            onPress: () => navigate("adult-eligibility"),
          }}
        />
      </AuxiliaryPage>
    );
  }

  const canSubmitAppeal =
    verification.appeal || verification.allowedActions?.includes("submit_appeal");

  if (!canSubmitAppeal) {
    return (
      <AuxiliaryPage
        title="复核说明"
        accessibilityLabel="当前无需提交实名复核说明"
        onBack={() => navigate("adult-eligibility")}
      >
        <AuxiliaryState
          icon="account"
          title="当前不需要复核说明"
          description="我的实名页面会根据当前结果显示可用操作。"
          action={{
            label: "返回我的实名",
            onPress: () => navigate("adult-eligibility"),
          }}
          tone="passenger"
        />
      </AuxiliaryPage>
    );
  }

  return (
    <AuxiliaryPage
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
      <View style={{ gap: theme.spacing.xs }}>
        <AppText family="display" size="title1" weight="bold">
          {verification?.appeal ? "复核说明已提交" : "说明需要协助的情况"}
        </AppText>
        <AppText tone="secondary">
          {
          verification?.appeal
            ? "处理结果更新后会显示在我的实名页面。"
            : "适用于结果长期无法确认、验证流程无法完成或身份信息需要更正。"
          }
        </AppText>
      </View>
      {verification?.appeal ? (
        <AuxiliaryState
          icon="account"
          title="复核说明已提交"
          description="当前无需重复提交，处理结果会显示在我的实名页面。"
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
          <AppText size="small" tone="secondary">
            复核用于核对流程和资料问题，不能替代成年条件和本人验证。
          </AppText>
        </View>
      )}
      {error ? (
        <AuxiliaryState
          icon="account"
          title="暂时无法提交"
          description={error}
          tone="danger"
          action={{
            label: "重新提交",
            loading: busy,
            onPress: () => void submit(),
          }}
        />
      ) : null}
    </AuxiliaryPage>
  );
}

function legalGenderLabel(gender?: "female" | "male"): string {
  if (gender === "female") return "女";
  if (gender === "male") return "男";
  return "已保护";
}

function formatVerifiedDate(value?: string): string {
  if (!value) return "已确认";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
