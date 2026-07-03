# Schema Query — 参考项目查阅规则

> 本规则教 Agent 如何高效查阅参考项目手册，避免每次都重新探索整个代码库。

## 查阅原则

1. **先查手册，后查代码** — 参考手册是"压缩知识"，优先查阅
2. **按索引定位** — 手册中的每个条目都有路径索引，直接定位到具体文件
3. **按需深入** — 只深入阅读与当前任务相关的部分
4. **记录发现** — 每次查阅的新发现要回补到手册中（见 `schemas/rules/ingest.md`）

## 查阅流程

### 1. 确定查阅目标

根据当前任务，确定需要查阅哪些维度：
- 需要了解架构？→ 查阅"架构设计"部分
- 需要调用某个接口？→ 查阅"接口设计" + "关键模块索引"
- 需要了解设计原则？→ 查阅"设计哲学"

### 2. 查阅参考手册

参考手册位于 `<当前项目根目录>/schemas/references/<project-name>.md`

可用手册列表（见 `schemas/index.md`）：
- `references/openclaw.md` — OpenClaw 核心骨架
- `references/openclaw-disassembled.md` — OpenClaw 拆解的插件库
- `references/hermes-agent.md` — Hermes Agent 参考项目
- （新项目会持续添加）

查阅步骤：
1. 读取目标手册
2. 根据任务需求，定位到相关章节
3. 根据章节中的路径索引，读取具体文件（如果需要）

### 3. 按需深入

如果手册中的信息不够：
1. 根据手册中的路径索引，读取具体文件
2. 使用 `search_file`、`search_content` 在项目中搜索
3. **重要**：将新发现回补到手册中（见 `schemas/rules/ingest.md`）

### 4. 查阅日志

每次查阅后，在手册的"查阅日志"部分记录：
```
- YYYY-MM-DD: 查阅了 XX 部分，用于 YY 任务
```

## 查阅示例

### 示例 1：需要了解 OpenClaw 的 Agent Loop 架构

```
1. 读取 schemas/index.md，找到 openclaw.md
2. 读取 schemas/references/openclaw.md
3. 定位到"架构设计" → "Inner Loop" 部分
4. 看到索引：packages/agent-core/agent-loop.ts
5. 如果需要细节，读取该文件
6. 将新发现回补到手册
```

### 示例 2：需要了解插件接口设计

```
1. 读取 schemas/index.md，找到 openclaw-disassembled.md
2. 读取 schemas/references/openclaw-disassembled.md
3. 定位到"接口设计" → "Plugin SDK" 部分
4. 看到索引：plugin-library/core/plugin-sdk/
5. 读取具体文件了解接口定义
6. 将新发现回补到手册
```

## 查阅禁忌

- ❌ 不要每次都重新探索整个项目结构
- ❌ 不要忽略手册中的索引，自己去猜文件位置
- ❌ 不要只查阅不回补（这样知识无法积累）
- ✅ 先查手册 → 按需深入 → 回补发现
