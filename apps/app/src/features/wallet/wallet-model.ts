export type SyntheticMoney = Readonly<{
  currency: "CNY";
  amountCents: number;
}>;

export type SyntheticBankCard = Readonly<{
  id: string;
  bankName: string;
  lastFour: string;
  holderNameMasked: string;
  status: "synthetic_only" | "disabled";
}>;

export type SyntheticWalletEntry = Readonly<{
  id: string;
  occurredAt: string;
  title: string;
  amount: SyntheticMoney;
  direction: "credit" | "debit";
  relatedOrderId?: string;
  status: "synthetic" | "disabled";
}>;

export type DriverWalletView = Readonly<{
  productionEnabled: false;
  realPaymentsEnabled: false;
  realWithdrawalsEnabled: false;
  withdrawableBalance: SyntheticMoney;
  pendingSettlement: SyntheticMoney;
  lifetimeIncome: SyntheticMoney;
  cards: readonly SyntheticBankCard[];
  entries: readonly SyntheticWalletEntry[];
}>;

export type BankCardDraft = Readonly<{
  holderName: string;
  cardNumber: string;
  bankName: string;
  reservedPhone: string;
  agreementAccepted: boolean;
}>;

export type WithdrawDraft = Readonly<{
  amountCents: number;
  cardId?: string;
}>;

export type ClosedMoneyAction = Readonly<{
  allowed: false;
  code: "REAL_MONEY_DISABLED";
  message: string;
}>;

export const emptyBankCardDraft: BankCardDraft = {
  holderName: "",
  cardNumber: "",
  bankName: "",
  reservedPhone: "",
  agreementAccepted: false,
};

export function formatMoney(money: SyntheticMoney): string {
  return `¥${(money.amountCents / 100).toFixed(2)}`;
}

export function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function validateSyntheticBankCardDraft(
  draft: BankCardDraft,
): Readonly<Record<keyof BankCardDraft, string | undefined>> {
  return {
    holderName: draft.holderName.trim() ? undefined : "请输入持卡人姓名",
    cardNumber: /^\d{16,19}$/.test(draft.cardNumber)
      ? undefined
      : "请输入 16–19 位银行卡号",
    bankName: draft.bankName.trim() ? undefined : "请输入开户行",
    reservedPhone: /^1\d{10}$/.test(draft.reservedPhone)
      ? undefined
      : "请输入 11 位手机号",
    agreementAccepted: draft.agreementAccepted ? undefined : "请确认已阅读相关说明",
  };
}

export function isSyntheticBankCardDraftValid(draft: BankCardDraft): boolean {
  return Object.values(validateSyntheticBankCardDraft(draft)).every(
    (message) => message === undefined,
  );
}

export function validateWithdrawDraft(
  draft: WithdrawDraft,
  wallet: DriverWalletView,
): string | undefined {
  if (draft.amountCents <= 0) return "请输入提现金额";
  if (draft.amountCents > wallet.withdrawableBalance.amountCents) {
    return "提现金额不能超过可提现余额";
  }
  if (!draft.cardId) return "请选择到账银行卡";
  if (!wallet.cards.some((card) => card.id === draft.cardId)) return "到账银行卡不可用";
  return undefined;
}

export function requestClosedMoneyAction(): ClosedMoneyAction {
  return {
    allowed: false,
    code: "REAL_MONEY_DISABLED",
    message: "真实绑卡、结算和提现尚未获得批准。",
  };
}
