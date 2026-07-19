# 完整产品系统模板说明

本仓库已于 `2026-07-11` 使用 Codex `full-product-system` 模板初始化，并完成 PollyCar 项目化改造。

## 当前使用方式

1. 阅读 `AGENTS.md` 的协作与中文文档硬约束。
2. 以 `ROADMAP.md` 判断当前阶段和可实施范围。
3. 通过 `docs/README.md` 找到每类事实的唯一真相源。
4. 修改文档后运行 `./scripts/test/check-doc-governance.ps1`。
5. 完成变更前运行 `./scripts/test/preflight.ps1 -SkipProjectTests`。

## 后续接入

技术栈确定后，需要把真实的测试、类型检查、静态检查、构建、迁移和冒烟命令接入 `scripts/test/preflight.ps1`。
