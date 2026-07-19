import type { VehicleReviewView } from "@pollycar/contracts";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { HttpVehicleReviewClient } from "../infrastructure/http-vehicle-review-client";
import { resolveApiBaseUrl } from "../infrastructure/api-base-url";
import { executeWriteWithReconciliation } from "./unknown-result-recovery";
import { useAdultEligibility } from "./adult-eligibility-context";

type VehicleReviewContextValue = {
  review: VehicleReviewView;
  saveDraft: (input: {
    vehicleType: string;
    maxPassengerCount: 1 | 2 | 3;
    insuranceExpiresOn: string;
    syntheticAttachmentId: string;
  }) => Promise<void>;
  submit: () => Promise<void>;
  refresh: () => Promise<VehicleReviewView>;
  resubmit: (input: { insuranceExpiresOn: string; syntheticAttachmentId: string }) => Promise<void>;
};

const VehicleReviewContext = createContext<VehicleReviewContextValue | undefined>(undefined);

export function VehicleReviewProvider({ children }: PropsWithChildren) {
  const { verification } = useAdultEligibility();
  const [client] = useState(
    () =>
      new HttpVehicleReviewClient(resolveApiBaseUrl()),
  );
  const [review, setReview] = useState<VehicleReviewView>(initialReview);
  const businessAccessAllowed = verification?.businessAccessAllowed === true;
  const refresh = useCallback(async () => {
    if (!businessAccessAllowed) {
      setReview(initialReview);
      return initialReview;
    }
    const next = await client.get("vehicle-application-7", "synthetic-account-7");
    setReview(next);
    return next;
  }, [businessAccessAllowed, client]);
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);
  const value = useMemo<VehicleReviewContextValue>(
    () => ({
      review,
      saveDraft: async (input) => {
        await executeWriteWithReconciliation(
          async () => setReview(await client.saveDraft({
            accountId: review.accountId,
            applicationId: review.applicationId,
            expectedVersion: review.version,
            idempotencyKey: `vehicle-draft-${review.version + 1}`,
            ...input,
          })),
          refresh,
        );
      },
      submit: async () => {
        await executeWriteWithReconciliation(
          async () => setReview(await client.submit({
            accountId: review.accountId,
            applicationId: review.applicationId,
            expectedVersion: review.version,
            idempotencyKey: `vehicle-submit-${review.version + 1}`,
          })),
          refresh,
        );
      },
      refresh,
      resubmit: async (input) => {
        await executeWriteWithReconciliation(
          async () => setReview(await client.resubmitMaterial({
            accountId: review.accountId,
            applicationId: review.applicationId,
            expectedVersion: review.version,
            idempotencyKey: `vehicle-resubmit-${review.version + 1}`,
            ...input,
          })),
          refresh,
        );
      },
    }),
    [client, refresh, review],
  );

  return <VehicleReviewContext.Provider value={value}>{children}</VehicleReviewContext.Provider>;
}

const initialReview: VehicleReviewView = {
  applicationId: "vehicle-application-7",
  accountId: "synthetic-account-7",
  status: "draft",
  version: 0,
  ownerIdentityAvailable: false,
  maxPassengerCount: 1,
  requestedMaterialCodes: [],
  timeline: [],
  synthetic: true,
};

export function useVehicleReview() {
  const context = useContext(VehicleReviewContext);
  if (!context) throw new Error("useVehicleReview 必须在 VehicleReviewProvider 内使用");
  return context;
}
