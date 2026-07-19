import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { presentAppError } from "./error-messages";
import { createActionLock } from "./action-lock";

export type AsyncActionState = "idle" | "running" | "succeeded" | "failed" | "unknown";

type ToastMessage = Readonly<{
  id: number;
  tone: "success" | "warning";
  title: string;
  message: string;
}>;

type ConfirmationRequest = Readonly<{
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  resolve(value: boolean): void;
}>;

type InteractionContextValue = Readonly<{
  actions: Readonly<Record<string, AsyncActionState>>;
  toast?: ToastMessage;
  confirmation?: ConfirmationRequest;
  runAction(
    key: string,
    action: () => Promise<void>,
    options?: Readonly<{ successTitle?: string; successMessage?: string }>,
  ): Promise<boolean>;
  confirm(options: Readonly<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
  }>): Promise<boolean>;
  dismissToast(): void;
  answerConfirmation(value: boolean): void;
}>;

const InteractionContext = createContext<InteractionContextValue | undefined>(undefined);

export function InteractionProvider({ children }: PropsWithChildren) {
  const [actions, setActions] = useState<Readonly<Record<string, AsyncActionState>>>({});
  const [toast, setToast] = useState<ToastMessage>();
  const [confirmation, setConfirmation] = useState<ConfirmationRequest>();
  const actionLock = useRef(createActionLock()).current;

  const runAction = useCallback<InteractionContextValue["runAction"]>(
    async (key, action, options) => {
      if (actionLock.isRunning(key)) return false;
      setActions((current) => ({ ...current, [key]: "running" }));
      try {
        await actionLock.run(key, action);
        setActions((current) => ({ ...current, [key]: "succeeded" }));
        if (options?.successTitle) {
          setToast({
            id: Date.now(),
            tone: "success",
            title: options.successTitle,
            message: options.successMessage ?? "最新状态已经同步。",
          });
        }
        return true;
      } catch (error) {
        const presentation = presentAppError(error);
        setActions((current) => ({
          ...current,
          [key]: error instanceof Error && error.message === "UNKNOWN_RESULT" ? "unknown" : "failed",
        }));
        setToast({
          id: Date.now(),
          tone: "warning",
          title: presentation.title,
          message: presentation.message,
        });
        return false;
      }
    },
    [actionLock],
  );

  const confirm = useCallback<InteractionContextValue["confirm"]>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setConfirmation({
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel,
          destructive: options.destructive ?? false,
          resolve,
        });
      }),
    [],
  );

  const answerConfirmation = useCallback((value: boolean) => {
    setConfirmation((current) => {
      current?.resolve(value);
      return undefined;
    });
  }, []);

  const value = useMemo<InteractionContextValue>(
    () => ({
      actions,
      ...(toast ? { toast } : {}),
      ...(confirmation ? { confirmation } : {}),
      runAction,
      confirm,
      dismissToast: () => setToast(undefined),
      answerConfirmation,
    }),
    [actions, answerConfirmation, confirm, confirmation, runAction, toast],
  );

  return <InteractionContext.Provider value={value}>{children}</InteractionContext.Provider>;
}

export function useInteraction() {
  const value = useContext(InteractionContext);
  if (!value) throw new Error("InteractionProvider 缺失");
  return value;
}
