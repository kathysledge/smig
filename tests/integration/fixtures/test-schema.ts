
import { defineSchema, composeSchema, string, datetime } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {
    article: defineSchema({
      table: 'article',
      fields: {
        title: string().required(),
        content: string(),
        publishedAt: datetime().value('time::now()')
      }
    })
  },
  relations: {}
});