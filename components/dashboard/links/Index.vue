<script setup>
import { useInfiniteScroll } from '@vueuse/core'
import { Loader } from 'lucide-vue-next'

const links = ref([])
const limit = 24
let cursor = ''
let listComplete = false
let listError = false

const sortBy = ref('az')

const displayedLinks = computed(() => {
  const sorted = [...links.value]
  switch (sortBy.value) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt - a.createdAt)
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt - b.createdAt)
    case 'az':
      return sorted.sort((a, b) => a.slug.localeCompare(b.slug))
    case 'za':
      return sorted.sort((a, b) => b.slug.localeCompare(a.slug))
    default:
      return sorted
  }
})

async function getLinks() {
  try {
    const linkListData = await useAPI('/api/link/list', {
      query: {
        limit,
        cursor,
      },
    });

    let processedLinks = (linkListData.links || [])
      .map(link => link ? ({ // Ensure link is not null before spreading
        ...link,
        isFavorite: link.isFavorite || false, // Ensure isFavorite exists
        visits: 0, // Initialize visits to 0
      }) : null)
      .filter(Boolean); // Remove any nulls if link was originally null

    if (processedLinks.length > 0) {
      const linkIdsForTrafficQuery = processedLinks.map(link => link.id).filter(Boolean); // Assuming link.id exists and is the identifier

      if (linkIdsForTrafficQuery.length > 0) {
        // Define time range for traffic query (e.g., last 7 days)
        // Adjust as needed
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startAtTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
        const endAtTimestamp = Math.floor(now.getTime() / 1000);

        try {
          const trafficResponse =await useAPI('/api/link/GetTraffic', {
            method: 'POST',
            body: {
              linkIds: linkIdsForTrafficQuery,
              startAt: startAtTimestamp,
              endAt: endAtTimestamp,
            }
          });

          if (trafficResponse && typeof trafficResponse === 'object') {
            processedLinks = processedLinks.map(link => {
              const linkId = link.id;
              const visitsCount = trafficResponse[linkId];
              return {
                ...link,
                visits: typeof visitsCount === 'number' ? visitsCount : 0,
              };
            });
          } else {
            console.warn('Traffic API did not return the expected object structure.');
          }

        } catch (trafficError) {
          console.error('获取链接流量数据失败 (links/Index.vue):', trafficError);
        }
      }
    } // End of if (processedLinks.length > 0)
    
    links.value = links.value.concat(processedLinks);
    cursor = linkListData.cursor;
    listComplete = linkListData.list_complete;
    listError = false;

  } catch (error) {
    console.error('获取链接列表失败 (links/Index.vue):', error);
    listError = true;
  }
}

const { isLoading } = useInfiniteScroll(
  document,
  getLinks,
  {
    distance: 150,
    interval: 1000,
    canLoadMore: () => {
      return !listError && !listComplete
    },
  },
)

async function updateLinkList(link, type) {
  const index = links.value.findIndex(l => l.id === link.id)

  if (type === 'edit') {
    if (index !== -1) {
      links.value[index] = { ...links.value[index], ...link }
    }
  }
  else if (type === 'delete') {
    if (index !== -1) {
      links.value.splice(index, 1)
    }
  }
  else if (type === 'favorite') {
    if (index !== -1) {
      links.value[index].isFavorite = link.isFavorite // 乐观更新
      try {
        // 调用新的 favorite API
        await useAPI(`/api/link/favorite`, { // 确保这是新的端点
          method: 'POST',                  // 确保方法是 POST
          body: {
            slug: link.slug,               // 发送 slug (或 id)
            isFavorite: link.isFavorite    // 发送新的 isFavorite 状态
          }
        })
        // 可以取消注释下面的日志或 toast 通知
        // console.log(`Link ${link.slug} favorite status successfully updated to ${link.isFavorite} via new API`)
        // toast.success(link.isFavorite ? t('links.favorited') : t('links.unfavorited'), { description: link.slug })
      }
      catch (error) {
        console.error('Failed to update favorite status via API:', error)
        links.value[index].isFavorite = !link.isFavorite // API 失败，回滚
        // toast.error(t('links.favorite_failed'), { description: link.slug })
      }
    }
  }
  else {
    links.value.unshift({ ...link, isFavorite: false })
    sortBy.value = 'newest'
  }
}
</script>

<template>
  <main class="space-y-6">
    <div class="flex flex-col gap-6 sm:gap-2 sm:flex-row sm:justify-between">
      <DashboardNav class="flex-1">
        <div class="flex items-center gap-2">
          <DashboardLinksEditor @update:link="updateLinkList" />
          <DashboardLinksSort v-model:sort-by="sortBy" />
        </div>
      </DashboardNav>
      <LazyDashboardLinksSearch />
    </div>
    <section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <DashboardLinksLink
        v-for="link in displayedLinks"
        :key="link.id"
        :link="link"
        @update:link="updateLinkList"
      />
    </section>
    <div
      v-if="isLoading"
      class="flex items-center justify-center"
    >
      <Loader class="animate-spin" />
    </div>
    <div
      v-if="!isLoading && listComplete"
      class="flex items-center justify-center text-sm"
    >
      {{ $t('links.no_more') }}
    </div>
    <div
      v-if="listError"
      class="flex items-center justify-center text-sm"
    >
      {{ $t('links.load_failed') }}
      <Button variant="link" @click="getLinks">
        {{ $t('common.try_again') }}
      </Button>
    </div>
  </main>
</template>
