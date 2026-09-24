export function getAvatarColor(value: string): string {
  const colors = [
    '#6366F1',
    '#8B5CF6',
    '#EC4444',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#EC4899',
  ]
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return colors[hash % colors.length] ?? colors[0]!
}
