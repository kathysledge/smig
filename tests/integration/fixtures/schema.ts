import { composeSchema, defineSchema, int, string } from 'smig';

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
