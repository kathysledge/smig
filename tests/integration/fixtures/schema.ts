import { defineSchema, composeSchema, string, int } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {
    test: defineSchema({
      table: 'test',
      fields: {
        name: string().required(),
        count: int().default(0),
      },
    }),
  },
  relations: {},
});

