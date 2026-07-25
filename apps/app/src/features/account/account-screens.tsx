import type { SyntheticAvatarAsset } from "@pollycar/contracts";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";

import { useAccountSession } from "../../application/account-session-context";
import { useFreeFlexTrial } from "../../application/free-flex-trial-context";
import { useAdultEligibility } from "../../application/adult-eligibility-context";
import { useSafetyCase } from "../../application/safety-case-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useTrustProfile } from "../../application/trust-profile-context";
import { useVehicleReview } from "../../application/vehicle-review-context";
import {
  AuxiliaryAvatarChoice,
  AuxiliaryChoiceRow,
  AuxiliaryDataRow,
  AuxiliaryGroup,
  AuxiliaryInlineFeedback,
  AuxiliaryPage,
  AuxiliarySection,
} from "../../components/auxiliary-page";
import {
  AppV2ChoiceChip,
  AppV2MetricStrip,
  AppV2NavigationRow,
  AppV2ReadinessList,
  AppV2SectionHeader,
  AppV2StageHeader,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import {
  clearStoredIdentityPreference,
  useIdentity,
} from "../../identity/identity-context";
import { useInteraction } from "../../interaction/interaction-context";
import { clearIdentityScopedJourneyState } from "../../navigation/journey-continuity";
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
type InlineFeedback = Readonly<{
  tone: "success" | "neutral" | "danger";
  title: string;
  description?: string;
}>;
type AvatarSelection =
  | Readonly<{ kind: "preset"; value: SyntheticAvatarAsset }>
  | Readonly<{
      kind: "custom";
      uri: string;
      saved: boolean;
      fileName?: string;
      mimeType?: "image/jpeg" | "image/png" | "image/webp";
      byteSize?: number;
      contentBase64?: string;
    }>;

const avatarOptions = [
  { value: "avatar-city-blue", label: "城市蓝", tone: "passenger" },
  { value: "avatar-warm-gray", label: "暖灰", tone: "neutral" },
  { value: "avatar-plum", label: "梅紫", tone: "owner" },
] as const satisfies readonly Readonly<{
  value: SyntheticAvatarAsset;
  label: string;
  tone: "passenger" | "neutral" | "owner";
}>[];

export function AccountProfileScreen({ navigate }: { navigate: Navigate }) {
  const { profile, loading, submitAvatar, submitCustomAvatar } = useTrustProfile();
  const { verification } = useAdultEligibility();
  const { actions, runAction } = useInteraction();
  const { activeIdentity } = useIdentity();
  const { theme } = useAppTheme();
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarSelection>({
    kind: "preset",
    value: "avatar-city-blue",
  });
  const [feedback, setFeedback] = useState<InlineFeedback>();
  const currentPreset =
    avatarOptions.find((option) => profile?.avatar.publicUrl?.includes(option.value))?.value ??
    "avatar-city-blue";

  useEffect(() => {
    if (profile?.avatar.source === "custom" && profile.avatar.publicUrl) {
      setSelectedAvatar({
        kind: "custom",
        uri: profile.avatar.publicUrl,
        saved: true,
      });
      return;
    }
    setSelectedAvatar({ kind: "preset", value: currentPreset });
  }, [currentPreset, profile?.avatar.publicUrl, profile?.avatar.source]);

  const saveAvatar = async () => {
    await runAction("account.avatar", async () => {
      setFeedback(undefined);
      try {
        const next =
          selectedAvatar.kind === "preset"
            ? await submitAvatar(selectedAvatar.value)
            : await submitCustomAvatar({
                fileName: selectedAvatar.fileName!,
                mimeType: selectedAvatar.mimeType!,
                byteSize: selectedAvatar.byteSize!,
                contentBase64: selectedAvatar.contentBase64!,
              });
        setFeedback(
          next.avatar.state === "approved"
            ? {
                tone: "success",
                title: "头像已更新",
                description: "新的头像会显示在与行程相关的页面中。",
              }
            : {
                tone: "danger",
                title: "暂时不能使用这张头像",
                description: "请重新选择一张清晰、合适的照片。",
              },
        );
      } catch (error) {
        setFeedback({
          tone: "danger",
          title: "头像没有保存",
          description: avatarErrorText(error),
        });
      }
    });
  };

  const chooseCustomAvatar = async () => {
    setFeedback(undefined);
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFeedback({
          tone: "danger",
          title: "无法访问照片",
          description: "请在系统设置中允许访问照片后重试。",
        });
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
      base64: true,
      exif: false,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = supportedAvatarMimeType(asset?.mimeType, asset?.fileName);
    if (!asset?.base64 || !asset.uri || !mimeType) {
      setFeedback({
        tone: "danger",
        title: "无法读取这张照片",
        description: "请选择 JPG、PNG 或 WebP 格式的图片。",
      });
      return;
    }
    const byteSize = asset.fileSize ?? decodedBase64Size(asset.base64);
    if (byteSize > 1_500_000) {
      setFeedback({
        tone: "danger",
        title: "照片文件过大",
        description: "请选择不超过 1.5 MB 的图片。",
      });
      return;
    }
    setSelectedAvatar({
      kind: "custom",
      uri: asset.uri,
      saved: false,
      fileName: asset.fileName ?? `avatar.${mimeType.split("/")[1]}`,
      mimeType,
      byteSize,
      contentBase64: asset.base64,
    });
    setFeedback({
      tone: "neutral",
      title: "照片已准备好",
      description: "确认预览后保存更改。",
    });
  };

  const avatarChanged =
    selectedAvatar.kind === "custom"
      ? !selectedAvatar.saved
      : profile?.avatar.source === "custom" || selectedAvatar.value !== currentPreset;
  const genderLabel =
    verification?.result?.legalGender === "female"
      ? "女"
      : verification?.result?.legalGender === "male"
        ? "男"
        : "完成实名后显示";
  const ratingLabel = profile?.rating
    ? `${profile.rating.average.toFixed(1)} · ${profile.rating.ratingCount} 次评价`
    : "暂无评价";
  const selectedTone =
    selectedAvatar.kind === "preset"
      ? avatarOptions.find((option) => option.value === selectedAvatar.value)?.tone ?? "passenger"
      : "passenger";
  const avatarColor =
    selectedTone === "owner"
      ? theme.colors.owner
      : selectedTone === "neutral"
        ? theme.colors.textSecondary
        : theme.colors.passenger;

  return (
    <AuxiliaryPage
      title="账户资料"
      accessibilityLabel="账户资料与公开头像"
      onBack={() => navigate("account")}
      actions={
        avatarChanged ? (
          <PrimaryButton
            label="保存更改"
            loading={actions["account.avatar"] === "running"}
            loadingLabel="正在保存"
            onPress={() => void saveAvatar()}
          />
        ) : undefined
      }
    >
      <View style={{ alignItems: "center", gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}>
        {selectedAvatar.kind === "custom" ? (
          <Image
            source={{ uri: selectedAvatar.uri }}
            accessibilityLabel="当前选择的头像照片"
            style={{ width: 88, height: 88, borderRadius: 44 }}
          />
        ) : (
          <View
            accessibilityLabel={`当前头像，${avatarOptions.find((option) => option.value === selectedAvatar.value)?.label ?? "城市蓝"}`}
            style={{
              width: 88,
              height: 88,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 44,
              backgroundColor: avatarColor,
            }}
          >
            <AppText family="display" size="display" weight="bold" style={{ color: theme.colors.onDeepSurface }}>
              林
            </AppText>
          </View>
        )}
        <AppText family="display" size="title1" weight="bold">林屿</AppText>
        <AppText size="small" tone="secondary">
          {activeIdentity === "owner" ? "当前使用车主身份" : "当前使用乘客身份"}
        </AppText>
      </View>

      <AuxiliarySection title="头像" description="会显示在与行程相关的页面中">
        <PrimaryButton
          label="从照片中选择"
          variant="secondary"
          onPress={() => void chooseCustomAvatar()}
        />
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}
        >
          {avatarOptions.map((option) => (
            <AuxiliaryAvatarChoice
              key={option.value}
              label={option.label}
              color={
                option.tone === "owner"
                  ? theme.colors.owner
                  : option.tone === "neutral"
                    ? theme.colors.textSecondary
                    : theme.colors.passenger
              }
              selected={
                selectedAvatar.kind === "preset" &&
                selectedAvatar.value === option.value
              }
              onPress={() => {
                setSelectedAvatar({ kind: "preset", value: option.value });
                setFeedback(undefined);
              }}
            />
          ))}
        </View>
      </AuxiliarySection>

      <AuxiliarySection title="公开资料">
        <AuxiliaryGroup>
          <AuxiliaryDataRow label="昵称" value="林屿" />
          <AuxiliaryDataRow label="性别" value={genderLabel} />
          <AuxiliaryDataRow label="行程评价" value={loading ? "正在读取" : ratingLabel} last />
        </AuxiliaryGroup>
      </AuxiliarySection>

      <AuxiliarySection title="身份资料">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="privacy"
            label="我的实名"
            value={verification?.businessAccessAllowed ? "已确认" : "需要完成"}
            description="查看实名资料和当前状态"
            onPress={() => navigate("adult-eligibility")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>

      {feedback ? (
        <AuxiliaryInlineFeedback
          title={feedback.title}
          description={feedback.description}
          tone={feedback.tone}
        />
      ) : null}
    </AuxiliaryPage>
  );
}

function supportedAvatarMimeType(
  mimeType?: string,
  fileName?: string | null,
): "image/jpeg" | "image/png" | "image/webp" | undefined {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  ) return mimeType;
  const normalized = fileName?.toLowerCase();
  if (normalized?.endsWith(".jpg") || normalized?.endsWith(".jpeg")) return "image/jpeg";
  if (normalized?.endsWith(".png")) return "image/png";
  if (normalized?.endsWith(".webp")) return "image/webp";
  return undefined;
}

function decodedBase64Size(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}

function avatarErrorText(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "AVATAR_FILE_TOO_LARGE") return "请选择不超过 1.5 MB 的图片。";
  if (code === "AVATAR_DIMENSIONS_INVALID") return "请选择边长至少 128 像素的方形照片。";
  if (code === "AVATAR_IMAGE_INVALID" || code === "AVATAR_UPLOAD_INVALID") {
    return "请选择 JPG、PNG 或 WebP 格式的有效图片。";
  }
  return "请检查网络后重试。";
}

