# Analyzers

Analyzers configure how SurrealDB processes text for full-text search. They control how text is broken into tokens and what transformations are applied.

## What is an analyzer?

When you search for "running shoes" in a product database, you probably want to find:
- Products with "running" and "shoes"
- Products with "runner" or "runners" (stemming)
- Products regardless of capitalization

An analyzer defines these text processing rules:
1. **Tokenizers** — How to split text into words
2. **Filters** — How to transform those words

## Creating an analyzer

Define an analyzer with tokenizers and filters:

```typescript
import { analyzer } from 'smig';

const english = analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(english)']);
```

This generates:

```sql
DEFINE ANALYZER english TOKENIZERS blank, class FILTERS lowercase, snowball(english);
```

Use it in a search index:

```typescript
indexes: {
  content: index(['title', 'body']).search('english'),
}
```

## Tokenizers

Tokenizers split text into individual tokens (words).

### Blank tokenizer

Splits on whitespace:

```typescript
tokenizers(['blank'])
// "hello world" → ["hello", "world"]
```

### Class tokenizer

Splits on character class changes (letters, numbers, punctuation):

```typescript
tokenizers(['class'])
// "hello123world" → ["hello", "123", "world"]
// "user@email.com" → ["user", "@", "email", ".", "com"]
```

### Camel tokenizer

Splits camelCase and PascalCase:

```typescript
tokenizers(['camel'])
// "getUserById" → ["get", "User", "By", "Id"]
// "XMLParser" → ["XML", "Parser"]
```

### Punct tokenizer

Splits on punctuation:

```typescript
tokenizers(['punct'])
// "hello,world;foo" → ["hello", "world", "foo"]
```

### Combining tokenizers

Use multiple tokenizers for thorough splitting:

```typescript
tokenizers(['blank', 'class', 'camel'])
// "getUserById at user@email.com" → 
// ["get", "User", "By", "Id", "at", "user", "@", "email", ".", "com"]
```

## Filters

Filters transform tokens after tokenization.

### lowercase

Convert to lowercase:

```typescript
filters(['lowercase'])
// "Hello WORLD" → "hello world"
```

### uppercase

Convert to uppercase:

```typescript
filters(['uppercase'])
// "Hello World" → "HELLO WORLD"
```

### ascii

Remove accents and convert to ASCII:

```typescript
filters(['ascii'])
// "café résumé" → "cafe resume"
```

### snowball(language)

Stem words to their root form:

```typescript
filters(['snowball(english)'])
// "running runners runs" → "run run run"

filters(['snowball(german)'])
// "laufend läufer" → "lauf lauf"
```

Supported languages:
- `english`, `french`, `german`, `spanish`, `italian`, `portuguese`
- `dutch`, `swedish`, `norwegian`, `danish`, `finnish`
- `russian`, `arabic`

### edgengram(min, max)

Generate edge n-grams for autocomplete:

```typescript
filters(['edgengram(2, 5)'])
// "hello" → ["he", "hel", "hell", "hello"]
```

### ngram(min, max)

Generate all n-grams:

```typescript
filters(['ngram(3, 3)'])
// "hello" → ["hel", "ell", "llo"]
```

## Common analyzer patterns

### English full-text search

Standard analyzer for English content with stemming:

```typescript
const english = analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii', 'snowball(english)']);
```

Good for: Blog content, articles, documentation

### Code search

Good for searching code, identifiers, and file names:

```typescript
const codeSearch = analyzer('code_search')
  .tokenizers(['blank', 'class', 'camel', 'punct'])
  .filters(['lowercase']);
```

Good for: Searching code, identifiers, file names

### Autocomplete

Edge n-grams for search-as-you-type functionality:

```typescript
const autocomplete = analyzer('autocomplete')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'edgengram(2, 10)']);
```

Good for: Search-as-you-type, suggestions

### Exact match

Simple tokenization for tags and keywords:

```typescript
const exact = analyzer('exact')
  .tokenizers(['blank'])
  .filters(['lowercase']);
```

Good for: Tags, categories, exact keyword matching

### Multilingual

Works across languages without stemming:

```typescript
const multilingual = analyzer('multilingual')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii']);
// No stemming - works across languages
```

Good for: Mixed language content

## Using analyzers in indexes

### Basic usage

Reference your analyzer by name in the search index:

```typescript
indexes: {
  content: index(['title', 'body']).search('english'),
}
```

### Multiple indexes with different analyzers

Use different analyzers for different purposes:

```typescript
analyzers: [english, autocomplete],
indexes: {
  // Full-text search
  fulltext: index(['title', 'body']).search('english'),
  
  // Autocomplete on titles
  titleAutocomplete: index(['title']).search('autocomplete'),
}
```

## Querying with analyzers

### Basic search

Match content against your query:

```sql
SELECT * FROM post WHERE title @@ 'running shoes';
```

### Scored search

Get relevance scores for ranking results:

```sql
SELECT *, search::score(0) AS relevance
FROM post
WHERE title @0@ 'running shoes'
ORDER BY relevance DESC;
```

### Highlight matches

Show matched terms with HTML tags:

```sql
SELECT search::highlight('<b>', '</b>', 0) AS highlighted
FROM post
WHERE content @0@ 'database';
```

## Custom tokenization function

For complex tokenization, use a function:

```typescript
const custom = analyzer('custom')
  .function('fn::my_tokenizer');
```

Define the tokenizer function:

```typescript
const myTokenizer = fn('fn::my_tokenizer')
  .params({ text: 'string' })
  .returns('array<string>')
  .body(`{
    // Your custom tokenization logic
    LET $words = string::words($text);
    LET $filtered = array::filter($words, |$w| string::len($w) > 2);
    RETURN $filtered;
  }`);
```

## Analyzer comments

Document your analyzer's purpose:

```typescript
const english = analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(english)'])
  .comment('Standard English full-text analyzer with stemming');
```

## Complete example

A post table with multiple search capabilities:

```typescript
import { analyzer, defineSchema, string, index, composeSchema } from 'smig';

// Analyzers for different use cases
const english = analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii', 'snowball(english)'])
  .comment('English content with stemming');

const autocomplete = analyzer('autocomplete')
  .tokenizers(['blank'])
  .filters(['lowercase', 'edgengram(2, 15)'])
  .comment('For search-as-you-type');

const code = analyzer('code')
  .tokenizers(['blank', 'class', 'camel', 'punct'])
  .filters(['lowercase'])
  .comment('For searching code and identifiers');

// Use in schema
const posts = defineSchema({
  table: 'post',
  fields: {
    title: string().required(),
    body: string(),
    tags: array('string'),
    code: string(),
  },
  indexes: {
    // Full-text search on content
    content: index(['title', 'body'])
      .search('english')
      .highlights()
      .bm25(1.2, 0.75),
    
    // Autocomplete on titles
    titleSearch: index(['title'])
      .search('autocomplete'),
    
    // Code search
    codeSearch: index(['code'])
      .search('code'),
  },
});

export default composeSchema({
  models: { post: posts },
  analyzers: [english, autocomplete, code],
});
```

## Related

- [Indexes](/schema-reference/indexes) — Where analyzers are used
- [Functions](/schema-reference/functions) — Custom tokenizer functions
