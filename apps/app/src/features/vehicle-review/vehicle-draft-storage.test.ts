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
      preparedMaterials: ["driver_license", "insurance_proof"],
    });
    expect(readVehicleFormDraft()).toMatchObject({
      vehicleType: "合成测试车辆",
      insuranceDate: "2027-08-31",
      maxPassengerCount: 2,
      preparedMaterials: ["driver_license", "insurance_proof"],
    });
  });

  it("提交成功后可以清理草稿", () => {
    saveVehicleFormDraft({
      vehicleType: "合成测试车辆",
      insuranceDate: "",
      maxPassengerCount: 1,
      preparedMaterials: [],
    });
    clearVehicleFormDraft();
    expect(readVehicleFormDraft()).toBeUndefined();
  });

  it("忽略不属于认证流程的材料标识", () => {
    saveVehicleFormDraft({
      vehicleType: "合成测试车辆",
      insuranceDate: "2027-08-31",
      maxPassengerCount: 1,
      preparedMaterials: ["driver_license", "unknown_material" as never],
    });
    expect(readVehicleFormDraft()?.preparedMaterials).toEqual(["driver_license"]);
  });
});
