# Becoming — 交接文档

> 上次更新: 2026-05-05 14:55
> 上次会话产出: 全部完成 confetti 回归 + 肯定语 4 层"心中一亮"动画 + bundle 拆分 + demo mode + F 设计登录页 + Will Durant tagline + 5 个 demo-flow E2E
> 当前 prod: `https://micro-habits-zeta.vercel.app`（main 本地领先 push 待 deploy，HEAD = `514d52b`）

---

## 1. 一句话现状

应用已从 `Micro Habits` 改名为 **Becoming**，引入 affirmations 作为一等内容类型（与 habits 并列）。本次会话进一步：恢复 confetti 撒花动画、肯定语点亮升级为 4 层"心中一亮"组合动效、bundle 拆 5 个 vendor chunk + HistoryView 懒加载（首屏 main chunk -8KB）、新加 `?demo=1` 模式跳过 Firebase Auth、登录页换为 F 方案（timeline + 闪烁 cursor + outline button）、Practice tagline 换为 Will Durant、新增 5 个 demo-flow E2E。线上还是上次的 `08b13ac`，本会话改动**未 push 未 deploy**。

---

## 2. 项目栈速览

| 模块 | 技术 |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind v4 + motion/react |
| State | 自写 hook `src/useStore.ts` (Firestore `onSnapshot` 实时监听，无 Redux/Zustand) |
| Auth | Firebase Auth + Google OAuth |
| Database | Firestore (`ai-studio-ab924c4d-55bb-42f4-beb5-a1fb1f58cb4f` 自定义 database) |
| Hosting | Vercel（手动 CLI 部署，**未连 GitHub auto-deploy**） |
| Cloud Function | `dailyTaskReminder` (functions/) — 推送通知调度器 |
| PWA | `vite-plugin-pwa`，含 push handler + SW |
| Tests | vitest 单元 + Playwright E2E |
| Repo | `https://github.com/ZhongJiaqi/micro-habits` (private) |
| Branch | main（feat/becoming-impl 已 fast-forward merge 到 main） |

**重要的非常规配置**：

- **Firestore database 是自定义 ID** (`ai-studio-...`)，不是 default。`firebase.json` 必须用数组形式 `firestore: [{ database: "...", rules: "firestore.rules" }]`
- **Vercel 不连 GitHub**，每次部署用 `vercel --prod`（user CLI 已登录，token 偶尔失效，需 `vercel login`）
- **Firebase Auth authorized domains** 必须含 `micro-habits-zeta.vercel.app`（已加，登录可用）
- **Google OAuth client redirect URIs** 同时含 `firebaseapp.com/__/auth/handler`（默认）+ `micro-habits-zeta.vercel.app/__/auth/handler`（reverse proxy 兼容）
- **package.json `name` 字段保留 `micro-habits`** 不改成 becoming（避免 Vercel slug 重链接，已在 spec §7 决定）

---

## 3. 数据模型（重构后）

```ts
// src/types.ts

export type MicroHabitCategory = 'habit' | 'affirmation';

export interface MicroHabit {
  id: string;
  title: string;
  createdAt: string;       // ISO
  active: boolean;
  userId: string;
  category: MicroHabitCategory;  // 新增，旧数据 lazy migration default 'habit'
}

export interface Task {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  completed: boolean;
  habitId: string;         // 现在必填，所有 task 都来自 habit
  userId: string;
  // ❌ 删除 type: 'habit' | 'one-time'
  // ❌ 删除 priority?: 'low' | 'medium' | 'high'
}

export interface HabitPoolItem {  // Hall of Fame
  id: string;
  habitId: string;
  title: string;
  achievedDate: string;
  userId: string;
}
```

**Firestore 集合**（路径未重命名，留作未来 v2）：

