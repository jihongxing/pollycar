import type {
  AvailableDriverTripView,
  DriverWalletView,
  SyntheticTripClient,
  SyntheticTripState,
  TripCancellationEligibility,
  TripPartyPublicProfile,
  TripPlace,
} from "./index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Expect<Value extends true> = Value;

type ExpectedVerifiedLegalGender = "female" | "male";

type VerifiedLegalGenderAssertion = Expect<
  Equal<TripPartyPublicProfile["gender"], ExpectedVerifiedLegalGender>
>;

type ServerAuthorityAssertion = Expect<
  Equal<TripCancellationEligibility["determinedByServer"], true>
>;

type OptionalCancellationReasonAssertion = Expect<
  Equal<TripCancellationEligibility["reasonRequired"], boolean>
>;

type OptionalCancellationNoteAssertion = Expect<
  Equal<TripCancellationEligibility["noteRequired"], false>
>;

type RealWithdrawalClosedAssertion = Expect<
  Equal<DriverWalletView["realWithdrawalEnabled"], false>
>;

type StructuredTripCreationAssertion = Expect<
  Equal<
    Parameters<SyntheticTripClient["create"]>[0],
    string | TripPlace
  >
>;

type DriverEnRouteStateAssertion = Expect<
  Equal<Extract<SyntheticTripState, "driver_en_route">, "driver_en_route">
>;

type DriverArrivedStateAssertion = Expect<
  Equal<Extract<SyntheticTripState, "driver_arrived">, "driver_arrived">
>;

type AvailableTripPassengerAssertion = Expect<
  Equal<AvailableDriverTripView["passengerProfile"], TripPartyPublicProfile>
>;

export type ContractTypeAssertions =
  | VerifiedLegalGenderAssertion
  | ServerAuthorityAssertion
  | OptionalCancellationReasonAssertion
  | OptionalCancellationNoteAssertion
  | RealWithdrawalClosedAssertion
  | StructuredTripCreationAssertion
  | DriverEnRouteStateAssertion
  | DriverArrivedStateAssertion
  | AvailableTripPassengerAssertion;
