import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import surqlGrammar from "./languages/surql.tmLanguage.json";

export default withMermaid(
  defineConfig({
    title: "smig",
    titleTemplate: ":title | smig",
    description: "Automatic schema migrations for SurrealDB 3.x with a type-safe TypeScript DSL",

    // Force dark mode only (no toggle)
    appearance: "force-dark",

    // Canonical URL for SEO
    base: "/",

    // Sitemap generation
    sitemap: {
      hostname: "https://smig.build",
    },

    // Last updated timestamps
    lastUpdated: true,

    markdown: {
      languages: [
        {
          ...surqlGrammar,
          aliases: ["surql", "surrealql", "surrealdb"],
        },
      ],
    },

    head: [
      // Favicon
      ["link", { rel: "icon", href: "/assets/smig-favicon.svg", type: "image/svg+xml" }],
      ["link", { rel: "icon", href: "/favicon.ico", sizes: "32x32" }],
      
      // Open Graph / Facebook
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "smig" }],
      ["meta", { property: "og:title", content: "smig — Automatic SurrealDB Migrations" }],
      ["meta", { property: "og:description", content: "Automatic schema migrations for SurrealDB 3.x with a type-safe TypeScript DSL. Define schemas with full autocomplete and let smig handle the SQL." }],
      ["meta", { property: "og:image", content: "https://smig.build/assets/smig-og-image.jpg" }],
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      ["meta", { property: "og:image:alt", content: "smig — Automatic SurrealDB Migrations" }],
      ["meta", { property: "og:locale", content: "en_US" }],
      
      // Twitter Card
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["meta", { name: "twitter:title", content: "smig — Automatic SurrealDB Migrations" }],
      ["meta", { name: "twitter:description", content: "Automatic schema migrations for SurrealDB 3.x with a type-safe TypeScript DSL." }],
      ["meta", { name: "twitter:image", content: "https://smig.build/assets/smig-og-image.jpg" }],
      ["meta", { name: "twitter:image:alt", content: "smig — Automatic SurrealDB Migrations" }],
      
      // Additional SEO
      ["meta", { name: "author", content: "Chris Harris" }],
      ["meta", { name: "keywords", content: "SurrealDB, database migrations, schema management, TypeScript, ORM, database schema, SurrealQL, graph database, vector database" }],
      ["meta", { name: "robots", content: "index, follow" }],
      ["meta", { name: "googlebot", content: "index, follow" }],
      
      // Theme color for mobile browsers
      ["meta", { name: "theme-color", content: "#1a1a1a" }],
      
      // Apple touch icon
      ["link", { rel: "apple-touch-icon", href: "/assets/smig-favicon.svg" }],
    ],

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

    // Dynamic page-level SEO
    transformPageData(pageData) {
      const canonicalUrl = `https://smig.build/${pageData.relativePath}`
        .replace(/index\.md$/, "")
        .replace(/\.md$/, "");
      
      pageData.frontmatter.head ??= [];
      pageData.frontmatter.head.push([
        "link",
        { rel: "canonical", href: canonicalUrl },
      ]);
      
      // Dynamic Open Graph URL per page
      pageData.frontmatter.head.push([
        "meta",
        { property: "og:url", content: canonicalUrl },
      ]);
    },

    mermaid: {
      // Mermaid config options
    },

    mermaidPlugin: {
      class: "mermaid",
    },
  }),
);
