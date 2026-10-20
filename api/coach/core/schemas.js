/* JSON schemas for the three answer shapes, handed to providers that can enforce a schema
 * while decoding (Ollama/llama.cpp grammar sampling, LM Studio, vLLM, OpenAI json_schema).
 *
 * Deliberately flat: no $ref, no anyOf/oneOf, no additionalProperties tricks — llama.cpp's
 * grammar converter has a history of choking on those (ollama#8444, #8063). The schema
 * guarantees *shape* so a small model cannot ramble; validate.js remains the only judge of
 * whether the contents are safe to act on. Fields that may hold any JSON value (`before`,
 * `after`) say so with a type union, which the grammar converter does support.
 */
const ANY = { type: ['number', 'string', 'boolean', 'object', 'array', 'null'] };
const STR = { type: 'string' };
const STRINGS = { type: 'array', items: { type: 'string' } };
// An alternative is a real exercise the person may do instead, so it can carry its own
// prescription: "哑铃侧平举 5–7.5kg" is not the same sets/weight as the cable movement above it.
const ALTERNATIVES = {
  type: 'array',
  maxItems: 6,
  items: {
    type: 'object',
    properties: {
      name: STR,
      sets: { type: 'integer' },
      reps: { type: 'integer' },
      repsMin: { type: 'integer' },
      repsMax: { type: 'integer' },
      weight: { type: 'number' },
      sec: { type: 'integer' },
      min: { type: 'integer' },
      note: STR
    },
    required: ['name']
  }
};

export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    coach_contract: { type: 'integer' },
    nochange: { type: 'boolean' },
    reading: STR,
    summary: STR,
    evidence: {
      type: 'object',
      properties: { from: STR, to: STR, sessions: { type: 'integer' } }
    },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: STR,
          type: STR,
          target: {
            type: 'object',
            properties: { routineId: STR, exId: STR, weekday: { type: 'integer' } }
          },
          before: ANY,
          after: ANY,
          why: STR
        },
        required: ['type', 'why']
      }
    },
    notes: STRINGS
  },
  required: ['coach_contract']
};

const EX_SCHEMA = {
  type: 'object',
  properties: {
    id: STR, sets: { type: 'integer' }, mode: STR,
    reps: { type: 'integer' }, sec: { type: 'integer' },
    min: { type: 'integer' }, speed: { type: 'number' },
    weight: { type: 'number' }, prog: STR, inc: { type: 'number' },
    repsMin: { type: 'integer' }, repsMax: { type: 'integer' },
    bodyweight: { type: 'boolean' }, side: { type: 'boolean' },
    sg: STR, why: STR, position: { type: 'integer' }
  },
  required: ['id', 'sets']
};

// `week` and `routines[].id` are required, not optional: the week is the only thing that says
// which day trains which routine, and it points at a routine by id. A schema that leaves either
// out lets a small local model answer with routines that have no id and a week naming "r1" —
// grammar-valid, and something validate.js can only ever reject ("the week schedules 0 days but
// 3 were asked for"), through the repair round and out as a failed job.
export const CREATE_SCHEMA = {
  type: 'object',
  properties: {
    coach_contract: { type: 'integer' },
    name: STR,
    summary: STR,
    basedOn: STR,
    week: { type: 'object' },
    // The caps are the validator's own (MAX_ROUTINES, MAX_EX_PER_ROUTINE), stated here as well
    // because "1-7 routines, each 3-12 exercises" in create.md is only a request. A small model
    // that starts repeating itself does not stop at a request: qwen2.5:3b walks the library id by
    // id, three sets of eight apiece, until it hits the output limit — twelve minutes for an
    // answer that arrives cut in half and cannot be parsed. maxItems ends that run at seven
    // routines instead.
    routines: {
      type: 'array',
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          id: STR, name: STR, emoji: STR, prog: STR, why: STR,
          ex: { type: 'array', maxItems: 20, items: EX_SCHEMA }
        },
        required: ['id', 'name', 'ex']
      }
    },
    customEx: {
      type: 'array',
      items: { type: 'object', properties: { id: STR, n: STR, bp: STR, desc: STR }, required: ['id', 'n'] }
    }
  },
  required: ['coach_contract', 'week', 'routines']
};

// Import: the model only *reads* a plan the user already wrote. It never picks exercises from
// the library and never decides what to train — the client matches each `name`/`query` against
// the catalogue and creates a custom exercise when nothing matches. No `id` fields on purpose:
// an id here would invite the model to invent library entries, which is the substitution bug
// this task exists to end.
export const IMPORT_SCHEMA = {
  type: 'object',
  properties: {
    coach_contract: { type: 'integer' },
    name: STR,
    summary: STR,
    routines: {
      type: 'array',
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          name: STR,
          emoji: STR,
          day: STR,
          weekday: { type: 'integer' },
          ex: {
            type: 'array',
            maxItems: 30,
            items: {
              type: 'object',
              properties: {
                name: STR, query: STR, bp: STR,
                sets: { type: 'integer' }, reps: { type: 'integer' },
                repsMin: { type: 'integer' }, repsMax: { type: 'integer' },
                sec: { type: 'integer' }, min: { type: 'integer' },
                weight: { type: 'number' }, note: STR,
                side: { type: 'boolean' }, bodyweight: { type: 'boolean' },
                alternatives: ALTERNATIVES
              },
              required: ['name']
            }
          }
        },
        required: ['name', 'ex']
      }
    }
  },
  required: ['coach_contract', 'routines']
};

export const DEBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    coach_contract: { type: 'integer' },
    summary: STR,
    score: { type: 'integer' },
    highlights: STRINGS,
    watch: STRINGS,
    nextTime: STRINGS
  },
  required: ['coach_contract', 'summary', 'score']
};

export const SCHEMAS = {
  review: REVIEW_SCHEMA, create: CREATE_SCHEMA, refine: CREATE_SCHEMA, debrief: DEBRIEF_SCHEMA, import: IMPORT_SCHEMA,
};
