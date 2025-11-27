# Changelog

All notable changes to **smig** will be documented in this file.

## [0.4.4] - 2025-11-26

Changed event method to `thenDo` in docs (had to change from `then` as it’s a reserved keyword in JavaScript and Biome was complaining.)

Added formatting section to contributing guidelines. 

## [0.4.3] - 2025-11-25

Just a version badge cache bust

## [0.4.2] - 2025-11-25

**Bug Fixes**

- 🐛 **Mermaid Annotation Quotes** - Fixed double quote issues in detailed diagrams
  - String default values now use single quotes (e.g., `"default: 'time::now()'"`) to avoid conflicts with outer annotation quotes
  - Improves readability and ensures proper Mermaid rendering

## [0.4.1] - 2025-11-24

**Improvements**

- 🎨 **Mermaid Nested Field Names** - Improved handling of nested field names (containing dots) in diagram generation
  - **Relationship labels** now preserve dots perfectly (`user ||--o{ user : "votes.positive"`)
  - **Field definitions** use underscores (`array votes_positive`) due to current Mermaid ER diagram parser limitations
  - This hybrid approach provides the best clarity possible within Mermaid's current constraints
  - **Future work**: We plan to collaborate with the Mermaid.js maintainers to enable dots in field definitions, allowing full preservation of nested field names throughout diagrams

## [0.4.0] - 2025-11-24

**New Features**

- 🎨 **Mermaid Diagram Generation** - Visualize your database schema with automatic Mermaid ER diagram generation
  - Two detail levels: Minimal (executive summary) and Detailed (comprehensive view)
  - Automatic relationship detection from schema definitions
  - Smart constraint summaries (length, range, pattern validation)
  - Field annotations including defaults, computed fields, and readonly indicators
  - Interactive CLI prompts for detail level selection
  - File overwrite protection with confirmation prompts
  - Export to `.mermaid` files for use with GitHub, GitLab, documentation sites, and Mermaid Live

**CLI Enhancements**

- 📊 **New `mermaid` command** - Generate visual diagrams from your schema
  - `--output` flag to specify custom output file path
  - `--debug` flag for troubleshooting diagram generation
  - `--schema` flag to specify custom schema file location
  - No database connection required - works entirely offline

## [0.3.0] - 2025-11-22

**Breaking Changes**

- 🔄 **SurrealDB 2.3+ Compatibility** - Updated to use `DEFINE ACCESS` syntax instead of `DEFINE SCOPE`
  - Scopes now generate `DEFINE ACCESS ... ON DATABASE TYPE RECORD` statements
  - Removal uses `REMOVE ACCESS ... ON DATABASE` syntax
  - Automatic parsing of both `scopes` and `accesses` fields for backward compatibility
  - Session duration parsing updated for new `DURATION FOR TOKEN ..., FOR SESSION ...` format

**Enhancements**

- 🔧 **Improved Schema Comparison** - Enhanced field comparison to eliminate spurious modifications
  - Fixed VALUE extraction for multi-line `<future>` blocks with nested braces
  - Normalized whitespace and parentheses in computed field values
  - Added duration normalization (7d = 1w) for scope session comparison
  - Case-insensitive comparison for analyzer tokenizers and filters
  - Fixed DEFAULT value parsing to exclude ASSERT clauses
  - Proper handling of array wildcard fields (`[*]`) from database introspection
  - Normalized permissions, comments, and boolean field flags for accurate comparison

- 📝 **Code Documentation** - Added clarifying comments explaining scope/access terminology mapping

**Examples**

- 📚 **Social Platform Schema** - Added comprehensive example demonstrating topics, posts, threads, voting system, authentication scopes, and full-text search analyzers

## [0.2.0] - 2025-11-22

Busting the version badge again

## [0.1.2] - 2025-11-22

**Enhancements**

- ✅ **Full Introspection Support** - Complete schema introspection for functions, scopes, and analyzers
  - Automatically detects existing functions, scopes, and analyzers in the database
  - Enables modification detection for all schema elements
  - Supports proper rollback for function/scope/analyzer changes
  - Parses SurrealDB `INFO FOR DB` output to extract complete schema state

## [0.1.1] - 2025-11-22

Simply trying to cache bust the version badge

## [0.1.0] - 2025-11-22

**Major Features**

- ✨ **Custom Functions** - Define reusable database functions with `fn()` builder
  - Type-safe parameters with `.param(name, type)`
  - Optional return type specification with `.returns(type)`
  - Full SurrealQL body support
  - Automatic migration generation

- 🔐 **Authentication Scopes** - Built-in auth configuration with `scope()` builder
  - Session duration management with `.session(duration)`
  - Custom SIGNUP logic with `.signup(query)`
  - Custom SIGNIN logic with `.signin(query)`
  - Argon2 password hashing support

- 🔍 **Full-Text Search Analyzers** - Configure text analysis with `analyzer()` builder
  - Tokenizer configuration (camel, class, blank, punct)
  - Filter configuration (ascii, lowercase, snowball, edgengram, ngram)
  - Language-specific stemming
  - Integration with SEARCH indexes

- 🔗 **Union Type Records** - Polymorphic table references
  - Single table: `record('user')`
  - Multiple tables: `record(['post', 'comment', 'user'])`
  - Generic record: `record()` (any table)
  - Useful for notifications, activity feeds

- ⚡ **Computed Fields** - Dynamic field calculations with `.computed()` method
  - Automatic wrapping in SurrealDB's `<future>` syntax
  - Always up-to-date derived values
  - Reduces storage overhead
  - No background job maintenance required

**Enhancements**

- 📊 Extended `SurrealDBSchema` interface to include functions, scopes, and analyzers
- 🔄 Enhanced `MigrationManager` to generate migrations for all new schema elements
- ↩️ Added rollback support for functions, scopes, and analyzers
- 🧪 Comprehensive test suite with 38 new tests
- 📚 Updated API reference documentation

**Breaking Changes**

- None - all changes are backward compatible
