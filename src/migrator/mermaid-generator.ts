/**
 * @fileoverview Mermaid diagram generator for SurrealDB schemas.
 *
 * This module provides functionality to generate Mermaid ER diagrams from SurrealDB schemas,
 * allowing developers to visualize database structure and relationships. It supports both
 * minimal (executive summary) and detailed (comprehensive) diagram modes.
 *
 * ## Features
 *
 * - **Minimal mode**: Entity names, relationships, and basic field information (name and type)
 * - **Detailed mode**: Complete entity definitions including constraints, defaults, computed fields
 * - **Relationship mapping**: Automatically identifies and diagrams relationships between tables
 * - **Clean formatting**: Generates well-formatted, readable Mermaid syntax
 *
 * @module mermaid-generator
 */

import type { SurrealDBSchema, SurrealField, SurrealRelation, SurrealTable } from "../types/schema";

/**
 * Diagram detail level options
 */
export type DiagramLevel = "minimal" | "detailed";

/**
 * Options for diagram generation
 */
export interface MermaidGeneratorOptions {
  /** Level of detail to include in the diagram */
  level: DiagramLevel;
  /** Whether to include schema comments as notes */
  includeComments?: boolean;
}

/**
 * Main class for generating Mermaid ER diagrams from SurrealDB schemas
 */
export class MermaidGenerator {
  private schema: SurrealDBSchema;
  private options: MermaidGeneratorOptions;

  constructor(schema: SurrealDBSchema, options: MermaidGeneratorOptions) {
    this.schema = schema;
    this.options = {
      includeComments: true,
      ...options,
    };
  }

  /**
   * Generates a complete Mermaid ER diagram from the schema
   * @returns Mermaid diagram syntax as a string
   */
  generate(): string {
    const lines: string[] = ["erDiagram"];

    // Generate relationships first (they appear at the top in Mermaid)
    const relationships = this.generateRelationships();
    if (relationships.length > 0) {
      lines.push(...relationships);
    }

    // Generate table definitions
    const tables = this.generateTables();
    if (tables.length > 0) {
      lines.push("");
      lines.push(...tables);
    }

    return lines.join("\n");
  }

  /**
   * Generates relationship declarations from schema
   */
  private generateRelationships(): string[] {
    const lines: string[] = [];
    const processedRelationships = new Set<string>();

    // Process explicit relations
    for (const relation of this.schema.relations) {
      const relationKey = `${relation.from}-${relation.name}-${relation.to}`;
      if (!processedRelationships.has(relationKey)) {
        const cardinality = this.inferCardinality(relation);
        const labelName = this.getRelationshipLabel(relation.name);
        lines.push(`    ${relation.from} ${cardinality} ${relation.to} : "${labelName}"`);
        processedRelationships.add(relationKey);
      }
    }

    // Infer relationships from record fields in tables
    for (const table of this.schema.tables) {
      for (const field of table.fields) {
        const recordTypes = this.extractRecordTypes(field.type);
        for (const recordType of recordTypes) {
          // Skip self-references for now to avoid clutter
          if (recordType === table.name) {
            const relationKey = `${table.name}-${field.name}-${recordType}`;
            if (!processedRelationships.has(relationKey)) {
              const labelName = this.getRelationshipLabel(field.name);
              lines.push(`    ${table.name} ||--o{ ${recordType} : "${labelName}"`);
              processedRelationships.add(relationKey);
            }
            continue;
          }

          const relationKey = `${table.name}-${field.name}-${recordType}`;
          if (!processedRelationships.has(relationKey)) {
            // Determine cardinality based on field type
            const isArray = field.type.includes("array");
            const isOptional = field.type.includes("option") || field.optional;

            let cardinality = "";
            if (isArray) {
              cardinality = isOptional ? "||--o{" : "||--o{";
            } else {
              cardinality = isOptional ? "}o--o|" : "}o--||";
            }

            const labelName = this.getRelationshipLabel(field.name);
            lines.push(`    ${table.name} ${cardinality} ${recordType} : "${labelName}"`);
            processedRelationships.add(relationKey);
          }
        }
      }
    }

    return lines;
  }

  /**
   * Infers cardinality notation for a relation
   */
  private inferCardinality(relation: SurrealRelation): string {
    // Check if relation has array fields that might indicate many-to-many
    const hasArrays = relation.fields.some((f) => f.type.includes("array"));

    // Default to one-to-many
    if (hasArrays) {
      return "||--o{";
    }
    return "}o--||";
  }

