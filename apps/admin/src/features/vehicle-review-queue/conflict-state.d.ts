export declare function ConflictState({ code, onBack, onRecover }: Readonly<{
    code: string;
    onBack(): void;
    onRecover?: (() => void | Promise<void>) | undefined;
}>): import("react").JSX.Element;
