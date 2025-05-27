<script setup>
const route = useRoute();
const slug = route.query.slug;

const link = ref({}); 
const id = computed(() => link.value.id);

provide('id', id);



async function getLink() { 
  try {
    const baseLinkData = await useAPI(`/api/link/query`, {
      query: { slug },
    });

    if (!baseLinkData || typeof baseLinkData !== 'object') {
      throw createError({ statusCode: 404, message: 'Link not found or invalid data from query API' });
    }

    const currentLink = {
      ...baseLinkData,
    };

    // Fetch all favorite slugs to determine if this one is a favorite
    try {
      const { data: favoritesDataRef, error: favError } = await useAPI('/api/link/favorites');
      if (favError.value) {
        console.warn('Could not fetch favorites list for link detail:', favError.value);
      } else if (favoritesDataRef.value && Array.isArray(favoritesDataRef.value.links)) {
        if (favoritesDataRef.value.links.some(favLink => favLink.slug === slug)) {
          currentLink.isFavorite = true;
        }
      }
    } catch (e) {
      console.warn('Error during favorites check for link detail:', e);
    }
    link.value = currentLink;
  } catch (error) {
    console.error('Failed to fetch link details for link page:', error);
  } 
}

async function updateLink(updatedLinkInfo, type) {
  if (type === 'delete') {
    navigateTo('/dashboard/links', { replace: true });
    return; 
  }
  if (type === 'favorite') {
    if (!link.value || typeof link.value !== 'object' || !link.value.slug) {
        console.error("Cannot toggle favorite: link data or slug is missing.");
        return;
    }
    
    const newIsFavorite = updatedLinkInfo.isFavorite; 
    const optimisticPreviousIsFavorite = link.value.isFavorite; 
    link.value.isFavorite = newIsFavorite; 

    try {
      const apiResponse = await useAPI(`/api/link/favorite`, {
        method: 'POST',
        body: {
          slug: link.value.slug,
          isFavorite: newIsFavorite,
        }
      });
      if (!(apiResponse && apiResponse.success)) {
        console.error('Favorite update API call did not indicate success for link page.');
        link.value.isFavorite = optimisticPreviousIsFavorite; 
      }
      if (apiResponse && apiResponse.link) {
         link.value = { ...link.value, ...apiResponse.link }; // Merge if API returns full updated link
      }
    } catch (error) {
      console.error('Failed to update favorite status for link page:', error);
      link.value.isFavorite = optimisticPreviousIsFavorite; 
    }
  } 

}

onMounted(() => {
  if (slug) {
    getLink();
  } 
});
</script>

<template>
  <main class="space-y-6">
    <DashboardBreadcrumb title="Link" />
    <DashboardLinksLink
      v-if="link.id"
      :link="link"
      @update:link="updateLink"
    />
    <Dashboard
      v-if="link.id"
      :link="link"
    />
  </main>
</template>
