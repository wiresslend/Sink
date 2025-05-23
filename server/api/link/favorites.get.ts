// 定义用于存储收藏链接 slug 列表的固定键名，应与 favorite.post.ts 中的一致
const FAVORITE_LINKS_KEY = 'system:favorite_slugs';
export default eventHandler(async (event) => {
  const { cloudflare } = event.context;
  const { KV } = cloudflare.env;

  if (!KV) {
    throw createError({ statusCode: 500, statusMessage: '主 KV 绑定 (KV) 未找到。检查配置。' });
  }

  // 此 API 目前不接受查询参数进行分页，一次性返回所有收藏夹项目
  // 如果将来需要分页，可以在这里添加 limit/cursor 的 query 参数验证

  try {
    // 1. 获取收藏链接的 slug 列表
    const rawFavoriteSlugs = await KV.get(FAVORITE_LINKS_KEY, { type: 'json' });
    let favoriteSlugs: string[] = [];
    if (Array.isArray(rawFavoriteSlugs)) {
      favoriteSlugs = rawFavoriteSlugs.filter(slug => typeof slug === 'string');
    } else if (rawFavoriteSlugs !== null && typeof rawFavoriteSlugs !== 'undefined') {
      // 如果存在但不是数组 (非预期情况)，打印警告并视为空列表
      console.warn(`Value for ${FAVORITE_LINKS_KEY} in KV is not an array or null/undefined:`, rawFavoriteSlugs);
    }
    // 如果 rawFavoriteSlugs 为 null 或 undefined，favoriteSlugs 保持为空数组 []

    if (favoriteSlugs.length === 0) {
      // 如果没有收藏的链接，直接返回空列表
      return {
        links: [],
        cursor: null, // 或者适合表示空列表的游标
        list_complete: true,
      };
    }

    // 2. 根据 slug 列表获取链接的详细信息
    const favoriteLinksDetails = await Promise.all(
      favoriteSlugs.map(async (slug) => {
        const keyName = `link:${slug}`;
        const { metadata, value: linkValue } = await KV.getWithMetadata(keyName, { type: 'json' });

        if (linkValue && typeof linkValue === 'object') {
          return {
            ...(metadata || {}),
            ...(linkValue as Record<string, any>),
            isFavorite: true, // 明确标记为收藏
          };
        }
        // 如果根据 slug 找不到对应的链接数据（可能数据不一致），则从结果中排除
        console.warn(`收藏夹中的 slug "${slug}" 在主链接 KV 中未找到对应数据。`);
        return null;
      })
    );

    // 3. 过滤掉可能产生的 null 值 (例如，某个收藏的 slug 在主 KV 中已不存在)
    const finalFavoriteLinks = favoriteLinksDetails.filter(link => link !== null);

    return {
      links: finalFavoriteLinks,
      // 更正为中文：由于我们目前一次性返回所有收藏，所以没有用于下一页的"cursor"，并且"list_complete"总是true
      cursor: null, 
      list_complete: true,
    };

  } catch (error: any) {
    console.error(`获取收藏链接列表 (${FAVORITE_LINKS_KEY}) 时出错:`, error);
    throw createError({ statusCode: 500, statusMessage: error.message || '获取收藏链接列表失败' });
  }
}); 