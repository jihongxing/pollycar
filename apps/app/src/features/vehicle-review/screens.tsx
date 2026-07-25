import DateTimePicker from "@react-native-community/datetimepicker";
import type { VehicleReviewView } from "@pollycar/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Controller, useForm } from "react-hook-form";

import { AppIcon, type AppIconName } from "../../components/app-icon";
import { AuthAgreementGate } from "../../components/auth-agreement-gate";
import { AuxiliaryInlineFeedback } from "../../components/auxiliary-page";
import { AuthStepRail } from "../../components/auth-step-rail";
import {
  AppText,
  NavigationRow,
  PrimaryButton,
  SandboxIndicator,
  ScreenScroll,
  SectionCard,
  WorkbenchHeader,
} from "../../components/ui";
import {
  ProductFormField,
} from "../../components/product-components";
import {
  AppV2NavigationRow,
  AppV2ReadinessList,
  AppV2SectionHeader,
  AppV2SegmentedTabs,
  AppV2StageHeader,
  AppV2SummaryList,
  AppV2Timeline,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { useVehicleReview } from "../../application/vehicle-review-context";
import { useFreeFlexTrial } from "../../application/free-flex-trial-context";
import { useSyntheticTrip } from "../../application/synthetic-trip-context";
import { useSafetyCase } from "../../application/safety-case-context";
import { useAdultEligibility } from "../../application/adult-eligibility-context";
import { useIdentity } from "../../identity/identity-context";
import { useAppTheme } from "../../theme/theme-context";
import { useInteraction } from "../../interaction/interaction-context";
import { useUnsavedChangesGuard } from "../../navigation/use-unsaved-changes-guard";
import {
  clearVehicleFormDraft,
  readVehicleFormDraft,
  saveVehicleFormDraft,
  type VehicleMaterialCode,
} from "./vehicle-draft-storage";
import {
  normalizeInsuranceDate,
  normalizeVehicleType,
  type VehicleFormValues,
  validateInsuranceDate,
  validateVehicleType,
} from "./vehicle-form-model";
import {
  formatVehicleReviewDate,
  vehicleReviewEntryCopy,
  vehicleReviewMaterialRequirements,
  vehicleReviewTimeline,
} from "./vehicle-review-presentation";

export type AppScreen =
  | "adult-eligibility"
  | "adult-eligibility-appeal"
  | "ride-home"
  | "ride-search"
  | "ride-confirmation"
  | "ride-matching"
  | "ride-pickup"
  | "ride-cancellation"
  | "ride-active"
  | "ride-completion"
  | "ride-history"
  | "ride-detail"
  | "driver-home"
  | "driver-orders"
  | "driver-pickup"
  | "driver-waiting-pickup"
  | "driver-active"
  | "driver-completion"
  | "driver-history"
  | "driver-order-detail"
  | "driver-wallet"
  | "driver-bank-card"
  | "driver-withdraw"
  | "trip-chat"
  | "message-center"
  | "passenger-workbench"
  | "owner-apply-intro"
  | "owner-profile"
  | "vehicle-form"
  | "submission-review"
  | "review-pending"
  | "review-needs-material"
  | "review-approved"
  | "owner-workbench"
  | "account"
  | "account-profile"
  | "account-login"
  | "legal-information"
  | "service-agreement"
  | "privacy-policy"
  | "phone-auth-notice"
  | "identity-settings"
  | "vehicle-settings"
  | "eligibility-settings"
  | "quota-settings"
  | "theme-settings"
  | "privacy-safety-settings"
  | "notifications"
  | "notification-detail"
  | "notification-settings"
  | "help-feedback"
  | "trip-create"
  | "trip-payment"
  | "trip-matching"
  | "trip-active"
  | "trip-result"
  | "trip-recovery"
  | "driver-offers"
  | "driver-trip"
  | "safety-chat"
  | "safety-report"
  | "safety-frozen"
  | "safety-appeal"
  | "safety-result";

const ownerMaterialRequirements = [
  {
    code: "driver_license",
    icon: "account" as const,
    title: "驾驶资格材料",
    description: "确认你具备驾驶资格",
  },
  {
    code: "vehicle_registration",
    icon: "car" as const,
    title: "车辆材料",
    description: "确认车辆信息与申请一致",
  },
  {
    code: "insurance_proof",
    icon: "safety" as const,
    title: "保险材料",
    description: "确认保险仍在有效期内",
  },
] as const;

export function PassengerWorkbench({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { dashboard, recoveryNotice } = useSyntheticTrip();
  const passengerTrip = dashboard.passengerTrip;
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="乘客工作台"
        title="今天想去哪里？"
        description="先完成当前任务，再查看身份、审核和安全状态。真实行程仍保持关闭。"
      />
      <AppV2SummaryList
        items={[
          {
            label: "行程",
            value: passengerTrip ? syntheticTripStateLabels[passengerTrip.state] : "暂无进行中行程",
            emphasized: true,
          },
          { label: "支付", value: "仅 ¥0 合成前置" },
        ]}
      />
      <View>
        <AppText size="caption" tone="secondary" weight="bold">当前任务</AppText>
        <AppText size="title2" weight="bold">
          {passengerTrip ? "继续处理当前合成行程" : "创建一笔合成行程"}
        </AppText>
      </View>
      <SectionCard accent="passenger">
        <AppText size="caption" tone="inverse" weight="bold">上海试点未开放</AppText>
        <AppText size="title2" tone="inverse" weight="bold">
          {passengerTrip ? "继续当前合成行程" : "当前暂不能发起真实行程"}
        </AppText>
        <AppText tone="inverse">行程创建、支付、匹配、履约和结果现在使用独立页面。</AppText>
        <PrimaryButton
          label={passengerTrip ? "进入当前行程" : "创建合成行程"}
          onPress={() => navigate(passengerTrip ? passengerTripScreenName(passengerTrip.state) : "trip-create")}
        />
      </SectionCard>
      {passengerTrip ? (
        <AppV2SummaryList
          items={[
            {
              label: "当前行程",
              value: syntheticTripStateLabels[passengerTrip.state],
              emphasized: true,
            },
            {
              label: "路线",
              value: `${passengerTrip.originLabel} → ${passengerTrip.destinationLabel}`,
            },
            { label: "费用", value: "¥0" },
          ]}
        />
      ) : null}
      {recoveryNotice ? (
        <AuxiliaryInlineFeedback
          icon="clock"
          title="行程状态已更新"
          description={recoveryNotice}
          tone="neutral"
        />
      ) : null}
      <NavigationRow
        title="通知与任务"
        description="汇总审核、行程、安全和资格的合成待办"
        onPress={() => navigate("notifications")}
      />
      {passengerTrip && ["pending_payment", "paid_pending_match", "accepted"].includes(passengerTrip.state) ? (
        <NavigationRow
          title="异常恢复"
          description="处理支付、匹配或接单超时"
          onPress={() => navigate("trip-recovery")}
        />
      ) : null}
      <View style={{ gap: 12 }}>
        <AppText size="title2" weight="bold">账户与身份</AppText>
        <NavigationRow
          title="申请车主身份"
          description="提交合成资料并完成车辆审核"
          tone="passenger"
          onPress={() => navigate("owner-apply-intro")}
        />
      </View>
    </ScreenScroll>
  );
}

export function OwnerApplyIntro({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { review } = useVehicleReview();
  const copy = vehicleReviewEntryCopy(review.status);
  const nextScreen =
    review.status === "draft" ? "owner-profile" : ownerEntryScreen(review.status);
  return (
    <MobilityPage
      title="成为车主"
      tone="driver"
      accessibilityLabel="车主申请说明"
      onBack={() => navigate("passenger-workbench")}
      actions={
        <>
          <PrimaryButton
            label={copy.actionLabel}
            variant="owner"
            onPress={() => navigate(nextScreen)}
          />
          <PrimaryButton
            label="暂时不申请"
            variant="text"
            onPress={() => navigate("passenger-workbench")}
          />
        </>
      }
    >
      <AppV2StageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        tone="driver"
      />
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={
          review.status === "under_review" || review.status === "needs_material"
            ? 2
            : review.status === "approved"
              ? 2
              : 0
        }
        tone="driver"
      />
    </MobilityPage>
  );
}

export function OwnerProfile({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const agreements = [
    {
      id: "service",
      icon: "orders" as const,
      title: "车主参与协议",
      summary: "逐单选择，不承诺持续在线或订单数量",
      detail: "你可以根据路线、时间和乘车人数逐单决定是否参与。通过车主审核后，仍需遵守平台资格、额度和安全要求。",
    },
    {
      id: "safety",
      icon: "safety" as const,
      title: "行程与安全责任",
      summary: "了解联系、履约和安全处理边界",
      detail: "平台只在行程履约与安全处理范围内提供联系和必要信息。发生安全事件时，需要配合平台完成处理。",
    },
    {
      id: "privacy",
      icon: "privacy" as const,
      title: "认证材料与隐私说明",
      summary: "了解身份、车辆和保险材料的使用范围",
      detail: "提交的认证材料用于身份确认、车辆审核和必要的安全处理，平台会按适用规则控制访问和保存范围。",
    },
  ] as const;

  return (
    <MobilityPage
      title="参与确认"
      tone="driver"
      accessibilityLabel="车主参与方式确认"
      onBack={() => navigate("owner-apply-intro")}
      actions={
        <PrimaryButton
          label="我已了解，继续添加车辆"
          variant="owner"
          disabled={!consentAccepted}
          onPress={() => navigate("vehicle-form")}
        />
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={0}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 1 步 · 参与确认"
        title="先阅读并同意参与规则"
        description="完成确认后，才能继续添加车辆。"
        tone="driver"
      />
      <AuthAgreementGate
        agreements={agreements}
        consentLabel="我已阅读并同意以上内容"
        consentAccepted={consentAccepted}
        onConsentChange={setConsentAccepted}
        tone="driver"
      />
    </MobilityPage>
  );
}

export function VehicleForm({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { theme } = useAppTheme();
  const { review, saveDraft } = useVehicleReview();
  const { actions, runAction, confirm: requestConfirmation } = useInteraction();
  const restoredDraft = useMemo(() => readVehicleFormDraft(), []);
  const [draftSavedAt, setDraftSavedAt] = useState(restoredDraft?.updatedAt);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [preparedMaterials, setPreparedMaterials] = useState<ReadonlySet<VehicleMaterialCode>>(
    new Set(restoredDraft?.preparedMaterials),
  );
  const { control, handleSubmit, formState, getValues, setValue, watch } = useForm<VehicleFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      vehicleType: restoredDraft?.vehicleType ?? review.vehicleType ?? "中大型轿车 · 示例 A",
      insuranceDate: restoredDraft?.insuranceDate ?? review.insuranceExpiresOn ?? "",
      maxPassengerCount: restoredDraft?.maxPassengerCount ?? review.maxPassengerCount ?? 1,
    },
  });
  useEffect(() => {
    const subscription = watch((values) => {
      const stored = saveVehicleFormDraft({
        vehicleType: values.vehicleType ?? "",
        insuranceDate: values.insuranceDate ?? "",
        maxPassengerCount: values.maxPassengerCount ?? 1,
        preparedMaterials: [...preparedMaterials],
      });
      setDraftSavedAt(stored.updatedAt);
    });
    return () => subscription.unsubscribe();
  }, [preparedMaterials, watch]);
  const confirmLeave = useCallback(
    () =>
      requestConfirmation({
        title: "离开车辆资料编辑？",
        message: "当前输入已保存在本机草稿中，下次回来可以继续；尚未同步到审核材料。",
        confirmLabel: "确认离开",
      }),
    [requestConfirmation],
  );
  const allowNavigation = useUnsavedChangesGuard(
    formState.isDirty || Boolean(restoredDraft),
    confirmLeave,
  );
  const goBack = async () => {
    if (!formState.isDirty && !restoredDraft) {
      navigate("owner-profile");
      return;
    }
    if (!await confirmLeave()) return;
    allowNavigation();
    navigate("owner-profile");
  };
  const saveAndContinue = handleSubmit(async (values) => {
    const normalized = {
      vehicleType: normalizeVehicleType(values.vehicleType),
      insuranceDate: normalizeInsuranceDate(values.insuranceDate),
      maxPassengerCount: values.maxPassengerCount,
    };
    const saved = await runAction(
      "vehicle.save-draft",
      () =>
        saveDraft({
          vehicleType: normalized.vehicleType,
          maxPassengerCount: normalized.maxPassengerCount,
          insuranceExpiresOn: normalized.insuranceDate,
          syntheticAttachmentId: "synthetic-insurance-a",
        }),
    );
    if (!saved) {
      saveVehicleFormDraft({
        ...getValues(),
        preparedMaterials: [...preparedMaterials],
      });
      return;
    }
    allowNavigation();
    navigate("submission-review");
  });
  const prepareMaterial = (materialCode: VehicleMaterialCode) => {
    const nextMaterials = new Set(preparedMaterials).add(materialCode);
    setPreparedMaterials(nextMaterials);
    const stored = saveVehicleFormDraft({
      ...getValues(),
      preparedMaterials: [...nextMaterials],
    });
    setDraftSavedAt(stored.updatedAt);
  };
  const materialsReady = preparedMaterials.size === ownerMaterialRequirements.length;

  return (
    <MobilityPage
      title="车辆资料"
      tone="driver"
      accessibilityLabel="车主车辆资料"
      onBack={() => void goBack()}
      actions={
        <PrimaryButton
          label="保存并继续"
          variant="owner"
          loading={actions["vehicle.save-draft"] === "running"}
          loadingLabel="正在保存"
          disabled={!formState.isValid || !materialsReady}
          onPress={() => void saveAndContinue()}
        />
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={1}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 2 步 · 车辆资料"
        title="添加你准备使用的车辆"
        description="逐项添加材料，完成基础检查后再提交审核。"
        tone="driver"
      />
      <Controller
        control={control}
        name="vehicleType"
        rules={{ validate: validateVehicleType }}
        render={({ field }) => (
          <ProductFormField
            label="车辆类型"
            value={field.value}
            error={formState.errors.vehicleType?.message}
            helper="例如：中大型轿车、紧凑型 SUV"
            onBlur={() => {
              field.onBlur();
              setValue("vehicleType", normalizeVehicleType(field.value), {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="maxPassengerCount"
        render={({ field }) => (
          <View style={{ gap: theme.spacing.sm }}>
            <AppV2SectionHeader title="最多可乘人数" detail="必选 · 最多 3 人" />
            <AppV2SegmentedTabs
              tone="driver"
              items={([1, 2, 3] as const).map((count) => ({
                value: String(count),
                label: `${count} 人`,
              }))}
              selected={String(field.value)}
              onSelect={(value) => field.onChange(Number(value) as 1 | 2 | 3)}
            />
          </View>
        )}
      />
      <Controller
        control={control}
        name="insuranceDate"
        rules={{ validate: (value) => validateInsuranceDate(value) }}
        render={({ field }) => (
          <View style={{ gap: theme.spacing.xs }}>
            <ProductFormField
              label="保险有效期"
              value={field.value}
              placeholder="2027-08-31"
              error={formState.errors.insuranceDate?.message}
              helper="请填写保险到期日，格式为 YYYY-MM-DD"
              onBlur={() => {
                field.onBlur();
                setValue("insuranceDate", normalizeInsuranceDate(field.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              onChangeText={field.onChange}
              webInputType="date"
            />
            {Platform.OS !== "web" ? (
              <>
                <PrimaryButton
                  label="使用系统日期选择器"
                  variant="secondary"
                  onPress={() => setDatePickerOpen(true)}
                />
                {datePickerOpen ? (
                  <DateTimePicker
                    mode="date"
                    minimumDate={new Date()}
                    maximumDate={new Date(new Date().setFullYear(new Date().getFullYear() + 5))}
                    value={parseDateForPicker(field.value)}
                    onChange={(_, selectedDate) => {
                      setDatePickerOpen(Platform.OS === "ios");
                      if (!selectedDate) return;
                      field.onChange(formatDateForInput(selectedDate));
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        )}
      />
      <AppV2SectionHeader
        title="审核材料"
        detail={`${preparedMaterials.size}/${ownerMaterialRequirements.length} 已完成`}
      />
      <View style={{ gap: theme.spacing.sm }}>
        {ownerMaterialRequirements.map((material) => (
          <OwnerMaterialCapture
            key={material.code}
            {...material}
            prepared={preparedMaterials.has(material.code)}
            onPress={() => prepareMaterial(material.code)}
          />
        ))}
      </View>
      <AppText size="caption" tone="secondary">
        {materialsReady
          ? "三项材料已完成基础检查。"
          : restoredDraft
            ? "已恢复上次未完成的车辆资料。"
            : draftSavedAt
              ? `已自动保存 · ${formatVehicleReviewDate(draftSavedAt)}`
              : "请先完成全部审核材料。"}
      </AppText>
    </MobilityPage>
  );
}

export function SubmissionReview({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { review, submit } = useVehicleReview();
  const { actions, runAction, confirm: requestConfirmation } = useInteraction();
  const draft = readVehicleFormDraft();
  return (
    <MobilityPage
      title="提交前检查"
      tone="driver"
      accessibilityLabel="车辆审核提交前检查"
      onBack={() => navigate("vehicle-form")}
      actions={
        <>
          <PrimaryButton
            label="提交车辆审核"
            variant="owner"
            loading={actions["vehicle.submit"] === "running"}
            loadingLabel="正在提交"
            onPress={() => void (async () => {
              if (!await requestConfirmation({
                title: "确认提交车辆审核？",
                message: "提交后将进入独立审核。审核期间无需重复提交，结果变化后会显示下一步。",
                confirmLabel: "确认提交",
              })) return;
              if (await runAction("vehicle.submit", submit)) {
                clearVehicleFormDraft();
                navigate("review-pending");
              }
            })()}
          />
          <PrimaryButton label="返回修改" variant="text" onPress={() => navigate("vehicle-form")} />
        </>
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={2}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 3 步 · 提交审核"
        title="确认信息后提交"
        description="三项材料将一并交给平台审核。"
        tone="driver"
      />
      <AppV2ReadinessList
        tone="driver"
        items={ownerMaterialRequirements.map((material) => ({
          icon: material.icon,
          title: material.title,
          description: draft?.preparedMaterials.includes(material.code)
            ? "基础检查通过"
            : "尚未完成",
          status: draft?.preparedMaterials.includes(material.code) ? "ready" as const : "pending" as const,
        }))}
      />
      <AppV2NavigationRow
        icon="car"
        title={review.vehicleType ?? "车辆资料"}
        description={`最多 ${review.maxPassengerCount} 人 · 保险有效期 ${review.insuranceExpiresOn ?? "待确认"}`}
        value="修改"
        tone="driver"
        onPress={() => navigate("vehicle-form")}
      />
      <AuxiliaryInlineFeedback
        icon="clock"
        title="提交后无需停留"
        description="审核完成、需要补充或无法继续时，页面会明确说明结果和下一步。"
        tone="neutral"
      />
    </MobilityPage>
  );
}

function OwnerMaterialCapture({
  icon,
  title,
  description,
  prepared,
  onPress,
  pendingActionLabel = "添加",
  preparedActionLabel = "重新添加",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  prepared: boolean;
  onPress: () => void;
  pendingActionLabel?: string;
  preparedActionLabel?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${prepared ? `基础检查通过，可${preparedActionLabel}` : pendingActionLabel}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 84,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        borderWidth: 1,
        borderColor: prepared ? `${theme.colors.owner}65` : theme.colors.border,
        borderRadius: theme.radius.medium,
        backgroundColor: prepared
          ? `${theme.colors.owner}0B`
          : pressed
            ? theme.colors.surfaceMuted
            : theme.colors.surface,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          backgroundColor: prepared ? `${theme.colors.owner}18` : theme.colors.surfaceMuted,
        }}
      >
        <AppIcon
          name={icon}
          size={20}
          color={prepared ? theme.colors.owner : theme.colors.textSecondary}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText weight="bold">{title}</AppText>
        <AppText size="small" tone="secondary">
          {prepared ? "基础检查通过" : description}
        </AppText>
      </View>
      <AppText
        size="small"
        weight="bold"
        style={{ color: prepared ? theme.colors.owner : theme.colors.primary }}
      >
        {prepared ? preparedActionLabel : pendingActionLabel}
      </AppText>
    </Pressable>
  );
}

export function ReviewPending({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { review, refresh } = useVehicleReview();
  const [refreshing, setRefreshing] = useState(false);
  const refreshAndRoute = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await refresh();
      if (next.status === "needs_material") navigate("review-needs-material");
      if (next.status === "approved") navigate("review-approved");
    } finally {
      setRefreshing(false);
    }
  }, [navigate, refresh]);
  useEffect(() => {
    const timer = setInterval(() => void refreshAndRoute(), 8_000);
    return () => clearInterval(timer);
  }, [refreshAndRoute]);
  return (
    <MobilityPage
      title="车辆审核"
      tone="driver"
      accessibilityLabel="车辆审核中"
      onBack={() => navigate("passenger-workbench")}
      actions={
        <>
          <PrimaryButton
            label="检查最新状态"
            variant="secondary"
            loading={refreshing}
            loadingLabel="正在更新"
            onPress={() => void refreshAndRoute()}
          />
          <PrimaryButton
            label="返回乘客首页"
            variant="text"
            onPress={() => navigate("passenger-workbench")}
          />
        </>
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={2}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 3 步 · 审核中"
        title="平台正在审核车辆资料"
        description="当前无需重复提交。"
        tone="driver"
      />
      <AppV2Timeline items={vehicleReviewTimeline(review)} />
    </MobilityPage>
  );
}

export function ReviewNeedsMaterial({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { theme } = useAppTheme();
  const { review, resubmit } = useVehicleReview();
  const { actions, runAction } = useInteraction();
  const materials = vehicleReviewMaterialRequirements(review);
  const requiresInsuranceDate = materials.some((material) => material.needsInsuranceDate);
  const [selectedInsuranceDate, setSelectedInsuranceDate] = useState(
    review.insuranceExpiresOn ?? "",
  );
  const [preparedMaterials, setPreparedMaterials] = useState<ReadonlySet<VehicleMaterialCode>>(
    new Set(),
  );
  const insuranceError = requiresInsuranceDate
    ? validateInsuranceDate(selectedInsuranceDate)
    : undefined;
  const materialsReady = materials.every((material) => preparedMaterials.has(material.code));
  const readyToSubmit = materialsReady && !insuranceError;
  const prepareMaterial = (materialCode: VehicleMaterialCode) => {
    setPreparedMaterials((current) => new Set(current).add(materialCode));
  };
  return (
    <MobilityPage
      title="补充车辆资料"
      tone="driver"
      accessibilityLabel="补充车辆审核资料"
      onBack={() => navigate("passenger-workbench")}
      actions={
        <>
          <PrimaryButton
            label="提交补充资料"
            variant="owner"
            disabled={!readyToSubmit}
            loading={actions["vehicle.resubmit"] === "running"}
            loadingLabel="正在提交"
            onPress={() => void (async () => {
              const updated = await runAction(
                "vehicle.resubmit",
                () =>
                  resubmit({
                    insuranceExpiresOn: requiresInsuranceDate
                      ? normalizeInsuranceDate(selectedInsuranceDate)
                      : review.insuranceExpiresOn ?? "",
                    syntheticAttachmentId: `synthetic-${materials.map((material) => material.code).join("-")}-b`,
                  }),
              );
              if (updated) navigate("review-pending");
            })()}
          />
          <PrimaryButton
            label="稍后处理"
            variant="text"
            onPress={() => navigate("passenger-workbench")}
          />
        </>
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={1}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 2 步 · 补充资料"
        title={materials.length === 1 ? materials[0]!.title : "请补交所需材料"}
        description={materials.length === 1
          ? materials[0]!.description
          : "逐项完成基础检查后，平台会继续审核。"}
        tone="driver"
      />
      <AppV2SectionHeader
        title="需要补充的材料"
        detail={`${preparedMaterials.size}/${materials.length} 已完成`}
      />
      <View style={{ gap: theme.spacing.sm }}>
        {materials.map((material) => (
          <OwnerMaterialCapture
            key={material.code}
            icon={material.icon}
            title={material.title}
            description={material.description}
            prepared={preparedMaterials.has(material.code)}
            onPress={() => prepareMaterial(material.code)}
            pendingActionLabel="补交"
            preparedActionLabel="重新补交"
          />
        ))}
      </View>
      {requiresInsuranceDate ? (
        <ProductFormField
          label="保险有效期"
          value={selectedInsuranceDate}
          error={insuranceError}
          helper="请填写保险到期日，格式为 YYYY-MM-DD"
          onChangeText={setSelectedInsuranceDate}
          webInputType="date"
        />
      ) : null}
      <AppText size="caption" tone="secondary">
        {readyToSubmit ? "补充材料已完成基础检查。" : "请完成当前需要补交的材料。"}
      </AppText>
      <AppV2Timeline items={vehicleReviewTimeline(review)} />
    </MobilityPage>
  );
}

export function ReviewApproved({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { approveOwner, setActiveIdentity } = useIdentity();
  const { review } = useVehicleReview();
  const enterOwner = async () => {
    approveOwner();
    await setActiveIdentity("owner");
    navigate("owner-workbench");
  };
  return (
    <MobilityPage
      title="审核结果"
      tone="driver"
      accessibilityLabel="车辆审核结果"
      onBack={() => navigate("passenger-workbench")}
      actions={
        <>
          <PrimaryButton
            label="进入车主首页"
            variant="owner"
            onPress={() => void enterOwner()}
          />
          <PrimaryButton
            label="继续使用乘客身份"
            variant="text"
            onPress={() => navigate("passenger-workbench")}
          />
        </>
      }
    >
      <AuthStepRail
        steps={["参与", "车辆", "审核"]}
        currentStep={2}
        tone="driver"
      />
      <AppV2StageHeader
        eyebrow="第 3 步 · 审核完成"
        title="车辆资料已通过审核"
        description="现在可以进入车主首页。"
        tone="driver"
      />
      <AppV2SummaryList
        items={[
          { label: "车辆", value: review.vehicleType ?? "常用车辆", emphasized: true },
          { label: "最多可乘", value: `${review.maxPassengerCount} 人` },
          { label: "保险有效期", value: review.insuranceExpiresOn ?? "已确认" },
          {
            label: "审核完成",
            value: formatVehicleReviewDate(review.timeline.at(-1)?.occurredAt),
          },
        ]}
      />
    </MobilityPage>
  );
}

export function OwnerWorkbench({ navigate }: { navigate: (screen: AppScreen) => void }) {
  const { setActiveIdentity } = useIdentity();
  const { review } = useVehicleReview();
  const { trial, submit, confirm, refresh } = useFreeFlexTrial();
  const {
    dashboard: tripDashboard,
  } = useSyntheticTrip();
  const activeTrip = tripDashboard.activeDriverTrip;
  const availableTrip = tripDashboard.availableDriverTrips[0];
  const { dashboard: safetyDashboard } = useSafetyCase();
  const { actions, runAction, confirm: requestConfirmation } = useInteraction();
  const [qualificationFeedback, setQualificationFeedback] = useState<Readonly<{
    tone: "success" | "neutral" | "danger";
    title: string;
    description: string;
  }>>();
  const runQualificationAction = async (
    key: string,
    action: () => Promise<void>,
    success: Readonly<{ title: string; description: string; tone?: "success" | "neutral" }>,
  ) => {
    setQualificationFeedback(undefined);
    const completed = await runAction(key, action, { resultPresentation: "local" });
    setQualificationFeedback(
      completed
        ? {
            tone: success.tone ?? "success",
            title: success.title,
            description: success.description,
          }
        : {
            tone: "danger",
            title: "资格状态没有更新",
            description: "请检查网络后重试，当前参与资格不会改变。",
          },
    );
  };
  const returnPassenger = async () => {
    await setActiveIdentity("passenger");
    navigate("passenger-workbench");
  };
  return (
    <ScreenScroll>
      <WorkbenchHeader
        eyebrow="车主工作台"
        title="先看任务，再开始参与。"
        description="车辆、资格、行程和安全状态集中呈现；真实接单继续关闭。"
        tone="owner"
      />
      <AppV2SummaryList
        items={[
          { label: "车辆", value: "审核有效", emphasized: true },
          { label: "资格", value: freeFlexTrialStateLabels[trial.state] },
          {
            label: "行程任务",
            value: activeTrip
              ? syntheticTripStateLabels[activeTrip.state]
              : availableTrip
                ? "有一笔待接行程"
                : "暂无待处理行程",
          },
        ]}
      />
      <View>
        <AppText size="caption" tone="secondary" weight="bold">当前任务</AppText>
        <AppText size="title2" weight="bold">
          {activeTrip ? "继续当前合成履约" : availableTrip ? "查看待接合成行程" : "等待新的合成任务"}
        </AppText>
      </View>
      <SectionCard accent="owner">
        <AppText size="caption" tone="inverse" weight="bold">车主资格有效</AppText>
        <AppText size="title2" tone="inverse" weight="bold">合成车辆已通过审核</AppText>
        <AppText tone="inverse">当前可以查看资格和车辆状态，但不能接受真实订单。</AppText>
      </SectionCard>
      <SectionCard accent="owner">
        <AppText size="title2" weight="bold">合成接单与履约</AppText>
        <AppText tone="secondary">
          {activeTrip
            ? `${activeTrip.originLabel} → ${activeTrip.destinationLabel} · ${syntheticTripStateLabels[activeTrip.state]}`
            : availableTrip
              ? `${availableTrip.originLabel} → ${availableTrip.destinationLabel} · 待接`
              : "暂无待处理合成行程"}
        </AppText>
        <PrimaryButton
          label={activeTrip ? "进入车主履约" : "查看待接行程"}
          variant="owner"
          onPress={() => navigate(activeTrip ? "driver-trip" : "driver-offers")}
        />
        {activeTrip ? (
          <PrimaryButton label="打开临时对话" variant="secondary" onPress={() => navigate("safety-chat")} />
        ) : null}
      </SectionCard>
      {safetyDashboard?.safetyCase ? (
        <NavigationRow
          title="查看安全案件"
          description={`当前状态：${safetyDashboard.safetyCase.state}`}
          tone="owner"
          onPress={() =>
            navigate(
              safetyDashboard.safetyCase?.state === "restored" || safetyDashboard.safetyCase?.state === "upheld"
                ? "safety-result"
                : "safety-frozen",
            )
          }
        />
      ) : null}
      <View>
        <AppText size="caption" tone="secondary" weight="bold">资格与车辆</AppText>
        <AppText size="title2" weight="bold">参与边界与可用额度</AppText>
      </View>
      <AuxiliaryInlineFeedback
        icon="car"
        tone="success"
        title="车辆状态有效"
        description={`示例 A · 合成审核有效 · 单次最多 ${review.maxPassengerCount} 人`}
      />
      <SectionCard accent="owner">
        <AppText size="title2" weight="bold">免费弹性资格试验</AppText>
        <AppText tone="secondary">
          状态：{freeFlexTrialStateLabels[trial.state]} · 费用 ¥0 · 批次 {trial.batchId}
        </AppText>
        <AppText tone="secondary">
          弹性额度：24 小时 {trial.quota.hours24} 单 / 7 日 {trial.quota.days7} 单 / 30 日 {trial.quota.days30} 单
        </AppText>
        <AppText tone="secondary">
          90 日内最多启用 {trial.maximumActivationDays} 日；真实邀请与付费资格保持关闭。
        </AppText>
        {trial.state === "invited" ? (
          <PrimaryButton
            label="申请免费弹性资格"
            variant="owner"
            loading={actions["flex.submit"] === "running"}
            onPress={() => void runQualificationAction(
              "flex.submit",
              submit,
              {
                title: "资格申请已提交",
                description: "审核期间无需重复申请，可以稍后回来查看结果。",
              },
            )}
          />
        ) : trial.state === "under_review" ? (
          <PrimaryButton
            label="刷新资格审核状态"
            variant="secondary"
            loading={actions["flex.refresh"] === "running"}
            onPress={() => void runQualificationAction(
              "flex.refresh",
              refresh,
              {
                title: "资格状态已更新",
                description: "当前页面已经显示最新结果。",
                tone: "neutral",
              },
            )}
          />
        ) : trial.state === "awaiting_confirmation" ? (
          <PrimaryButton
            label="确认并启用 30 天资格"
            variant="owner"
            loading={actions["flex.confirm"] === "running"}
            onPress={() => void (async () => {
              if (!await requestConfirmation({
                title: "启用 30 天免费资格？",
                message: "资格不会自动续期，90 日内累计启用最多 60 日。",
                confirmLabel: "确认启用",
              })) return;
              await runQualificationAction(
                "flex.confirm",
                confirm,
                {
                  title: "免费资格已启用",
                  description: "资格周期已经开始，开始参与前仍会确认其他条件。",
                },
              );
            })()}
          />
        ) : null}
        {qualificationFeedback ? (
          <AuxiliaryInlineFeedback
            title={qualificationFeedback.title}
            description={qualificationFeedback.description}
            tone={qualificationFeedback.tone}
          />
        ) : null}
      </SectionCard>
      {activeTrip?.state === "accepted" ? (
        <NavigationRow
          title="处理接单超时"
          description="进入异常恢复页推进合成时钟"
          tone="owner"
          onPress={() => navigate("trip-recovery")}
        />
      ) : null}
      <NavigationRow
        title="通知与任务"
        description="汇总审核、行程、安全和资格的合成待办"
        tone="owner"
        onPress={() => navigate("notifications")}
      />
      <View style={{ gap: 12 }}>
        <AppText size="title2" weight="bold">账户与身份</AppText>
        <NavigationRow
          title="返回乘客身份"
          description="切换身份不会改变车辆、资格和安全限制"
          tone="owner"
          onPress={() => void returnPassenger()}
        />
      </View>
    </ScreenScroll>
  );
}

export function AccountScreen({
  navigate,
}: {
  navigate: (screen: AppScreen) => void;
}) {
  const { activeIdentity, setActiveIdentity } = useIdentity();
  const { review } = useVehicleReview();
  const { trial } = useFreeFlexTrial();
  const { verification } = useAdultEligibility();
  const { actions, runAction } = useInteraction();
  const { theme } = useAppTheme();
  const ownerApproved =
    review.ownerIdentityAvailable || review.status === "approved";
  const ownerApplicationStarted =
    review.status !== "draft" ||
    review.version > 0 ||
    Boolean(review.vehicleType) ||
    review.timeline.length > 0;
  const realNameLabel = verification?.businessAccessAllowed
    ? "已确认"
    : verification?.state === "processing" || verification?.state === "needs_review"
      ? "确认中"
      : "需要完成";
  const switchIdentity = async (identity: "passenger" | "owner") => {
    await runAction("account.identity", async () => {
      await setActiveIdentity(identity);
    });
  };
  return (
    <ScreenScroll>
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: theme.spacing.xl }}>
        <AppV2StageHeader
          eyebrow={activeIdentity === "owner" ? "我的 · 车主身份" : "我的"}
          title="林屿"
          description={
            activeIdentity === "owner"
              ? "管理订单、车辆、参与资格和资金记录。"
              : "查看行程、账户资料和常用设置。"
          }
          tone={activeIdentity === "owner" ? "driver" : "passenger"}
        />

        {activeIdentity === "owner" ? (
          <>
            <AccountIdentityAction
              title="车主身份"
              description="当前正在使用车主身份"
              actionLabel="切换为乘客"
              loading={actions["account.identity"] === "running"}
              onPress={() => void switchIdentity("passenger")}
            />
            <View style={{ gap: theme.spacing.sm }}>
              <AppV2SectionHeader title="车主服务" />
              <AccountMenuGroup>
                <AccountMenuRow
                  icon="orders"
                  title="我的订单"
                  description="查看进行中、已完成和已取消的订单"
                  tone="owner"
                  onPress={() => navigate("driver-history")}
                />
                <AccountMenuRow
                  icon="car"
                  title="我的车辆"
                  description={`查看车辆资料和当前审核状态`}
                  tone="owner"
                  onPress={() => navigate("vehicle-settings")}
                />
                <AccountMenuRow
                  icon="account"
                  title="参与资格"
                  description={`当前${accountTrialStateLabels[trial.state]}，查看确认和恢复路径`}
                  tone="owner"
                  onPress={() => navigate("eligibility-settings")}
                />
                <AccountMenuRow
                  icon="orders"
                  title="参与额度"
                  description="查看滚动窗口上限和当前限制"
                  tone="owner"
                  onPress={() => navigate("quota-settings")}
                />
                <AccountMenuRow
                  icon="wallet"
                  title="资金中心"
                  description="查看余额与明细；结算、绑卡和提现暂不可用"
                  tone="owner"
                  onPress={() => navigate("driver-wallet")}
                />
              </AccountMenuGroup>
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: theme.spacing.sm }}>
              <AppV2SectionHeader title="乘客服务" />
              <AccountMenuGroup>
                <AccountMenuRow
                  icon="route"
                  title="我的行程"
                  description="查看进行中、预约和历史行程"
                  onPress={() => navigate("ride-history")}
                />
              </AccountMenuGroup>
            </View>
            <PassengerOwnerEntry
              review={review}
              ownerApproved={ownerApproved}
              applicationStarted={ownerApplicationStarted}
              loading={actions["account.identity"] === "running"}
              onSwitchOwner={() => void switchIdentity("owner")}
              navigate={navigate}
            />
          </>
        )}

        <View style={{ gap: theme.spacing.sm }}>
          <AppV2SectionHeader title="账户与设置" />
          <AccountMenuGroup>
            <AccountMenuRow
              icon="account"
              title="账户资料"
              description="管理头像和行程中的账户展示"
              onPress={() => navigate("account-profile")}
            />
            <AccountMenuRow
              icon="privacy"
              title="我的实名"
              description={
                verification?.businessAccessAllowed
                  ? "实名信息已确认"
                  : "完成实名后即可使用行程服务"
              }
              value={realNameLabel}
              onPress={() => navigate("adult-eligibility")}
            />
            <AccountMenuRow
              icon="messages"
              title="通知设置"
              description="管理非紧急服务通知的显示偏好"
              onPress={() => navigate("notification-settings")}
            />
            <AccountMenuRow
              icon="theme"
              title="主题"
              description="选择明亮或暗色外观"
              onPress={() => navigate("theme-settings")}
            />
            <AccountMenuRow
              icon="privacy"
              title="隐私与安全"
              description="查看安全事项、位置使用和行程联系边界"
              onPress={() => navigate("privacy-safety-settings")}
            />
            <AccountMenuRow
              icon="help"
              title="帮助与反馈"
              description="获取行程、实名和安全帮助，或分享产品建议"
              onPress={() => navigate("help-feedback")}
            />
            <AccountMenuRow
              icon="device"
              title="账户与登录"
              description="查看当前登录状态或退出账户"
              onPress={() => navigate("account-login")}
            />
          </AccountMenuGroup>
        </View>

        <View style={{ alignItems: "center" }}>
          <SandboxIndicator />
        </View>
      </View>
    </ScreenScroll>
  );
}

function PassengerOwnerEntry({
  review,
  ownerApproved,
  applicationStarted,
  loading,
  onSwitchOwner,
  navigate,
}: {
  review: VehicleReviewView;
  ownerApproved: boolean;
  applicationStarted: boolean;
  loading: boolean;
  onSwitchOwner: () => void;
  navigate: (screen: AppScreen) => void;
}) {
  if (ownerApproved) {
    return (
      <AccountIdentityAction
        title="车主身份已通过"
        description="切换后可以查看车辆、订单和参与状态"
        actionLabel="切换为车主"
        loading={loading}
        onPress={onSwitchOwner}
      />
    );
  }
  if (review.status === "under_review" || review.status === "appealing") {
    return (
      <AppV2NavigationRow
        icon="car"
        title={review.status === "appealing" ? "车主申请正在复核" : "车主申请审核中"}
        description="当前无需重复提交，可以随时查看最新进度"
        value={review.status === "appealing" ? "复核中" : "审核中"}
        tone="driver"
        onPress={() => navigate(ownerEntryScreen(review.status))}
      />
    );
  }
  if (review.status === "needs_material") {
    return (
      <AppV2NavigationRow
        icon="car"
        title="车主申请需要补充资料"
        description="完成当前缺少的信息后，审核会继续进行"
        value="待补充"
        tone="driver"
        onPress={() => navigate("review-needs-material")}
      />
    );
  }
  if (review.status === "suspended" || review.status === "revoked" || review.status === "expired") {
    return (
      <AppV2NavigationRow
        icon="car"
        title="车主申请暂不可继续"
        description="查看原因和当前可以采取的下一步"
        value="查看状态"
        tone="driver"
        onPress={() => navigate("vehicle-settings")}
      />
    );
  }
  if (applicationStarted) {
    return (
      <AppV2NavigationRow
        icon="car"
        title="继续申请成为车主"
        description="完成车辆资料并提交后进入审核"
        tone="driver"
        onPress={() => navigate("owner-apply-intro")}
      />
    );
  }
  return (
    <PrimaryButton
      label="申请成为车主"
      variant="owner"
      onPress={() => navigate("owner-apply-intro")}
    />
  );
}

function AccountIdentityAction({
  title,
  description,
  actionLabel,
  loading,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel: string;
  loading: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${actionLabel}`}
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 92,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        borderRadius: theme.radius.large,
        padding: theme.spacing.lg,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.deepSurface,
        opacity: loading ? 0.68 : 1,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.pill,
          backgroundColor: `${theme.colors.owner}40`,
        }}
      >
        <AppIcon name="car" size={24} color={theme.colors.onDeepSurface} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText weight="bold" style={{ color: theme.colors.onDeepSurface }}>
          {title}
        </AppText>
        <AppText size="small" style={{ color: theme.colors.onDeepSurface }}>
          {description}
        </AppText>
        <AppText size="caption" weight="bold" style={{ color: theme.colors.onDeepSurface }}>
          {loading ? "切换中…" : actionLabel}
        </AppText>
      </View>
      <AppIcon name="chevron-right" size={18} color={theme.colors.onDeepSurface} />
    </Pressable>
  );
}

function AccountMenuGroup({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.large,
        backgroundColor: theme.colors.surface,
      }}
    >
      {children}
    </View>
  );
}

function AccountMenuRow({
  icon,
  title,
  description,
  value,
  onPress,
  tone = "passenger",
}: {
  icon: AppIconName;
  title: string;
  description: string;
  value?: string;
  onPress: () => void;
  tone?: "passenger" | "owner";
}) {
  const { theme } = useAppTheme();
  const color = tone === "owner" ? theme.colors.owner : theme.colors.passenger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，${description}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: theme.radius.medium,
          backgroundColor: `${color}14`,
        }}
      >
        <AppIcon name={icon} size={20} color={color} />
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        <AppText weight="medium">{title}</AppText>
        <AppText size="small" tone="secondary">{description}</AppText>
      </View>
      {value ? <AppText size="small" weight="bold">{value}</AppText> : null}
      <AppIcon name="chevron-right" size={17} />
    </Pressable>
  );
}

function ownerEntryScreen(status: VehicleReviewView["status"]): AppScreen {
  if (status === "approved") return "review-approved";
  if (status === "under_review") return "review-pending";
  if (status === "needs_material") return "review-needs-material";
  return "owner-apply-intro";
}

const accountTrialStateLabels = {
  invited: "邀请可用",
  under_review: "审核中",
  awaiting_confirmation: "待确认",
  active: "已启用",
  rejected: "未通过",
  expired: "已到期",
} as const;

const freeFlexTrialStateLabels = {
  invited: "合成邀请可用",
  under_review: "内部审核中",
  awaiting_confirmation: "待本人确认",
  active: "合成资格已启用",
  rejected: "未通过",
  expired: "已到期",
} as const;

const syntheticTripStateLabels = {
  pending_payment: "待零金额支付",
  paid_pending_match: "已支付待匹配",
  scheduled: "预约待接单",
  reserved: "预约已接受",
  preparing: "准备履约",
  accepted: "车主已接受",
  driver_en_route: "车主接驾中",
  driver_arrived: "车主已到达",
  in_progress: "履约中",
  safety_frozen: "安全冻结中",
  completed: "已完成",
  unfulfilled: "预约未履约",
  cancelled: "已取消",
} as const;

const syntheticTripClosureLabels = {
  passenger_cancelled: "乘客已取消",
  driver_cancelled: "车主已取消",
  payment_timeout: "支付前置超时",
  matching_timeout: "匹配等待超时",
} as const;

function passengerTripScreenName(state: keyof typeof syntheticTripStateLabels): AppScreen {
  if (state === "pending_payment") return "trip-payment";
  if (state === "paid_pending_match" || state === "scheduled") return "trip-matching";
  if (
    state === "reserved" ||
    state === "preparing" ||
    state === "accepted" ||
    state === "driver_en_route" ||
    state === "driver_arrived" ||
    state === "in_progress" ||
    state === "safety_frozen"
  ) return "trip-active";
  return "trip-result";
}

function SandboxTools({
  actionLabel,
  loading,
  onRun,
}: {
  actionLabel: string;
  loading: boolean;
  onRun: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <SectionCard>
      <Pressable accessibilityRole="button" onPress={() => setOpen((current) => !current)}>
        <AppText weight="bold">内部沙箱工具 {open ? "⌃" : "⌄"}</AppText>
        <AppText size="small" tone="secondary">仅用于合成时钟和异常边界验证。</AppText>
      </Pressable>
      {open ? <PrimaryButton label={actionLabel} variant="secondary" loading={loading} onPress={onRun} /> : null}
    </SectionCard>
  );
}

function parseDateForPicker(value: string): Date {
  const normalized = normalizeInsuranceDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return new Date();
  const [year = 0, month = 0, day = 0] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateForInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const screenTitles = Object.freeze({
  "adult-eligibility": "我的实名",
  "adult-eligibility-appeal": "人工复核",
  "ride-home": "叫车首页",
  "ride-search": "选择目的地",
  "ride-confirmation": "确认行程",
  "ride-matching": "等待接单",
  "ride-pickup": "车主接驾",
  "ride-cancellation": "取消行程",
  "ride-active": "行程进行中",
  "ride-completion": "行程完成",
  "ride-history": "我的行程",
  "ride-detail": "行程详情",
  "driver-home": "车主首页",
  "driver-orders": "附近订单",
  "driver-pickup": "前往上车点",
  "driver-waiting-pickup": "等待上车",
  "driver-active": "车主履约",
  "driver-completion": "订单完成",
  "driver-history": "我的订单",
  "driver-order-detail": "订单详情",
  "driver-wallet": "资金中心",
  "driver-bank-card": "银行卡",
  "driver-withdraw": "提现",
  "trip-chat": "行程联系",
  "message-center": "消息",
  "passenger-workbench": "乘客工作台",
  "owner-apply-intro": "申请车主身份",
  "owner-profile": "车主资料",
  "vehicle-form": "车辆资料",
  "submission-review": "提交确认",
  "review-pending": "车辆审核",
  "review-needs-material": "补充材料",
  "review-approved": "审核结果",
  "owner-workbench": "车主工作台",
  account: "我的",
  "account-profile": "账户资料",
  "account-login": "账户与登录",
  "legal-information": "协议与隐私",
  "service-agreement": "服务协议",
  "privacy-policy": "隐私政策",
  "phone-auth-notice": "手机号认证说明",
  "identity-settings": "身份切换",
  "vehicle-settings": "车辆",
  "eligibility-settings": "资格",
  "quota-settings": "配额",
  "theme-settings": "主题",
  "privacy-safety-settings": "隐私与安全",
  notifications: "服务通知",
  "notification-detail": "通知详情",
  "notification-settings": "通知设置",
  "help-feedback": "帮助与反馈",
  "trip-create": "创建行程",
  "trip-payment": "支付前置",
  "trip-matching": "匹配等待",
  "trip-active": "当前行程",
  "trip-result": "行程结果",
  "trip-recovery": "异常恢复",
  "driver-offers": "待接行程",
  "driver-trip": "车主履约",
  "safety-chat": "安全联系记录",
  "safety-report": "安全举报",
  "safety-frozen": "安全冻结",
  "safety-appeal": "安全申诉",
  "safety-result": "处理结果",
} satisfies Record<AppScreen, string>);
