<script setup>
import { useInfiniteScroll } from '@vueuse/core'
import { Loader } from 'lucide-vue-next'

const links = ref([])
const limit = 24
const cursor = ref('')
const listComplete = ref(false)
const listError = ref(false)

const sortBy = ref('az')

const displayedLinks = computed(() => {
  const sorted = [...links.value]
  switch (sortBy.value) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    case 'az':
      return sorted.sort((a, b) => (a.slug || '').localeCompare(b.slug || ''))
    case 'za':
      return sorted.sort((a, b) => (b.slug || '').localeCompare(a.slug || ''))
    default:
      return sorted
  }
})

async function getLinks() {
  if (listComplete.value || isLoading.value || listError.value && cursor.value !== '') {
    if (!(listError.value && cursor.value === '')) return;
  }
  isLoading.value = true;
  listError.value = false;

  try {
    const favoritesResponse = await useAPI('/api/link/favorites'); 

    if (!favoritesResponse || !Array.isArray(favoritesResponse.links)) {
      console.error('Error fetching favorite links: API did not return expected links array.', favoritesResponse);
      listError.value = true;
      return; 
    }

    let fetchedFavoriteLinks = (favoritesResponse.links || [])
      .map(link => link ? ({ 
        ...link,
        isFavorite: true, 
        visits: 0, 
      }) : null)
      .filter(Boolean);

    if (fetchedFavoriteLinks.length > 0) {
      const linkIdsForTrafficQuery = fetchedFavoriteLinks.map(link => link.id).filter(Boolean); 
      if (linkIdsForTrafficQuery.length > 0) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startAtTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
        const endAtTimestamp = Math.floor(now.getTime() / 1000);

        try {
          const trafficData = await useAPI('/api/link/GetTraffic', { 
            method: 'POST',
            body: {
              linkIds: linkIdsForTrafficQuery,
              startAt: startAtTimestamp,
              endAt: endAtTimestamp,
            }
          });

          if (trafficData && typeof trafficData === 'object') {
            fetchedFavoriteLinks = fetchedFavoriteLinks.map(link => {
              const linkId = link.id;
              const visitsCount = trafficData[linkId];
              return { ...link, visits: typeof visitsCount === 'number' ? visitsCount : 0 };
            });
          } else {
            console.warn('Traffic API (favorite/Index) did not return expected object structure.', trafficData);
          }
        } catch (trafficError) {
          console.error('获取收藏链接的流量数据失败 (favorite/Index.vue):', trafficError);
        }
      }
    }
    
    if (cursor.value === '') { 
      links.value = fetchedFavoriteLinks;
    } else { 
      links.value = fetchedFavoriteLinks; 
    }
    
    listComplete.value = favoritesResponse.list_complete !== undefined ? favoritesResponse.list_complete : true; 
    cursor.value = favoritesResponse.cursor || null; 

  } catch (error) {
    console.error('获取收藏链接列表或流量失败 (favorite/Index.vue):', error);
    listError.value = true;
  }
}

const { isLoading } = useInfiniteScroll(
  document,
  getLinks,
  {
    distance: 150,
    interval: 1000,
    canLoadMore: () => !listComplete.value && !isLoading.value && !listError.value,
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
  else if (type === 'favorite') {
    if (index !== -1) {
      try {
        const apiResponse = await useAPI(`/api/link/favorite`, {
          method: 'POST',
          body: {
            slug: link.slug,
            isFavorite: link.isFavorite
          }
        });

        if (apiResponse && apiResponse.success && apiResponse.link) {
          if (!apiResponse.link.isFavorite) {
            links.value.splice(index, 1);
          } else {
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
  else { 
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
