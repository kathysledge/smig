import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'smig',
    description: 'Automatic schema migrations for SurrealDB',
    
    head: [
      ['link', { rel: 'icon', href: '/smig-logo-light.svg' }],
    ],

    themeConfig: {
      logo: {
        light: '/smig-logo-light.svg',
        dark: '/smig-logo-dark.svg',
      },
      siteTitle: 'smig',

      nav: [
        { text: 'Guide', link: '/getting-started/' },
        { text: 'Reference', link: '/schema-reference/' },
        { text: 'Examples', link: '/examples/' },
        {
          text: 'Links',
          items: [
            { text: 'GitHub', link: 'https://github.com/kathysledge/smig' },
            { text: 'npm', link: 'https://www.npmjs.com/package/smig' },
            { text: 'Sponsor', link: 'https://ko-fi.com/kathysledge' },
          ],
        },
      ],

      sidebar: {
        '/': [
          {
            text: 'Getting started',
            items: [
              { text: 'Quick start', link: '/getting-started/' },
              { text: 'Installation', link: '/getting-started/installation' },
              { text: 'Your first migration', link: '/getting-started/first-migration' },
            ],
          },
          {
            text: 'Guides',
            items: [
              { text: 'Overview', link: '/guides/' },
              { text: 'Schema design', link: '/guides/schema-design' },
              { text: 'Understanding migrations', link: '/guides/migrations' },
              { text: 'CLI commands', link: '/guides/cli-commands' },
              { text: 'Multi-environment', link: '/guides/multi-environment' },
              { text: 'Best practices', link: '/guides/best-practices' },
            ],
          },
          {
            text: 'Schema reference',
            items: [
              { text: 'Overview', link: '/schema-reference/' },
              { text: 'Tables', link: '/schema-reference/tables' },
              { text: 'Fields', link: '/schema-reference/fields' },
              { text: 'Indexes', link: '/schema-reference/indexes' },
              { text: 'Events', link: '/schema-reference/events' },
              { text: 'Relations', link: '/schema-reference/relations' },
              { text: 'Functions', link: '/schema-reference/functions' },
              { text: 'Analyzers', link: '/schema-reference/analyzers' },
              { text: 'Access (auth)', link: '/schema-reference/access' },
              { text: 'Params', link: '/schema-reference/params' },
              { text: 'Sequences', link: '/schema-reference/sequences' },
              { text: 'Config', link: '/schema-reference/config' },
            ],
          },
          {
            text: 'API reference',
            items: [
              { text: 'Overview', link: '/api-reference/' },
              { text: 'Concise schema', link: '/api-reference/concise-schema' },
              { text: 'Migration manager', link: '/api-reference/migration-manager' },
              { text: 'Surreal client', link: '/api-reference/surreal-client' },
            ],
          },
          {
            text: 'Examples',
            items: [
              { text: 'Overview', link: '/examples/' },
              { text: 'Simple blog', link: '/examples/blog' },
              { text: 'Social network', link: '/examples/social-network' },
              { text: 'E-commerce', link: '/examples/ecommerce' },
              { text: 'AI embeddings', link: '/examples/ai-embeddings' },
            ],
          },
          {
            text: 'Resources',
            link: '/resources/',
          },
        ],
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/kathysledge/smig' },
      ],

      footer: {
        message: 'Released under the ISC License.',
        copyright: 'Copyright © Chris Harris',
      },

      search: {
        provider: 'local',
      },

      editLink: {
        pattern: 'https://github.com/kathysledge/smig/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },
    },

    mermaid: {
      // Mermaid config options
    },

    mermaidPlugin: {
      class: 'mermaid',
    },
  })
);

