import type { PassengerCount } from "./passenger-capacity.js";
import type { TripPlace } from "./trip-place.js";

export type DriverOrderState = "available" | "accepted" | "in_progress" | "completed" | "cancelled";

export type DriverOrderSummary = Readonly<{
  orderId: string;
  tripId: string;
  state: DriverOrderState;
  origin: TripPlace;
  destination: TripPlace;
  passengerCount: PassengerCount;
  amountMinor: 0;
  currency: "CNY";
  occurredAt: string;
  synthetic: true;
}>;

export type DriverOrderDetail = DriverOrderSummary &
  Readonly<{
    timeline: readonly Readonly<{
      event: "created" | "accepted" | "started" | "completed" | "cancelled";
      occurredAt: string;
    }>[];
    realOrderEnabled: false;
    realSettlementEnabled: false;
  }>;

export type SyntheticBankCard = Readonly<{
  cardId: string;
  holderNameMasked: string;
  bankName: string;
  cardNumberMasked: string;
  reservedMobileMasked: string;
  state: "synthetic_verified" | "synthetic_failed";
  realBankCardBindingEnabled: false;
  synthetic: true;
}>;

export type DriverWalletEntry = Readonly<{
  entryId: string;
  orderId?: string;
  type: "synthetic_income" | "synthetic_settlement" | "synthetic_withdrawal";
  amountMinor: number;
  currency: "CNY";
  occurredAt: string;
  synthetic: true;
}>;

export type SyntheticWithdrawal = Readonly<{
  withdrawalId: string;
  amountMinor: number;
  feeMinor: 0;
  currency: "CNY";
  bankCardId: string;
  state: "synthetic_pending" | "synthetic_succeeded" | "synthetic_failed" | "unknown";
  requestedAt: string;
  completedAt?: string;
  realWithdrawalEnabled: false;
  synthetic: true;
}>;

export type DriverWalletView = Readonly<{
  withdrawableAmountMinor: number;
  pendingSettlementAmountMinor: number;
  totalIncomeAmountMinor: number;
  currency: "CNY";
  bankCards: readonly SyntheticBankCard[];
  entries: readonly DriverWalletEntry[];
  withdrawals: readonly SyntheticWithdrawal[];
  realPaymentEnabled: false;
  realSettlementEnabled: false;
  realBankCardBindingEnabled: false;
  realWithdrawalEnabled: false;
  synthetic: true;
}>;

export type BindSyntheticBankCardCommand = Readonly<{
  holderName: string;
  bankName: string;
  cardNumber: string;
  reservedMobile: string;
  agreementAccepted: true;
}>;

export type RequestSyntheticWithdrawalCommand = Readonly<{
  amountMinor: number;
  bankCardId: string;
  idempotencyKey: string;
}>;

export interface DriverCommerceClient {
  listOrders(state?: DriverOrderState): Promise<readonly DriverOrderSummary[]>;
  getOrder(orderId: string): Promise<DriverOrderDetail>;
  getWallet(): Promise<DriverWalletView>;
  bindSyntheticBankCard(command: BindSyntheticBankCardCommand): Promise<SyntheticBankCard>;
  requestSyntheticWithdrawal(command: RequestSyntheticWithdrawalCommand): Promise<SyntheticWithdrawal>;
}