- `users/{uid}/microHabits` — habit 定义
- `users/{uid}/tasks` — 每日 task 实例（确定性 ID `{habitId}_{date}`）
- `users/{uid}/habitPool` — Hall of Fame entries
- `users/{uid}/fcmTokens` — push notification tokens
- `users/{uid}/pushSubscriptions` — Web Push subscriptions

---

## 4. UI 信息架构

```
[ Today ]   [ Practice ]   [ History ]
```

| Tab | 内容 |
|---|---|
| **Today** | 每日打卡。Affirmations section 在上（italic + `&ldquo;...&rdquo;`），Habits section 在下（serif 正立）。空 section 标题不渲染。**习惯完成态**：圆形 check 填 `#8A9A86` + line-through。**肯定语完成态**：金圆点 `#C9A961` + 不划线 + 4 层"心中一亮"组合（一颗 ✨ scale 0→3.5 扩散 + 行尾常驻 ✨ overshoot 弹入 + 标题 textShadow 金色脉冲 1.4s + 行背景金色微光横扫 1.2s）。**全部完成态**：顶部 "All completed." 渐变带 + canvas-confetti 80 颗金色撒花（`disableForReducedMotion`） |
| **Practice** | 管理 habits / affirmations。两个 section + 各自 + 按钮。顶部 **Will Durant tagline** *"You are what you repeatedly do."*（去引号 + 去名人归属，跟登录页 James Clear 句子去重）。Affirmations 空态 *"Words you live by, repeated."*；Habits 空态 *"The beginning of a new chapter."* |
| **History** | Calendar heatmap + Best Streak + **Active Practices** + Weekly Progress + The 21-Day Hall。顶部 filter `[All / Habits / Affirmations]`，filter 是视图镜头不持久化。HistoryView 通过 `React.lazy` 懒加载（首屏不下载，独立 chunk 10.3 KB gzip） |

**登录页（F 设计 — `LoginPage.tsx` 独立组件）**:
- warm cream `#F5F2EC` 背景
- header: 3-dot horizontal timeline，最右一个填充黑色 = "今天是开始"
- 标题 `Becoming` 大字 serif + 后面闪烁 cursor `|`（视觉化 -ing 进行时态）
- italic serif tagline（去引号 + 去名人归属）：*Every action you take is a vote for the type of person you wish to become.*
- outline button "Continue with Google"，hover 时 left→right 黑色 fill
- 三段独立 layout（header / main / footer 而不是单 max-w-md 容器，避免 absolute 定位错乱）

**Header（应用内主面）**: 应用名 **Becoming** 大字 serif

---

## 5. 关键文件

| 文件 | 责任 |
|---|---|
| `src/useStore.ts` | 中央 store hook。daily reset effect + lazy migrations（category backfill, one-time delete）+ `calculateStreak` 纯函数 + `addMicroHabit(title, category)` |
| `src/useDemoStore.ts` | **新（本会话）** 同 useStore 接口的 in-memory store，4 条预置数据；用于 `?demo=1` 模式跳过 Firebase Auth |
| `src/types.ts` | 类型定义 |
| `src/firebase.ts` | Firebase 初始化 + same-origin authDomain override（仅 `*.vercel.app` 域名生效） |
| `src/lib/auth.ts` | `signInWithGoogle` 检测 mobile/PWA → redirect，桌面 → popup |
| `src/components/TodayView.tsx` | 每日打卡 UI。**含 4 层"心中一亮"动效 + canvas-confetti 全部完成撒花** |
| `src/components/PracticeView.tsx` | 双 section CRUD（重命名自 HabitsView）|
| `src/components/HistoryView.tsx` | Calendar + filter + Hall。**通过 React.lazy 懒加载** |
| `src/components/LoginPage.tsx` | **新（本会话）** F 设计独立组件 — timeline + 闪烁 cursor + outline button |
| `src/components/SwipeActions.tsx` | 移动端左滑编辑/删除（不动） |
| `src/App.tsx` | tab 路由 + 登录态 gate + demo 模式 + 推送权限 prompt。**接入 LoginPage + useDemoStore + HistoryView 懒加载** |
| `firestore.rules` | 安全规则（已在上次会话 dogfood 修复 isValidTask） |
| `vercel.json` | reverse proxy `/__/auth/*` 到 firebaseapp.com（绕 ITP）+ SPA fallback |
| `vite.config.ts` | PWA manifest + `navigateFallbackDenylist: [/^\/__\//]` + **manualChunks 拆 5 个 vendor chunk**（firebase / motion / date-fns / lucide / confetti） |
| `functions/src/index.ts` | dailyTaskReminder Cloud Function（v2 scheduled）|
| `tests/useStore.test.ts` | 26 单元测试（含 calculateStreak / migration 测试） |
| `tests/e2e/habits.spec.ts` | 7 E2E 测试（登录页 brand + manifest + meta） |
| `tests/e2e/demo-flow.spec.ts` | **新（本会话）** 5 个 demo-flow E2E（登录后 UI 渲染 / 交互 / 导航） |