export function AccountLoginScreen({ navigate }: { navigate: Navigate }) {
  const { session, revoke } = useAccountSession();
  const { activeIdentity } = useIdentity();
  const { actions, runAction, confirm } = useInteraction();

  const signOut = async () => {
    const accepted = await confirm({
      title: "退出当前账户？",
      message: "退出后需要重新验证手机号才能继续使用。",
      confirmLabel: "退出登录",
      destructive: true,
    });
    if (!accepted) return;
    await runAction("account.logout", async () => {
      await revoke();
      clearIdentityScopedJourneyState();
      clearStoredIdentityPreference();
      router.replace("/");
    });
  };

  return (
    <AuxiliaryPage
      title="账户与登录"
      accessibilityLabel="账户与登录"
      onBack={() => navigate("account")}
      actions={
        <PrimaryButton
          label="退出登录"
          variant="danger"
          loading={actions["account.logout"] === "running"}
          loadingLabel="正在退出"
          onPress={() => void signOut()}
        />
      }
    >
      <AuxiliarySection title="登录状态">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="device"
            label="当前设备"
            value={session?.state === "active" ? "已登录" : "需要重新登录"}
          />
          <AuxiliaryDataRow
            icon="account"
            label="当前身份"
            value={activeIdentity === "owner" ? "车主" : "乘客"}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        退出不会删除账户、行程记录或当前设备上的主题与通知偏好。
      </AppText>
    </AuxiliaryPage>
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
    <AuxiliaryPage
      title="身份切换"
      tone={activeIdentity === "owner" ? "driver" : "passenger"}
      accessibilityLabel="乘客与车主身份切换"
      onBack={() => navigate("account")}
      actions={
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
      }
    >
      <AuxiliarySection title="当前使用">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon={activeIdentity === "owner" ? "car" : "account"}
            label={activeIdentity === "owner" ? "车主身份" : "乘客身份"}
            description={
              activeIdentity === "owner"
                ? "查看车主任务、资格和车辆状态"
                : "发起行程、查看行程和乘客服务"
            }
            value="当前"
            valueTone={activeIdentity === "owner" ? "owner" : "primary"}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="可用身份">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="route"
            label="乘客身份"
            description="默认可用"
            value={activeIdentity === "passenger" ? "当前" : "可切换"}
          />
          <AuxiliaryDataRow
            icon="car"
            label="车主身份"
            description={
              ownerAvailable
                ? "车辆审核已完成"
                : vehicleReviewEntryCopy(review.status).description
            }
            value={activeIdentity === "owner" ? "当前" : ownerAvailable ? "可切换" : "未开通"}
            valueTone="owner"
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      {access.kind !== "ready" ? (
        <AuxiliarySection title="车主身份准备">
          <AuxiliaryGroup>
            <AuxiliaryDataRow
              icon={access.kind === "safety" ? "safety" : access.kind === "vehicle" ? "car" : "account"}
              label={access.title}
              description={access.description}
              value="未完成"
              valueTone={access.kind === "safety" ? "danger" : "owner"}
              last
            />
          </AuxiliaryGroup>
        </AuxiliarySection>
      ) : null}
      <AppText size="small" tone="secondary">
        切换身份只改变当前工作台，不会改变车辆、资格、额度或安全状态。
      </AppText>
    </AuxiliaryPage>
  );
}