  /**
   * Extracts table names from record type strings
   * Handles: record<user>, record<user | post>, array<record<user>>
   */
  private extractRecordTypes(type: string): string[] {
    const recordTypes: string[] = [];

    // Match record<...> patterns
    const recordMatch = type.match(/record<([^>]+)>/);
    if (recordMatch) {
      const innerType = recordMatch[1];
      // Split on | for union types
      const types = innerType.split("|").map((t) => t.trim());
      recordTypes.push(...types);
    } else if (type === "record") {
      // Generic record - no specific type to extract
      return [];
    }

    return recordTypes;
  }

  /**
   * Generates table definitions with fields
   */
  private generateTables(): string[] {
    const lines: string[] = [];

    for (const table of this.schema.tables) {
      lines.push(`    ${table.name} {`);

      if (this.options.level === "minimal") {
        lines.push(...this.generateMinimalFields(table));
      } else {
        lines.push(...this.generateDetailedFields(table));
      }

      lines.push("    }");
      lines.push("");
    }

    return lines;
  }

  /**
   * Generates minimal field definitions (name and type only)
   */
  private generateMinimalFields(table: SurrealTable): string[] {
    const lines: string[] = [];

    for (const field of table.fields) {
      const simpleType = this.simplifyType(field.type);
      const sanitizedName = this.sanitizeFieldName(field.name);
      const annotations = this.getMinimalAnnotations(field);
      const line = annotations
        ? `        ${simpleType} ${sanitizedName} ${annotations}`
        : `        ${simpleType} ${sanitizedName}`;
      lines.push(line);
    }

    return lines;
  }

  /**
   * Generates detailed field definitions with constraints and defaults
   */
  private generateDetailedFields(table: SurrealTable): string[] {
    const lines: string[] = [];

    for (const field of table.fields) {
      const simpleType = this.simplifyType(field.type);
      const sanitizedName = this.sanitizeFieldName(field.name);
      const annotations = this.getDetailedAnnotations(field);
      const line = annotations
        ? `        ${simpleType} ${sanitizedName} ${annotations}`
        : `        ${simpleType} ${sanitizedName}`;
      lines.push(line);
    }

    return lines;
  }

  /**
   * Sanitizes field names for use in table field definitions
   * Converts dots to underscores due to Mermaid ER diagram parser limitations
   *
   * Note: Mermaid's ER diagram parser only accepts alphanumeric characters and
   * underscores in field names (ATTRIBUTE_WORD tokens). Quotes are not supported
   * in this context, unlike in relationship labels.
   */
  private sanitizeFieldName(name: string): string {
    return name.replace(/\./g, "_");
  }

  /**
   * Gets the field name for use in relationship labels
   * Removes quotes if present since the relationship template adds its own quotes
   */
  private getRelationshipLabel(name: string): string {
    // If the name is already quoted, remove the quotes for the label
    if (name.startsWith('"') && name.endsWith('"')) {
      return name.slice(1, -1);
    }
    return name;
  }

  /**
   * Simplifies complex type strings for display
   */
  private simplifyType(type: string): string {
    // Extract base type from complex types
    if (type.startsWith("option<")) {
      // Extract inner type from option<...>
      const match = type.match(/option<(.+)>/);
      if (match) {
        return this.simplifyType(match[1]);
      }
    }

    if (type.startsWith("array<")) {
      return "array";
    }

    if (type.startsWith("record<")) {
      return "record";
    }

    // Map to simple display types
    const typeMap: Record<string, string> = {
      datetime: "datetime",
      int: "int",
      float: "number",
      bool: "bool",
      string: "string",
      object: "object",
      uuid: "string",
      decimal: "number",
      duration: "string",
      geometry: "geometry",
      any: "any",
    };

    return typeMap[type] || type;
  }

  /**
   * Gets minimal field annotations (unique, primary key indicators)
   */
  private getMinimalAnnotations(field: SurrealField): string {
    const annotations: string[] = [];

    // Check if field is unique via assert or comment
    if (field.assert?.includes("UNIQUE") || field.comment?.toLowerCase().includes("unique")) {
      annotations.push("UK");
    }

    // Check if this looks like a primary key
    if (field.name === "id" || field.comment?.toLowerCase().includes("primary")) {
      annotations.push("PK");
    }

    // Add simplified constraint info
    if (field.assert) {
      const constraint = this.extractConstraintSummary(field.assert);
      if (constraint) {
        annotations.push(`"${constraint}"`);
      }
    }

    return annotations.length > 0 ? annotations.join(" ") : "";
  }

