import { currentLocales } from './i18n/i18n'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxthub/core',
    'shadcn-nuxt',
    '@nuxt/eslint',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    '@nuxtjs/i18n',
  ],
  devtools: { enabled: true },

  colorMode: {
    classSuffix: '',
  },

  runtimeConfig: {
    siteToken: process.env.NUXT_SITE_TOKEN || 'SinkCool',
    redirectStatusCode: process.env.NUXT_REDIRECT_STATUS_CODE || '301',
    linkCacheTtl: parseInt(process.env.NUXT_LINK_CACHE_TTL || '60', 10),
    redirectWithQuery: process.env.NUXT_REDIRECT_WITH_QUERY === 'true',
    homeURL: process.env.NUXT_HOME_URL || '',
    cfAccountId: process.env.NUXT_CF_ACCOUNT_ID || '',
    cfApiToken: process.env.NUXT_CF_API_TOKEN || '',
    dataset: process.env.NUXT_DATASET || 'sink',
    aiModel: process.env.NUXT_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct',
    aiPrompt: process.env.NUXT_AI_PROMPT || `You are a URL shortening assistant, please shorten the URL provided by the user into a SLUG. The SLUG information must come from the URL itself, do not make any assumptions. A SLUG is human-readable and should not exceed three words and can be validated using regular expressions {slugRegex} . Only the best one is returned, the format must be JSON reference {"slug": "example-slug"}`,
    caseSensitive: process.env.NUXT_CASE_SENSITIVE === 'true',
    listQueryLimit: parseInt(process.env.NUXT_LIST_QUERY_LIMIT || '500', 10),
    disableBotAccessLog: process.env.NUXT_DISABLE_BOT_ACCESS_LOG === 'true',
    public: {
      previewMode: process.env.NUXT_PUBLIC_PREVIEW_MODE || '',
      slugDefaultLength: process.env.NUXT_PUBLIC_SLUG_DEFAULT_LENGTH || '6',
    },
  },

  routeRules: {
    '/': {
      prerender: true,
    },
    '/dashboard/**': {
      ssr: false,
    },
    '/dashboard': {
      redirect: '/dashboard/links',
    },
  },

  compatibilityDate: '2024-07-08',

  nitro: {
    experimental: {
      // Enable Server API documentation within NuxtHub
      openAPI: true,
    },
  },

  hub: {
    ai: true,
    analytics: true,
    blob: false,
    cache: false,
    database: false,
    kv: true,
  },

  eslint: {
    config: {
      stylistic: true,
      standalone: false,
    },
  },

  i18n: {
    locales: currentLocales,
    compilation: {
      strictMessage: false,
      escapeHtml: true,
    },
    lazy: true,
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'sink_i18n_redirected',
      redirectOn: 'root',
    },
    baseUrl: '/',
    defaultLocale: 'en-US',
  },
})
