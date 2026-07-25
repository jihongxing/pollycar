import { describe, expect, it } from "vitest";
import { createProductionPoolConnectionString } from "./production-postgres.js";

describe("createProductionPoolConnectionString", () => {
  it("保留连接信息但移除会覆盖显式 CA 配置的 sslmode", () => {
    expect(createProductionPoolConnectionString(
      "postgresql://pollycar:secret@postgres:5432/pollycar?sslmode=verify-full&application_name=pollycar",
    )).toBe(
      "postgresql://pollycar:secret@postgres:5432/pollycar?application_name=pollycar",
    );
  });
});