export function VehicleSettingsScreen({ navigate }: { navigate: Navigate }) {
  const { review } = useVehicleReview();
  const [returnScreen] = useState<AppScreen>(
    () => consumeMessageCenterDetailReturn("vehicle-settings") ?? "account",
  );
  const reviewLabel = vehicleReviewStatusLabel(review.status);
  const entry = vehicleReviewEntryCopy(review.status);
  return (
    <AuxiliaryPage
      title="我的车辆"
      tone="driver"
      accessibilityLabel="车主车辆与审核"
      onBack={() => navigate(returnScreen)}
    >
      <AuxiliarySection title="车辆信息">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="car"
            label="常用车辆"
            value={review.vehicleType ?? "待填写"}
            valueTone="owner"
          />
          <AuxiliaryDataRow label="最多可乘" value={`${review.maxPassengerCount} 人`} />
          <AuxiliaryDataRow
            label="保险有效期"
            value={review.insuranceExpiresOn ?? "待填写"}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="审核状态">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon={review.status === "draft" ? "car" : "orders"}
            label={entry.actionLabel}
            description={entry.description}
            value={reviewLabel}
            valueTone="owner"
            onPress={() => navigate(vehicleReviewScreen(review.status))}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        车辆审核完成后，开始参与时仍会确认资格、额度和安全状态。
      </AppText>
    </AuxiliaryPage>
  );
}

