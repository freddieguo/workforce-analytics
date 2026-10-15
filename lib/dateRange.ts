// 日期范围筛选工具（服务端用）：前端日期选择器的底料。
// 每日数据集的日期列都是 "日期"（YYYY-MM-DD 字符串），直接按字符串比较即可。

import { cookies } from "next/headers";

export type DateRange = { start: string; end: string; min: string; max: string };

/**
 * 读用户上次选的日期范围（会话 cookie，关浏览器就清掉）。
 * 页面没带 URL 参数时用它做默认；带了 URL 参数时 URL 优先。
 */
export async function getSavedRange(): Promise<{ start?: string; end?: string }> {
  try {
    const store = await cookies();
    const raw = store.get("dateRange")?.value ?? "";
    const [s, e] = raw.split("|");
    return { start: s || undefined, end: e || undefined };
  } catch {
    return {};
  }
}

/** 由全部日期 + URL 参数算出有效范围。
 * 只要参数带了就直接用（不拿本页的 min/max 去卡），这样不同页之间选的范围能保持一致；
 * 参数缺失时才回退到全量范围。
 * 会过滤掉 Excel 空日期 artifact（如 1899-12-31）这类明显无效的日期。 */
export function resolveRange(
  allDates: Array<string | undefined>,
  startParam?: string,
  endParam?: string
): DateRange {
  const sane = (d?: string) => Boolean(d && d >= "2000-01-01");
  const valid = [...new Set(allDates.filter(Boolean) as string[])]
    .filter(sane)
    .sort();
  const min = valid[0] ?? "";
  const max = valid[valid.length - 1] ?? "";
  let start = sane(startParam) ? (startParam as string) : min;
  let end = sane(endParam) ? (endParam as string) : max;
  if (start > end) [start, end] = [end, start];
  return { start, end, min, max };
}

/** 过滤每日数据集的行：只留 日期 在 [start, end] 内的行。 */
export function filterByDateRange<T extends Record<string, unknown>>(
  rows: T[],
  start: string,
  end: string
): T[] {
  if (!start || !end) return rows;
  return rows.filter((r) => {
    const d = String(r["日期"] ?? "");
    return d >= start && d <= end;
  });
}

/** 按 keyField 分组，对 sumFields 求和。返回每组一行。 */
export function sumByKey<T extends Record<string, unknown>>(
  rows: T[],
  keyField: string,
  sumFields: string[]
): Array<Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const k = String(r[keyField] ?? "未分类") || "未分类";
    if (!m.has(k)) {
      const init: Record<string, unknown> = { [keyField]: k };
      for (const f of sumFields) init[f] = 0;
      m.set(k, init);
    }
    const a = m.get(k)!;
    for (const f of sumFields) {
      const v = Number(r[f] ?? 0);
      a[f] = (a[f] as number) + (Number.isFinite(v) ? v : 0);
    }
  }
  return [...m.values()];
}
