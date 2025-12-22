import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import surqlGrammar from "./languages/surql.tmLanguage.json";

export default withMermaid(
  defineConfig({
    title: "smig",
    description: "Automatic schema migrations for SurrealDB",

    // Force dark mode only (no toggle)
    appearance: "force-dark",

    markdown: {
      languages: [
        {
          ...surqlGrammar,
          aliases: ["surql", "surrealql", "surrealdb"],
        },
      ],
    },

    head: [["link", { rel: "icon", href: "/assets/smig-favicon.svg" }]],

    themeConfig: {
      logo: { src: "/assets/smig-logo-dark.svg", alt: "smig ‘S’ logo" },
      siteTitle: false,

      nav: [
        { text: "Guide", link: "/getting-started/" },
        { text: "Schema", link: "/schema-reference/" },
        { text: "Examples", link: "/examples/" },
        {
          text: "Links",
          items: [
            { text: "GitHub", link: "https://github.com/kathysledge/smig" },
            { text: "npm", link: "https://www.npmjs.com/package/smig" },
            { text: "Changelog", link: "https://github.com/kathysledge/smig/blob/main/CHANGELOG.md" },
          ],
        },
      ],

      sidebar: {
        "/getting-started/": [
          {
            text: "Getting started",
            items: [
              { text: "Overview", link: "/getting-started/" },
              { text: "Installation", link: "/getting-started/installation" },
              { text: "Your first migration", link: "/getting-started/first-migration" },
            ],
          },
          {
            text: "Next steps",
            items: [
              { text: "Schema design →", link: "/guides/schema-design" },
              { text: "CLI commands →", link: "/guides/cli-commands" },
            ],
          },
        ],

        "/guides/": [
          {
            text: "Guides",
            items: [{ text: "Overview", link: "/guides/" }],
          },
          {
            text: "Core concepts",
            items: [
              { text: "Schema design", link: "/guides/schema-design" },
              { text: "Understanding migrations", link: "/guides/migrations" },
            ],
          },
          {
            text: "Working with smig",
            items: [
              { text: "CLI commands", link: "/guides/cli-commands" },
              { text: "Multi-environment", link: "/guides/multi-environment" },
            ],
          },
          {
            text: "Going deeper",
            items: [{ text: "Best practices", link: "/guides/best-practices" }],
          },
        ],

        "/schema-reference/": [
          {
            text: "Schema reference",
            items: [{ text: "Overview", link: "/schema-reference/" }],
          },
          {
            text: "Tables and fields",
            collapsed: false,
            items: [
              { text: "Tables", link: "/schema-reference/tables" },
              { text: "Fields", link: "/schema-reference/fields" },
              { text: "Indexes", link: "/schema-reference/indexes" },
              { text: "Events", link: "/schema-reference/events" },
            ],
          },
          {
            text: "Relationships",
            collapsed: false,
            items: [{ text: "Relations", link: "/schema-reference/relations" }],
          },
          {
            text: "Database logic",
            collapsed: false,
            items: [
              { text: "Functions", link: "/schema-reference/functions" },
              { text: "Analyzers", link: "/schema-reference/analyzers" },
            ],
          },
          {
            text: "Security",
            collapsed: false,
            items: [{ text: "Access (auth)", link: "/schema-reference/access" }],
          },
          {
            text: "System",
            collapsed: false,
            items: [
              { text: "Params", link: "/schema-reference/params" },
              { text: "Sequences", link: "/schema-reference/sequences" },
              { text: "Config", link: "/schema-reference/config" },
            ],
          },
        ],

        "/api-reference/": [
          {
            text: "API reference",
            items: [
              { text: "Overview", link: "/api-reference/" },
              { text: "Concise schema", link: "/api-reference/concise-schema" },
              { text: "Migration manager", link: "/api-reference/migration-manager" },
              { text: "Surreal client", link: "/api-reference/surreal-client" },
            ],
          },
        ],

        "/examples/": [
          {
            text: "Examples",
            items: [{ text: "Overview", link: "/examples/" }],
          },
          {
            text: "Getting started",
            items: [{ text: "Minimal example", link: "/examples/minimal" }],
          },
          {
            text: "Applications",
            items: [
              { text: "Simple blog", link: "/examples/blog" },
              { text: "Social network", link: "/examples/social-network" },
              { text: "E-commerce", link: "/examples/ecommerce" },
              { text: "Social platform", link: "/examples/social-platform" },
            ],
          },
          {
            text: "Advanced",
            items: [{ text: "AI embeddings", link: "/examples/ai-embeddings" }],
          },
        ],

        "/resources/": [
          {
            text: "Resources",
            items: [{ text: "Overview", link: "/resources/" }],
          },
        ],
      },

      socialLinks: [{ icon: "github", link: "https://github.com/kathysledge/smig" }],

      footer: {
        message: "Released under the ISC License.",
        copyright: "Copyright © Chris Harris",
      },

      search: {
        provider: "local",
      },

      editLink: {
        pattern: "https://github.com/kathysledge/smig/edit/main/docs/:path",
        text: "Edit this page on GitHub",
      },

      outline: {
        level: [2, 3],
        label: "On this page",
      },
    },

    mermaid: {
      // Mermaid config options
    },

    mermaidPlugin: {
      class: "mermaid",
    },
  }),
);
