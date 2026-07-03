# Hermes Agent — 参考手册

> 生成时间: 2026-07-01
> 路径: E:\aiproject\hermes-agent
> 最后更新: 2026-07-01
> 索引位置: schemas/references/hermes-agent.md

## 项目概述

| 项目 | 说明 |
|------|------|
| **名称** | Hermes Agent |
| **定位** | 个人 AI 助手，强调"学习闭环"和自我改进能力 |
| **核心功能** | Agent 循环、后台自我审查、技能自动创建、记忆提醒、上下文压缩、凭证池 |
| **技术栈** | Python、SQLite (WAL + FTS5)、Ink TUI |
| **核心差异** | 后台自我审查循环 + 技能自动创建/改进 = 闭环学习系统 |

## 目录结构

```
E:\aiproject\hermes-agent\
├── agent/                      # Agent 核心
│   ├── conversation_loop.py    # 对话循环（主循环）
│   ├── background_review.py    # ★ 后台自我审查（学习闭环核心）
│   ├── context_compressor.py   # 上下文压缩（保持缓存）
│   ├── credential_pool.py      # 凭证池故障转移
│   └── curator.py              # ★ 技能管理器（使用频率追踪、归档）
├── tools/                      # 工具实现
│   ├── registry.py             # 工具注册表
│   ├── skill_manager_tool.py   # ★ 技能管理工具
│   └── memory_tool.py          # 记忆工具
├── gateway/                    # 网关服务
│   ├── run.py                  # 网关入口
│   └── platforms/              # 平台适配
├── plugins/                    # 插件系统
│   └── model-providers/        # 模型提供者插件
├── ui-tui/                     # TUI 界面（Ink）
├── docs/                       # 设计文档
├── .plans/                     # 开发计划
├── AGENTS.md                   # ★ 核心开发指南（~70k）
└── config.yaml                 # 配置文件
```

## 架构设计

### 核心架构：对话循环 + 后台审查

```
用户输入
    ↓
AIAgent.run_conversation()
    ↓
┌─────────────────────────────────────────┐
│  ① build_turn_context()                 │
│     ← 记忆预取 + 插件钩子               │
│                                         │
│  ② _restore_or_build_system_prompt()   │
│     ← 缓存或首次构建                    │
│                                         │
│  ③ while loop:                         │
│     a. 消息准备 + steer drain           │
│     b. LLM 调用                         │
│     c. if tool_calls:                   │
│        → handle_function_call()         │
│        → 结果追加到 messages            │
│     d. else: final_response → break    │
│                                         │
│  ④ finalize_turn()                     │
│     ← 轨迹保存 + 诊断                   │
│                                         │
│  ⑤ _spawn_background_review() ★       │
│     → 分叉 AIAgent                     │
│     → 审查记忆/技能                     │
│     → 写入磁盘（不污染主对话缓存）      │
└─────────────────────────────────────────┘
    ↓
SessionDB (SQLite WAL + FTS5)
```

### 关键设计差异（vs OpenClaw）

| 特性 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| 学习机制 | 无 | ★ 后台自我审查循环 |
| 技能管理 | 静态 Skill 文件 | ★ 自动创建 + 使用中改进 |
| 记忆 | 插件实现 | ★ 记忆提醒 + 后台审查安全网 |
| 上下文压缩 | 简单截断 | ★ 保持缓存的压缩（parent_session_id 链） |
| 凭证管理 | 单一 | ★ 凭证池故障转移 |

## 接口设计

### Agent 核心接口

```python
class AIAgent:
    async def run_conversation(self, messages: List[Message]) -> str:
        """主对话循环"""
        
    async def _spawn_background_review(self):
        """★ 后台自我审查（学习闭环核心）"""
        # 分叉一个守护线程
        # 用相同模型（暖缓存）或更便宜模型
        # 问自己："应该保存什么记忆/创建什么技能？"
        # 写入磁盘，不污染主对话缓存
```

### 技能管理接口

```python
# 技能自动创建
async def create_skill(name: str, content: str) -> Skill

# 技能改进（使用中）
async def improve_skill(skill: Skill, feedback: str) -> Skill

# Curator 系统
class Curator:
    def track_usage(self, skill: Skill) -> None
    def archive_expired(self) -> List[Skill]
```