**Spec 和 Plan**:

- `docs/superpowers/specs/2026-05-03-becoming-rebrand-and-affirmation-module-design.md` — 设计 spec（中文，568 行）
- `docs/superpowers/plans/2026-05-03-becoming-rebrand-and-affirmation-module.md` — 实施 plan（11 task / 1621 行）
- `docs/superpowers/plans/...` 之外**不要**新增 Plan 目录里其他文件，按 superpowers 流程

---

## 6. 本次会话（2026-05-05）干了什么

| Phase | 内容 | Commit |
|---|---|---|
| **A** | 全部完成 confetti 回归 + 肯定语 4 层"心中一亮"动画（一颗 ✨ 扩散 + 行尾常驻 ✨ + 标题暖辉 + 行背景金光横扫） | `93df78a` |
| **B** | vite.config.ts 加 manualChunks 拆 4 vendor chunk（firebase/motion/date-fns/lucide）首屏 main 76→68 KB gzip | `6f87b13` |
| **C** | F 设计登录页落地 + Practice tagline 换 Will Durant + E2E 同步去 James Clear 名字断言 | `7622633` |
| **D** | demo mode：useDemoStore.ts 新增 + App.tsx 接 ?demo=1 跳过 Auth + Exit Demo 按钮 + 接入 LoginPage | `3579bb3` |
| **E** | canvas-confetti 独立 vendor chunk + HistoryView 用 React.lazy 懒加载（独立 10.3 KB gzip） | `646a9c9` |
| **F** | 5 个 demo-flow E2E（Today 双 section / 切 Practice 看 Will Durant / 切 History 看 Active Practices / 点击 toggle / Exit Demo 返登录） | `514d52b` |

**总验证状态**：lint 0 错 / 26 单元测试通过 / 12 个 E2E 全过 / build 0 warning。

**未完成（移交下次）**：
- gstack 1.26.0.0 → 1.26.3.0 升级（CLI self-modification guard 拦了 agent 自升，需用户手动 `cd ~/.claude/skills/gstack && git fetch && git reset --hard origin/main && ./setup`）
- "名字" 残留：`metadata.json` 的 `微习惯 (Micro Habits)` / `useStore.ts:254` 注释 / `README.md` URL / `package.json` name / GitHub repo / Vercel slug `micro-habits-zeta`（用户说"先不改"）
- Firebase Auth Emulator 真登录态 e2e（spec §10 推迟到 v2，已用 demo-flow 间接覆盖）
- 配 OpenAI API key 让 design-shotgun 能真 AI 出图（写 `~/.gstack/openai.json` 或 `OPENAI_API_KEY` env）
- 自定义域名 `becoming.app` / 应用市场 / 数据导出（spec §10 / handoff §8 已记录）

---

## 6.x 上次会话（2026-05-03）—— Becoming rebrand 史

### Phase 1：iOS 移动端登录修复（早晨）

