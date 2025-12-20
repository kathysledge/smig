# Analyzers

Configure text analyzers for full-text search with `analyzer()`.

---

## Basic usage

```javascript
import { analyzer } from 'smig';

const englishAnalyzer = analyzer('english_search')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(english)']);
```

**Generated SurrealQL:**

```sql
DEFINE ANALYZER english_search 
  TOKENIZERS BLANK, CLASS 
  FILTERS LOWERCASE, SNOWBALL(ENGLISH);
```

---

## Options

| Method | Description | Required |
|--------|-------------|----------|
| `.tokenizers([...])` | Text tokenizers | Yes |
| `.filters([...])` | Token filters | Yes |
| `.function(name)` | Custom tokenizer function | No |
| `.comment(text)` | Documentation | No |

---

## Tokenizers

Split text into tokens:

| Tokenizer | Description |
|-----------|-------------|
| `blank` | Split on whitespace |
| `class` | Split on character class changes |
| `camel` | Split on camelCase boundaries |
| `punct` | Split on punctuation |

### Examples

```javascript
// Whitespace only
analyzer('simple')
  .tokenizers(['blank'])
  .filters(['lowercase'])

// Code-aware (splits camelCase)
analyzer('code')
  .tokenizers(['camel', 'class', 'blank'])
  .filters(['lowercase'])

// All tokenizers
analyzer('comprehensive')
  .tokenizers(['blank', 'class', 'camel', 'punct'])
  .filters(['lowercase'])
```

---

## Filters

Transform tokens:

| Filter | Description |
|--------|-------------|
| `lowercase` | Convert to lowercase |
| `uppercase` | Convert to uppercase |
| `ascii` | Convert to ASCII |
| `snowball(lang)` | Stemming for language |
| `edgengram(min, max)` | Create edge n-grams |
| `ngram(min, max)` | Create n-grams |
| `mapper(path)` | Custom mapping file |

### Snowball languages

`arabic`, `danish`, `dutch`, `english`, `finnish`, `french`, `german`, `greek`, `hungarian`, `italian`, `norwegian`, `portuguese`, `romanian`, `russian`, `spanish`, `swedish`, `tamil`, `turkish`

---

## Common patterns

### Standard text search

```javascript
analyzer('standard')
  .tokenizers(['blank', 'punct'])
  .filters(['lowercase', 'ascii'])
```

### Language-specific

```javascript
// English with stemming
analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii', 'snowball(english)'])

// French
analyzer('french')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(french)'])

// German
analyzer('german')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(german)'])
```

### Autocomplete

```javascript
// Edge n-grams for prefix matching
analyzer('autocomplete')
  .tokenizers(['blank'])
  .filters(['lowercase', 'edgengram(2, 15)'])
```

### Fuzzy matching

```javascript
// N-grams for similarity matching
analyzer('fuzzy')
  .tokenizers(['blank'])
  .filters(['lowercase', 'ngram(2, 4)'])
```

### Code search

```javascript
// Handles camelCase and snake_case
analyzer('code')
  .tokenizers(['camel', 'class', 'blank'])
  .filters(['lowercase'])
```

---

## Using analyzers

Reference analyzers in fulltext indexes:

```javascript
import { analyzer, index, defineSchema } from 'smig';

const englishAnalyzer = analyzer('english')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(english)']);

const postSchema = defineSchema({
  table: 'post',
  fields: {
    title: string(),
    content: string(),
  },
  indexes: {
    search: index(['title', 'content'])
      .fulltext()
      .analyzer('english')  // Reference the analyzer
      .highlights(),
  },
});

export default composeSchema({
  models: { post: postSchema },
  analyzers: { english: englishAnalyzer },
});
```

---

## Complete example

```javascript
import { analyzer, composeSchema } from 'smig';

// General English search
const english = analyzer('english')
  .tokenizers(['blank', 'class', 'punct'])
  .filters(['lowercase', 'ascii', 'snowball(english)']);

// Autocomplete for instant search
const autocomplete = analyzer('autocomplete')
  .tokenizers(['blank'])
  .filters(['lowercase', 'edgengram(1, 20)']);

// Code/technical content
const technical = analyzer('technical')
  .tokenizers(['camel', 'class', 'blank'])
  .filters(['lowercase', 'ascii']);

export default composeSchema({
  models: { /* ... */ },
  analyzers: {
    english,
    autocomplete,
    technical,
  },
});
```

---

## See also

- [Indexes](indexes.md) - Fulltext index configuration
- [Tables](tables.md) - Table definitions

