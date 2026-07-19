export type TripRatingTag =
  | "safe_driving"
  | "clean_vehicle"
  | "polite"
  | "easy_pickup"
  | "good_communication"
  | "other";

export type TripRatingView = Readonly<{
  ratingId: string;
  tripId: string;
  raterAccountId: string;
  subjectAccountId: string;
  score: 1 | 2 | 3 | 4 | 5;
  tags: readonly TripRatingTag[];
  note?: string;
  createdAt: string;
  synthetic: true;
}>;

export type SubmitTripRatingCommand = Readonly<{
  tripId: string;
  score: 1 | 2 | 3 | 4 | 5;
  tags?: readonly TripRatingTag[];
  note?: string;
  idempotencyKey: string;
}>;

export interface TripRatingClient {
  getForTrip(tripId: string): Promise<TripRatingView | undefined>;
  submit(command: SubmitTripRatingCommand): Promise<TripRatingView>;
}
