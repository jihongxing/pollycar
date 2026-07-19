import { router, type Href, useNavigation, usePathname } from "expo-router";
import { useEffect, useRef } from "react";

export function useUnsavedChangesGuard(
  enabled: boolean,
  confirmLeave: () => Promise<boolean>,
) {
  const navigation = useNavigation();
  const pathname = usePathname();
  const allowNextNavigation = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!enabled || allowNextNavigation.current) return;
      event.preventDefault();
      void confirmLeave().then((confirmed) => {
        if (!confirmed) {
          router.push(pathname as Href);
          return;
        }
        allowNextNavigation.current = true;
        navigation.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [confirmLeave, enabled, navigation, pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [enabled]);

  return () => {
    allowNextNavigation.current = true;
  };
}