**问题**：用户手机登不上（错误页 "The requested action is invalid"）。

**5 层根因 + 修复**（commit `c08d49f`）：

1. iOS Safari standalone 模式 popup 失败 → `signInWithGoogle` 移动 UA 走 `signInWithRedirect`
2. iOS Safari 14+ ITP 隔离第三方 storage → `firebase.ts` 在 `*.vercel.app` 域用同源 authDomain
3. OAuth 跨域 state 丢失 → `vercel.json` reverse proxy `/__/auth/*` 到 firebaseapp.com
4. **PWA SW 把 `/__/auth/handler` 替换成 SPA index.html** → `vite.config.ts` 加 `navigateFallbackDenylist: [/^\/__\//]`
5. GCP OAuth client 没把 zeta 加 redirect URI → 用户去 GCP Console 手动加

**最终 root cause**：用户的 VPN 被 iOS 26.4.2 系统更新关掉了，根本是网络问题。但 5 层修复都是真改进（iOS 17+ 趋势），仍保留。

**learning**：诊断 iOS Safari 登录问题时，先排除网络/VPN，再查代码层。

### Phase 2：Becoming rebrand 设计（中午）

通过 superpowers brainstorming + visual companion 引导，决定：

- 应用改名 **Becoming**（来自 James Clear "vote for who you wish to become" 的进行时）
- 引入 **affirmations** 作为一等内容（不再藏在 habits 里）
- IA 选 B：同页两 section（Practice tab，含 Habits + Affirmations）
- 顺序：**Affirmations 在上，Habits 在下**（早晨先念后做的仪式感）
- 视觉：肯定语 italic + `&ldquo;...&rdquo;` 弯引号；习惯 serif 正立
- Streak / heatmap **合并算**（"今天全做完" = 完美日）
- Hall of Fame **不分类**（合并 list）
- 删 one-time task **硬删除**
- 数据迁移：lazy migration on read，幂等
- Tagline: *"Every action you take is a vote for the type of person you wish to become." — James Clear*（直接原文，不改写）

Spec: `docs/superpowers/specs/2026-05-03-becoming-rebrand-and-affirmation-module-design.md` (commit `c9ff37b`)

### Phase 3：实施 plan + 11 task subagent-driven 实施（下午）

每个 task fresh subagent + 双 review（spec + code quality）：

| Task | Commit | 关键改动 |
|---|---|---|
| 1 | `1fcb28e` | types.ts 加 category，删 type/priority |
| 2 | `0057f9b` | useStore lazy migration backfill category |
| 3 | `b9e393d` | useStore 硬删 legacy one-time tasks |
| 4 | `e405a2f` | 抽 calculateStreak + addMicroHabit 接 category |
| 5 | `155f22c` | TodayView 双 section（285→116 行） |
| 5b | `b58e4fd` | hotfix: 引号改 HTML entities (避 CSS escape 风险) |
| 6 | `fcb464b` | HabitsView → PracticeView，双 section CRUD |
| 7 | `9cb463d` | HistoryView filter + Active Practices + Hall affirmation 渲染 |
| 7b | `d7fea71` | 删 dead code taskCompletion.ts |
| 8 | `e4d4b12` | App.tsx rebrand → Becoming + login subtitle |
| 9 | `fb9d9eb` | index.html / vite.config / README rebrand |
| 10 | `83c233f` | E2E 断言更新 |

**verification**: lint 0 errors / 26 unit tests pass / 7 E2E tests pass / build success

### Phase 4：dogfood + 发现 critical bug（傍晚）

用 gstack browse（升级到 v1.26.0.0 ARM64 native 后稳定）+ visible Chrome handoff，自动化跑：

- 桌面登录后 Today 页（13 旧习惯）
- Practice 页（James Clear tagline + 双 section）
- 创建 affirmation "I am enough."
- **❌ Today 没显示新 affirmation** — daily reset 创建 task 报 `Missing or insufficient permissions`

