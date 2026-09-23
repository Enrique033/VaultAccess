/**
 * Paleta de colores para identificar categorías visualmente.
 */
export const CATEGORY_COLORS = [
  '#8B5CF6', // violeta
  '#EC4899', // rosa
  '#10B981', // verde
  '#F59E0B', // ámbar
  '#3B82F6', // azul
  '#EF4444', // rojo
  '#14B8A6', // teal
  '#6B7280', // gris
] as const

export function pickCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]!
}
