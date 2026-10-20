import { describe, it, expect } from 'vitest'
import { buildImportedBundle, resolveImportedExercise } from './plan-import.js'

const day = (...ex) => ({ name: 'Push', ex })

describe('pasted plan import', () => {
  it('matches a Chinese catalogue name exactly', async () => {
    const m = await resolveImportedExercise({ name: '杠铃卧推' })
    expect(m.id).toBe('0025')
    expect(m.matched).toBe(true)
  })

  it('creates a custom exercise, with the original name, when the library has no such movement', async () => {
    const { bundle, report } = await buildImportedBundle({
      routines: [day({ name: '招财猫', query: 'cable rear delt fly', bp: 'shoulders', sets: 3, reps: 15 })]
    })
    const row = report[0].ex[0]
    expect(row.matched).toBe(false)
    expect(row.original).toBe('招财猫')
    expect(bundle.customEx).toHaveLength(1)
    expect(bundle.customEx[0].n).toBe('招财猫')
    expect(bundle.routines[0].ex[0].id).toBe(bundle.customEx[0].id)
  })

  it('matches an English name through the curated alias table', async () => {
    const { report } = await buildImportedBundle({ routines: [day({ name: 'Bench Press', sets: 3, reps: 8 })] })
    expect(report[0].ex[0].id).toBe('0025')
    expect(report[0].ex[0].matched).toBe(true)
  })

  it('keeps the written prescription: sets, rep range and alternatives', async () => {
    const { bundle } = await buildImportedBundle({
      routines: [day({ name: '杠铃卧推', sets: 4, repsMin: 8, repsMax: 12, weight: 60, alternatives: ['哑铃卧推'] })]
    })
    const ex = bundle.routines[0].ex[0]
    expect(ex.sets).toBe(4)
    expect(ex.reps).toBe(12)
    expect(ex.repsMin).toBe(8)
    expect(ex.repsMax).toBe(12)
    expect(ex.weight).toBe(60)
    expect(ex.note).toContain('哑铃卧推')
  })

  it('keeps alternatives as swappable ids, not just text in the note', async () => {
    const { bundle } = await buildImportedBundle({
      routines: [day({ name: '杠铃卧推', alternatives: [{ name: '哑铃卧推', sets: 4, reps: 8, weight: 20 }] })]
    })
    const ex = bundle.routines[0].ex[0]
    expect(ex.note).toContain('哑铃卧推')
    expect(ex.alt).toHaveLength(1)
    expect(ex.alt[0]).not.toBe(ex.id)
    // The alternative's own numbers must travel, not the main movement's.
    expect(ex.altCfg[ex.alt[0]]).toMatchObject({ sets: 4, reps: 8, weight: 20 })
  })

  it('puts a cool-down block after the training day it follows', async () => {
    const { bundle, report } = await buildImportedBundle({
      routines: [
        { name: 'Day 1：推日', ex: [{ name: '杠铃卧推' }] },
        { name: 'Day 2：拉日', ex: [{ name: '高位下拉' }] },
        { name: '练后拉伸（Day 1 推日）', ex: [{ name: '门框胸部拉伸' }] },
        { name: '练后拉伸（Day 2 拉日）', ex: [{ name: '坐姿二头拉伸' }] }
      ]
    })
    expect(bundle.routines).toHaveLength(2)
    expect(bundle.routines[0].ex).toHaveLength(2)
    expect(bundle.routines[1].ex).toHaveLength(2)
    expect(report.map(r => r.name)).toEqual(['Day 1：推日', 'Day 2：拉日'])
  })

  it('does not let an English translation turn 绳索面拉 into a rear-delt row', async () => {
    const m = await resolveImportedExercise({ name: '绳索面拉', query: 'face pull' })
    expect(m.id).toBe(null)
    expect(m.matched).toBe(false)
  })

  it('does not let an English translation turn 鸽子式 into 双鸽式', async () => {
    const m = await resolveImportedExercise({ name: '鸽子式', query: 'pigeon pose' })
    expect(m.id).toBe(null)
    expect(m.matched).toBe(false)
  })

  it('never gives two customs the same id', async () => {
    const { bundle } = await buildImportedBundle({
      routines: [day({ name: '招财猫' }, { name: '固定器械坐姿推胸' })]
    })
    expect(new Set(bundle.customEx.map(c => c.id)).size).toBe(2)
  })

  it('reuses one custom exercise when the same movement appears twice', async () => {
    const { bundle } = await buildImportedBundle({
      routines: [day({ name: '招财猫' }), day({ name: '招财猫', sets: 4 })]
    })
    expect(bundle.customEx).toHaveLength(1)
    expect(bundle.routines[0].ex[0].id).toBe(bundle.routines[1].ex[0].id)
  })

  it('matches an equipment prefix, but not an angle that changes the lift', async () => {
    const pec = await resolveImportedExercise({ name: '蝴蝶机夹胸', query: 'pec deck fly' })
    expect(pec.id).toBe('1030')
    const incline = await resolveImportedExercise({ name: '上斜杠铃卧推', query: 'barbell bench press' })
    expect(incline.id).toBe(null)
    expect(incline.matched).toBe(false)
  })
})
