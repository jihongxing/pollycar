import { afterEach, describe, expect, it } from "vitest";

import {
  clearVehicleFormDraft,
  readVehicleFormDraft,
  saveVehicleFormDraft,
} from "./vehicle-draft-storage";

describe("车辆表单草稿", () => {
  afterEach(clearVehicleFormDraft);

  it("保存并恢复当前设备草稿", () => {
    saveVehicleFormDraft({
      vehicleType: "合成测试车辆",
      insuranceDate: "2027-08-31",
      maxPassengerCount: 2,
    });
    expect(readVehicleFormDraft()).toMatchObject({
      vehicleType: "合成测试车辆",
      insuranceDate: "2027-08-31",
      maxPassengerCount: 2,
    });
  });

  it("提交成功后可以清理草稿", () => {
    saveVehicleFormDraft({
      vehicleType: "合成测试车辆",
      insuranceDate: "",
      maxPassengerCount: 1,
    });
    clearVehicleFormDraft();
    expect(readVehicleFormDraft()).toBeUndefined();
  });
});
