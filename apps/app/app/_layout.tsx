import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { type PropsWithChildren, useState } from "react";

import { IdentityProvider } from "@/identity/identity-context";
import { ThemeProvider } from "@/theme/theme-context";
import { VehicleReviewProvider } from "@/application/vehicle-review-context";
import { FreeFlexTrialProvider } from "@/application/free-flex-trial-context";
import { SyntheticTripProvider } from "@/application/synthetic-trip-context";
import { SafetyCaseProvider } from "@/application/safety-case-context";
import { InteractionProvider } from "@/interaction/interaction-context";
import { InteractionOverlay } from "@/interaction/interaction-overlay";
import { AppRecoveryProvider } from "@/application/app-recovery-context";
import { AppRecoveryBanner } from "@/application/app-recovery-banner";
import { MobilityProvider } from "@/application/mobility-context";
import { CommunicationProvider } from "@/application/communication-context";
import { AdultEligibilityProvider } from "@/application/adult-eligibility-context";
import { TrustProfileProvider } from "@/application/trust-profile-context";
import { AccountSessionProvider } from "@/application/account-session-context";

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AccountSessionProvider>
        <IdentityProvider>
          <AdultEligibilityProvider>
          <InteractionProvider>
            <ApplicationProviders>
              <Stack screenOptions={{ headerShown: false, animation: "none" }} />
            </ApplicationProviders>
            <InteractionOverlay />
          </InteractionProvider>
          </AdultEligibilityProvider>
        </IdentityProvider>
        </AccountSessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ApplicationProviders({ children }: PropsWithChildren) {
  return (
    <VehicleReviewProvider>
      <FreeFlexTrialProvider>
        <SyntheticTripProvider>
          <TrustProfileProvider>
            <MobilityProvider>
              <CommunicationProvider>
                <SafetyCaseProvider>
                  <AppRecoveryProvider>
                    {children}
                    <AppRecoveryBanner />
                  </AppRecoveryProvider>
                </SafetyCaseProvider>
              </CommunicationProvider>
            </MobilityProvider>
          </TrustProfileProvider>
        </SyntheticTripProvider>
      </FreeFlexTrialProvider>
    </VehicleReviewProvider>
  );
}
