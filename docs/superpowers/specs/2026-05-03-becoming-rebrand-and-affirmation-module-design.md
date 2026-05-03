# Becoming —— 改名 + 肯定语模块设计

- **日期**：2026-05-03
- **作者**：ZhongJiaqi
- **状态**：已批准（brainstorm 阶段完成，可进入实施计划阶段）
- **Brainstorm 会话**：`~/.gstack/brainstorm/57175-1777781785/`（日志已保留）
- **实施计划**：待定（下一步：调用 `superpowers:writing-plans` skill）

---

## 1. 背景

### 现状

`Micro Habits` 是一个基于 Firebase + Vercel 的 React 19 单页 PWA 应用。用户用它做每日打卡——既包括真实习惯（如「散步 30 分钟」），**也**包括以习惯形式记录的积极肯定语（如「I am enough.」）。one-time task 也是数据模型的一部分，但实际几乎没用。

### 用户反馈的痛点

1. **混乱感**：肯定语和习惯被放在同一个扁平的 task 列表里、用同样的样式渲染——视觉上是一类，心理上却是两类（「做」 vs 「念」）。
2. **One-time tasks 几乎没有使用**：整条 one-time 代码路径（创建 UI、priority 字段、type 字段）都是死代码。
3. **产品定位模糊**：用户既要继续自己用，又希望打磨好后能给别人用。当前名字 `Micro Habits` 过度锚定在「习惯」上，把肯定语排除在外。

### 本 spec 涵盖范围

- 把产品改名为 **Becoming**。
- 引入 **肯定语 (affirmations)** 作为一等公民的内容类型（与习惯并列），不再藏在习惯里冒充。
- 重构 Today / Practice / History 三个页面，让肯定语和习惯**视觉上可区分**地分组渲染。
- 删除 one-time task（代码 + 数据）。
- 用懒迁移策略平滑迁移现有数据，用户零打扰。

### 不在范围内

- 推送通知 / `dailyTaskReminder` Cloud Function —— 独立模块，不动。
- Firestore 集合重命名（`microHabits` / `tasks` / `habitPool`）—— 维持原名，避免全量数据迁移；未来 Becoming v2 想改再改。
- 新增功能（分享、社交、多端同步）—— 纯重构 + 改名，不加新功能。

---

## 2. 产品定位（Becoming）

### 核心理念

行为科学链条：**思想 → 行为 → 命运**。背书：

- Cialdini 承诺与一致原则。
- William James / Aristotle 关于「习惯即身份」的论述。
- James Clear《Atomic Habits》中基于身份的习惯（identity-based habits）。
- Pygmalion / Rosenthal 自我实现预言研究。

应用是一个 **每日实践承载面 (daily practice surface)**，对两类互补的内容使用同一种打卡机制：

- **Affirmations（肯定语）** —— 「思想」的重复层（你每天对自己说什么）。
- **Habits（习惯）** —— 「行为」的重复层（你每天做什么）。

二者一起构成完整的闭环：「我每天**重复**地想什么、做什么，决定我成为什么样的人」。

### 为什么叫「Becoming」

- 直接来自 James Clear 的引文：*"Every action you take is a vote for the type of person you wish to **become**."*
- 「-ing」时态强调过程而非终点，契合成长心理学的核心。
- 单个英文词，做 logo 简洁；在 habits-app 这片红海里独特（Streaks / Habitica / Productive 都是名词或行为锚点；Becoming 是身份锚点）。
- 中英都好用：中文语境里「成为」也很干净；为品牌纯度可保留英文不译。

### Tagline（产品标语）

> *Every action you take is a vote for the type of person you wish to become.*
> —— James Clear, *Atomic Habits*

使用位置：

- 登录页 subtitle（替换原来的 *"Build better habits, one day at a time."*）
- Practice tab 引导文案（替换原来的 *"Small, effortless actions. They will appear automatically..."*）

### 我们 NOT 是什么

- 不是通用 to-do 应用（没 one-time task）。
- 不是冥想应用（没音频、没计时器——「时刻」就是承认肯定语本身这个动作）。
- 不是社交习惯追踪器（没排行榜、没公开分享）。

---

## 3. 信息架构 (IA)

### 底部 tab 栏

```
[ Today ]   [ Practice ]   [ History ]
```

