import type { SyntheticAvatarAsset } from "@pollycar/contracts";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useFreeFlexTrial } from "../../application/free-flex-trial-context";
import { useAdultEligibility } from "../../application/adult-eligibility-context";
import { useSafetyCase } from "../../application/safety-case-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useTrustProfile } from "../../application/trust-profile-context";
import { useVehicleReview } from "../../application/vehicle-review-context";
import {
  AppV2ChoiceChip,
  AppV2MetricStrip,
  AppV2NavigationRow,
  AppV2ReadinessList,
  AppV2SectionHeader,
  AppV2StageHeader,
  AppV2StatusPanel,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import { useIdentity } from "../../identity/identity-context";
import { useInteraction } from "../../interaction/interaction-context";
import { useAppTheme } from "../../theme/theme-context";
import { consumeMessageCenterDetailReturn } from "../messages/message-center-navigation";
import type { AppScreen } from "../vehicle-review/screens";
import {
  vehicleReviewEntryCopy,
  vehicleReviewStatusLabel,
} from "../vehicle-review/vehicle-review-presentation";
import {
  ownerAccessPresentation,
  ownerQualificationPresentation,
  ownerQualificationStatusLabel,
  ownerSafetyPresentation,
} from "./owner-access-presentation";

type Navigate = (screen: AppScreen) => void;

const avatarOptions = [
  { value: "avatar-city-blue", label: "城市蓝" },
  { value: "avatar-warm-gray", label: "暖灰" },
  { value: "avatar-plum", label: "梅紫" },
] as const satisfies readonly Readonly<{
  value: SyntheticAvatarAsset;
  label: string;
}>[];

export function AccountProfileScreen({ navigate }: { navigate: Navigate }) {
  const { profile, loading, submitAvatar } = useTrustProfile();
  const { verification } = useAdultEligibility();
  const { actions, runAction } = useInteraction();
  const { activeIdentity } = useIdentity();
  const { theme } = useAppTheme();
  const [selectedAvatar, setSelectedAvatar] =
    useState<SyntheticAvatarAsset>("avatar-city-blue");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const publicUrl = profile?.avatar.publicUrl;
    const selected = avatarOptions.find((option) => publicUrl?.includes(option.value));
    if (selected) setSelectedAvatar(selected.value);
  }, [profile?.avatar.publicUrl]);

  const saveAvatar = async () => {
    await runAction("account.avatar", async () => {
      const next = await submitAvatar(selectedAvatar);
      setMessage(
        next.avatar.state === "approved"
          ? "公开头像已经更新。"
          : "这个头像暂不能使用，请选择其他样式。",
      );
    });
  };

  const avatarStatus =
    loading
      ? "正在加载"
      : profile?.avatar.state === "approved"
        ? "已公开"
        : profile?.avatar.state === "rejected"
          ? "需重新选择"
          : "默认头像";

  return (
    <MobilityPage
      title="账户资料"
      accessibilityLabel="账户资料与公开头像"
      onBack={() => navigate("account")}
      actions={
        <>
          <PrimaryButton
            label="保存头像"
            loading={actions["account.avatar"] === "running"}
            loadingLabel="正在保存"
            onPress={() => void saveAvatar()}
          />
          <PrimaryButton
            label="返回我的账户"
            variant="text"
            onPress={() => navigate("account")}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow="我的账户"
        title="林屿"
        description="管理行程中可见的头像，并查看账户身份信息。"
      />
      <AppV2SummaryList
        items={[
          {
            label: "当前身份",
            value: activeIdentity === "owner" ? "车主" : "乘客",
            emphasized: true,
          },
          { label: "行程头像", value: avatarStatus },
          {
            label: "行程评分",
            value: profile?.rating
              ? `${profile.rating.average.toFixed(1)} · ${profile.rating.ratingCount} 次评价`
              : "暂无评价",
          },
        ]}
      />
      <View style={{ gap: theme.spacing.md }}>
        <AppV2SectionHeader title="选择头像" detail="行程对方可见" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {avatarOptions.map((option) => (
            <AppV2ChoiceChip
              key={option.value}
              label={option.label}
              selected={selectedAvatar === option.value}
              onPress={() => {
                setSelectedAvatar(option.value);
                setMessage(undefined);
              }}
            />
          ))}
        </View>
        <AppText size="small" tone="secondary">
          目前可以使用以下头像；个人照片暂不可选择。
        </AppText>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <AppV2SectionHeader title="身份信息" />
        <AppV2NavigationRow
          icon="account"
          title="本人和成年条件"
          description={
            verification?.businessAccessAllowed
              ? "身份信息已经确认，不在账户页面公开证件资料"
              : "完成确认后才能使用乘客与车主业务功能"
          }
          value={verification?.businessAccessAllowed ? "已确认" : "需要完成"}
          onPress={() => navigate("adult-eligibility")}
          tone="passenger"
        />
        <AppText size="small" tone="secondary">
          证件产生的身份信息不会作为可编辑资料展示；必要信息仅在规定的行程阶段使用。
        </AppText>
      </View>
      {message ? (
        <AppV2StatusPanel
          title={message}
          description={
            profile?.avatar.state === "rejected"
              ? "未通过的头像不会对行程对方公开。"
              : "新的头像会用于后续行程中的账户展示。"
          }
          tone={profile?.avatar.state === "rejected" ? "safety" : "neutral"}
        />
      ) : null}
    </MobilityPage>
  );
}