**Root cause**: `firestore.rules` 的 `isValidTask` 还要求 `type` 字段，但 Becoming refactor 删了 type。**Plan §7 把 firestore.rules 标"可选"，实际是必修项**。

**Hotfix** (commit `08b13ac`):

- `isValidTask` required fields 改为 `[id, title, date, completed, habitId, userId]`
- 删除 `type in ['habit', 'one-time']` 验证
- 删除 priority 验证
- `firebase deploy --only firestore` → ai-studio 数据库 release new ruleset

修复后 dogfood 全部通过：affirmation 创建 + checkbox toggle + History filter All/Habits/Affirmations 都正常。

### Phase 5：merge + push（晚上）

- `git checkout main && git merge --ff-only feat/becoming-impl`
- `git push origin main` → GitHub origin/main 跟上 prod

### Sessions 全部 commits（按时间）

```
08b13ac fix(firestore.rules): isValidTask hotfix             ← dogfood 发现
83c233f test(e2e): 更新断言 Becoming + James Clear
fb9d9eb chore: rebrand index.html / PWA manifest / README
e4d4b12 feat(App): Becoming rebrand + login subtitle
d7fea71 chore: 删 dead code taskCompletion.ts
9cb463d feat(HistoryView): filter + Active Practices + Hall affirmation
fcb464b feat(PracticeView): 重命名 + 双 section + James Clear
b58e4fd fix(TodayView): 引号改 inline span
155f22c feat(TodayView): 双 section 渲染
e405a2f refactor(useStore): calculateStreak + 删 task.type 过滤
b9e393d feat(useStore): 删 one-time tasks migration
0057f9b feat(useStore): category lazy migration
1fcb28e refactor(types): 加 category 删 type/priority
964ac94 docs: 实施 plan
c9ff37b docs: spec 中文版
0907333 docs: spec 英文版
c08d49f feat: 修 iOS 移动端登录失败 + 同步推送通知到 git
```

---

## 7. 尝试过 / 失败 / 学到的

### 失败的尝试（避免重复踩坑）

1. **gstack browse 在 ARM mac 上 server 反复重启**
   - 原因：老版本 gstack 的 binary 是 x86_64，通过 Rosetta 跑，bun 依赖 AVX 但 Rosetta 不支持 → silent crash
   - 教训：在 ARM mac 上跑 bun-based 工具前先 `file <binary>` 确认架构。升级 gstack 到 v1.26.0.0 后是 native ARM，server 跨命令复用稳定

2. **本地 dogfood (localhost:4173) 报 `auth/unauthorized-domain`**
   - 原因：Firebase Auth authorized domains 没含 localhost（被项目移除过或没初始化）
   - 教训：本地 dogfood 登录态前要先确认 Firebase Console authorized domains。或者直接用 prod URL（已 authorized）跑 dogfood，更省事

3. **plan §7 把 `firestore.rules` 标"可选"是错的**
   - dogfood 阶段才发现 isValidTask 拒绝新 task → 必须是 plan 范围内的 critical 改动
   - 教训：refactor 删字段时，所有 server-side validation（rules / Cloud Functions / external schemas）都要同步检查

4. **commit message 加了"Co-Authored-By Claude" 被全局 hook 阻止**
   - 项目 settings 里全局禁用了 attribution
   - 教训：本项目 commit message 不要带 Co-Authored-By（已遵守）

5. **Vercel token 偶尔失效**
   - `vercel --prod` 报 "The specified token is not valid" → user 用 `! vercel login` OAuth 重新登录
   - 这是 routine，不是 bug

### 成功的方式（值得复用）

1. **superpowers:brainstorming + visual companion** 引导文案 / IA 决策非常有效。最终定下 Becoming 名字 + James Clear tagline 都是来回多轮迭代得到
2. **subagent-driven 实施 + 双 review** 抓到了多个 quality issue（虽然多是 minor）
3. **Playwright MCP + gstack browse 自动化 dogfood** 抓到了 firestore.rules critical bug，比手动测更稳更全
4. **`firebase deploy --only firestore`**（不是 `--only firestore:rules`）能确保 multi-database 配置 picks up