| Tab | 旧名 | 新名 | 做什么 |
|---|---|---|---|
| Today | Today | Today | 每日打卡——肯定语和习惯，分两个视觉上区分的 section |
| Practice | Habits | **Practice** | 管理（CRUD）肯定语和习惯，分两个 section 同屏 |
| History | History | History | 日历热力图、streak、Hall of Fame——带 All / Habits / Affirmations 过滤器 |

应用名（左上 header）和登录页品牌文字改为 **Becoming**。

### Today 和 Practice 内的 section 顺序

**肯定语在上，习惯在下。** 镜像自然的早晨仪式：先读肯定语定意图，再做行动。颠覆了最初「先做后说」的推荐。

### Hall of Fame 位置

继续放 History tab 底部。**不分类的统一 Hall**，肯定语连续 21 天和习惯连续 21 天的成就都进同一个 Hall（与 §5.2「合并 streak」心智一致）。

---

## 4. 数据模型

### `MicroHabit`

```ts
export interface MicroHabit {
  id: string;
  title: string;
  createdAt: string;
  active: boolean;
  userId: string;
  category: 'habit' | 'affirmation';   // 新增 —— 旧数据默认 'habit'
}
```

- `category` 是某条 microHabit 归属哪个 section 的唯一真相来源。**创建时设定，v1 不可变**——UI 不提供「跨类移动」操作；用户需要的话可以删了重建。如果未来 v2 出现真实需求，再考虑加重新分类功能。

### `Task`

```ts
export interface Task {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  completed: boolean;
  habitId: string;         // 现在是必填（之前是 optional）
  userId: string;
  // 删除：type: 'habit' | 'one-time'
  // 删除：priority?: 'low' | 'medium' | 'high'
}
```

- 现在所有 task 都派生自某条 microHabit（one-time task 已删，见 §5.4）。
- task 的 category **不冗余存储**，读取时通过 `microHabits.find(h => h.id === task.habitId)?.category` 派生。**单一真相来源**。

### `HabitPoolItem`（Hall of Fame）

不变。当某条 microHabit（不分 category）连续打卡 21 天时触发写入。

---

## 5. 行为

### 5.1 肯定语生命周期

- 跟习惯一样：在 Practice 页写一次，每天在 Today 出现，点击 checkbox 完成，第二天早上重置。
- `useStore.ts` 里的 daily reset effect 每天为每条 active 肯定语创建一个新的 task，使用确定性 ID `{habitId}_{date}`（沿用现有模式，不变）。

### 5.2 Streak / 「完美日」语义

- 「完美日」= 当天**所有** task 全部完成（肯定语和习惯**合并算**）。沿用现有逻辑，不动。
- 这是用户选定的心智模型：漏一条肯定语和漏一条习惯一样会断 streak。控制肯定语数量在合理范围内是用户自己的事。
- History 页的 filter（§5.6）是**视图镜头**，会重新投影 streak / 热力图 / 周进度，但**不改变** `habitPool` 里写入的 streak 数值（Hall of Fame 仍按「单条 microHabit 连续 21 天」规则触发）。

### 5.3 Hall of Fame 触发

- 当某条 task 被标记完成时，针对该 `habitId` 往前数 21 天。如果存在 21 天连续完成且 `habitPool` 里还没有这条 `habitId`，则写入新的 `HabitPoolItem`。
- **代码改动**：`useStore.ts:280` 当前过滤了 `task.type === 'habit'`。删除这个过滤——现在所有 task 都来自 habit，肯定语连续 21 天也应该被同等庆祝。

### 5.4 One-time tasks：硬删除

- 所有现存的 `task.type === 'one-time'` 文档将在下一次迁移过程中**从 Firestore 删除**。
- 理由：用户报告几乎没用过；软删除会让死状态永远留着。
- 安全网：删除前 console.log 数量；Firebase PITR (Point-in-Time Recovery) 提供 7 天回滚窗口，万一发现误删可以恢复（个人应用风险可接受）。
- 代码：移除所有跟 one-time 创建、priority 字段、单 task 编辑相关的 UI 和 store 函数。

### 5.5 读取时懒迁移

- `useStore` 挂载、Firestore 数据订阅就绪后，扫描 `data.microHabits`。任何不带 `category` 字段的 habit，调用 `setDoc(doc, { category: 'habit' }, { merge: true })` 补字段。
- 同一个 migration effect 里同时跑 one-time task 清理（一个 cycle 完成全部迁移）。
- 所有读取路径用 `habit.category ?? 'habit'` 作为 defensive fallback，过渡期保留。

### 5.6 History 过滤器

