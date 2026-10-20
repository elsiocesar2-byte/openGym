// Turn a pasted plan the model transcribed into an openGym bundle.
//
// The model is deliberately not allowed to choose exercises: it only says what the user wrote
// (the original name, plus a literal English translation when the name is not English). This
// module is what decides whether that name is a catalogue exercise, and when it is not, it
// creates a custom exercise with the user's own name. It never swaps one movement for another
// — a wrong match would silently file months of training under a lift the person never did,
// which is worse than a custom exercise they can rename or merge later.
//
// Matching order, most faithful first:
//   1. the Chinese name pack, exact (normalised) — the catalogue's own vocabulary
//   2. an English name, through the curated alias/word-bag matcher used by CSV import
//   3. an English translation, but only when the candidate's Chinese name clearly overlaps
//      the original (so "固定器械坐姿推胸" may find "器械推胸", while "招财猫" cannot become
//      a face pull just because the model guessed an English phrase)
//   4. otherwise: a custom exercise, with the original name untouched.

import { EXIDX } from './exercises.js'
import { matchExercise as matchEnglish, bpFromName } from './import-csv.js'
import { uid } from './format.js'

const BPS = new Set(['back', 'cardio', 'chest', 'full body', 'lower arms', 'lower legs', 'neck', 'shoulders', 'upper arms', 'upper legs', 'waist'])
const CJK = /[\u3400-\u9fff]/
const hasCJK = s => CJK.test(String(s || ''))
const norm = s => String(s || '').toLowerCase().replace(/[\s\-_/\\()（）[\]【】,，.。:：;；'’"“”·]+/g, '')

let zhPromise = null
function zhNames() {
  if (!zhPromise) {
    // Lazy: the pack is ~180 KB and most sessions never import a Chinese plan.
    zhPromise = import('../exercise-names/zh.js')
      .then(m => m.default || {})
      .catch(() => ({}))
  }
  return zhPromise
}

let zhReverse = null
function reverseZh(pack) {
  if (zhReverse) return zhReverse
  const map = new Map()
  for (const [id, name] of Object.entries(pack || {})) {
    if (!EXIDX[id] || !name) continue
    const key = norm(name)
    if (key && !map.has(key)) map.set(key, id)
  }
  zhReverse = map
  return map
}

const nameOf = id => EXIDX[id]?.n || id

/**
 * Resolve one transcribed exercise. Returns `{ id, matched, name }`; `id` is null when the
 * name is not confidently in the catalogue.
 */
export async function resolveImportedExercise({ name, query, bp } = {}) {
  const original = String(name || '').trim()
  if (!original) return { id: null, matched: false, bp }

  // The user wrote English (or the name is otherwise Latin): use the import matcher directly.
  // Do this before loading the Chinese pack, so an English plan never pays for it.
  if (!hasCJK(original)) {
    const id = matchEnglish(original)
    return id ? { id, matched: true, how: 'english', bp: bpOf(bp, id) } : { id: null, matched: false, bp: bp || bpFromName(original) }
  }

  const pack = await zhNames()
  const zh = reverseZh(pack)

  const exact = zh.get(norm(original))
  if (exact) return { id: exact, matched: true, how: 'zh-exact', bp: bpOf(bp, exact) }

  // A Chinese name the pack does not have. A translated query may still find it, but only if
  // the candidate's own Chinese name is visibly the same movement.
  const q = String(query || '').trim()
  const id = q ? matchEnglish(q) : null
  if (id) {
    const candidate = pack[id] || ''
    if (sameMovement(original, candidate)) return { id, matched: true, how: 'zh-translation', bp: bpOf(bp, id) }
  }
  return { id: null, matched: false, bp: bp || bpFromName(original) }
}

// Equipment words may differ between two names for the same movement ("杠杆蝴蝶机夹胸" is
// "蝴蝶机夹胸"). Everything else may not: "上斜" and "下斜" change the lift, and "反向" changes
// the movement, so those names stay separate. This is deliberately narrower than a fuzzy score.
const EQUIP = ['固定器械', '史密斯机', '史密斯', '龙门架', '弹力带', '壶铃', '杠铃', '哑铃', '绳索', '器械', '杠杆', '自重', '辅助', '单臂', '双臂', '机']
function equipmentOnly(s) {
  let rest = s
  for (let guard = 0; guard < 8; guard++) {
    const hit = EQUIP.find(w => rest.startsWith(w))
    if (!hit) break
    rest = rest.slice(hit.length)
  }
  return rest === ''
}

// Is the catalogue's Chinese name the same movement as what the user wrote? The English
// translation is only a hint for finding a candidate; this is the gate. The names must share
// their movement core (the tail of the name in Chinese), and whatever is left in front of it
// on either side must be equipment only. So 绳索面拉 cannot become 绳索后三角肌划船, and
// 鸽子式 cannot become 双鸽式, but 蝴蝶机夹胸 can find 杠杆蝴蝶机夹胸.
function sameMovement(original, candidate) {
  const a = norm(original), b = norm(candidate)
  if (!a || !b) return false
  if (a === b) return true
  let shared = 0
  while (shared < a.length && shared < b.length && a[a.length - 1 - shared] === b[b.length - 1 - shared]) shared++
  if (shared < 2) return false
  return equipmentOnly(a.slice(0, a.length - shared)) && equipmentOnly(b.slice(0, b.length - shared))
}

function bpOf(bp, id) {
  if (BPS.has(bp)) return bp
  const p = EXIDX[id]?.bp
  return BPS.has(p) ? p : 'waist'
}

const cleanNote = s => String(s || '').trim().slice(0, 500)

// What an alternative was written with. This is an override, not a full slot: a value the text
// did not give (say, sets for "哑铃侧平举 5–7.5kg") falls back to the main movement's when the
// swap happens. A range is stored the way the app reads one: `reps` is the top, `repsMin` the
// bottom, so the row shows 8–12 rather than an undefined number.
function weightInText(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*(?:[-–~到]\s*(\d+(?:\.\d+)?))?\s*(kg|公斤|lb|磅)/i)
  return m ? Number(m[1]) : null
}

function altPreset(a) {
  const out = {}
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi
  if (int(a.sets, 1, 20)) out.sets = a.sets
  if (int(a.repsMin, 1, 200)) {
    const top = int(a.repsMax, 1, 200) ? a.repsMax : (int(a.reps, 1, 200) ? a.reps : a.repsMin)
    out.reps = top
    out.repsMin = a.repsMin
    if (top > a.repsMin) out.repsMax = top
  } else if (int(a.reps, 1, 200)) out.reps = a.reps
  // The model may leave a written "5–7.5kg" in the alternative's note instead of filling
  // `weight`; use the lower end, which is the safe place to start, and keep the text in `note`.
  const weight = Number.isFinite(a.weight) ? a.weight : (weightInText(a.note) ?? weightInText(a.name))
  if (weight != null) out.weight = weight
  if (int(a.sec, 1, 3600)) { out.mode = 'time'; out.sec = a.sec }
  else if (int(a.min, 1, 600)) { out.mode = 'cardio'; out.min = a.min }
  else if (out.reps != null) out.mode = 'reps'
  if (a.note) out.note = cleanNote(a.note)
  return Object.keys(out).length ? out : null
}

// A pasted plan usually ends each day with a stretch block. Those are cool-downs, not another
// training day: the model writes them as their own routine (the prompt asks for that so they are
// not lost), and this puts them back at the end of the day they belong to.
const STRETCH = /拉伸|放松|stretch|mobility/i
const WARMUP = /热身|激活|warm.?up|动态/i
const isStretchRoutine = name => {
  const s = String(name || '')
  return STRETCH.test(s) && !WARMUP.test(s)
}

const DAY_WORDS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7 }
function dayNumber(name) {
  const s = String(name || '')
  const en = s.match(/\bday\s*([1-9])\b/i)
  if (en) return Number(en[1])
  const cn = s.match(/第\s*([一二三四五六七1-9])\s*天/)
  if (cn) return DAY_WORDS[cn[1]] || Number(cn[1])
  return null
}