### 决策回顾

- 删除 one-time task 选 **真删除**（B3）— 用户"几乎不用" + 留着是死代码
- App 名 **Becoming**（强推中选）— 进行时跟 James Clear quote 同根
- Practice 页改名（B1）— 跟双内容一致
- Filter 不持久化 — 避免"上次切到 Habits 这次进来 streak 看着断了"困惑
- Hall of Fame 一个统一 hall — 跟合并 streak 心智一致

---

## 8. 已知遗留 / 待优化项

### 不阻塞但值得记录

1. ~~**Bundle 体积**: 882 KB / 242 KB gzipped。超 landing budget。~~ **已部分解决（2026-05-05）**：拆 5 个 vendor chunk + HistoryView 懒加载，main chunk 76→68 KB gzip。Firebase SDK 仍占大头（108 KB gzip）但已独立缓存。下一步可以考虑动态 import firebase 直到用户登录后再加载（更激进）。

2. **`store: any` 类型**: 所有 view 组件用 `store: any`，TS 不安全。沿用旧 pattern。**未来优化**：抽 `MicroHabitStore` interface，但跨多文件改动，scope creep。

3. **package.json 仍是 `micro-habits`**: 没改成 becoming，避免 Vercel slug 重链接。Spec §7 明确决定保留。本次会话用户也选了"先不改名"。

4. ~~**登录态 e2e 测试缺口**~~ **已部分解决（2026-05-05）**：用 demo mode 替代 — 5 个 demo-flow E2E 覆盖登录后 UI 渲染 / 交互 / 导航。真 Firebase Auth 链路 e2e（用 Auth Emulator）仍 deferred 到 v2。

5. **dailyTaskReminder Cloud Function 日志告警**: `firebase-debug.log` 里有 `show_missing is not supported for Enterprise Edition databases` 错误。可能不影响实际运行（function 仍在跑），但建议有空看一眼。

6. **gstack 升级被 self-modification guard 拦**: 1.26.0.0 → 1.26.3.0 提示已出现，agent 不能自升 ~/.claude/skills/gstack。用户手动一行：`! cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main && ./setup`

7. **`?demo=1` 模式代码进 prod bundle**: useDemoStore 没有 `import.meta.env.DEV` 守卫，prod build 也包含约 2 KB demo store。可以加 dev guard tree-shake 掉，本次 minor 没做。

8. **Continue with Google 按钮无 explicit aria-label**: 视觉够用，未来 i18n 时可统一处理。

9. **手机端 PWA 旧 SW 残留**: 用户手机如果加了 Becoming 到主屏幕，可能需要**删除 PWA + 清 Safari 数据 + 重启 iPhone** 才能拿到最新代码。这是 iOS Safari SW 顽固 bug，不是我们的问题。新用户加 PWA 直接是新版，无影响。

10. **localhost 不在 Firebase Auth authorized domains**: 本地 dev `npm run dev` 用真 Google 登录会报 `auth/unauthorized-domain`。**绕开方案**：用 `?demo=1` 进 demo 模式（已实现）。**永久解决**：Firebase Console → Authentication → Settings → Authorized domains → Add `localhost`。

### 数据迁移残余

旧用户的 microHabits 在第一次访问后会被 `migrateMicroHabitCategory` lazy 补上 `category='habit'`。但**用户用 ✨ 包裹的肯定语类内容仍是 category='habit'**（迁移只补默认值，不智能识别）。如果想批量迁移，可以：

- 选项 A：让用户手动删了重建为 affirmation
- 选项 B：写一个 admin 脚本检测 `title` 含 `✨` 改 category='affirmation'
- 选项 C：spec §4 决定 v1 不允许跨 category 移动，**保持现状**（推荐）