- History 页顶部：3 段 toggle `[ All | Habits | Affirmations ]`，沿用现有的 uppercase letterspaced 标签风格。
- Filter 状态**不持久化**——每次进 History 默认 `All`（避免「上次切到 Habits 看，这次进来 streak 看着像断了」的困惑）。
- History 所有面板（日历点、Best Streak、Active Practices、Weekly Progress 柱状图）都按当前 filter 投影。
- 「Active Habits」统计指标在 All 视图下改名为 **「Active Practices」**；在 filter 视图下只数对应类别。

---

## 6. UI 设计

### 6.1 Today 页

```
[Header]    Becoming                              May 03 ▾
                                                  Sign Out

   ─── AFFIRMATIONS ──────────────────
   ◯  "I am enough."
   ◯  "Today, I choose calm."
   ◯  "I trust the process."

   ─── HABITS ────────────────────────
   ◯  每天散步 30 分钟
   ◯  读书 20 页
   ◯  冥想 10 分钟

[Bottom nav]   Today  ·  Practice  ·  History
```

#### 视觉规则

- **Section 标题**：沿用现有 `text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]`。跟其他地方风格一致——不引入新的标题层级。
- **肯定语渲染**：`font-style: italic`，通过 CSS `::before` / `::after` 伪元素自动加 `"..."` 双引号。引号只是显示用，**不存进** `title` 字段。
- **习惯渲染**：保持现有 `font-serif` 正立。跟肯定语形成视觉对比——这是分组的整个意义。
- **完成态**：圆形 checkbox 填充 `#8A9A86`（沿用现有色），文字 `line-through` + 颜色变浅。两类一致。
- **空 section 处理**：某一类没设置过任何 active microHabit 时，**整个 section 标题不渲染**——避免孤零零的「Affirmations」标题挂在那里没东西。
- **顺序**：肯定语永远在习惯之上。硬编码，v1 不允许用户配置。

### 6.2 Practice 页（原 Habits 页改名）

```
Practice
Every action you take is a vote for the type of person
you wish to become.   — James Clear

   ─── AFFIRMATIONS ──────────────────
   01  "I am enough."
   02  "Today, I choose calm."
       + Add Affirmation

   ─── HABITS ────────────────────────
   01  每天散步 30 分钟
   02  读书 20 页
       + Add Habit
```

- 数字标记 (`01`, `02`) 沿用现有 `HabitsView.tsx` 风格——这是位置标识，不是稳定 ID。
- 两个**独立**的 + 按钮（`+ Add Affirmation`, `+ Add Habit`）——创建时 category 显式确定，没有 toggle、没有 select。点按钮打开同一个 inline-input 表单，只是 `category` 已经预设好了。
- 空态文案：
  - Habits 空：沿用 *"The beginning of a new chapter."*
  - Affirmations 空：新文案 *"Words you live by, repeated."*
- 编辑 / 删除沿用现有 `SwipeActions` 组件，不变。
- Tagline (James Clear 引文) 替换现有的 *"Small, effortless actions..."* 文案。小字号、浅色 `text-[#8C8C8C]`，跟现有引导文案样式一致。

### 6.3 History 页

```
HISTORY                  [All | Habits | Affirmations]   ‹ May 2026 ›

[ 日历网格 —— 完美日绿圆点，按 filter 投影 ]

      [Best Streak]      [Active Practices]
          21                    6

  ─── This Week's Progress ───
   ▂  ▅  █  ▃  ▆  ▂  _
   Su Mo Tu We Th Fr Sa

  ─── THE 21-DAY HALL ───
  • 每天散步 30 分钟        ACHIEVED 2026-04-15
    47 DAYS COMPLETED

  • "I am enough."         ACHIEVED 2026-05-01
    23 DAYS COMPLETED
```

- Filter toggle 风格跟现有标签一致。
- Hall of Fame：统一列表，肯定语 entry 用 italic + 引号渲染（跟 Today / Practice 一致）。
- 空 Hall：沿用 *"Consistency builds character."*

### 6.4 登录页

- 品牌文字 `Micro Habits` → **`Becoming`**。
- Subtitle `Build better habits, one day at a time.` → **`Every action you take is a vote for the type of person you wish to become.`**。
- 登录按钮 (`Continue with Google`) 不变。

### 6.5 Header

- Header 里的应用标题 `Micro Habits` → `Becoming`。
- Header 其他布局 / 行为不变（日期、Sign Out）。

---

