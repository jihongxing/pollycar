import { describe, expect, it } from "vitest";

import {
  isSyntheticBankCardDraftValid,
  maskCardNumber,
  requestClosedMoneyAction,
  validateSyntheticBankCardDraft,
  validateWithdrawDraft,
  type DriverWalletView,
} from "./wallet-model";

const wallet: DriverWalletView = {
  productionEnabled: false,
  realPaymentsEnabled: false,
  realWithdrawalsEnabled: false,
  withdrawableBalance: { currency: "CNY", amountCents: 5000 },
  pendingSettlement: { currency: "CNY", amountCents: 1000 },
  lifetimeIncome: { currency: "CNY", amountCents: 9000 },
  cards: [
    {
      id: "card-1",
      bankName: "沙箱银行",
      lastFour: "1234",
      holderNameMasked: "沙**",
      status: "synthetic_only",
    },
  ],
  entries: [],
};

describe("wallet model", () => {
  it("masks card numbers", () => {
    expect(maskCardNumber("6222 0000 0000 1234")).toBe("************1234");
  });

  it("validates synthetic card drafts without enabling binding", () => {
    const validDraft = {
      holderName: "沙箱用户",
      cardNumber: "6222000000001234",
      bankName: "沙箱银行",
      reservedPhone: "13800000000",
      agreementAccepted: true,
    };
    expect(validateSyntheticBankCardDraft(validDraft)).toEqual({
      holderName: undefined,
      cardNumber: undefined,
      bankName: undefined,
      reservedPhone: undefined,
      agreementAccepted: undefined,
    });
    expect(isSyntheticBankCardDraftValid(validDraft)).toBe(true);
    expect(requestClosedMoneyAction()).toEqual({
      allowed: false,
      code: "REAL_MONEY_DISABLED",
      message: "真实绑卡、结算和提现尚未获得批准。",
    });
  });

  it("rejects invalid card drafts", () => {
    expect(
      isSyntheticBankCardDraftValid({
        holderName: "",
        cardNumber: "123",
        bankName: "",
        reservedPhone: "1",
        agreementAccepted: false,
      }),
    ).toBe(false);
  });

  it("enforces balance and card selection before closed withdrawal", () => {
    expect(validateWithdrawDraft({ amountCents: 0 }, wallet)).toBe("请输入提现金额");
    expect(validateWithdrawDraft({ amountCents: 5001, cardId: "card-1" }, wallet)).toBe(
      "提现金额不能超过可提现余额",
    );
    expect(validateWithdrawDraft({ amountCents: 1000 }, wallet)).toBe("请选择到账银行卡");
    expect(validateWithdrawDraft({ amountCents: 1000, cardId: "missing" }, wallet)).toBe(
      "到账银行卡不可用",
    );
    expect(validateWithdrawDraft({ amountCents: 1000, cardId: "card-1" }, wallet)).toBeUndefined();
  });
});
