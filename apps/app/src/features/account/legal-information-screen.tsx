import { View } from "react-native";

import {
  AuxiliaryDataRow,
  AuxiliaryGroup,
  AuxiliaryPage,
  AuxiliarySection,
} from "../../components/auxiliary-page";
import { AppText } from "../../components/ui";
import { useAppTheme } from "../../theme/theme-context";

type LegalDocumentKind = "service-agreement" | "privacy-policy" | "phone-auth-notice";

export function LegalInformationScreen({
  onBack,
  navigate,
}: {
  onBack: () => void;
  navigate: (screen: LegalDocumentKind) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <AuxiliaryPage
      title="协议与隐私"
      accessibilityLabel="服务协议、隐私政策与手机号认证说明"
      onBack={onBack}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <View accessibilityRole="header">
          <AppText family="display" size="title1" weight="bold">
            使用服务前，请了解这些内容
          </AppText>
        </View>
        <AppText tone="secondary">
          这里汇总账户、行程和信息使用的主要规则。
        </AppText>
      </View>

      <AuxiliarySection title="服务协议">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="orders"
            label="账户使用"
            description="一个账户可使用乘客服务；通过车主准入后可切换车主身份。"
            value="查看"
            onPress={() => navigate("service-agreement")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>

      <AuxiliarySection title="隐私政策">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="privacy"
            label="信息如何使用"
            description="查看账户实名、位置、行程联系和用户控制说明。"
            value="查看"
            onPress={() => navigate("privacy-policy")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>

      <AuxiliarySection title="手机号认证说明">
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            icon="phone"
            label="登录与设备"
            description="查看验证码、手机号登录和退出后的账户说明。"
            value="查看"
            onPress={() => navigate("phone-auth-notice")}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>

      <AppText size="small" tone="secondary">
        更新日期：2026年7月19日
      </AppText>
    </AuxiliaryPage>
  );
}

export function LegalDocumentScreen({
  document,
  onBack,
}: {
  document: LegalDocumentKind;
  onBack: () => void;
}) {
  const content = legalDocuments[document];
  return (
    <AuxiliaryPage
      title={content.title}
      accessibilityLabel={content.accessibilityLabel}
      onBack={onBack}
    >
      <AuxiliarySection title={content.introduction.title}>
        <AuxiliaryGroup>
          <AuxiliaryDataRow
            label={content.introduction.label}
            description={content.introduction.description}
            last
          />
        </AuxiliaryGroup>
      </AuxiliarySection>
      {content.sections.map((section) => (
        <AuxiliarySection key={section.title} title={section.title}>
          <AuxiliaryGroup>
            {section.items.map((item, index) => (
              <AuxiliaryDataRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                description={item.description}
                last={index === section.items.length - 1}
              />
            ))}
          </AuxiliaryGroup>
        </AuxiliarySection>
      ))}
      <AppText size="small" tone="secondary">
        更新日期：2026年7月19日
      </AppText>
    </AuxiliaryPage>
  );
}

const legalDocuments = {
  "service-agreement": {
    title: "服务协议",
    accessibilityLabel: "御驾出行服务协议主要说明",
    introduction: {
      title: "适用范围",
      label: "账户与行程服务",
      description: "适用于账户使用、乘客行程以及通过准入后的车主参与。",
    },
    sections: [
      {
        title: "账户与身份",
        items: [
          {
            icon: "account",
            label: "一个账户",
            description: "乘客是默认身份；车主身份需完成车辆审核后才可切换。",
          },
          {
            icon: "privacy",
            label: "本人使用",
            description: "涉及实名、行程和车主参与的操作应由账户本人完成。",
          },
        ],
      },
      {
        title: "行程使用",
        items: [
          {
            icon: "route",
            label: "真实意愿",
            description: "发起、接受或取消行程时，应按照页面提示确认当前决定。",
          },
          {
            icon: "orders",
            label: "费用与责任",
            description: "会在相关操作前展示对当前决定有影响的费用、责任和下一步。",
          },
        ],
      },
      {
        title: "车主参与",
        items: [
          {
            icon: "car",
            label: "分别确认",
            description: "车辆、资格、额度和安全状态会在开始参与前分别确认。",
          },
          {
            icon: "safety",
            label: "限制与恢复",
            description: "状态受限时，页面会显示原因和可用恢复路径；切换身份不会绕过限制。",
          },
        ],
      },
    ],
  },
  "privacy-policy": {
    title: "隐私政策",
    accessibilityLabel: "御驾出行隐私政策主要说明",
    introduction: {
      title: "使用原则",
      label: "只用于完成服务",
      description: "账户、实名、位置和行程信息用于完成用户选择的服务与必要安全处理。",
    },
    sections: [
      {
        title: "账户与实名",
        items: [
          {
            icon: "account",
            label: "账户资料",
            description: "用于登录、账户展示、行程记录和当前设备上的偏好。",
          },
          {
            icon: "privacy",
            label: "实名信息",
            description: "用于确认账户本人、成年条件和必要的安全责任处理。",
          },
        ],
      },
      {
        title: "位置与行程",
        items: [
          {
            icon: "location",
            label: "位置",
            description: "在用户发起相关操作时，用于路线、接驾、行程进展和必要安全处理。",
          },
          {
            icon: "messages",
            label: "行程联系",
            description: "联系只与相关行程绑定；建议在 24 小时内发起，会话最多开放 72 小时，结束后保留只读记录。",
          },
        ],
      },
      {
        title: "用户控制",
        items: [
          {
            icon: "device",
            label: "设备偏好",
            description: "主题与通知偏好保存在当前设备，可随时在设置中调整。",
          },
          {
            icon: "logout",
            label: "退出登录",
            description: "退出不会删除账户或行程记录，再次使用时需要重新验证手机号。",
          },
        ],
      },
    ],
  },
  "phone-auth-notice": {
    title: "手机号认证说明",
    accessibilityLabel: "手机号认证与设备登录说明",
    introduction: {
      title: "认证用途",
      label: "登录当前账户",
      description: "手机号用于获取验证码、登录账户和恢复当前设备上的登录状态。",
    },
    sections: [
      {
        title: "验证码",
        items: [
          {
            icon: "phone",
            label: "本人操作",
            description: "验证码用于确认当前手机号可由本人使用，请勿转交他人。",
          },
          {
            icon: "clock",
            label: "有效时间",
            description: "验证码仅在页面显示的有效时间内使用，失效后需要重新获取。",
          },
        ],
      },
      {
        title: "设备登录",
        items: [
          {
            icon: "device",
            label: "当前设备",
            description: "验证成功后，当前设备会保存必要的登录状态。",
          },
          {
            icon: "logout",
            label: "退出与恢复",
            description: "退出后需重新验证手机号；账户资料和行程记录不会因此删除。",
          },
        ],
      },
    ],
  },
} as const satisfies Record<
  LegalDocumentKind,
  Readonly<{
    title: string;
    accessibilityLabel: string;
    introduction: Readonly<{
      title: string;
      label: string;
      description: string;
    }>;
    sections: readonly Readonly<{
      title: string;
      items: readonly Readonly<{
        icon: "account" | "privacy" | "route" | "orders" | "car" | "safety" | "location" | "messages" | "device" | "logout" | "phone" | "clock";
        label: string;
        description: string;
      }>[];
    }>[];
  }>
>;

export type { LegalDocumentKind };
