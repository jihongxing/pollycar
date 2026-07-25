import { router } from "expo-router";

import { LegalDocumentScreen } from "@/features/account/legal-information-screen";
import { routeForScreen } from "@/navigation/routes";

export default function ServiceAgreementRoute() {
  return (
    <LegalDocumentScreen
      document="service-agreement"
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        router.replace(routeForScreen("legal-information"));
      }}
    />
  );
}
