import { describe, expect, it } from "vitest";

import {
  normalizeInsuranceDate,
  normalizeVehicleType,
  validateInsuranceDate,
  validateVehicleType,
} from "./vehicle-form-model";

describe("车辆表单模型", () => {
  it("格式化车辆类型和中文日期", () => {
    expect(normalizeVehicleType("  中大型   轿车  ")).toBe("中大型 轿车");
    expect(normalizeInsuranceDate("2027年8月31日")).toBe("2027-08-31");
  });

  it("提供实时车辆类型校验", () => {
    expect(validateVehicleType("")).toBe("请输入车辆类型。");
    expect(validateVehicleType("A")).toBe("车辆类型至少需要 2 个字符。");
    expect(validateVehicleType("合成车辆")).toBeUndefined();
  });

  it("拒绝无效、过期和过远日期", () => {
    const today = new Date("2026-07-12T00:00:00.000Z");
    expect(validateInsuranceDate("2026-02-30", today)).toBe("日期不存在，请检查年、月和日。");
    expect(validateInsuranceDate("2026-07-11", today)).toBe("保险有效期不能早于今天。");
    expect(validateInsuranceDate("2032-01-01", today)).toBe("保险有效期不能超过未来 5 年。");
    expect(validateInsuranceDate("2027-08-31", today)).toBeUndefined();
  });
});
