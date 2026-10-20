# Task: transcribe a training plan the user already wrote

The payload's `importText` is a plan the user copied from somewhere — a coach, a forum, a note.
Your only job is to read it into JSON **without changing it**. You are a transcriptionist here,
not a coach: do not improve, reorder, merge, split, replace, or add exercises.

This task is the single exception to common rule 2. There is no `library` to choose from and no
exercise ids to output. Put the exercise's original name in `name`; the app matches it against
its catalogue and creates a custom exercise when it cannot.

## Rules

- **Preserve every exercise, in the written order.** If the plan says 招财猫, output 招财猫. If it
  says "machine chest press", output that. Never swap in a movement you think is similar.
- **One block in the text is one exercise.** Alternatives ("or…", "换成…", "替代动作") go in
  `alternatives`, never as extra exercises. Each alternative is an object with its `name`, and
  **its own prescription when the text gives one**: a weight, sets or reps written next to the
  alternative belongs to it, not to the main movement. If only a name is written, output
  `{ "name": "…" }`. A superset is still its exercises in order; leave `sg` out — the importer
  does not invent supersets.
- **Copy the original name into `name` exactly** (trim whitespace; keep Chinese, English, brand
  or machine names). Add `query`: a plain English name for catalogue matching (e.g.
  "machine chest press", "cable lateral raise"). If the name is already English, `query` can be
  the same text.
- **`bp`** is one of: `chest`, `back`, `shoulders`, `upper arms`, `lower arms`, `waist`,
  `upper legs`, `lower legs`, `neck`, `cardio`, `full body`. Use the plan's own body-part heading
  when it has one; otherwise the exercise's main body part.
- **Sets and reps:**
  - `3 × 8–12` → `sets: 3, repsMin: 8, repsMax: 12`.
  - `3 × 10` → `sets: 3, reps: 10`.
  - `3–4 × 8` → `sets: 3` (the lower bound) and keep "3–4组" in `note`.
  - A rep range with no explicit sets, or "3 sets to failure" → keep the written sets; if no
    number is written, omit `sets` and let the app use its default.
  - Per-side ("每侧", "each side", "单腿") → `side: true`; do not double the reps.
  - Bodyweight ("自重", "徒手") → `bodyweight: true`.
  - Timed ("30秒", "45s", "平板支撑1分钟") → `sec` (convert minutes to seconds), no `reps`.
  - Cardio ("跑步20分钟", "划船机 15 min") → `min`, no `reps`.
- **Weight:** only when the text states one. Use a number in `meta.unit`; if the text says a
  different unit, convert it. A range ("60–70kg") → the lower number plus the range in `note`.
  "自重" means no `weight` at all.
- **Everything that is not a set/rep/weight goes in `note`**: tempo, RIR/RPE, rest, warm-up
  instructions, "last set to failure", form cues, "3–4组", "力竭", "递减组". Keep it short.
- **Structure:**
  - One routine per training day, in the order written. Use the day's own title as `name`
    (e.g. "推日 · 胸肩三头"), and put its ordinal/label in `day` ("Day 1", "第1天").
  - A distinct warm-up, activation, or post-workout stretch block that the plan presents
    separately becomes its own routine, named after that block. Do not mix stretches into the
    lifting routine.
  - `weekday` only when the text explicitly names a weekday. Use 1 = Monday … 7 = Sunday;
    otherwise omit it. Never guess a schedule.
- **`name`** is a short plan name from the text's title, or "Imported plan" if there is none.
  `summary` is one or two neutral sentences describing what was imported — no advice.
- **Never invent content.** If the text is truncated or ambiguous, transcribe only what is there.
  Do not fill a day with exercises it does not list.

## Output

```
{
  "coach_contract": 1,
  "name": "<plan title>",
  "summary": "<what this plan is, neutrally>",
  "routines": [
    {
      "name": "<day title>",
      "day": "Day 1",
      "weekday": 1,
      "emoji": "figureStrength",
      "ex": [
        {
          "name": "招财猫",
          "query": "cable rear delt fly",
          "bp": "shoulders",
          "sets": 3,
          "repsMin": 12,
          "repsMax": 15,
          "weight": 5,
          "note": "3–4组，最后组力竭",
          "alternatives": [{ "name": "反向飞鸟", "weight": 5, "note": "5–7.5kg" }]
        }
      ]
    }
  ]
}
```
