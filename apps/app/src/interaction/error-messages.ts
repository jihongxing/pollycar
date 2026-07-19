export type AppErrorPresentation = Readonly<{
  title: string;
  message: string;
  retryable: boolean;
}>;

const errorMessages: Readonly<Record<string, AppErrorPresentation>> = {
  SERVICE_UNAVAILABLE: {
    title: "服务暂不可用",
    message: "内部沙箱暂时无法连接，请稍后重试。",
    retryable: true,
  },
  UNKNOWN_RESULT: {
    title: "操作结果待确认",
    message: "网络在提交后中断。系统已读取最新状态，不会自动重复提交。",
    retryable: true,
  },
  AUTHENTICATION_REQUIRED: {
    title: "登录已过期",
    message: "请重新使用手机号验证码登录。",
    retryable: true,
  },
  PHONE_NUMBER_INVALID: { title: "手机号格式不正确", message: "请输入 11 位有效手机号。", retryable: false },
  PHONE_AUTH_CONSENT_REQUIRED: { title: "请确认相关协议", message: "阅读并同意相关协议后才能获取验证码。", retryable: false },
  PHONE_CODE_RATE_LIMITED: { title: "请求过于频繁", message: "请等待倒计时结束后再获取验证码。", retryable: true },
  PHONE_CODE_DELIVERY_UNKNOWN: { title: "发送结果待确认", message: "短信供应商暂未返回明确结果，请稍后重新获取，避免重复发送。", retryable: true },
  PHONE_CODE_INVALID: { title: "验证码不正确", message: "请检查后重新输入。", retryable: true },
  PHONE_CODE_EXPIRED: { title: "验证码已过期", message: "请重新获取验证码。", retryable: true },
  PHONE_CODE_LOCKED: { title: "验证码已失效", message: "错误次数过多，请重新获取验证码。", retryable: true },
  PHONE_CODE_REPLAYED: { title: "验证码已使用", message: "请重新获取验证码。", retryable: true },
  REAL_PHONE_DATA_FORBIDDEN: { title: "当前仅开放内部验证", message: "内部沙箱不接收真实手机号，请使用指定合成号码。", retryable: false },
  REFRESH_TOKEN_REPLAYED: { title: "登录已失效", message: "为保护账户安全，请重新使用手机号验证码登录。", retryable: false },
  REFRESH_SESSION_EXPIRED: { title: "登录已过期", message: "请重新使用手机号验证码登录。", retryable: false },
  STORAGE_CONCURRENT_MODIFICATION: {
    title: "状态已经变化",
    message: "其他操作已更新当前记录，请刷新后继续。",
    retryable: true,
  },
  TRIP_INVALID_STATE: {
    title: "当前不能执行此操作",
    message: "行程状态已发生变化，请刷新后查看最新结果。",
    retryable: true,
  },
  TRIP_PICKUP_TIME_INVALID: {
    title: "预约时间无效",
    message: "请选择系统提供的有效上车时间段。",
    retryable: false,
  },
  TRIP_PICKUP_TIME_IN_PAST: {
    title: "预约时间已过",
    message: "该时间段已经过去，请重新选择。",
    retryable: true,
  },
  TRIP_PICKUP_TIME_TOO_SOON: {
    title: "预约时间太近",
    message: "预约至少需要提前 30 分钟；如需立即出发，请选择尽快出发。",
    retryable: true,
  },
  TRIP_PICKUP_TIME_TOO_FAR: {
    title: "超出预约范围",
    message: "当前最多可预约 Server 当前时间起未来 72 小时。",
    retryable: true,
  },
  TRIP_PICKUP_TIME_UNAVAILABLE: {
    title: "该时间暂不可约",
    message: "服务时段可能已变化，请刷新后选择其他时间。",
    retryable: true,
  },
  TRIP_SCHEDULE_CONFLICT: {
    title: "行程时间冲突",
    message: "该时间与车主已有安排重叠，请选择其他预约或等待其他车主。",
    retryable: true,
  },
  TRIP_SCHEDULE_CHANGED: {
    title: "预约信息已更新",
    message: "请查看最新预约时间后再继续。",
    retryable: true,
  },
  TRIP_SCHEDULE_RESULT_UNKNOWN: {
    title: "预约结果待确认",
    message: "网络在提交后中断，请先刷新行程状态，不要重复创建预约。",
    retryable: true,
  },
  TRIP_SCHEDULE_NOT_READY: {
    title: "尚未到准备时间",
    message: "预约开始前 30 分钟才可进入接驾准备。",
    retryable: false,
  },
  TRIP_TIMEOUT_NOT_REACHED: {
    title: "尚未到可核对时间",
    message: "当前行程还未达到可核对的等待时间，请稍后再试。",
    retryable: false,
  },
  VEHICLE_REVIEW_INVALID_STATE: {
    title: "审核状态已变化",
    message: "车辆审核当前不接受该操作，请刷新审核状态。",
    retryable: true,
  },
  ELIGIBILITY_INVALID_STATE: {
    title: "资格状态已变化",
    message: "请刷新免费资格状态后再继续。",
    retryable: true,
  },
  SAFETY_INVALID_STATE: {
    title: "安全案件状态已变化",
    message: "案件已被处理或不再允许当前操作，请刷新后查看。",
    retryable: true,
  },
};

export function presentAppError(error: unknown): AppErrorPresentation {
  const code = error instanceof Error ? error.message : "INTERNAL_UNEXPECTED_ERROR";
  return errorMessages[code] ?? {
    title: "操作未完成",
    message: "发生了未预期的问题，请刷新状态后重试。",
    retryable: true,
  };
}
