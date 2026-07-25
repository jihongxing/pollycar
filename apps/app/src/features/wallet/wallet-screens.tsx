import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppIcon } from "../../components/app-icon";
import { AuxiliaryInlineFeedback } from "../../components/auxiliary-page";
import {
  AppV2BalanceHero,
  AppV2EmptyState,
  AppV2MetricStrip,
  AppV2NavigationRow,
  AppV2StageHeader,
  AppV2SummaryList,
} from "../../components/app-v2-components";
import { MobilityPage } from "../../components/mobility";
import { AppText, PrimaryButton } from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";
import {
  emptyBankCardDraft,
  formatMoney,
  validateSyntheticBankCardDraft,
  validateWithdrawDraft,
  type BankCardDraft,
  type DriverWalletView,
  type WithdrawDraft,
} from "./wallet-model";

type Navigate = (route: string) => void;

export function DriverWalletScreen({
  wallet,
  navigate,
}: {
  wallet: DriverWalletView;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  return (
    <MobilityPage
      title="资金中心"
      tone="driver"
      accessibilityLabel="车主资金中心"
      onBack={() => navigate("driver-home")}
      hero={
        <AppV2BalanceHero
          label="可提现余额"
          amount={formatMoney(wallet.withdrawableBalance)}
          description="真实结算与提现尚未开放"
          action={{
            label: "提现",
            disabled: true,
            onPress: () => navigate("driver-withdraw"),
          }}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="车主 · 费用记录"
        title="资金中心"
        description="核对行程费用、待结算记录和银行卡入口。"
        tone="driver"
      />
      <AppV2MetricStrip
        tone="driver"
        items={[
          {
            label: "待结算",
            value: formatMoney(wallet.pendingSettlement),
            icon: "clock",
          },
          {
            label: "累计费用记录",
            value: formatMoney(wallet.lifetimeIncome),
            icon: "wallet",
          },
        ]}
      />
      <AppV2NavigationRow
        tone="driver"
        icon="bank-card"
        title="银行卡"
        description="查看已保存的卡片与绑定说明"
        value={wallet.cards.length > 0 ? `${wallet.cards.length} 张` : "未绑定"}
        onPress={() => navigate("driver-bank-card")}
      />
      <AppV2NavigationRow
        tone="driver"
        icon="orders"
        title="我的订单"
        description="查看费用对应的行程记录"
        onPress={() => navigate("driver-history")}
      />
      <View style={styles.moneySection}>
        <View style={styles.sectionHeading}>
          <AppText size="title2" weight="bold">最近明细</AppText>
          <AppText size="caption" tone="secondary">按记录时间排序</AppText>
        </View>
        {wallet.entries.length === 0 ? (
          <AppV2EmptyState
            icon="wallet"
            title="暂无费用明细"
            description="完成行程后，相关费用记录会显示在这里。"
            tone="driver"
          />
        ) : (
          wallet.entries.map((entry) => (
            <View
              key={entry.id}
              style={[styles.moneyEntry, { borderTopColor: theme.colors.border }]}
            >
              <View style={styles.flex}>
                <AppText weight="medium">{entry.title}</AppText>
                <AppText tone="secondary" size="small">
                  {formatWalletDate(entry.occurredAt)}
                </AppText>
              </View>
              <AppText weight="bold" tone={entry.direction === "credit" ? "owner" : "primary"}>
                {entry.direction === "credit" ? "+" : "-"}
                {formatMoney(entry.amount)}
              </AppText>
            </View>
          ))
        )}
      </View>
    </MobilityPage>
  );
}

export function DriverBankCardScreen({
  wallet,
  navigate,
}: {
  wallet: DriverWalletView;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState<BankCardDraft>(emptyBankCardDraft);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [bindingAttempted, setBindingAttempted] = useState(false);
  const updateDraft = (next: BankCardDraft) => {
    setDraft(next);
    setBindingAttempted(false);
  };
  const formDraft = { ...draft, agreementAccepted };
  const errors = validateSyntheticBankCardDraft(formDraft);
  const valid = Object.values(errors).every((message) => message === undefined);

  return (
    <MobilityPage
      title="绑定银行卡"
      tone="driver"
      accessibilityLabel="绑定银行卡"
      onBack={() => navigate("driver-wallet")}
      actions={
        <PrimaryButton
          label="确认绑定"
          variant="owner"
          disabled={!valid}
          onPress={() => setBindingAttempted(true)}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="银行卡 · 信息确认"
        title="绑定银行卡"
        description="银行卡能力开放后，将使用本人银行卡完成费用结算。"
        tone="driver"
      />
      <AuxiliaryInlineFeedback
        icon="privacy"
        title="请勿填写真实银行卡资料"
        description="请勿输入真实姓名、银行卡号或手机号；当前提交不会绑定银行卡。"
        tone="neutral"
      />
      {wallet.cards.map((card) => (
        <View
          key={card.id}
          style={[styles.savedCard, { backgroundColor: theme.colors.deepSurface }]}
        >
          <View style={styles.cardHeading}>
            <AppIcon name="bank-card" color={theme.colors.inverseText} />
            <AppText size="title2" weight="bold" tone="inverse">{card.bankName}</AppText>
          </View>
          <AppText size="title1" weight="bold" tone="inverse" style={styles.cardNumber}>
            •••• {card.lastFour}
          </AppText>
          <AppText size="small" tone="inverse">{card.holderNameMasked}</AppText>
        </View>
      ))}
      <View
        style={[
          styles.formCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={styles.sectionHeading}>
          <AppText size="title2" weight="bold">银行卡信息</AppText>
          <AppText size="caption" tone="secondary">请仅使用页面示例信息</AppText>
        </View>
        <ClosedInput
          label="持卡人"
          value={draft.holderName}
          placeholder="请输入示例姓名"
          error={draft.holderName.length > 0 ? errors.holderName : undefined}
          onChangeText={(holderName) => updateDraft({ ...draft, holderName })}
        />
        <ClosedInput
          label="银行卡号"
          value={draft.cardNumber}
          placeholder="请输入 16–19 位示例卡号"
          keyboardType="number-pad"
          error={draft.cardNumber.length > 0 ? errors.cardNumber : undefined}
          onChangeText={(cardNumber) => updateDraft({ ...draft, cardNumber })}
        />
        <ClosedInput
          label="开户行"
          value={draft.bankName}
          placeholder="请输入示例银行名称"
          error={draft.bankName.length > 0 ? errors.bankName : undefined}
          onChangeText={(bankName) => updateDraft({ ...draft, bankName })}
        />
        <ClosedInput
          label="预留手机号"
          value={draft.reservedPhone}
          placeholder="请输入示例手机号"
          keyboardType="phone-pad"
          error={draft.reservedPhone.length > 0 ? errors.reservedPhone : undefined}
          onChangeText={(reservedPhone) => updateDraft({ ...draft, reservedPhone })}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreementAccepted }}
          accessibilityLabel="同意银行卡服务协议与隐私说明"
          onPress={() => {
            setAgreementAccepted((current) => !current);
            setBindingAttempted(false);
          }}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: theme.colors.border,
                backgroundColor: agreementAccepted
                  ? theme.colors.owner
                  : theme.colors.surface,
              },
            ]}
          >
            {agreementAccepted ? <AppText tone="inverse">✓</AppText> : null}
          </View>
          <AppText style={styles.flex}>我已阅读并同意银行卡服务协议与隐私说明</AppText>
        </Pressable>
        {bindingAttempted ? (
          <AuxiliaryInlineFeedback
            title="暂时无法绑定"
            description="银行卡能力尚未开放，本次信息不会被提交。"
            tone="danger"
            icon="bank-card"
          />
        ) : null}
      </View>
    </MobilityPage>
  );
}

export function DriverWithdrawScreen({
  wallet,
  navigate,
}: {
  wallet: DriverWalletView;
  navigate: Navigate;
}) {
  const { theme } = useAppTheme();
  const [draft, setDraft] = useState<WithdrawDraft>({ amountCents: 0 });
  const error = validateWithdrawDraft(draft, wallet);

  return (
    <MobilityPage
      title="提现"
      tone="driver"
      accessibilityLabel="车主提现确认"
      onBack={() => navigate("driver-wallet")}
      hero={
        <AppV2BalanceHero
          label="可提现余额"
          amount={formatMoney(wallet.withdrawableBalance)}
          description="真实提现尚未开放"
        />
      }
      actions={
        <PrimaryButton
          label="确认提现"
          variant="owner"
          disabled={!wallet.realWithdrawalsEnabled || Boolean(error)}
          onPress={() => undefined}
        />
      }
    >
      <AppV2StageHeader
        eyebrow="提现 · 金额确认"
        title="确认提现信息"
        description="核对金额、到账银行卡和费用后再提交。"
        tone="driver"
      />
      <View
        style={[
          styles.formCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <AppText size="title2" weight="bold">提现金额</AppText>
        <ClosedInput
          label="金额"
          value={draft.amountCents === 0 ? "" : String(draft.amountCents / 100)}
          placeholder="0.00"
          keyboardType="decimal-pad"
          onChangeText={(value) => {
            const parsed = Number(value);
            setDraft({
              ...draft,
              amountCents: Number.isFinite(parsed) ? Math.round(parsed * 100) : 0,
            });
          }}
        />
        <PrimaryButton
          label={`全部提现 ${formatMoney(wallet.withdrawableBalance)}`}
          variant="text"
          disabled={wallet.withdrawableBalance.amountCents === 0}
          onPress={() =>
            setDraft({ ...draft, amountCents: wallet.withdrawableBalance.amountCents })
          }
        />
      </View>
      <View
        style={[
          styles.formCard,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        <AppText size="title2" weight="bold">到账银行卡</AppText>
        {wallet.cards.length === 0 ? (
          <AppV2EmptyState
            icon="bank-card"
            title="暂无银行卡"
            description="银行卡能力开放后，可在这里选择到账卡片。"
            action={{ label: "查看银行卡说明", onPress: () => navigate("driver-bank-card") }}
            tone="driver"
          />
        ) : (
          wallet.cards.map((card) => (
            <Pressable
              key={card.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.cardId === card.id }}
              onPress={() => setDraft({ ...draft, cardId: card.id })}
              style={[
                styles.selectableCard,
                {
                  borderColor:
                    draft.cardId === card.id ? theme.colors.owner : theme.colors.border,
                  backgroundColor:
                    draft.cardId === card.id ? `${theme.colors.owner}0D` : theme.colors.surface,
                },
              ]}
            >
              <View style={styles.cardHeading}>
                <AppIcon name="bank-card" />
                <View>
                  <AppText weight="medium">{card.bankName}</AppText>
                  <AppText tone="secondary">**** {card.lastFour}</AppText>
                </View>
              </View>
              <AppText tone={draft.cardId === card.id ? "owner" : "secondary"} weight="bold">
                {draft.cardId === card.id ? "已选择" : "选择"}
              </AppText>
            </Pressable>
          ))
        )}
      </View>
      <AppV2SummaryList
        items={[
          { label: "手续费", value: "¥0.00" },
          { label: "预计到账", value: "能力开放后显示" },
        ]}
      />
    </MobilityPage>
  );
}

function ClosedInput({
  label,
  value,
  placeholder,
  error,
  keyboardType,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  keyboardType?: "default" | "number-pad" | "phone-pad" | "decimal-pad";
  onChangeText: (value: string) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.field}>
      <AppText weight="medium">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      />
      {error ? <AppText tone="danger" size="small">{error}</AppText> : null}
    </View>
  );
}

function formatWalletDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  moneySection: { gap: 12 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  moneyEntry: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  savedCard: {
    minHeight: 156,
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 20,
    padding: 20,
  },
  cardNumber: { letterSpacing: 2 },
  formCard: {
    gap: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
  },
  selectableCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  field: {
    gap: 6,
    marginBottom: 14,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 6,
  },
});