  /**
   * Gets detailed field annotations including defaults, computed, validations
   */
  private getDetailedAnnotations(field: SurrealField): string {
    const annotations: string[] = [];

    // Unique/primary indicators
    if (field.assert?.includes("UNIQUE") || field.comment?.toLowerCase().includes("unique")) {
      annotations.push("UK");
    }
    if (field.name === "id" || field.comment?.toLowerCase().includes("primary")) {
      annotations.push("PK");
    }

    // Default values
    if (field.default !== null && field.default !== undefined) {
      const defaultStr = this.formatDefaultValue(field.default);
      if (defaultStr) {
        annotations.push(`default: ${defaultStr}`);
      }
    }

    // Computed fields
    if (field.value?.includes("<future>")) {
      annotations.push("computed");
    }

    // Value expressions (non-computed)
    if (field.value && !field.value.includes("<future>")) {
      const valueStr = this.truncate(field.value, 30);
      annotations.push(`value: ${valueStr}`);
    }

    // Readonly
    if (field.readonly) {
      annotations.push("readonly");
    }

    // Validation constraints
    if (field.assert) {
      const constraint = this.extractConstraintSummary(field.assert);
      if (constraint) {
        annotations.push(constraint);
      }
    }

    // Comments
    if (field.comment && this.options.includeComments) {
      const comment = this.truncate(field.comment, 40);
      annotations.push(`"${comment}"`);
    }

    return annotations.length > 0 ? `"${annotations.join("; ")}"` : "";
  }

  /**
   * Formats a default value for display
   */
  private formatDefaultValue(value: unknown): string {
    if (typeof value === "string") {
      if (value.length > 20) {
        return `"${value.substring(0, 17)}..."`;
      }
      return `"${value}"`;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return "[]";
    }
    if (typeof value === "object" && value !== null) {
      return "{}";
    }
    return "";
  }

  /**
   * Extracts a summary of validation constraints from assert string
   */
  private extractConstraintSummary(assert: string): string {
    // Extract key constraint patterns
    const constraints: string[] = [];

    // Length constraints
    if (assert.match(/string::len.*>=.*AND.*string::len.*<=/)) {
      const minMatch = assert.match(/string::len.*>=\s*(\d+)/);
      const maxMatch = assert.match(/string::len.*<=\s*(\d+)/);
      if (minMatch && maxMatch) {
        constraints.push(`${minMatch[1]}-${maxMatch[1]} chars`);
      }
    } else if (assert.match(/string::len.*>=\s*(\d+)/)) {
      const match = assert.match(/string::len.*>=\s*(\d+)/);
      if (match) {
        constraints.push(`min ${match[1]} chars`);
      }
    }

    // Range constraints
    if (assert.match(/\$value\s*>=.*AND.*\$value\s*<=/)) {
      const minMatch = assert.match(/\$value\s*>=\s*(\d+)/);
      const maxMatch = assert.match(/\$value\s*<=\s*(\d+)/);
      if (minMatch && maxMatch) {
        constraints.push(`${minMatch[1]}-${maxMatch[1]}`);
      }
    } else if (assert.match(/\$value\s*>=\s*(\d+)/)) {
      const match = assert.match(/\$value\s*>=\s*(\d+)/);
      if (match) {
        constraints.push(`>=${match[1]}`);
      }
    }

    // Email validation
    if (assert.includes("string::is::email")) {
      constraints.push("email");
    }

    // Pattern validation (simplified)
    if (assert.includes("~") && assert.includes("/")) {
      constraints.push("pattern");
    }

    return constraints.join(", ");
  }

  /**
   * Truncates a string to a maximum length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return `${str.substring(0, maxLength - 3)}...`;
  }
}

/**
 * Generates a Mermaid ER diagram from a schema
 *
 * @param schema - The SurrealDB schema to visualize
 * @param options - Diagram generation options
 * @returns Mermaid diagram syntax as a string
 *
 * @example
 * ```typescript
 * const diagram = generateMermaidDiagram(schema, { level: 'minimal' });
 * console.log(diagram);
 * // Output:
 * // erDiagram
 * //     user ||--o{ post : "author"
 * //     user {
 * //         string email UK
 * //         string name
 * //     }
 * ```
 */
export function generateMermaidDiagram(
  schema: SurrealDBSchema,
  options: MermaidGeneratorOptions,
): string {
  const generator = new MermaidGenerator(schema, options);
  return generator.generate();
}
