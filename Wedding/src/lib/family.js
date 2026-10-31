// "Yang Berharap" family groups.
//
// The ONLY source is MySQL: wedding_settings.content.invitation.familyGroups
//   [{ title: 'Keluarga Pengantin Lelaki', members: 'one name per line' }, …]
// There is deliberately no built-in list of names: if the groups are missing,
// empty or could not be loaded, the family list is simply not shown.

const text = (v) => (typeof v === 'string' ? v : '')

/** The stored groups, normalised for editing ([] when there are none). */
export function familyGroupsOf(invitation) {
  if (!Array.isArray(invitation?.familyGroups)) return []
  return invitation.familyGroups.filter((g) => g && typeof g === 'object').map((g) => ({ title: text(g.title), members: text(g.members) }))
}

/**
 * Groups with at least one name, one name per display line. Names are shown
 * exactly as stored; a "/" (as printed on the card between couples) only
 * starts a new line.
 */
export function visibleFamilyGroups(invitation) {
  return familyGroupsOf(invitation)
    .map((g) => ({ title: g.title.trim(), lines: g.members.split(/\r?\n|\//).map((l) => l.trim()).filter(Boolean) }))
    .filter((g) => g.lines.length > 0)
}
