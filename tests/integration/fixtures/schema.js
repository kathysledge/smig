import {
  composeSchema,
  datetime,
  defineSchema,
  index,
  record,
  string,
} from "../../../dist/schema/concise-schema.js";

// ============================================================================
// INTEGRATION TEST SCHEMA
// ============================================================================

const userModel = defineSchema({
  table: "user",
  schemafull: true,
  fields: {
    name: string().required(),
    email: string().required(),
    createdAt: datetime().value("time::now()"),
  },
  indexes: {
    emailIndex: index(["email"]).unique(),
  },
});

const postModel = defineSchema({
  table: "post",
  schemafull: true,
  fields: {
    title: string().required(),
    content: string().required(),
    author: record("user").required(),
    createdAt: datetime().value("time::now()"),
  },
});

const fullSchema = composeSchema({
  models: {
    user: userModel,
    post: postModel,
  },
  relations: {},
});

export default fullSchema;