### 记忆接口

```python
# 记忆工具
async def memory_save(key: str, value: str) -> None
async def memory_load(key: str) -> Optional[str]

# 记忆提醒（系统提示词中嵌入）
MEMORY_NUDGE = "在适当时机调用 memory 工具持久化知识"
```

## 设计哲学

### 核心原则

1. **学习闭环（Learning Loop）** — 每次对话后自我审查，提取知识
2. **技能自我改进** — 技能在使用中可被 Agent 主动修改
3. **记忆提醒机制** — 系统提示词引导 Agent 主动记忆
4. **缓存友好** — 上下文压缩保持前缀缓存有效
5. **足迹阶梯** — 扩展策略：已有代码 > CLI+技能 > 服务 > 插件 > MCP > 新核心工具

### 后台自我审查（核心差异点）

```python
# 每轮对话后
_spawn_background_review():
    # 分叉一个守护线程
    reviewer = AIAgent(model=cheaper_model)  # 或暖缓存的相同模型
    
    # 问自己
    questions = [
        "应该保存什么记忆？",
        "应该创建什么技能？",
        "有什么知识值得持久化？"
    ]
    
    # 写入磁盘（不污染主对话缓存）
    for answer in reviewer.ask(questions):
        save_to_disk(answer)
```

### 技能自动创建与改进

```python
# 复杂任务完成后
async def post_task_hook(task_result):
    # Agent 自动将工作流提炼为 SKILL.md
    skill = extract_skill_from_workflow(task_result)
    save_skill(skill)
    
    # Curator 追踪使用频率
    curator.track_usage(skill)
    
    # 归档过期技能
    curator.archive_expired()
```

### 反模式

- ❌ 不保存学习成果（应该触发后台审查）
- ❌ 手动管理技能（应该让 Agent 自动创建/改进）
- ❌ 忽略缓存友好性（应该使用 context_compressor）

## 关键模块索引

| 模块 | 路径 | 说明 |
|------|------|------|
| conversation_loop | `agent/conversation_loop.py` | 主对话循环 |
| background_review | `agent/background_review.py` | ★ 后台自我审查（学习闭环） |
| context_compressor | `agent/context_compressor.py` | 上下文压缩（保持缓存） |
| credential_pool | `agent/credential_pool.py` | 凭证池故障转移 |
| curator | `agent/curator.py` | ★ 技能管理器（使用追踪、归档） |
| skill_manager_tool | `tools/skill_manager_tool.py` | 技能管理工具 |
| memory_tool | `tools/memory_tool.py` | 记忆工具 |
| registry | `tools/registry.py` | 工具注册表 |

## 配置与约定

### 配置入口

| 配置项 | 位置 | 说明 |
|--------|------|------|
| config.yaml | `~/.hermes/config.yaml` | 行为设置 |
| .env | `~/.hermes/.env` | API 密钥 |
| SOUL.md | `~/.hermes/SOUL.md` | Agent 身份/人格 |
| MEMORY.md | `~/.hermes/MEMORY.md` | 持久记忆 |
| USER.md | `~/.hermes/USER.md` | 用户画像 |
| skills/ | `~/.hermes/skills/` | 用户技能目录 |

### 构建命令
- 安装依赖: `pip install -r requirements.txt`
- 运行: `python -m hermes`
- 测试: `pytest`

### 代码规范
- Python 3.10+
- 异步优先（async/await）
- SQLite WAL + FTS5 用于全文搜索

## 核心数据流

```
用户输入 → CLI/Gateway → AIAgent.run_conversation()
    ↓
① build_turn_context() ← 记忆预取
② build_system_prompt() ← 缓存或首次构建
③ while loop: LLM 调用 + 工具执行
④ finalize_turn() ← 轨迹保存
⑤ _spawn_background_review() ★ ← 后台学习
    ↓
SessionDB (SQLite) → 持久化
```

## 查阅日志

- 2026-07-01: 初始生成（Loop Engineering 改造项目）
- 核心发现：后台自我审查循环是 Hermes 区别于其他 Agent 框架的核心设计
