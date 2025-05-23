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
    const data = await useAPI('/api/link/list', {
      query: {
        limit,
        cursor,
      },
    })

    // 1. Map and ensure isFavorite exists, and filter out any null/undefined links from the API response
    const allFetchedLinks = data.links
      .map(link => link ? ({ // Check if link is not null/undefined before spreading
        ...link,
        isFavorite: link.isFavorite || false,
      }) : null)
      .filter(Boolean); // Removes any nulls that were explicitly returned or resulted from the map

    // 2. Filter these fetched links to only include those where isFavorite is true
    const favoriteLinks = allFetchedLinks.filter(link => link.isFavorite);

    // 3. Concatenate only the favorite links to your main list
    if (favoriteLinks.length > 0) {
      links.value = links.value.concat(favoriteLinks);
    }
    
    cursor = data.cursor;
    listComplete = data.list_complete;
    listError = false;

  }
  catch (error) {
    console.error(error);
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
  const index = links.value.findIndex(l => l.id === link.id);

  if (type === 'edit') {
    if (index !== -1) {
      links.value[index] = { ...links.value[index], ...link };
    }
  }
  else if (type === 'delete') {
    if (index !== -1) {
      links.value.splice(index, 1);
    }
  }
  else if (type === 'favorite') { // 处理收藏/取消收藏切换
    if (index !== -1) {
      try {
        const apiResponse = await useAPI(`/api/link/favorite`, {
          method: 'POST',
          body: {
            slug: link.slug,
            isFavorite: link.isFavorite // 发送新的期望状态 (例如 false 表示取消收藏)
          }
        });

        if (apiResponse && apiResponse.success && apiResponse.link) {
          if (!apiResponse.link.isFavorite) {
            // API 确认链接已取消收藏，则从本收藏夹列表中移除
            links.value.splice(index, 1);
          } else {
            // API 确认链接仍为收藏状态 (或变为收藏状态)，则更新它
            links.value[index] = { ...links.value[index], ...apiResponse.link };
          }
        } else {
          console.error('收藏状态更新API调用未成功或返回非预期响应。');
        }
      } catch (error) {
        console.error('调用收藏状态更新API失败:', error);
      }
    }
  }
  else { // 创建新链接
    if (link.isFavorite) { 
        links.value.unshift({ ...link });
        sortBy.value = 'newest';
    } 
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
