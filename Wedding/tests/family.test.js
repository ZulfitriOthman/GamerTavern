import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultContent } from '../src/config/defaultContent.js'
import { familyGroupsOf, visibleFamilyGroups } from '../src/lib/family.js'
import { deepMerge } from '../src/lib/merge.js'

// Shaped like wedding_settings.content.invitation from the API (placeholder names).
const stored = {
  familyHeading: 'Yang Berharap',
  familyGroups: [
    { title: 'Group One', members: 'Awg A Bin B\nDyg C Binti D (Isteri)\nAwg E Bin F' },
    { title: 'Group Two', members: 'Awg G Bin H\nDyg I Binti J(Isteri)' },
  ],
}
const shown = (invitation) => visibleFamilyGroups(deepMerge(defaultContent, { invitation }).invitation)

describe('family groups (MySQL is the only source)', () => {
  it('the frontend ships no family names of its own', () => {
    assert.deepEqual(defaultContent.invitation.familyGroups, [])
    assert.equal('family' in defaultContent.invitation, false)
    const source = JSON.stringify(defaultContent)
    for (const name of ['Noorhana', 'Haji Ismail', 'Abd Hamid', 'Qisthina', 'Mohd Daud', 'Syafie']) assert.equal(source.includes(name), false, name)
  })

  it('renders exactly the stored groups, in order, one name per line', () => {
    assert.deepEqual(shown(stored), [
      { title: 'Group One', lines: ['Awg A Bin B', 'Dyg C Binti D (Isteri)', 'Awg E Bin F'] },
      { title: 'Group Two', lines: ['Awg G Bin H', 'Dyg I Binti J(Isteri)'] },
    ])
  })

  it('an edited name in the database is what gets shown', () => {
    const edited = structuredClone(stored)
    edited.familyGroups[1].members = edited.familyGroups[1].members.replace('Awg G Bin H', 'Awg G Bin H (edited)')
    assert.equal(shown(edited)[1].lines[0], 'Awg G Bin H (edited)')
  })

  it('shows nothing (never old names) when groups are missing, empty or not loaded', () => {
    assert.deepEqual(visibleFamilyGroups(deepMerge(defaultContent, {}).invitation), [])
    assert.deepEqual(shown({ familyGroups: [] }), [])
    assert.deepEqual(visibleFamilyGroups({ family: 'Legacy Name / Other Name' }), [])
    assert.deepEqual(visibleFamilyGroups(undefined), [])
    assert.deepEqual(familyGroupsOf({ familyGroups: 'not-an-array' }), [])
  })

  it('hides empty groups, trims, and ignores blank lines and malformed entries', () => {
    const v = visibleFamilyGroups({ familyGroups: [{ title: ' T ', members: 'a\r\n\n b \n' }, { title: 'Empty', members: '  ' }, null, { title: 7 }] })
    assert.deepEqual(v, [{ title: 'T', lines: ['a', 'b'] }])
  })

  it('a "/" between names only starts a new line', () => {
    assert.deepEqual(visibleFamilyGroups({ familyGroups: [{ title: 'T', members: 'Awg A / Dyg B /\nAwg C' }] })[0].lines, ['Awg A', 'Dyg B', 'Awg C'])
  })

  it('admin editing keeps the stored structure', () => {
    assert.deepEqual(familyGroupsOf(stored), stored.familyGroups)
    assert.deepEqual(familyGroupsOf({}), [])
  })
})