export function IdentitySettingsScreen({ navigate }: { navigate: Navigate }) {
  const { activeIdentity, setActiveIdentity } = useIdentity();
  const { review } = useVehicleReview();
  const { trial } = useFreeFlexTrial();
  const { dashboard: safetyDashboard } = useSafetyCase();
  const { dashboard: tripDashboard } = useSyntheticTrip();
  const { actions, runAction } = useInteraction();
  const ownerAvailable = review.ownerIdentityAvailable || review.status === "approved";
  const access = ownerAccessPresentation({
    reviewStatus: review.status,
    qualificationState: trial.state,
    safetyState: safetyDashboard?.safetyCase?.state,
    tripSafetyFrozen: tripDashboard.activeDriverTrip?.state === "safety_frozen",
  });

  const switchIdentity = async () => {
    if (activeIdentity === "owner") {
      await runAction("identity.switch", async () => {
        await setActiveIdentity("passenger");
        navigate("passenger-workbench");
      });
      return;
    }
    if (!ownerAvailable) {
      navigate(access.target);
      return;
    }
    await runAction("identity.switch", async () => {
      await setActiveIdentity("owner");
      navigate("owner-workbench");
    });
  };

  return (
    <MobilityPage
      title="身份切换"
      tone={activeIdentity === "owner" ? "driver" : "passenger"}
      accessibilityLabel="乘客与车主身份切换"
      onBack={() => navigate("account")}
      actions={
        <>
          <PrimaryButton
            label={
              activeIdentity === "owner"
                ? "切换为乘客身份"
                : ownerAvailable
                  ? "切换为车主身份"
                  : access.actionLabel
            }
            variant={activeIdentity === "owner" ? "secondary" : "owner"}
            loading={actions["identity.switch"] === "running"}
            loadingLabel="正在切换"
            onPress={() => void switchIdentity()}
          />
          <PrimaryButton
            label="返回我的账户"
            variant="text"
            onPress={() => navigate("account")}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow="一个账户 · 两种身份"
        title={activeIdentity === "owner" ? "当前使用车主身份" : "当前使用乘客身份"}
        description="切换身份只改变当前工作台，不会改变车辆、资格、额度或安全状态。"
        tone={activeIdentity === "owner" ? "driver" : "passenger"}
      />
      <AppV2SummaryList
        items={[
          {
            label: "当前身份",
            value: activeIdentity === "owner" ? "车主" : "乘客",
            emphasized: true,
          },
          { label: "乘客身份", value: "可用" },
          {
            label: "车主身份",
            value: ownerAvailable ? "可切换" : "尚未准备好",
          },
        ]}
      />
      <AppV2ReadinessList
        tone={activeIdentity === "owner" ? "driver" : "passenger"}
        items={[
          {
            icon: "route",
            title: "乘客身份",
            description: "叫车、查看行程并处理乘客任务",
            status: activeIdentity === "passenger" ? "current" : "ready",
          },
          {
            icon: "car",
            title: "车主身份",
            description: ownerAvailable
              ? "进入车主首页后查看资格、额度和当前任务"
              : vehicleReviewEntryCopy(review.status).description,
            status: activeIdentity === "owner"
              ? "current"
              : ownerAvailable
                ? "ready"
                : "pending",
          },
        ]}
      />
      {access.kind !== "ready" ? (
        <AppV2StatusPanel
          title="切换身份不会解除当前限制"
          description={access.description}
          tone={access.kind === "safety" ? "safety" : "driver"}
        />
      ) : null}
    </MobilityPage>
  );
}

export function VehicleSettingsScreen({ navigate }: { navigate: Navigate }) {
  const { review } = useVehicleReview();
  const [returnScreen] = useState<AppScreen>(
    () => consumeMessageCenterDetailReturn("vehicle-settings") ?? "account",
  );
  const returnLabel =
    returnScreen === "message-center" ? "返回消息" : "返回我的账户";
  const reviewLabel = vehicleReviewStatusLabel(review.status);
  const entry = vehicleReviewEntryCopy(review.status);
  return (
    <MobilityPage
      title="我的车辆"
      tone="driver"
      accessibilityLabel="车主车辆与审核"
      onBack={() => navigate(returnScreen)}
      actions={
        <PrimaryButton
          label={returnLabel}
          variant="text"
          onPress={() => navigate(returnScreen)}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="车主 · 车辆"
        title={review.vehicleType ?? "准备一辆常用车辆"}
        description={
          review.status === "draft"
            ? "完成车辆资料后，可以提交审核并随时回来查看结果。"
            : "查看车辆信息、审核结果和当前需要处理的事项。"
        }
        tone="driver"
      />
      <AppV2SummaryList
        items={[
          { label: "审核进度", value: reviewLabel, emphasized: true },
          { label: "最多可乘", value: `${review.maxPassengerCount} 人` },
          { label: "保险有效期", value: review.insuranceExpiresOn ?? "待填写" },
        ]}
      />
      <AppV2NavigationRow
        icon={review.status === "draft" ? "car" : "orders"}
        title={entry.actionLabel}
        description={entry.description}
        value={reviewLabel}
        tone="driver"
        onPress={() => navigate(vehicleReviewScreen(review.status))}
      />
      <AppV2StatusPanel
        title="车辆审核与参与资格相互独立"
        description="车辆审核完成后，是否可以开始参与仍取决于资格、额度和安全状态。"
        tone="driver"
      />
    </MobilityPage>
  );
}

export function EligibilitySettingsScreen({ navigate }: { navigate: Navigate }) {
  const { trial, submit, confirm, refresh } = useFreeFlexTrial();
  const { actions, runAction, confirm: confirmAction } = useInteraction();
  const [returnScreen] = useState<AppScreen>(
    () => consumeMessageCenterDetailReturn("eligibility-settings") ?? "account",
  );
  const returnLabel =
    returnScreen === "message-center" ? "返回消息" : "返回我的账户";
  const presentation = ownerQualificationPresentation(trial.state);

  const submitQualification = async () => {
    if (!await confirmAction({
      title: "申请参与资格？",
      message: "本次申请不会产生费用。提交后会进入审核，结果更新后会显示下一步。",
      confirmLabel: "确认申请",
    })) return;
    await runAction("eligibility.submit", submit, {
      successTitle: "资格申请已提交",
      successMessage: "当前无需重复申请，可以稍后回来查看结果。",
    });
  };

  const confirmQualification = async () => {
    if (!await confirmAction({
      title: "确认启用 30 天资格？",
      message: "确认后开始计算 30 天参与周期，90 日内累计最多启用 60 天。",
      confirmLabel: "确认启用",
    })) return;
    await runAction("eligibility.confirm", confirm, {
      successTitle: "参与资格已启用",
      successMessage: "开始参与前仍会重新确认车辆、额度和安全状态。",
    });
  };

  const runPrimaryAction = async () => {
    if (presentation.action === "submit") {
      await submitQualification();
      return;
    }
    if (presentation.action === "confirm") {
      await confirmQualification();
      return;
    }
    if (presentation.action === "quota") {
      navigate("quota-settings");
      return;
    }
    await runAction("eligibility.refresh", refresh);
  };

  const activeDays = `${trial.activationDaysInLookback} / ${trial.maximumActivationDays} 天`;

  return (
    <MobilityPage
      title="参与资格"
      tone="driver"
      accessibilityLabel="车主参与资格"
      onBack={() => navigate(returnScreen)}
      actions={
        <>
          <PrimaryButton
            label={presentation.actionLabel}
            variant="owner"
            loading={
              actions["eligibility.submit"] === "running" ||
              actions["eligibility.confirm"] === "running" ||
              actions["eligibility.refresh"] === "running"
            }
            onPress={() => void runPrimaryAction()}
          />
          <PrimaryButton
            label={returnLabel}
            variant="text"
            onPress={() => navigate(returnScreen)}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow={presentation.eyebrow}
        title={presentation.title}
        description={presentation.description}
        tone="driver"
      />
      <AppV2SummaryList
        items={[
          {
            label: "当前状态",
            value: presentation.statusLabel,
            emphasized: true,
          },
          { label: "参与费用", value: "无需付费" },
          { label: "90 日内已启用", value: activeDays },
        ]}
      />
      <AppV2NavigationRow
        icon="orders"
        title="参与额度"
        description="查看 24 小时、7 天和 30 天滚动窗口上限"
        value={`${trial.quota.hours24} / ${trial.quota.days7} / ${trial.quota.days30}`}
        tone="driver"
        onPress={() => navigate("quota-settings")}
      />
      {trial.state === "invited" ? (
        <AppV2StatusPanel
          title="申请不会产生费用"
          description="提交申请不会自动续期，也不会因付费获得更多参与机会。"
          tone="driver"
        />
      ) : trial.state === "under_review" ? (
        <AppV2StatusPanel
          title="当前无需重复申请"
          description="审核结果更新后会显示需要确认、等待或处理的下一步。"
          tone="driver"
        />
      ) : trial.state === "rejected" || trial.state === "expired" ? (
        <AppV2StatusPanel
          title="当前不能开始新的车主任务"
          description="请检查最新状态；如果出现新的邀请或恢复路径，页面会直接显示。"
          tone="safety"
        />
      ) : null}
    </MobilityPage>
  );
}

export function QuotaSettingsScreen({ navigate }: { navigate: Navigate }) {
  const { trial } = useFreeFlexTrial();
  const { review } = useVehicleReview();
  const { dashboard: safetyDashboard } = useSafetyCase();
  const { dashboard: tripDashboard } = useSyntheticTrip();
  const access = ownerAccessPresentation({
    reviewStatus: review.status,
    qualificationState: trial.state,
    safetyState: safetyDashboard?.safetyCase?.state,
    tripSafetyFrozen: tripDashboard.activeDriverTrip?.state === "safety_frozen",
  });

  return (
    <MobilityPage
      title="参与额度"
      tone="driver"
      accessibilityLabel="车主参与额度与使用边界"
      onBack={() => navigate("account")}
      actions={
        <PrimaryButton
          label="返回我的账户"
          variant="text"
          onPress={() => navigate("account")}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="车主 · 参与额度"
        title="每次参与前都会重新确认"
        description="额度按滚动窗口计算，并与车辆、资格和安全状态共同决定当前是否可以参与。"
        tone="driver"
      />
      <AppV2MetricStrip
        tone="driver"
        items={[
          { label: "24 小时", value: `${trial.quota.hours24} 单`, icon: "clock" },
          { label: "7 天", value: `${trial.quota.days7} 单`, icon: "orders" },
          { label: "30 天", value: `${trial.quota.days30} 单`, icon: "route" },
        ]}
      />
      <AppV2SummaryList
        items={[
          {
            label: "参与资格",
            value: ownerQualificationStatusLabel(trial.state),
            emphasized: true,
          },
          {
            label: "90 日内已启用",
            value: `${trial.activationDaysInLookback} / ${trial.maximumActivationDays} 天`,
          },
          { label: "额度调整", value: "不可手工增加或转让" },
        ]}
      />
      <AppV2StatusPanel
        title="这里显示的是滚动窗口上限"
        description="实际可用次数以开始参与时的确认结果为准；车辆、资格或安全状态变化时，额度可能暂时不可用。"
        tone="driver"
      />
      {access.kind !== "ready" ? (
        <AppV2NavigationRow
          icon={access.kind === "safety" ? "safety" : access.kind === "vehicle" ? "car" : "account"}
          title={access.title}
          description={access.description}
          value="去处理"
          tone={access.kind === "safety" ? "safety" : "driver"}
          onPress={() => navigate(access.target)}
        />
      ) : (
        <AppV2NavigationRow
          icon="account"
          title="参与资格当前有效"
          description="开始参与时仍会重新确认本次可用额度"
          value="有效"
          tone="driver"
          onPress={() => navigate("eligibility-settings")}
        />
      )}
    </MobilityPage>
  );
}

export function ThemeSettingsScreen({ navigate }: { navigate: Navigate }) {
  const { mode, setMode } = useAppTheme();
  return (
    <MobilityPage
      title="外观"
      accessibilityLabel="明亮与暗色外观"
      onBack={() => navigate("account")}
      actions={
        <PrimaryButton
          label="返回我的账户"
          variant="text"
          onPress={() => navigate("account")}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="账户 · 外观"
        title="选择舒适的显示方式"
        description="外观偏好只保存在当前设备，不会改变乘客或车主身份。"
      />
      <AppV2SummaryList
        items={[
          {
            label: "当前外观",
            value: mode === "light" ? "明亮" : "暗色",
            emphasized: true,
          },
        ]}
      />
      <AppV2NavigationRow
        icon="theme"
        title="明亮外观"
        description="适合日间和光线充足的环境"
        value={mode === "light" ? "当前" : "切换"}
        onPress={() => setMode("light")}
      />
      <AppV2NavigationRow
        icon="theme"
        title="暗色外观"
        description="适合夜间和低光环境"
        value={mode === "dark" ? "当前" : "切换"}
        onPress={() => setMode("dark")}
      />
    </MobilityPage>
  );
}

export function PrivacySafetySettingsScreen({ navigate }: { navigate: Navigate }) {
  const { dashboard: tripDashboard } = useSyntheticTrip();
  const {
    dashboard: safetyDashboard,
    load: loadSafetyCase,
  } = useSafetyCase();
  const activeTrip = tripDashboard.activeDriverTrip ?? tripDashboard.passengerTrip;
  const tripSafetyFrozen = activeTrip?.state === "safety_frozen";
  const safetyCase = safetyDashboard?.safetyCase;
  const safety = ownerSafetyPresentation({
    safetyState: safetyCase?.state,
    tripSafetyFrozen,
  });

  useEffect(() => {
    if (tripSafetyFrozen && activeTrip) {
      void loadSafetyCase(activeTrip.tripId).catch(() => undefined);
    }
  }, [activeTrip, loadSafetyCase, tripSafetyFrozen]);

  const safetyTarget =
    safetyCase?.state === "restored" || safetyCase?.state === "upheld"
      ? "safety-result"
      : "safety-frozen";

  return (
    <MobilityPage
      title="隐私与安全"
      tone={safety.needsAction ? "driver" : "neutral"}
      accessibilityLabel="账户隐私与安全设置"
      onBack={() => navigate("account")}
      actions={
        <PrimaryButton
          label="返回我的账户"
          variant="text"
          onPress={() => navigate("account")}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="账户 · 隐私与安全"
        title={safety.title}
        description={safety.description}
        tone={safety.needsAction ? "safety" : "neutral"}
      />
      {safety.needsAction ? (
        <AppV2NavigationRow
          icon="safety"
          title="查看当前安全事项"
          description="查看影响、处理进度和当前可以采取的下一步"
          value={safety.statusLabel}
          tone="safety"
          onPress={() => navigate(safetyTarget)}
        />
      ) : (
        <AppV2StatusPanel
          title="当前状态正常"
          description="如果行程被暂停、出现举报或需要复核，这里会显示影响和处理入口。"
        />
      )}
      <AppV2ReadinessList
        items={[
          {
            icon: "phone",
            title: "行程联系",
            description: "只在相关行程和安全处理需要时开放",
            status: "ready",
          },
          {
            icon: "route",
            title: "位置使用",
            description: "用于路线、接驾和必要的安全处理",
            status: "ready",
          },
          {
            icon: "privacy",
            title: "身份与车辆",
            description: "身份切换不会绕过审核、资格或安全限制",
            status: "ready",
          },
        ]}
      />
      <AppV2NavigationRow
        icon="messages"
        title="行程帮助与安全联系"
        description="查看当前可联系的行程和已有消息"
        onPress={() => navigate("message-center")}
      />
    </MobilityPage>
  );
}

function vehicleReviewScreen(
  status:
    | "draft"
    | "under_review"
    | "needs_material"
    | "approved"
    | "suspended"
    | "appealing"
    | "revoked"
    | "expired",
): AppScreen {
  if (status === "approved") return "review-approved";
  if (status === "under_review") return "review-pending";
  if (status === "needs_material") return "review-needs-material";
  return "owner-apply-intro";
}