// Which training routine does this stretch block follow? An explicit "Day 1" or 推/拉/腿 wins;
// when the plan only wrote "练后拉伸" the order of the blocks is the only signal left.
function stretchTarget(name, trainingNames, order) {
  const day = dayNumber(name)
  if (day) {
    const hit = trainingNames.findIndex(n => dayNumber(n) === day)
    if (hit >= 0) return hit
  }
  for (const tag of ['推', '拉', '腿']) {
    if (String(name).includes(tag)) {
      const hit = trainingNames.findIndex(n => String(n).includes(tag))
      if (hit >= 0) return hit
    }
  }
  return Math.min(order, Math.max(0, trainingNames.length - 1))
}

/**
 * Build the bundle mergePlan/applyCreatedPlan expect, plus a per-exercise report the
 * preview renders. Pure apart from `uid`; no store access, so it is testable on its own.
 */
export async function buildImportedBundle(parsed, { forceCustom = [] } = {}) {
  const src = parsed && typeof parsed === 'object' ? parsed : {}
  const forced = new Set((Array.isArray(forceCustom) ? forceCustom : []).map(norm))
  const customEx = []
  const customIds = new Map()   // same written name in two days is one custom exercise
  const built = []

  const custom = (name, bp, desc) => {
    const key = `${norm(name)}|${bp || 'waist'}`
    let id = customIds.get(key)
    if (!id) {
      id = `c${uid()}`
      customIds.set(key, id)
      customEx.push({ id, n: name, bp: bp || 'waist', desc: cleanNote(desc) })
    } else if (desc) {
      const rec = customEx.find(c => c.id === id)
      if (rec && !rec.desc) rec.desc = cleanNote(desc)
    }
    return id
  }

  const buildRoutine = async (r, ri) => {
    const routine = { id: `r${uid()}`, name: String(r?.name || '').trim() || `Day ${ri + 1}`, emoji: r?.emoji || '🏋️', ex: [] }
    const rows = []
    for (const e of (Array.isArray(r?.ex) ? r.ex : [])) {
      const original = String(e?.name || '').trim()
      if (!original) continue
      // The preview can turn a library match into a custom exercise in one tap. It is the
      // person's plan: when the matcher picked a variant they did not write, keeping the
      // written name is always the safe direction.
      const m = forced.has(norm(original))
        ? { id: null, matched: false, bp: e.bp || bpFromName(original) }
        : await resolveImportedExercise({ name: original, query: e.query, bp: e.bp })

      const note = cleanNote(e.note)
      const alts = (Array.isArray(e.alternatives) ? e.alternatives : [])
        .map(a => (typeof a === 'string' ? { name: a } : a))
        .filter(a => a && String(a.name || '').trim())
        .map(a => ({ ...a, name: String(a.name).trim() }))
        .slice(0, 6)
      const fullNote = alts.length
        ? [note, `${hasCJK(original) ? '备选' : 'Alt'}: ${alts.map(a => a.name).join(', ')}`].filter(Boolean).join(' · ').slice(0, 500)
        : note

      let id = m.id
      if (!id) id = custom(original, m.bp, fullNote)

      const ex = { id, sets: Number.isFinite(e.sets) && e.sets > 0 ? e.sets : 3 }
      if (e.mode === 'time' || e.sec != null) { ex.mode = 'time'; ex.sec = e.sec || 45 }
      else if (e.mode === 'cardio' || e.min != null) { ex.mode = 'cardio'; ex.min = e.min || 20 }
      else {
        ex.mode = 'reps'
        if (e.repsMin != null) {
          // The app stores a double-progression range as `reps` = top and `repsMin` = bottom
          // (history.js `hasRange`), so an imported 8-12 must not leave `reps` undefined.
          const top = e.repsMax != null ? e.repsMax : (e.reps != null ? e.reps : e.repsMin)
          ex.reps = top
          ex.repsMin = e.repsMin
          ex.repsMax = top
        } else ex.reps = e.reps != null ? e.reps : 10
      }
      if (e.weight) ex.weight = e.weight
      if (e.side === true) ex.side = true
      if (e.bodyweight === true) ex.bodyweight = true
      if (fullNote) ex.note = fullNote

      // Alternatives are real movements, not just a line of prose: resolving them now means the
      // routine screen can show a one-tap swap and the prescription comes along (replaceSlotExercise).
      const altIds = []
      const altCfg = {}
      for (const alt of alts) {
        const altName = alt.name
        if (norm(altName) === norm(original)) continue
        const am = forced.has(norm(altName))
          ? { id: null, bp: bpFromName(altName) }
          : await resolveImportedExercise({ name: altName })
        const aid = am.id || custom(altName, am.bp || bpFromName(altName), '')
        if (aid && aid !== id && !altIds.includes(aid)) {
          altIds.push(aid)
          const preset = altPreset(alt)
          if (preset) altCfg[aid] = preset
        }
      }
      if (altIds.length) ex.alt = altIds
      if (Object.keys(altCfg).length) ex.altCfg = altCfg

      routine.ex.push(ex)
      rows.push({
        key: `${ri}:${routine.ex.length - 1}`,
        original,
        id,
        matched: m.matched,
        name: m.matched ? nameOf(id) : original,
        zh: m.matched ? (await zhNames())[id] || '' : original,
        bp: m.bp || 'waist',
        how: m.how || 'custom',
        forced: forced.has(norm(original)),
        alt: altIds
      })
    }
    return { routine, rows }
  }

  for (const [ri, r] of (Array.isArray(src.routines) ? src.routines : []).entries()) {
    built.push(await buildRoutine(r, ri))
  }

  // Put cool-downs back after the work. A plan that is only stretches has no training day to
  // attach them to, so it keeps its routines as written.
  const training = built.filter(b => !isStretchRoutine(b.routine.name))
  const stretches = built.filter(b => isStretchRoutine(b.routine.name))
  if (training.length) {
    const names = training.map(b => b.routine.name)
    stretches.forEach((s, i) => {
      const target = training[stretchTarget(s.routine.name, names, i)] || training[0]
      target.routine.ex.push(...s.routine.ex)
      target.rows.push(...s.rows)
    })
  }
  const kept = (training.length ? training : built).filter(b => b.routine.ex.length)
  const routines = kept.map(b => b.routine)
  const report = kept.map((b, ri) => ({
    name: b.routine.name,
    ex: b.rows.map((row, j) => ({ ...row, key: `${ri}:${j}` }))
  }))

  return {
    bundle: {
      opengym_plan: 1,
      name: String(src.name || '').trim() || 'Imported plan',
      summary: String(src.summary || '').trim().slice(0, 600),
      routines,
      customEx
    },
    report
  }
}