## 7. 文件改动清单

| 文件 | 改动 |
|---|---|
| `src/types.ts` | `MicroHabit` 加 `category`。`Task` 删 `type` 和 `priority`，`habitId` 改为必填。 |
| `src/firebase.ts` | （本 spec 不动。） |
| `src/useStore.ts` | (1) 加懒迁移 effect：补 `category='habit'`，删除所有 `type==='one-time'` 的 task。(2) 移除 streak / Hall of Fame trigger 里的 `t.type === 'habit'` 过滤。(3) 移除 `addOneTimeTask` 等所有 one-time 相关的 store 函数。(4) `addMicroHabit` 签名加 `category` 参数。 |
| `src/App.tsx` | (1) 把 `Micro Habits` 替换为 `Becoming`（登录页 header + 主 header）。(2) 登录页 subtitle 替换为 James Clear tagline。(3) `HabitsView` import 改名为 `PracticeView`。(4) 底部 nav 标签 `Habits` → `Practice`。 |
| `src/components/HabitsView.tsx` → `src/components/PracticeView.tsx` | 重命名文件。重构成两个分组 section（Affirmations、Habits），各有独立 `+ Add` 按钮。intro 文案换成 James Clear tagline。加肯定语空态文案。 |
| `src/components/TodayView.tsx` | (1) 删除所有 one-time UI（编辑 input、priority chip）。(2) 按 `microHabits.find(h => h.id === t.habitId)?.category` 把 task 分到两个 section。(3) 肯定语加 italic + 引号样式。(4) 空 section 隐藏标题。 |
| `src/components/HistoryView.tsx` | (1) 删除 `t.type === 'habit'` 过滤（约 line 189）。(2) 加 filter toggle UI (All / Habits / Affirmations)。(3) filter 应用到日历点、Best Streak、Active Practices、Weekly Progress。(4) 「Active Habits」统计标签改为「Active Practices」。(5) Hall of Fame：肯定语 entry 用 italic + 引号渲染。 |
| `src/components/SwipeActions.tsx` | （不动。） |
| `tests/useStore.test.ts` | mock data 去掉 `type`，加 `category`。加测试：legacy habit 没 `category` 时迁移补字段。加测试：one-time 删除路径。更新 Hall of Fame 测试断言肯定语 21 天也触发 entry。 |
| `firestore.rules` | 可选：在 `isValidMicroHabit()` 加 `category` 字段验证。可推到实现阶段再决定。 |
| `index.html` | `<title>` 从 `MicroHabits` 改为 `Becoming`。 |
| `vite.config.ts` (PWA manifest) | manifest 的 `name` 和 `short_name` 从 `MicroHabits` 改为 `Becoming`。 |
| `public/manifest.webmanifest` | （由 vite-plugin-pwa 从配置生成；不手动改。） |
| `package.json` | `"name"` 字段（小写、kebab-case——保留 `micro-habits` 避免影响 deploy slug，**或**改名为 `becoming`。**决定：保留 `micro-habits` 避免 Vercel 项目重新链接**。） |
| `README.md` | 头部介绍改为「Becoming —— 肯定语和习惯的每日实践」。 |

### 不动的文件
- Firestore 集合路径 (`microHabits` / `tasks` / `habitPool`) —— 维持原状。
- Cloud Function `dailyTaskReminder` 和 `functions/` —— 独立模块。
- `firebase-applet-config.json` —— 无 schema 变更需求。
- 推送通知子系统 (`messaging.ts`、`firebase-messaging-sw.js` 等)。

---

## 8. 迁移策略

### 用户下次加载时的执行顺序

1. App 启动，`useStore.ts` 挂载。
2. Firestore 数据订阅就绪后，每个 session 跑一次 migration effect：
   - 每条不带 `category` 的 `microHabit`：写 `{ category: 'habit' }` (`merge: true`)。
   - 每条 `type === 'one-time'` 的 `task`：删除文档。
   - 日志：`[migration] backfilled N microHabits, deleted M one-time tasks`。
3. Migration 是幂等的——重复跑无副作用。
4. Migration 后，所有读取路径在接下来 30 天内继续用 `habit.category ?? 'habit'` 做 defensive fallback，之后可在 follow-up commit 里清理。

### 回滚方案

- 代码：标准 `git revert` 在实现 commit 上。
- 数据：Firestore PITR 覆盖 7 天。如果后悔删了 one-time，从 PITR 用 `gcloud firestore import` 恢复。
- Hall of Fame：无破坏性变更——现有 entry 在 refactor 中保留。

