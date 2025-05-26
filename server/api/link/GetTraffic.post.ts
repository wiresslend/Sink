// server/api/stats/visits-for-links.post.ts
import { z } from 'zod';
import type { H3Event } from 'h3';

// --- 定义期望的响应类型 ---
interface WAEQueryDataRow {
  visits: string | number; // API 可能返回字符串或数字，我们用 parseInt 处理
}

interface WAEResponse {
  meta?: any[];
  data?: WAEQueryDataRow[];
  rows?: number;
  rows_before_limit_at_least?: number;
  // 如果你的 useWAE 封装了错误处理并返回类似结构，则可以加上 success/errors 字段
}
// --- 类型定义结束 ---

// 假设 useWAE 在全局或通过其他方式可用，并且其返回类型与 WAEResponse 兼容
// declare function useWAE(event: H3Event, sql: string): Promise<WAEResponse>;

// 为了演示，我们将简化 SQL 构建逻辑，并假设 useWAE 已定义
// 你需要根据你的 SqlBricks 和日志结构调整实际的 SQL 构建

const BodySchema = z.object({
  linkIds: z.array(z.string().min(1)).min(1), // 至少一个 linkId
  startAt: z.number().int(), // Unix timestamp in seconds
  endAt: z.number().int(),   // Unix timestamp in seconds
});

export default eventHandler(async (event: H3Event) => {
  const { cloudflare } = event.context; // 虽然此API不直接用KV，但保留上下文结构
  const { dataset } = useRuntimeConfig(event);

  if (!dataset) {
    throw createError({ statusCode: 500, statusMessage: 'Runtime config "dataset" for Analytics Engine is not defined.' });
  }

  const body = await readValidatedBody(event, BodySchema.parse);

  const results: Record<string, number> = {}; // 用于存储 linkId -> visits

  await Promise.all(body.linkIds.map(async (linkId) => {
    let visits = 0;
    try {
      const sqlFilter = `link_identifier = '${linkId.replace(/'/g, "''")}' AND eventTimestamp >= toDateTime(${body.startAt}) AND eventTimestamp <= toDateTime(${body.endAt})`; // 基本的 SQL 注入防范
      const visitsSql = `SELECT SUM(_sample_interval) as visits FROM ${dataset} WHERE ${sqlFilter}`;
      
      const waeResponse = await useWAE(event, visitsSql) as WAEResponse; 

      if (waeResponse?.data && Array.isArray(waeResponse.data) && waeResponse.data.length > 0) {
        const firstResult = waeResponse.data[0];
        if (firstResult && typeof firstResult.visits !== 'undefined') {
          visits = parseInt(String(firstResult.visits), 10);
          if (isNaN(visits)) {
            visits = 0;
            console.warn(`visits for linkId ${linkId} was not a valid number:`, firstResult.visits);
          }
        }
      } else if (waeResponse && (waeResponse as any).errors && (waeResponse as any).errors.length > 0) {
        console.error(`WAE API returned errors for linkId ${linkId}:`, (waeResponse as any).errors);
      }

    } catch (waeError) {
      console.error(`获取 linkId ${linkId} 的访问次数时发生异常:`, waeError);
    }
    results[linkId] = visits;
  }));

  return results; // 返回 { "id1": 10, "slug2": 5, "id3": 0 } 这样的对象
});