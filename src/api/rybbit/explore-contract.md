# Explore 首期维度契约

核对日期：2026-09-12。状态：已完成官方源码静态核对、共享查询上下文、首期 Breakdown 数据层，以及 Dashboard 的 Referrers 五行预览与完整列表；尚未进行完整的 Web 数值对照，其余首期维度界面也尚未实现。

## 1. 对齐基准与范围

- 官方仓库：`rybbit-io/rybbit`。
- 固定提交：[`2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d`](https://github.com/rybbit-io/rybbit/tree/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d)。该提交的 `server/package.json` 版本为 `2.9.1`；这不是已验证的最低兼容版本，也不证明目标实例部署了该提交。
- 对齐标准 Main Dashboard 的 Referrers、Pages、Browsers、Countries 面板及默认排序。`NEXT_PUBLIC_LITE_DASHBOARD=true` 使用另一组组件与端点，不属于本契约。
- 首期显示指标固定为 **Sessions**，读取 `count`；不跟随 Overview 的 Users/Pageviews 指标选择切换。
- 当前未提供目标自托管版本。后续实例验收须记录实际版本和标准/Lite 模式；出现差异时核对该版本源码，不静默替换统计口径。

来源：[MainPage][main]、[构建开关][const]、[服务端版本][package]、[StandardSection][section]、[Row][row]。

## 2. 四维度映射

所有请求使用 `GET /api/sites/:siteId/metric`。四个维度没有独立的 Sessions 请求参数；端点自行计算 `count`。

| 分类 / Web tab | `parameter` | `value` 与展示 | `count` 的实际计算 | 服务端排序 |
| --- | --- | --- | --- | --- |
| Acquisition / Referrers | `referrer` | 服务端 `domainWithoutWWW(referrer)`；原样显示该域名 | 在查询时间窗内，先排除空域名事件，再按会话取最早事件的域名，按域名统计不同 `session_id` | `count DESC, value ASC` |
| Content / Pages | `pathname` | 原始 pathname；Web 展示最多前 50 字符加 `...`，空值显示 `Other` | 只取时间窗内的 `type = 'pageview'`，按 pathname 统计不同 `session_id` | `unique_sessions DESC, pathname ASC` |
| Technology / Browsers | `browser` | 后端 browser 字符串，不在客户端合并或重新解析 UA | 时间窗内排除空 browser 后，每个会话取最早的 browser，再按 browser 统计不同 `session_id` | `count DESC, value ASC` |
| Geography / Countries | `country` | 后端国家代码作为原始键；Web 用英文 `Intl.DisplayNames` 转换展示名称 | 时间窗内排除空 country 后，每个会话取最早的 country，再按 country 统计不同 `session_id` | `count DESC, value ASC` |

共同规则：

- Referrers、Browsers、Countries 的归因输入不限于 pageview，而是查询窗口内满足条件的 events；不能在移动端从 pageviews 重新推算。
- “最早”是窗口内 `argMin(..., timestamp)`，不是无条件取整个会话生命周期的入口。相同 timestamp 的归因没有额外 tie-break，客户端应保留服务端结果。
- Pages 按 pathname 分组，不按 `(hostname, pathname)` 分组。不同 hostname 的同一路径合并；返回的 `hostname` 是 `anyHeavy(hostname)` 代表值，不能据此拆行。
- 一个会话访问两个路径，会在两个 Pages 行各计一次。每行仍是 Sessions，所有行的和可能超过 Overview 的总 Sessions。
- Referrers 排除了空域名；全程 Direct 的会话不会形成空值行。Web 有空字符串显示 `Direct` 的防御性分支，但不能由此推导 API 会返回 Direct 行，也不能用 Overview 总数减去 referrers 合计补一行。
- 浏览器空值的 Web 展示后备为 `Other`，但当前正常查询会排除空 browser。国家名称转换失败或无结果时保留原始代码；Web 没有统一改为 `Unknown`。不要自行补造缺失分类。
- 排序以原始服务端值为准，不能在国家名转换后按名称重新排序，也不能用设备 locale 的字符串排序代替服务端次级排序。

来源：[四个 Web 面板][referrers]、[Pages][pages]、[Devices][devices]、[Countries][countries]、[SQL 查询][metric]、[SQL 参数映射][sql-param]、[国家显示名称][labels]。

## 3. 请求、响应与分页

请求组成：

- 实例的规范化 server URL + `/api/sites/` + 经过编码的站点 ID + `/metric`。
- `parameter` 为上表中的准确 API 名称，不发送 UI 别名 `page`、`countries` 等。
- `time_zone` 为解析后的 IANA 时区；时间模式只发送一种，详见下一节。
- `filters` 非空时，将 Filter 数组 JSON 序列化后作为一个 URL 编码的查询参数；无筛选可省略。标准 Web 默认带全局筛选。
- `limit=100&page=1` 是当前标准面板的首屏请求。页号从 1 开始，后续递增；服务端 offset 为 `(page - 1) * limit`，默认 limit 也是 100。移动端可使用较小页大小，但不改变数据语义。
- 不需要 `bucket`、`metric=sessions` 或自造排序参数。
- MyRabbit 使用 `Authorization: Bearer <api_key>`，省略 cookies；不复制 Web 的浏览器 session 认证方式。

当前成功响应为两层 data：

```json
{
  "data": {
    "data": [
      { "value": "Chrome", "count": 3, "percentage": 75 }
    ],
    "totalCount": 2
  }
}
```

上例仅说明结构，非实测数据。`totalCount` 是当前查询的维度行总数，不是总 Sessions。`getMetric` 即使省略 `page` 仍返回该结构。

必需消费字段为 `value`、`count`、`percentage`、`totalCount`。运行时应验证对象层级、数组、有限数值及非负计数；不能缺字段就填 0。首期四维度按预期接受字符串 value；异常类型应作为不兼容/异常响应处理，不能任意强转并改变原始键。

额外字段可能包括 `hostname`、`pageviews`、`pageviews_percentage`、`bounce_rate`、`time_on_page_seconds`。首期不依赖这些字段，也不允许用它们替代 count。尤其通用维度分支的 `pageviews` 实际为 SessionData 上的 `COUNT()`，该 CTE 每会话一行，不能据字段名宣称它是原始 pageview 总数。

服务端数值转换器会尝试无损转换数值字符串，且并未把 `value` 排除在转换之外。正常四维度值是域名、路径、浏览器名和国家代码；对数值化的异常 value，后续兼容适配需要明确证据，不应作为通用猜测加入。

Web 分页规则：累加返回页的原始行数，达到最后一页 `totalCount` 时停止；展示时按 value 去重，保留第一次出现的行和顺序。不要把去重后的数量用于该停止计算。服务端 data 和 totalCount 分别查询，offset 分页不是快照；活跃时间段会有数据移动。移动端应补充空页终止和显式重试，刷新重置分页。

来源：[Metric hook][hook]、[通用查询 hook][query]、[响应端点][metric]、[分页执行器][pagination]、[数值转换][coercion]、[请求序列化][request]、[API 参数编码][api-utils]。

## 4. 时间、筛选与会话归因

| 模式 | 参数 | 服务端时间边界 |
| --- | --- | --- |
| 日历日期 | `start_date`, `end_date`, `time_zone` | 起始日当地零点包含；历史结束日的下一日当地零点排除。结束日是当地今天时，截止服务端当前时刻，包含当前边界 |
| 精确时间 | `start_datetime`, `end_datetime`, `time_zone` | `[start, end)`；Web 将选定时区的时间转换成 UTC 再发送 |
| 最近 N 分钟 | `past_minutes_start`, `past_minutes_end`, `time_zone` | `(now - start, now - end]`；start 大于 end，例如 30 和 0 |
| All Time | 空的 `start_date` / `end_date`，不带另一种窗口 | 无时间条件 |

- Web 时区是全局用户设置，默认 `system`，可手动选择并持久化；`system` 在请求前解析成实际时区。不能假定它总等于站点时区或手机时区。MyRabbit 现有设备时区仅在双方设置相同时自然对齐。
- 当前 MyRabbit 日期层已覆盖日历日期、相对分钟、All Time。精确时分范围并非本次 MVP 必须新增的 UI；对照时不要拿 Web 的精确时分查询与移动端整日查询比较。
- 对四个参数，`buildSessionAndRowFilterFragments` 的 row-level 参数列表为空：筛选先确定合格的会话，再统计这些会话中窗口内的事件。
- 例如 pathname `/pricing` 的筛选可筛出访问过该路径的会话，Pages 仍可显示这些会话访问的其他路径。禁止在客户端仅保留 `/pricing` 一行。
- 查询和筛选的归因实现并非处处相同：通用 breakdown 取最早非空维度；会话筛选对 browser/country 使用 `argMax`，referrer 使用最早非空归因。保留后端行为，不在移动端自行“统一修正”。
- Referrer 域名化由服务端执行；Channels 另用“首个有归因信号的 channel，缺少信号时回退”的规则。不要把 channel 规则复制到 referrer 查询。

来源：[时间窗口][time]、[Web 时区状态][store]、[Web 参数构建][api-utils]、[会话筛选][filters]、[会话来源归因][attribution]、[Metric 查询][metric]。

## 5. 百分比、条形图、格式与交互

- `percentage = round(count / sum(各维度行 count) * 100, 2)`，分母在 SQL LIMIT/OFFSET 之前计算，覆盖该查询全部分组；不是当前页的合计。
- Referrers 分母只含有非空来源归因的会话；Pages 分母是逐路径 Sessions 的合计；浏览器和国家分母分别排除缺失维度的会话。不要用 Overview 总数或已加载页的合计重算。
- Web 的比例系数为：首行 percentage 非零时 `100 / first.percentage`，否则 `1`；行宽为 `row.percentage * ratio` 百分比。它用的是已保留两位小数的 API percentage，因此与直接 `row.count / first.count` 可能略有不同。
- 保持首行作为整个已加载列表的缩放基准，不因滚动视口或页边界改变。特别覆盖首行 percentage 为 0 的高基数情况，不做除零。
- Web 默认紧凑数字格式，悬停显示完整 count；百分比悬停显示一位小数。移动端可以适配交互，但必须可访问完整原始 count；条宽不是用户占比这一新指标。
- Pages 可以适配长文本布局，但原始 pathname 必须保留用于键、可访问性和未来筛选。Browsers 的 `Chrome`、`Mobile Chrome` 等不合并。
- Country 展示采用 `new Intl.DisplayNames(['en'], { type: 'region' })`，传入大写代码；原始 value 不改。不同运行时 ICU 名称可能有展示差异，先保留代码并在对照时记录，不能改变分组。
- Web 点击行会切换该 parameter + 原始 value 的 equals filter。首期筛选 UI 不在范围内，可不提供行筛选交互，但不能把展示名称作为未来过滤值。
- Web 浏览器展开查询 `browser_version`，并附加 browser equals 筛选。MVP 可不做展开；不要预留假数据或不可用按钮。

来源：[StandardSection][section]、[Row][row]、[展开表格默认排序][dialog]、[Countries][countries]、[名称转换][labels]。

## 6. 认证与错误边界

- 路由注册为 `publicAnalyticsRead`，使用站点访问控制和 `analytics:read` scope。MyRabbit 仍必须按项目约定发送手工 API key。
- 此路由允许公开站点的匿名基线访问；成功读取公开站点不能证明 key 有效。它不应替代现有连接验证。
- 私有站点无访问权时可返回 `403 Forbidden`，有效但 scope 不足时返回带不足 scope 信息的 403，限流可返回 429。不能假设无效 key 在该端点一定是 401。
- HTTP 时间参数校验可返回 400；查询执行失败返回 500。保留服务端可辨识错误信息供分类，不将所有错误解释为“无数据”或“不支持版本”。
- 单次 404/400 不足以证明旧版不支持维度；需结合站点有效性、错误内容和已确认版本。网络失败不清除凭据。

来源：[路由与 scope][routes]、[访问控制][auth]、[查询错误处理][pagination]、[时间参数校验][validation]。

## 7. 对原 issue 的修正与后续验收

已确认需要修正：

1. 四个默认面板均为 Sessions，包括 Pages，删除“session count or whichever metric Web uses”这一不确定表述。
2. Referrers 不自行添加 Direct；Countries 允许展示层代码到名称转换。
3. 默认顺序为 count 降序、原始维度值升序；百分比和相对条按上述公式。
4. 本提交标准 Titles tab 使用 `/metric?parameter=page_title`，并非 `/page-titles`。后者是另一接口；不能只因存在该 API 就替换 Web 实际端点。Titles 不属于首期交付。
5. UTM 是 `utm_source`、`utm_medium`、`utm_campaign`、`utm_term`、`utm_content` 五个参数；Map 是单独内容组件。此次仅确认分类，未完成这些扩展维度契约。

源码推导的最小验收场景（不是已执行测试）：

| 场景 | 预期 |
| --- | --- |
| 一个会话在窗口内先 Direct 后 google 来源 | Referrers 归于 google 的服务端域名结果；不增加 Direct 行 |
| 会话全部为 Direct | 不计入 Referrers 的分组和百分比分母 |
| 同一会话 `/a` 两次、`/b` 一次 | Pages 两行 count 均为 1；各占 50%；额外 pageviews 分别为 2、1 |
| 两个 hostname 出现相同 pathname | Pages 合并为同一 pathname 行 |
| 两行 count 相同 | 使用服务端原始 value 次级升序，不按展示名称排序 |
| 一页未覆盖全部维度 | percentage 不随 limit 改变；totalCount 表示全量行数 |
| 日期末尾、跨时区、跨 DST | 与同一时区 Web 请求的边界一致 |
| 数据为空 | `data.data = []`、`totalCount = 0` 是空状态；结构缺失是异常 |

后续真实对照应选已经结束的固定历史范围，并记录：实例版本、标准/Lite 模式、site、时区、完整时间参数、filters、limit/page、原始响应以及 Web 行值和顺序。至少核对上述四维度，并补一组超过一页的数据。移动端页面能显示实例数据，但尚未按本契约记录完整的 Web 数值与顺序对照；这些运行时对照仍属于实现后的验收。

共享上下文和 Breakdown 数据层现已分别落在 `analytics-context.ts` 与 `breakdown.ts`。Dashboard 展示 Referrers 前五行，独立详情保留完整计数、相对条形图、分页、刷新以及加载、空白和错误状态。Pages、Browsers、Countries 界面与完整的 Web 数值对照仍未完成。

## Content 扩展核对（2026-10-18）

新增 Content 单元，按当前官方标准 Web 的 tab 顺序展示 Pages、Titles、Entries、Exits、Hostnames。以下扩展核对的是当日 `master` 源码，不将旧版自托管实例假定为相同实现。

| Tab | `/metric` parameter | Sessions 口径 |
| --- | --- | --- |
| Pages | `pathname` | 查询窗口内 pageview 按原始 pathname 分组，每行统计不同 session_id |
| Titles | `page_title` | 查询窗口内非空标题的 pageview 按原始标题分组，每行统计不同 session_id |
| Entries | `entry_page` | 每个合格会话在查询窗口内的首个 pageview 路径，再按路径统计不同 session_id |
| Exits | `exit_page` | 每个合格会话在查询窗口内的最后一个 pageview 路径，再按路径统计不同 session_id |
| Hostnames | `hostname` | 通用维度分支取窗口内每会话最早非空 hostname，再按值统计不同 session_id |

五个 tab 均读取 `count`，保留服务端顺序、原始键及分页；不用额外 `pageviews` 替代 Sessions。Pages/Titles/Entries/Exits 的空字符串显示 `Other`，不改动原始 value。移动端允许两行长文本，辅助功能标签保留完整值。条宽优先使用 API percentage 和首行 percentage，遵循第 5 节的 Web 公式；事件接口无 percentage 时使用计数的相对比例。

Explore 预览最多五行，标题右侧 chevron 进入保留当前 tab 的 Content 内页；内页加载全部可用 API 页并按原始键去重。沿用共享站点、时间、时区和筛选，以及取消、超时、空状态、失败和重试。旧实例若不支持某参数，显示原有请求错误，不伪造空列表或改用其他接口。

来源：[Pages tabs](https://github.com/rybbit-io/rybbit/blob/master/client/src/app/%5Bsite%5D/main/components/sections/Pages.tsx)、[StandardSection](https://github.com/rybbit-io/rybbit/blob/master/client/src/app/%5Bsite%5D/components/shared/StandardSection/StandardSection.tsx)、[Metric hook](https://github.com/rybbit-io/rybbit/blob/master/client/src/api/analytics/hooks/useGetMetric.ts)、[服务端 Metric SQL](https://github.com/rybbit-io/rybbit/blob/master/server/src/api/analytics/getMetric.ts)。尚未访问真实实例进行 Web 数值对照。

## 固定提交源码索引

[main]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/main/page.tsx
[const]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/lib/const.ts
[package]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/package.json
[referrers]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/main/components/sections/Referrers.tsx
[pages]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/main/components/sections/Pages.tsx
[devices]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/main/components/sections/Devices.tsx
[countries]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/main/components/sections/Countries.tsx
[section]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/components/shared/StandardSection/StandardSection.tsx
[row]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/components/shared/StandardSection/Row.tsx
[dialog]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/app/%5Bsite%5D/components/shared/StandardSection/StandardSectionDialog.tsx
[labels]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/lib/utils.ts
[hook]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/api/analytics/hooks/useGetMetric.ts
[query]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/api/analytics/useAnalyticsQuery.ts
[request]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/api/analytics/analyticsRequest.ts
[api-utils]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/api/utils.ts
[store]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/client/src/lib/store.ts
[metric]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/getMetric.ts
[sql-param]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/getFilterStatement.ts
[pagination]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/analyticsQuery.ts
[coercion]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/utils.ts
[time]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/timeWindow.ts
[filters]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/sessionFilters.ts
[attribution]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/sessionAttribution.ts
[routes]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/index.ts
[auth]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/lib/auth-middleware.ts
[validation]: https://github.com/rybbit-io/rybbit/blob/2c8d7fcd310cb1be689ac1d03ea814fb7c5f466d/server/src/api/analytics/utils/query-validation.ts
