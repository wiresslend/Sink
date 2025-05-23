import { z } from 'zod'

// 定义一个固定的键名，用于在 KV 中存储收藏链接的 slug 列表
const FAVORITE_LINKS_KEY = 'system:favorite_slugs';

export default eventHandler(async (event) => {
  const { cloudflare } = event.context
  const { KV } = cloudflare.env

  if (!KV) {
    // 如果 NuxtHub/Pages 的绑定没有正常工作，这个错误理想情况下不应发生
    throw createError({ statusCode: 500, statusMessage: '主 KV 绑定 (KV) 未找到。' })
  }

  const body = await readValidatedBody(event, z.object({
    slug: z.string().trim().min(1),
    isFavorite: z.boolean(), // true 表示收藏, false 表示取消收藏
  }).parse)

  const linkKeyName = `link:${body.slug}`; // 单个链接对象的键名

  try {
    // 1. 获取当前的收藏列表 (slug 数组)
    const rawFavoriteSlugs = await KV.get(FAVORITE_LINKS_KEY, { type: 'json' });
    let favoriteSlugs: string[] = [];
    if (Array.isArray(rawFavoriteSlugs)) {
      favoriteSlugs = rawFavoriteSlugs.filter(slug => typeof slug === 'string');
    } else if (rawFavoriteSlugs !== null && typeof rawFavoriteSlugs !== 'undefined') {
      console.warn(`Value for ${FAVORITE_LINKS_KEY} in KV is not an array or null/undefined:`, rawFavoriteSlugs);
    }
    const favoriteSlugsSet = new Set(favoriteSlugs); // 使用 Set 进行高效操作

    if (body.isFavorite) {
      // 2a. 收藏操作：将 slug 添加到 Set (如果尚不存在)
      favoriteSlugsSet.add(body.slug);
    } else {
      // 2b. 取消收藏操作：从 Set 中移除 slug
      favoriteSlugsSet.delete(body.slug);
    }

    // 3. 将更新后的 Set转换回数组并写回 KV
    await KV.put(FAVORITE_LINKS_KEY, JSON.stringify(Array.from(favoriteSlugsSet)));

    // --- 步骤1: 更新单个链接对象中的 isFavorite 字段 ---
    const existingLinkEntry = await KV.getWithMetadata(linkKeyName, { type: 'json' });

    if (!existingLinkEntry.value) {
      throw createError({ statusCode: 404, statusMessage: '链接未找到，无法更新其收藏状态。' });
    }

    const existingLinkData = existingLinkEntry.value as Record<string, any>;
    const existingMetadata = existingLinkEntry.metadata;

    const updatedLinkData = {
      ...existingLinkData,
      isFavorite: body.isFavorite, // 设置新的收藏状态
    };

    await KV.put(linkKeyName, JSON.stringify(updatedLinkData), { metadata: existingMetadata });

    // --- 步骤3: 返回成功响应 ---
    // 现在可以考虑返回更新后的链接对象，因为它确实被修改了
    return {
      success: true,
      message: `链接 (slug: ${body.slug}) 的收藏状态已更新为 ${body.isFavorite}，并且收藏列表也已更新。`,
      link: updatedLinkData, // 返回被修改后的链接对象
    }

  } catch (error: any) {
    console.error(`为 slug ${body.slug} 更新收藏状态和列表时出错:`, error)
    if (error.data?.zodError) {
        throw createError({ statusCode: 400, statusMessage: '无效的请求体', data: error.data.zodError.issues })
    }
    if (error.statusCode === 404) {
      throw error; 
    }
    throw createError({ statusCode: 500, statusMessage: error.message || '更新收藏状态和列表失败' })
  }
}) 