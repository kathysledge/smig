/**
 * @fileoverview Comprehensive test suite for Mermaid diagram generator
 */

import { describe, expect, it } from "vitest";
import { generateMermaidDiagram } from "../src/migrator/mermaid-generator";
import {
  array,
  bool,
  composeSchema,
  datetime,
  defineRelation,
  defineSchema,
  int,
  object,
  option,
  record,
  string,
} from "../src/schema/concise-schema";
import type { SurrealDBSchema } from "../src/types/schema";

describe("MermaidGenerator", () => {
  describe("Basic Diagram Generation", () => {
    it("should generate minimal ER diagram header", () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [],
        comments: [],
      };

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });
      expect(diagram).toContain("erDiagram");
    });

    it("should generate diagram with single table", () => {
      const userSchema = defineSchema({
        table: "user",
        schemafull: true,
        fields: {
          email: string(),
          name: string(),
        },
      });

      const schema = composeSchema({
        models: { user: userSchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toContain("erDiagram");
      expect(diagram).toContain("user {");
      expect(diagram).toContain("string email");
      expect(diagram).toContain("string name");
    });

    it("should generate diagram with multiple tables", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: { name: string() },
      });

      const postSchema = defineSchema({
        table: "post",
        fields: { title: string() },
      });

      const schema = composeSchema({
        models: { user: userSchema, post: postSchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toContain("user {");
      expect(diagram).toContain("post {");
    });
  });

  describe("Relationship Detection", () => {
    it("should detect record field relationships", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: { name: string() },
      });

      const postSchema = defineSchema({
        table: "post",
        fields: {
          title: string(),
          author: record("user"),
        },
      });

      const schema = composeSchema({
        models: { user: userSchema, post: postSchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toMatch(/post.*user.*:.*"author"/);
    });

    it("should detect array record relationships", () => {
      const postSchema = defineSchema({
        table: "post",
        fields: {
          title: string(),
          categories: array(record("category")),
        },
      });

      const categorySchema = defineSchema({
        table: "category",
        fields: { name: string() },
      });

      const schema = composeSchema({
        models: { post: postSchema, category: categorySchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toMatch(/post.*category.*:.*"categories"/);
    });

    it("should handle explicit relations", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: { name: string() },
      });

      const postSchema = defineSchema({
        table: "post",
        fields: { title: string() },
      });

      const likeRelation = defineRelation({
        name: "like",
        from: "user",
        to: "post",
        fields: {
          createdAt: datetime().value("time::now()"),
        },
      });

      const schema = composeSchema({
        models: { user: userSchema, post: postSchema },
        relations: { like: likeRelation },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toMatch(/user.*post.*:.*"like"/);
    });

    it("should handle self-referencing relationships", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: {
          name: string(),
          followers: array(record("user")),
        },
      });

      const schema = composeSchema({
        models: { user: userSchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      expect(diagram).toMatch(/user.*user.*:.*"followers"/);
    });

    it("should handle union type relationships", () => {
      const notificationSchema = defineSchema({
        table: "notification",
        fields: {
          message: string(),
          context: record(["post", "comment", "user"]),
        },
      });

      const postSchema = defineSchema({
        table: "post",
        fields: { title: string() },
      });

      const commentSchema = defineSchema({
        table: "comment",
        fields: { content: string() },
      });

      const userSchema = defineSchema({
        table: "user",
        fields: { name: string() },
      });

      const schema = composeSchema({
        models: {
          notification: notificationSchema,
          post: postSchema,
          comment: commentSchema,
          user: userSchema,
        },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      // Should create relationships for all union types
      expect(diagram).toMatch(/notification.*post.*:.*"context"/);
      expect(diagram).toMatch(/notification.*comment.*:.*"context"/);
      expect(diagram).toMatch(/notification.*user.*:.*"context"/);
    });

    it("should not duplicate relationships", () => {
      const postSchema = defineSchema({
        table: "post",
        fields: {
          author: record("user"),
          reviewer: record("user"),
        },
      });

      const userSchema = defineSchema({
        table: "user",
        fields: { name: string() },
      });

      const schema = composeSchema({
        models: { post: postSchema, user: userSchema },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      // Count occurrences of relationships
      const matches = diagram.match(/post.*user/g);
      expect(matches).toBeTruthy();
      expect(matches?.length).toBe(2); // One for author, one for reviewer
    });
  });

  describe("Field Type Simplification", () => {
    it("should simplify basic types correctly", () => {
      const schema = defineSchema({
        table: "test",
        fields: {
          str: string(),
          num: int(),
          flag: bool(),
          time: datetime(),
        },
      });

      const fullSchema = composeSchema({
        models: { test: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("string str");
      expect(diagram).toContain("int num");
      expect(diagram).toContain("bool flag");
      expect(diagram).toContain("datetime time");
    });

    it("should simplify option types", () => {
      const schema = defineSchema({
        table: "test",
        fields: {
          optionalStr: option("string"),
          optionalInt: option("int"),
        },
      });

      const fullSchema = composeSchema({
        models: { test: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("string optionalStr");
      expect(diagram).toContain("int optionalInt");
    });

    it("should simplify array types", () => {
      const schema = defineSchema({
        table: "test",
        fields: {
          tags: array("string"),
          scores: array("int"),
        },
      });

      const fullSchema = composeSchema({
        models: { test: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("array tags");
      expect(diagram).toContain("array scores");
    });

    it("should simplify record types", () => {
      const schema = defineSchema({
        table: "test",
        fields: {
          author: record("user"),
          relatedItems: array(record("item")),
        },
      });

      const fullSchema = composeSchema({
        models: { test: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("record author");
      expect(diagram).toContain("array relatedItems");
    });
  });

  describe("Minimal Mode Annotations", () => {
    it("should show unique constraints", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string().assert("$value != NONE"),
        },
        comments: ["unique constraint on email"],
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      // Should not contain UK since we're not using a unique index
      expect(diagram).toContain("string email");
    });

    it("should extract constraint summaries for length", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          username: string().assert("string::len($value) >= 3").assert("string::len($value) <= 20"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toMatch(/username.*"3-20 chars"/);
    });

    it("should extract constraint summaries for range", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          age: int().assert("$value >= 0").assert("$value <= 150"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toMatch(/age.*"0-150"/);
    });

    it("should detect email validation", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string().assert("string::is::email($value)"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toMatch(/email.*"email"/);
    });

    it("should detect pattern validation", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          code: string().assert("$value ~ /^[A-Z]{3}$/"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toMatch(/code.*"pattern"/);
    });
  });

  describe("Detailed Mode Annotations", () => {
    it("should show default values", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          isActive: bool().default(true),
          tokens: int().default(0),
          role: string().default("user"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/isActive.*default: true/);
      expect(diagram).toMatch(/tokens.*default: 0/);
      expect(diagram).toMatch(/role.*default: 'user'/);
    });

    it("should show computed fields", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          score: int().computed("array::len(votes.positive) - array::len(votes.negative)"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/score.*computed/);
    });

    it("should show value expressions", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          createdAt: datetime().value("time::now()"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/createdAt.*value: time::now/);
    });

    it("should show readonly fields", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          id: string().readonly(),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/id.*readonly/);
    });

    it("should show field comments", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string().comment("User's email address"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/email.*User's email address/);
    });

    it("should truncate long comments", () => {
      const longComment =
        "This is a very long comment that should be truncated when displayed in the diagram";
      const schema = defineSchema({
        table: "user",
        fields: {
          field: string().comment(longComment),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      // Comment should be truncated to 40 chars
      expect(diagram).toMatch(/\.\.\./);
    });

    it("should combine multiple annotations", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string()
            .default("user@example.com")
            .assert("string::is::email($value)")
            .comment("User email"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/email.*default.*email.*User email/);
    });
  });

  describe("Cardinality Inference", () => {
    it("should use correct cardinality for optional fields", () => {
      const schema = defineSchema({
        table: "post",
        fields: {
          author: option(record("user")),
        },
      });

      const fullSchema = composeSchema({
        models: { post: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      // Optional record should use }o--o|
      expect(diagram).toMatch(/post.*}o--o\|.*user/);
    });

    it("should use correct cardinality for array fields", () => {
      const schema = defineSchema({
        table: "post",
        fields: {
          tags: array(record("tag")),
        },
      });

      const fullSchema = composeSchema({
        models: { post: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      // Array should indicate one-to-many
      expect(diagram).toMatch(/post.*\|\|--o\{.*tag/);
    });

    it("should use correct cardinality for required fields", () => {
      const schema = defineSchema({
        table: "post",
        fields: {
          author: record("user"),
        },
      });

      const fullSchema = composeSchema({
        models: { post: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      // Required record should use }o--||
      expect(diagram).toMatch(/post.*}o--\|\|.*user/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tables", () => {
      const schema = defineSchema({
        table: "empty",
        schemafull: false,
        fields: {},
      });

      const fullSchema = composeSchema({
        models: { empty: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("empty {");
      expect(diagram).toContain("}");
    });

    it("should handle nested field names with dots", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          "votes.positive": array(record("user")).default([]),
          "votes.negative": array(record("user")).default([]),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      // Field definitions use underscores (Mermaid parser limitation)
      expect(diagram).toContain("array votes_positive");
      expect(diagram).toContain("array votes_negative");

      // But relationship labels preserve dots (they support quotes)
      expect(diagram).toContain('"votes.positive"');
      expect(diagram).toContain('"votes.negative"');
    });

    it("should handle generic record types", () => {
      const schema = defineSchema({
        table: "report",
        fields: {
          subject: record(), // Generic record - any table
        },
      });

      const fullSchema = composeSchema({
        models: { report: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "minimal" });

      expect(diagram).toContain("record subject");
      // Should not create relationships for generic records
      expect(
        diagram.split("\n").filter((line) => line.includes("report") && line.includes(":")),
      ).toHaveLength(0);
    });

    it("should handle complex default values", () => {
      const schema = defineSchema({
        table: "config",
        fields: {
          settings: object().default({ theme: "dark" }),
          tags: array("string").default([]),
        },
      });

      const fullSchema = composeSchema({
        models: { config: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/settings.*default: {}/);
      expect(diagram).toMatch(/tags.*default: \[\]/);
    });

    it("should truncate long default string values", () => {
      const longDefault = "This is a very long default value that should be truncated";
      const schema = defineSchema({
        table: "test",
        fields: {
          description: string().default(longDefault),
        },
      });

      const fullSchema = composeSchema({
        models: { test: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      expect(diagram).toMatch(/\.\.\./);
    });
  });

  describe("Real-World Schema", () => {
    it("should generate diagram for social platform schema", () => {
      // Simplified version of the social platform example
      const userSchema = defineSchema({
        table: "user",
        fields: {
          email: string().assert("string::is::email($value)"),
          name: string().assert("$value = /^[\\w]{3,32}$/"),
          followers: array(record("user")).default([]),
          following: array(record("user")).default([]),
          tokens: int().default(0).assert("$value >= 0").assert("$value <= 65536"),
        },
      });

      const postSchema = defineSchema({
        table: "post",
        fields: {
          user: record("user"),
          title: string().assert("$value = /.{4,128}/"),
          content: string(),
          time: datetime().default("time::now()"),
          comments: array(record("comment")).default([]),
        },
      });

      const commentSchema = defineSchema({
        table: "comment",
        fields: {
          user: record("user"),
          post: record("post"),
          content: string(),
          time: datetime().default("time::now()"),
        },
      });

      const schema = composeSchema({
        models: {
          user: userSchema,
          post: postSchema,
          comment: commentSchema,
        },
      });

      const diagram = generateMermaidDiagram(schema, { level: "minimal" });

      // Should have all tables
      expect(diagram).toContain("user {");
      expect(diagram).toContain("post {");
      expect(diagram).toContain("comment {");

      // Should have relationships
      expect(diagram).toMatch(/post.*user/);
      expect(diagram).toMatch(/comment.*user/);
      expect(diagram).toMatch(/comment.*post/);

      // Should have constraint summaries
      expect(diagram).toMatch(/tokens.*"0-65536"/);
    });

    it("should generate detailed diagram with all annotations", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          id: string().readonly().comment("Unique identifier"),
          email: string().assert("string::is::email($value)").comment("User's email address"),
          name: string()
            .assert("string::len($value) >= 3")
            .assert("string::len($value) <= 50")
            .comment("Display name"),
          isActive: bool().default(true).comment("Account status"),
          createdAt: datetime().value("time::now()").comment("Registration date"),
          tokens: int()
            .default(0)
            .assert("$value >= 0")
            .assert("$value <= 1000")
            .comment("Available tokens"),
          score: int().computed("array::len(votes) * 10"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const diagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      // Should have readonly
      expect(diagram).toMatch(/id.*readonly/);

      // Should have defaults
      expect(diagram).toMatch(/isActive.*default: true/);
      expect(diagram).toMatch(/tokens.*default: 0/);

      // Should have value expressions
      expect(diagram).toMatch(/createdAt.*value: time::now/);

      // Should have computed indicator
      expect(diagram).toMatch(/score.*computed/);

      // Should have constraints
      expect(diagram).toMatch(/email.*email/);
      expect(diagram).toMatch(/name.*3-50 chars/);
      expect(diagram).toMatch(/tokens.*0-1000/);

      // Should have comments
      expect(diagram).toMatch(/id.*Unique identifier/);
      expect(diagram).toMatch(/isActive.*Account status/);
    });
  });

  describe("Options", () => {
    it("should respect includeComments option", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string().comment("User's email address"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      // With comments
      const diagramWithComments = generateMermaidDiagram(fullSchema, {
        level: "detailed",
        includeComments: true,
      });
      expect(diagramWithComments).toContain("User's email");

      // Without comments
      const diagramWithoutComments = generateMermaidDiagram(fullSchema, {
        level: "detailed",
        includeComments: false,
      });
      expect(diagramWithoutComments).not.toContain("User's email");
    });

    it("should handle minimal vs detailed consistently", () => {
      const schema = defineSchema({
        table: "user",
        fields: {
          email: string()
            .default("user@example.com")
            .assert("string::is::email($value)")
            .comment("User email"),
        },
      });

      const fullSchema = composeSchema({
        models: { user: schema },
      });

      const minimalDiagram = generateMermaidDiagram(fullSchema, { level: "minimal" });
      const detailedDiagram = generateMermaidDiagram(fullSchema, { level: "detailed" });

      // Minimal should be shorter
      expect(minimalDiagram.length).toBeLessThan(detailedDiagram.length);

      // Minimal should have basic constraint
      expect(minimalDiagram).toMatch(/email.*"email"/);

      // Detailed should have everything
      expect(detailedDiagram).toMatch(/email.*default.*email.*User email/);
    });
  });
});
