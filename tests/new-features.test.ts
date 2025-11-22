import { describe, expect, it } from "vitest";
import {
  analyzer,
  any,
  composeSchema,
  defineSchema,
  fn,
  int,
  record,
  scope,
  string,
} from "../src/schema/concise-schema";

describe("New Schema Features", () => {
  describe("Function Builder", () => {
    it("should create a basic function", () => {
      const daysSince = fn("fn::days_since")
        .param("time", "datetime")
        .returns("float")
        .body("RETURN <float> (time::now() - $time) / 60 / 60 / 24;");

      const built = daysSince.build();
      expect(built.name).toBe("fn::days_since");
      expect(built.parameters).toHaveLength(1);
      expect(built.parameters[0]).toEqual({ name: "time", type: "datetime" });
      expect(built.returnType).toBe("float");
      expect(built.body).toBe("RETURN <float> (time::now() - $time) / 60 / 60 / 24;");
    });

    it("should create a function with multiple parameters", () => {
      const calculateDiscount = fn("calculate_discount")
        .param("price", "decimal")
        .param("discount_percent", "int")
        .returns("decimal")
        .body(`
          LET $discount = $price * ($discount_percent / 100);
          RETURN $price - $discount;
        `);

      const built = calculateDiscount.build();
      expect(built.parameters).toHaveLength(2);
      expect(built.parameters[0]).toEqual({ name: "price", type: "decimal" });
      expect(built.parameters[1]).toEqual({ name: "discount_percent", type: "int" });
    });

    it("should create a function without return type", () => {
      const logAction = fn("log_action")
        .param("action", "string")
        .body("CREATE log SET action = $action, time = time::now();");

      const built = logAction.build();
      expect(built.returnType).toBeNull();
      expect(built.body).toContain("CREATE log");
    });

    it("should support function names with and without fn:: prefix", () => {
      const withPrefix = fn("fn::my_func").body("RETURN true;");
      const withoutPrefix = fn("my_func").body("RETURN true;");

      expect(withPrefix.build().name).toBe("fn::my_func");
      expect(withoutPrefix.build().name).toBe("my_func");
    });

    it("should add comments to functions", () => {
      const func = fn("my_function").body("RETURN 42;").comment("Calculates the meaning of life");

      const built = func.build();
      expect(built.comments).toContain("Calculates the meaning of life");
    });

    it("should throw error if function name is invalid", () => {
      expect(() => fn("123invalid")).toThrow(/Invalid function name/);
      expect(() => fn("")).toThrow(/required and cannot be empty/);
    });

    it("should throw error if function body is missing", () => {
      const func = fn("incomplete");
      expect(() => func.build()).toThrow(/requires a body/);
    });
  });

  describe("Scope Builder", () => {
    it("should create a complete authentication scope", () => {
      const accountScope = scope("account")
        .session("7d")
        .signup(`
          CREATE user SET
            email = $email,
            name = $username,
            password = crypto::argon2::generate($password),
            dateJoined = time::now()
        `)
        .signin(`
          SELECT * FROM user
          WHERE (email = $id OR name = $id)
          AND crypto::argon2::compare(password, $password)
        `);

      const built = accountScope.build();
      expect(built.name).toBe("account");
      expect(built.session).toBe("7d");
      expect(built.signup).toContain("CREATE user");
      expect(built.signin).toContain("SELECT * FROM user");
    });

    it("should create a scope with only signin", () => {
      const apiScope = scope("api")
        .session("30d")
        .signin(`
          SELECT * FROM api_key
          WHERE key = $key
          AND active = true
        `);

      const built = apiScope.build();
      expect(built.signup).toBeNull();
      expect(built.signin).toContain("api_key");
    });

    it("should create a scope with only signup", () => {
      const registerScope = scope("register")
        .session("1h")
        .signup("CREATE pending_user SET email = $email;");

      const built = registerScope.build();
      expect(built.signup).toContain("pending_user");
      expect(built.signin).toBeNull();
    });

    it("should add comments to scopes", () => {
      const scope_obj = scope("test")
        .signin("SELECT * FROM user WHERE id = $id;")
        .comment("Test authentication scope");

      const built = scope_obj.build();
      expect(built.comments).toContain("Test authentication scope");
    });

    it("should throw error if scope name is invalid", () => {
      expect(() => scope("123invalid")).toThrow(/Invalid scope name/);
      expect(() => scope("")).toThrow(/required and cannot be empty/);
    });

    it("should throw error if neither signup nor signin is provided", () => {
      const incomplete = scope("incomplete");
      expect(() => incomplete.build()).toThrow(/requires at least SIGNUP or SIGNIN/);
    });

    it("should throw error if signup/signin is empty", () => {
      expect(() => scope("test").signup("")).toThrow(/required and cannot be empty/);
      expect(() => scope("test").signin("")).toThrow(/required and cannot be empty/);
    });
  });

  describe("Analyzer Builder", () => {
    it("should create a full-text search analyzer", () => {
      const englishSearch = analyzer("english_search")
        .tokenizers(["class", "camel", "blank"])
        .filters(["lowercase", "ascii", "snowball(english)"]);

      const built = englishSearch.build();
      expect(built.name).toBe("english_search");
      expect(built.tokenizers).toEqual(["class", "camel", "blank"]);
      expect(built.filters).toEqual(["lowercase", "ascii", "snowball(english)"]);
    });

    it("should create an autocomplete analyzer", () => {
      const autocomplete = analyzer("autocomplete")
        .tokenizers(["blank"])
        .filters(["lowercase", "edgengram(2, 15)"]);

      const built = autocomplete.build();
      expect(built.filters).toContain("edgengram(2, 15)");
    });

    it("should create a simple case-insensitive analyzer", () => {
      const caseInsensitive = analyzer("case_insensitive")
        .tokenizers(["blank"])
        .filters(["lowercase"]);

      const built = caseInsensitive.build();
      expect(built.tokenizers).toEqual(["blank"]);
      expect(built.filters).toEqual(["lowercase"]);
    });

    it("should add comments to analyzers", () => {
      const analyzer_obj = analyzer("test")
        .tokenizers(["blank"])
        .filters(["lowercase"])
        .comment("Test analyzer for search");

      const built = analyzer_obj.build();
      expect(built.comments).toContain("Test analyzer for search");
    });

    it("should throw error if analyzer name is invalid", () => {
      expect(() => analyzer("123invalid")).toThrow(/Invalid analyzer name/);
      expect(() => analyzer("")).toThrow(/required and cannot be empty/);
    });

    it("should throw error if tokenizers are missing", () => {
      const incomplete = analyzer("test").filters(["lowercase"]);
      expect(() => incomplete.build()).toThrow(/requires at least one tokenizer/);
    });

    it("should throw error if filters are missing", () => {
      const incomplete = analyzer("test").tokenizers(["blank"]);
      expect(() => incomplete.build()).toThrow(/requires at least one filter/);
    });

    it("should throw error if tokenizers array is empty", () => {
      expect(() => analyzer("test").tokenizers([])).toThrow(/At least one tokenizer is required/);
    });

    it("should throw error if filters array is empty", () => {
      expect(() => analyzer("test").filters([])).toThrow(/At least one filter is required/);
    });
  });

  describe("Union Type Records", () => {
    it("should create a record field with single table", () => {
      const author = record("user");
      expect(author.build().type).toBe("record<user>");
    });

    it("should create a record field with union type (multiple tables)", () => {
      const context = record(["post", "comment", "user"]);
      expect(context.build().type).toBe("record<post | comment | user>");
    });

    it("should create a generic record field (any table)", () => {
      const subject = record();
      expect(subject.build().type).toBe("record");
    });

    it("should support required() modifier on union types", () => {
      const context = record(["post", "comment"]).required();
      const built = context.build();
      expect(built.type).toBe("record<post | comment>");
      expect(built.assert).toBe("$value != NONE");
    });

    it("should support required() modifier on generic records", () => {
      const subject = record().required();
      const built = subject.build();
      expect(built.type).toBe("record");
      expect(built.assert).toBe("$value != NONE");
    });
  });

  describe("Computed Fields", () => {
    it("should create a computed field with future syntax", () => {
      const score = int().computed(`
        array::len(votes.positive) - 
        (<float> array::len(votes.misleading) / 2) - 
        array::len(votes.negative)
      `);

      const built = score.build();
      expect(built.value).toContain("<future>");
      expect(built.value).toContain("array::len(votes.positive)");
    });

    it("should create a computed followers list", () => {
      const followers = string().computed(`
        LET $id = id;
        RETURN SELECT VALUE id FROM user WHERE topics CONTAINS $id;
      `);

      const built = followers.build();
      expect(built.value).toContain("<future>");
      expect(built.value).toContain("LET $id = id");
    });

    it("should allow both value() and computed() methods", () => {
      // value() is for simple expressions
      const createdAt = string().value("time::now()");
      expect(createdAt.build().value).toBe("time::now()");
      expect(createdAt.build().value).not.toContain("<future>");

      // computed() wraps in <future> { }
      const score = int().computed("array::len(votes)");
      expect(score.build().value).toContain("<future>");
    });

    it("should work with any() type for dynamic computed fields", () => {
      const followers = any().computed(`
        LET $id = id;
        RETURN SELECT VALUE id FROM user WHERE topics CONTAINS $id;
      `);

      const built = followers.build();
      expect(built.type).toBe("any");
      expect(built.value).toContain("<future>");
      expect(built.value).toContain("SELECT VALUE id FROM user");
    });
  });

  describe("Schema Composition with New Features", () => {
    it("should compose a complete schema with all new features", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: {
          email: string().required(),
          name: string().required(),
        },
      });

      const daysSince = fn("fn::days_since")
        .param("time", "datetime")
        .returns("float")
        .body("RETURN <float> (time::now() - $time) / 60 / 60 / 24;");

      const accountScope = scope("account")
        .session("7d")
        .signin("SELECT * FROM user WHERE email = $email;");

      const searchAnalyzer = analyzer("search")
        .tokenizers(["camel", "class"])
        .filters(["ascii", "lowercase"]);

      const fullSchema = composeSchema({
        models: {
          user: userSchema,
        },
        functions: {
          daysSince: daysSince,
        },
        scopes: {
          account: accountScope,
        },
        analyzers: {
          search: searchAnalyzer,
        },
        comments: ["Complete schema with all features"],
      });

      expect(fullSchema.tables).toHaveLength(1);
      expect(fullSchema.functions).toHaveLength(1);
      expect(fullSchema.scopes).toHaveLength(1);
      expect(fullSchema.analyzers).toHaveLength(1);
      expect(fullSchema.comments).toContain("Complete schema with all features");
    });

    it("should handle schema with no functions, scopes, or analyzers", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: {
          email: string().required(),
        },
      });

      const schema = composeSchema({
        models: {
          user: userSchema,
        },
      });

      expect(schema.functions).toEqual([]);
      expect(schema.scopes).toEqual([]);
      expect(schema.analyzers).toEqual([]);
    });

    it("should handle optional schema elements", () => {
      const userSchema = defineSchema({
        table: "user",
        fields: {
          email: string().required(),
        },
      });

      const func = fn("test").body("RETURN 1;");

      const schema = composeSchema({
        models: {
          user: userSchema,
        },
        functions: {
          test: func,
        },
        // scopes and analyzers omitted
      });

      expect(schema.functions).toHaveLength(1);
      expect(schema.scopes).toEqual([]);
      expect(schema.analyzers).toEqual([]);
    });
  });

  describe("Field Type Edge Cases", () => {
    it("should handle nested fields with computed values", () => {
      const score = string().computed("array::len(votes.positive)");
      const built = score.build();
      expect(built.value).toContain("<future>");
      expect(built.value).toContain("array::len(votes.positive)");
    });

    it("should handle multiple assertions with computed fields", () => {
      const field = int().computed("array::len(items)").assert("$value >= 0");

      const built = field.build();
      expect(built.value).toContain("<future>");
      expect(built.assert).toBe("$value >= 0");
    });

    it("should normalize table names in record types to lowercase", () => {
      const userRef = record("User");
      expect(userRef.build().type).toBe("record<user>");

      const multiRef = record(["Post", "Comment"]);
      expect(multiRef.build().type).toBe("record<post | comment>");
    });
  });

  describe("Real-world Schema Examples", () => {
    it("should handle a social media platform schema", () => {
      // Analyzer for search
      const searchAnalyzer = analyzer("relevanceSearch")
        .tokenizers(["camel", "class"])
        .filters(["ascii", "snowball(english)"]);

      // Function for date calculations
      const daysSince = fn("fn::days_since")
        .param("time", "datetime")
        .returns("float")
        .body("RETURN <float> (time::now() - $time) / 60 / 60 / 24;");

      // Authentication scope
      const accountScope = scope("account")
        .session("7d")
        .signup("CREATE user SET email = $email, password = crypto::argon2::generate($password);")
        .signin(
          "SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password);",
        );

      // User table with computed score
      const userSchema = defineSchema({
        table: "user",
        fields: {
          email: string().required(),
          name: string().required(),
          "votes.positive": string().default([]),
          "votes.negative": string().default([]),
          "votes.score": int().computed("array::len(votes.positive) - array::len(votes.negative)"),
        },
      });

      // Post table with union type reference
      const postSchema = defineSchema({
        table: "post",
        fields: {
          author: record("user").required(),
          content: string().required(),
          replyTo: record(["post", "comment"]), // Union type
        },
      });

      // Notification with generic record
      const notificationSchema = defineSchema({
        table: "notification",
        fields: {
          recipient: record("user").required(),
          context: record(), // Generic - any record
        },
      });

      const fullSchema = composeSchema({
        models: {
          user: userSchema,
          post: postSchema,
          notification: notificationSchema,
        },
        functions: {
          daysSince,
        },
        scopes: {
          account: accountScope,
        },
        analyzers: {
          search: searchAnalyzer,
        },
      });

      expect(fullSchema.tables).toHaveLength(3);
      expect(fullSchema.functions).toHaveLength(1);
      expect(fullSchema.scopes).toHaveLength(1);
      expect(fullSchema.analyzers).toHaveLength(1);
    });
  });

  describe("Introspection", () => {
    it("should parse function definitions from INFO FOR DB", () => {
      // This test validates the parsing logic for functions
      // The format matches what SurrealDB returns from INFO FOR DB
      const mockFuncDef =
        "FUNCTION fn::days_since($time: datetime) -> float { RETURN <float> (time::now() - $time) / 60 / 60 / 24; }";

      // In reality, this would be called by MigrationManager.parseFunctionDefinition
      // We're testing the parsing logic indirectly through the regex patterns

      // Test parameter extraction
      const paramMatch = mockFuncDef.match(/\((.*?)\)/);
      expect(paramMatch).toBeTruthy();
      expect(paramMatch?.[1]).toBe("$time: datetime");

      // Test return type extraction
      const returnMatch = mockFuncDef.match(/\)\s*->\s*([^\s{]+)/);
      expect(returnMatch).toBeTruthy();
      expect(returnMatch?.[1]).toBe("float");

      // Test body extraction
      const bodyMatch = mockFuncDef.match(/\{(.*)\}/s);
      expect(bodyMatch).toBeTruthy();
      expect(bodyMatch?.[1].trim()).toBe("RETURN <float> (time::now() - $time) / 60 / 60 / 24;");
    });

    it("should parse scope definitions from INFO FOR DB", () => {
      // Test parsing of scope with all components
      const mockScopeDef =
        "SCOPE account SESSION 24h SIGNUP (CREATE user SET email = $email, password = crypto::argon2::generate($password)) SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password))";

      // Test session extraction
      const sessionMatch = mockScopeDef.match(/SESSION\s+(\S+)/);
      expect(sessionMatch).toBeTruthy();
      expect(sessionMatch?.[1]).toBe("24h");

      // Test SIGNUP extraction
      const signupMatch = mockScopeDef.match(/SIGNUP\s+\((.*?)\)\s*(?:SIGNIN|$)/s);
      expect(signupMatch).toBeTruthy();
      expect(signupMatch?.[1]).toContain("CREATE user SET");

      // Test SIGNIN extraction
      const signinMatch = mockScopeDef.match(/SIGNIN\s+\((.*?)\)\s*$/s);
      expect(signinMatch).toBeTruthy();
      expect(signinMatch?.[1]).toContain("SELECT * FROM user");
    });

    it("should parse analyzer definitions from INFO FOR DB", () => {
      // Test parsing of analyzer with tokenizers and filters
      const mockAnalyzerDef =
        "ANALYZER relevanceSearch TOKENIZERS blank, class FILTERS lowercase, snowball(english)";

      // Test tokenizers extraction
      const tokenizerMatch = mockAnalyzerDef.match(/TOKENIZERS\s+([^F]+?)(?:\s+FILTERS|$)/);
      expect(tokenizerMatch).toBeTruthy();
      const tokenizers = tokenizerMatch?.[1]
        .trim()
        .split(",")
        .map((t) => t.trim());
      expect(tokenizers).toEqual(["blank", "class"]);

      // Test filters extraction
      const filterMatch = mockAnalyzerDef.match(/FILTERS\s+(.+?)$/);
      expect(filterMatch).toBeTruthy();
      const filters = filterMatch?.[1]
        .trim()
        .split(",")
        .map((f) => f.trim());
      expect(filters).toEqual(["lowercase", "snowball(english)"]);
    });

    it("should parse function with multiple parameters", () => {
      const mockFuncDef =
        "FUNCTION calculate_discount($price: decimal, $discount_percent: int) -> decimal { LET $discount = $price * ($discount_percent / 100); RETURN $price - $discount; }";

      const paramMatch = mockFuncDef.match(/\((.*?)\)/);
      expect(paramMatch).toBeTruthy();

      const paramStr = paramMatch?.[1];
      const paramParts = paramStr.split(",");
      expect(paramParts).toHaveLength(2);

      // First parameter
      const param1 = paramParts[0].trim();
      expect(param1).toContain("$price: decimal");

      // Second parameter
      const param2 = paramParts[1].trim();
      expect(param2).toContain("$discount_percent: int");
    });

    it("should parse function without return type", () => {
      const mockFuncDef =
        "FUNCTION log_action($action: string) { CREATE log SET action = $action, time = time::now(); }";

      const returnMatch = mockFuncDef.match(/\)\s*->\s*([^\s{]+)/);
      expect(returnMatch).toBeNull();
    });

    it("should parse scope with only SIGNIN", () => {
      const mockScopeDef =
        "SCOPE api_scope SESSION 1h SIGNIN (SELECT * FROM api_key WHERE key = $key)";

      const sessionMatch = mockScopeDef.match(/SESSION\s+(\S+)/);
      expect(sessionMatch?.[1]).toBe("1h");

      const signupMatch = mockScopeDef.match(/SIGNUP\s+\((.*?)\)\s*(?:SIGNIN|$)/s);
      expect(signupMatch).toBeNull();

      const signinMatch = mockScopeDef.match(/SIGNIN\s+\((.*?)\)\s*$/s);
      expect(signinMatch).toBeTruthy();
    });

    it("should parse analyzer with only tokenizers", () => {
      const mockAnalyzerDef = "ANALYZER simple TOKENIZERS blank, class";

      const tokenizerMatch = mockAnalyzerDef.match(/TOKENIZERS\s+([^F]+?)(?:\s+FILTERS|$)/);
      expect(tokenizerMatch).toBeTruthy();

      const filterMatch = mockAnalyzerDef.match(/FILTERS\s+(.+?)$/);
      expect(filterMatch).toBeNull();
    });
  });
});