export function EligibilitySettingsScreen({ navigate }: { navigate: Navigate }) {
  const { trial, submit, confirm, refresh } = useFreeFlexTrial();
  const { actions, runAction, confirm: confirmAction } = useInteraction();
  const { theme } = useAppTheme();
  const [returnScreen] = useState<AppScreen>(
    () => consumeMessageCenterDetailReturn("eligibility-settings") ?? "account",
  );
  const [feedback, setFeedback] = useState<InlineFeedback>();
  const presentation = ownerQualificationPresentation(trial.state);

  const submitQualification = async () => {
    if (!await confirmAction({
      title: "申请参与资格？",
      message: "本次申请不会产生费用。提交后会进入审核，结果更新后会显示下一步。",
      confirmLabel: "确认申请",
    })) return;
    setFeedback(undefined);
    const submitted = await runAction("eligibility.submit", submit, {
      resultPresentation: "local",
    });
    setFeedback(
      submitted
        ? {
            tone: "success",
            title: "资格申请已提交",
            description: "当前无需重复申请，可以稍后回来查看结果。",
          }
        : {
            tone: "danger",
            title: "资格申请没有提交",
            description: "请检查网络后重试，当前资格状态不会改变。",
          },
    );
  };

  const confirmQualification = async () => {
    if (!await confirmAction({
      title: "确认启用 30 天资格？",
      message: "确认后开始计算 30 天参与周期，90 日内累计最多启用 60 天。",
      confirmLabel: "确认启用",
    })) return;
    setFeedback(undefined);
    const confirmed = await runAction("eligibility.confirm", confirm, {
      resultPresentation: "local",
    });
    setFeedback(
      confirmed
        ? {
            tone: "success",
            title: "参与资格已启用",
            description: "开始参与前仍会重新确认车辆、额度和安全状态。",
          }
        : {
            tone: "danger",
            title: "参与资格没有启用",
            description: "请稍后重试，当前资格周期不会开始计算。",
          },
    );
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
    setFeedback(undefined);
    const refreshed = await runAction("eligibility.refresh", refresh, {
      resultPresentation: "local",
    });
    setFeedback(
      refreshed
        ? {
            tone: "neutral",
            title: "资格状态已更新",
            description: "当前页面已经显示最新结果。",
          }
        : {
            tone: "danger",
            title: "暂时无法更新资格状态",
            description: "请检查网络后重试。",
          },
    );
  };

  const activeDays = `${trial.activationDaysInLookback} / ${trial.maximumActivationDays} 天`;

  return (
    <AuxiliaryPage
      title="参与资格"
      tone="driver"
      accessibilityLabel="车主参与资格"
      onBack={() => navigate(returnScreen)}
      actions={
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
      }
    >
      <View
        style={{
          alignItems: "center",
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <View
          style={{
            borderRadius: theme.radius.pill,
            backgroundColor: `${trial.state === "rejected" ? theme.colors.danger : theme.colors.owner}18`,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
          }}
        >
          <AppText size="small" weight="bold" tone={trial.state === "rejected" ? "danger" : "owner"}>
            {presentation.statusLabel}
          </AppText>
        </View>
        <View accessibilityRole="header">
          <AppText family="display" size="title1" weight="bold">{presentation.title}</AppText>
        </View>
        <AppText tone="secondary" style={{ textAlign: "center" }}>
          {presentation.description}
        </AppText>
      </View>
      {feedback ? (
        <AuxiliaryInlineFeedback
          title={feedback.title}
          description={feedback.description}
          tone={feedback.tone}
        />
      ) : null}
      <AuxiliarySection title="资格信息">
        <AuxiliaryGroup>
          <AuxiliaryDataRow label="参与费用" value="无需付费" />
          <AuxiliaryDataRow label="资格周期" value="每次启用 30 天" />
          <AuxiliaryDataRow label="90 日内已启用" value={activeDays} last />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="参与额度">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="orders"
            label="滚动额度"
            description={`24 小时 ${trial.quota.hours24} 单 · 7 天 ${trial.quota.days7} 单 · 30 天 ${trial.quota.days30} 单`}
            value="查看"
            valueTone="owner"
            onPress={() => navigate("quota-settings")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        车辆、资格、额度和安全状态会在开始参与前分别确认。
      </AppText>
    </AuxiliaryPage>
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
    <AuxiliaryPage
      title="参与额度"
      tone="driver"
      accessibilityLabel="车主参与额度与使用边界"
      onBack={() => navigate("account")}
    >
      <AuxiliarySection title="滚动额度" description="额度按当前时刻向前滚动计算。">
        <AuxiliaryGroup>
          <AuxiliaryDataRow label="24 小时" value={`${trial.quota.hours24} 单`} />
          <AuxiliaryDataRow label="7 天" value={`${trial.quota.days7} 单`} />
          <AuxiliaryDataRow label="30 天" value={`${trial.quota.days30} 单`} last />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="当前资格">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            label="参与资格"
            value={ownerQualificationStatusLabel(trial.state)}
            valueTone="owner"
          />
          <AuxiliaryDataRow
            label="90 日内已启用"
            value={`${trial.activationDaysInLookback} / ${trial.maximumActivationDays} 天`}
          />
          <AuxiliaryDataRow label="调整规则" value="不可增加或转让" last />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="开始参与前">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon={access.kind === "safety" ? "safety" : access.kind === "vehicle" ? "car" : "account"}
            label={access.kind === "ready" ? "参与资格当前有效" : access.title}
            description={
              access.kind === "ready"
                ? "开始参与时仍会确认本次可用额度"
                : access.description
            }
            value={access.kind === "ready" ? "有效" : "去处理"}
            valueTone={access.kind === "safety" ? "danger" : "owner"}
            onPress={() => navigate(access.kind === "ready" ? "eligibility-settings" : access.target)}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        开始参与时仍会确认车辆、资格、额度和安全状态。
      </AppText>
    </AuxiliaryPage>
  );
}

export function ThemeSettingsScreen({ navigate }: { navigate: Navigate }) {
  const { mode, setMode } = useAppTheme();
  return (
    <AuxiliaryPage
      title="主题"
      accessibilityLabel="明亮与暗色外观"
      onBack={() => navigate("account")}
    >
      <AuxiliarySection title="显示方式">
        <View accessibilityRole="radiogroup">
          <AuxiliaryGroup>
            <AuxiliaryChoiceRow
              icon="theme"
              label="明亮"
              description="适合日间和光线充足的环境"
              selected={mode === "light"}
              onPress={() => setMode("light")}
            />
            <AuxiliaryChoiceRow
              icon="theme"
              label="暗色"
              description="适合夜间和低光环境"
              selected={mode === "dark"}
              onPress={() => setMode("dark")}
              last
            />
          </AuxiliaryGroup>
        </View>
      </AuxiliarySection>
      <AppText size="small" tone="secondary">
        主题只影响当前设备，不会改变账户身份。
      </AppText>
    </AuxiliaryPage>
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
    <AuxiliaryPage
      title="隐私与安全"
      tone={safety.needsAction ? "driver" : "neutral"}
      accessibilityLabel="账户隐私与安全设置"
      onBack={() => navigate("account")}
    >
      {safety.needsAction ? (
        <AuxiliarySection title="当前安全事项">
          <AuxiliaryGroup>
            <AuxiliaryDataRow
              icon="safety"
              label={safety.title}
              description={safety.description}
              value={safety.statusLabel}
              valueTone="danger"
              onPress={() => navigate(safetyTarget)}
              last
            />
          </AuxiliaryGroup>
        </AuxiliarySection>
      ) : (
        <AppText size="small" tone="secondary">
          当前没有需要处理的安全事项。
        </AppText>
      )}
      <AuxiliarySection title="资料与身份">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="account"
            label="账户资料"
            description="管理头像和行程中的账户展示"
            onPress={() => navigate("account-profile")}
          />
          <AuxiliaryDataRow
            icon="privacy"
            label="我的实名"
            description="查看实名资料和当前状态"
            onPress={() => navigate("adult-eligibility")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="协议与说明">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="privacy"
            label="协议与隐私"
            description="查看服务协议、隐私政策和手机号认证说明"
            onPress={() => navigate("legal-information")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      <AuxiliarySection title="行程中的信息">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="route"
            label="位置"
            description="用于路线、接驾和必要的安全处理"
            value="按需使用"
          />
          <AuxiliaryDataRow
            icon="messages"
            label="行程联系"
            description="只保留与相关行程绑定的联系记录"
            onPress={() => navigate("message-center")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
    </AuxiliaryPage>
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
