import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";

import { useAccountSession } from "../application/account-session-context";
import { AppText, PrimaryButton, SandboxIndicator, ThemeToggle } from "../components/ui";
import { resolveBrandDisplayEnvironment } from "./display-environment";
import { presentAppError } from "../interaction/error-messages";
import { routeForScreen } from "../navigation/routes";
import { useAppTheme } from "../theme/theme-context";

export function BrandLoginScreen() {
  const router = useRouter();
  const { authenticated, loading, requestPhoneCode, session, verifyPhoneCode } = useAccountSession();
  const { theme } = useAppTheme();
  const environment = resolveBrandDisplayEnvironment();
  const sandbox = environment === "sandbox";
  const [phoneNumber, setPhoneNumber] = useState(sandbox ? "18800000007" : "");
  const [code, setCode] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [challengeId, setChallengeId] = useState<string>();
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (authenticated && session) {
      router.replace(routeForScreen(session.businessAccessAllowed ? "ride-home" : "adult-eligibility"));
    }
  }, [authenticated, router, session]);
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  const sendCode = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const challenge = await requestPhoneCode(phoneNumber, consentAccepted);
      setChallengeId(challenge.challengeId);
      setResendAt(new Date(challenge.resendAvailableAt).getTime());
    } catch (caught) {
      setError(presentAppError(caught).message);
    } finally {
      setSubmitting(false);
    }
  };
  const verify = async () => {
    if (!challengeId) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await verifyPhoneCode(challengeId, code);
      router.replace(routeForScreen(result.account.nextStep === "adult_eligibility" ? "adult-eligibility" : "ride-home"));
    } catch (caught) {
      setError(presentAppError(caught).message);
    } finally {
      setSubmitting(false);
    }
  };
  const secondsRemaining = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return (
    <View style={{ flex: 1, paddingHorizontal: theme.spacing.xl, paddingTop: 56, paddingBottom: 32, backgroundColor: theme.colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: theme.spacing.xs }}>
        <ThemeToggle />
        <SandboxIndicator />
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xl }}>
        <Image source={require("../../assets/brand/rego-app-icon.png")} accessibilityLabel="REGO 品牌图标" style={{ width: 76, height: 76, borderRadius: 18 }} />
        <View style={{ gap: theme.spacing.sm }}>
          <AppText size="display" weight="bold" style={{ letterSpacing: -1.4 }}>REGO</AppText>
          <AppText size="title1" weight="bold">欢迎回来</AppText>
          <AppText tone="secondary">使用手机号登录。首次验证成功后将自动创建账户。</AppText>
        </View>
        <View style={{ gap: theme.spacing.md }}>
          <TextInput
            accessibilityLabel="手机号"
            keyboardType="phone-pad"
            maxLength={11}
            placeholder="请输入手机号"
            placeholderTextColor={theme.colors.textSecondary}
            value={phoneNumber}
            onChangeText={(value) => setPhoneNumber(value.replace(/\D/g, ""))}
            style={{ minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.small, paddingHorizontal: theme.spacing.md, color: theme.colors.text, backgroundColor: theme.colors.surface }}
          />
          {sandbox && !challengeId ? (
            <PrimaryButton
              variant="text"
              label="使用验收号码 18800000007"
              onPress={() => {
                setPhoneNumber("18800000007");
                setConsentAccepted(true);
                setError(undefined);
              }}
            />
          ) : null}
          {challengeId ? (
            <TextInput
              accessibilityLabel="六位验证码"
              keyboardType="number-pad"
              maxLength={6}
              placeholder="请输入 6 位验证码"
              placeholderTextColor={theme.colors.textSecondary}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
              style={{ minHeight: 52, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.small, paddingHorizontal: theme.spacing.md, color: theme.colors.text, backgroundColor: theme.colors.surface, letterSpacing: 6 }}
            />
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="我已阅读并同意相关协议"
            accessibilityState={{ checked: consentAccepted }}
            onPress={() => setConsentAccepted((value) => !value)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: consentAccepted ? theme.colors.primary : theme.colors.border, backgroundColor: consentAccepted ? theme.colors.primary : theme.colors.surface, alignItems: "center", justifyContent: "center" }}>
              {consentAccepted ? <AppText style={{ color: theme.colors.inverseText }}>✓</AppText> : null}
            </View>
            <AppText size="small" tone="secondary" style={{ flex: 1 }}>
              我已阅读并同意相关协议。
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="查看服务协议、隐私政策和手机号认证说明"
            onPress={() => router.push(routeForScreen("legal-information"))}
            style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
          >
            <AppText size="small" tone="primary" weight="medium">
              服务协议 · 隐私政策 · 手机号认证说明
            </AppText>
          </Pressable>
          {error ? <AppText tone="danger">{error}</AppText> : null}
          <PrimaryButton
            label={submitting || loading ? "请稍候…" : challengeId ? "验证并登录" : "获取验证码"}
            loading={submitting || loading}
            disabled={challengeId ? code.length !== 6 : phoneNumber.length !== 11 || !consentAccepted}
            onPress={() => void (challengeId ? verify() : sendCode())}
          />
          {challengeId ? (
            <PrimaryButton
              variant="text"
              label={secondsRemaining > 0 ? `${secondsRemaining} 秒后可重新获取` : "重新获取验证码"}
              disabled={secondsRemaining > 0}
              onPress={() => void sendCode()}
            />
          ) : null}
          {sandbox ? (
            <>
              <SandboxIndicator />
              <AppText size="caption" tone="secondary" style={{ textAlign: "center" }}>
                验收号码已预填。勾选协议后获取验证码，并输入 246810。完成登录后仍需通过成年资格验证才能使用行程功能。
              </AppText>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}