---

## 9. 测试

### 单元测试 (vitest, `tests/useStore.test.ts`)

- ✅ Daily reset 仍然为每条 active microHabit 创建一个 task（沿用）。
- 🆕 Legacy `microHabit` 没 `category` → migration 写 `category: 'habit'`。
- 🆕 Daily reset 同时包括 `category: 'habit'` 和 `category: 'affirmation'` 的 microHabit。
- 🆕 Hall of Fame 在肯定语连续 21 天时触发。
- 🆕 One-time task 删除运行一次且幂等。
- ❌ 移除断言 `Task.type === 'one-time'` 行为的测试。
- 🎯 覆盖率目标：`useStore.ts` ≥ 80%（按 CLAUDE.md 全局规则）。

### E2E 测试 (Playwright, `tests/e2e/`)

- 🆕 新流程：在 Practice 创建一条肯定语，验证它出现在 Today 的 Affirmations section，完成它，验证 line-through + 颜色变浅。
- 🆕 新流程：切换 History filter All → Habits → Affirmations，验证日历 / streak / weekly 全部更新。
- ✅ 现有习惯创建 / 完成流程仍然通过。
- 🆕 验证登录页显示 `Becoming` 和 James Clear tagline。

### 视觉回归

- 在 mobile viewport (375x812) 拍 Today / Practice / History 三页基线截图——实现后再拍一组对比。

### 声明完成前的手动冒烟测试 (CLAUDE.md 全局规则)

- 跑 `npm run dev`，用真实 Google 账号登录，完整走一次仪式（读肯定语 → 打卡 → 做习惯 → 打卡），确认 Today、Practice、History、Hall of Fame 都连贯。

---

## 10. 开放风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 懒迁移半路失败（断网、Firestore quota）| 低 | 中 | Migration 幂等；下次进入再跑。带日志。 |
| 用户其实有想保留的 one-time task 数据 | 低 | 高（感知层）| PITR 7 天回滚。用户已明确批准硬删除。 |
| Vercel 部署 slug `micro-habits-zeta.vercel.app` 在新品牌下显得违和 | 低 | 低 | 后续再决定——要么保留 slug 兼容老用户，要么 follow-up 加 `becoming.app` 自定义域名。 |
| 肯定语 streak 心智不同——用户加 30 条，每天「完美」就不可能 | 中 | 中 | v2 加 UX 提示：`+ Add Affirmation` 旁加 caption「Keep it few. The point is to mean it.」。延后做。 |
| iOS Safari PWA 用户还在用旧 SW（昨天才发了 5 层修复）| 已解决 | —— | `c08d49f` 已处理。 |

---

## 11. 决策回顾（备忘）

Brainstorm 会话期间用户确认的选择：

| 决定项 | 选择 | 理由 |
|---|---|---|
| 肯定语打卡语义 | 每天 reset (选项 A) | 跟习惯同机制 |
| Streak / 热力图 | 合并算 (选项 A) | 简洁，「今天就是一整天」 |
| 信息架构 | 同页两 section (选项 B)，Practice tab | 不增加 tab 数 |
| Section 顺序 | Affirmations 在 Habits 上 | 早晨仪式：先念后做 |
| Tab 名 | Habits → Practice (B1) | 匹配双内容承载面 |
| App 名 | Micro Habits → **Becoming** | 身份锚点，James Clear 脉络 |
| Tagline | James Clear: *"Every action you take is a vote..."* | 直接溯源，现代心理学 |
| 视觉风格 | 肯定语 italic + `"..."` 引号 | 跟习惯 serif 形成文学对比 |
| Hall of Fame 拆分 | 一个统一 Hall | 跟合并 streak 心智一致 |
| Active 统计标签 | "Active Practices" | 同时涵盖两类 |
| One-time task | 硬删除 | 几乎无用，死代码 |
| Filter 持久化 | 不持久化 | 避免「streak 看着断了」的困惑 |

---

## 12. 下一步

1. ✅ Spec 写完并 commit。
2. 🟡 用户 review spec（必须的 gate）。
3. ⏳ 调用 `superpowers:writing-plans` skill 产出详细实施计划（精确到文件，按 TDD 规则 test-first）。
4. ⏳ 在 feature branch 实施，PR review，merge。
5. ⏳ 手动冒烟测试 + 视觉回归。
6. ⏳ `vercel --prod` 部署。