### Firestore Rules 容忍度

新 `isValidTask` 不强制 absent type/priority，对**旧 task 文档**（带 type/priority）read 仍 OK，create/update 也 OK（rules 用 `hasAll` 不是 `equals`）。这是有意的兼容性设计。

---

## 9. 下次会话开局指引

### 如何快速进入状态

```bash
cd /Users/jiaqizhong/micro-habits
git log --oneline -5            # 看最新 commits
git status                       # working tree 状态
npm run lint && npm test -- --run  # 快速 verify 健康
```

### 各文档定位

- 这份 **handoff.md**: 高层状态 + 时间线
- **spec**: `docs/superpowers/specs/2026-05-03-becoming-rebrand-and-affirmation-module-design.md`（决定 trail + 设计原则）
- **plan**: `docs/superpowers/plans/2026-05-03-becoming-rebrand-and-affirmation-module.md`（详细实施步骤，可作为 reference）
- **CLAUDE.md**: 项目级规则（数据流 / 关键设计决定）

### 常用命令

```bash
# 本地开发
npm run dev                      # vite dev :3000（用 ?demo=1 跳过 Firebase Auth）
npm run preview                  # vite preview :4173 (跑 dist 产物)

# 验证
npm run lint                     # tsc --noEmit (期望 0 errors)
npm test -- --run                # vitest 单跑（26 unit）
npm run test:e2e                 # Playwright (auto-build + preview)（12 e2e: 7 login + 5 demo）

# 部署
vercel --prod                    # 生产部署 (需 user authorized + token 有效)
firebase deploy --only firestore # firestore.rules deploy
firebase deploy --only functions # Cloud Functions deploy

# 回滚
vercel alias set <old-deployment-url> micro-habits-zeta.vercel.app  # 快速 alias 切回
git revert HEAD                                                     # 代码回滚
```

### Demo 模式（本地开发 / 演示）

```
http://localhost:3000?demo=1     # 跳过 Firebase Auth，预置 4 条数据
                                 # 2 affirmations + 2 habits 的 in-memory store
                                 # Sign Out 按钮变 "Exit Demo"
```

### 紧急联系

- Firebase project: `gen-lang-client-0474013935` (Console: https://console.firebase.google.com/project/gen-lang-client-0474013935)
- Vercel: project `micro-habits` in team `jiaqis-projects-c666d1ab`
- GitHub: `https://github.com/ZhongJiaqi/micro-habits` (private)
- Firestore database: `ai-studio-ab924c4d-55bb-42f4-beb5-a1fb1f58cb4f`

### 下一步可能的工作（用户决定优先级）

| 候选 | 说明 |
|---|---|
| 用户实际使用反馈收集 | 让我自己 / 朋友用一周看是否好用 |
| Bundle 优化 | dynamic import + chunk splitting |
| 登录态 E2E（Firebase Auth Emulator）| 完整 e2e 覆盖 |
| 域名: `becoming.app` 自定义域名 | DNS + Vercel 配置 + Firebase authorized |
| 应用市场上线 | PWABuilder 打包 → App Store / Play Store |
| 数据导出/导入 | 用户备份功能 |
| 多设备同步可视化 | 当前 Firestore 已实时同步，但 UI 没显示同步状态 |

### 不要做的事（历史教训）

- **不要在 main 直接干**: 用 feature branch + ff merge
- **不要漏 firestore.rules**: refactor 字段时一起 review
- **不要直接动 settings.json**: 用 update-config skill 走 hook
- **不要 `git push --force` 到 main**: main 是 source of truth
- **不要 commit `.env.local` / `dist/` / `firebase-debug.log`**: 已在 .gitignore
- **不要把 prod URL hardcode 在测试**: 用 `BASE_URL` 变量

---

**当前 handoff 完成**。新会话拿这个文件 + spec + plan，能完整 reconstruct 项目状态。
