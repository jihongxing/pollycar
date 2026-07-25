import { router } from "expo-router";

import { LegalInformationScreen } from "@/features/account/legal-information-screen";
import { routeForScreen } from "@/navigation/routes";

export default function LegalInformationRoute() {
  return (
    <LegalInformationScreen
      navigate={(screen) => router.push(routeForScreen(screen))}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace("/");
      }}
    />
  );
}
