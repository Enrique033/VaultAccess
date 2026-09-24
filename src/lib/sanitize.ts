/**
 * Sanitización defensiva para texto de chat.
 *
 * React escapa el contenido al renderizarlo, pero el mensaje también se
 * sanea antes de persistirlo para no almacenar HTML ni caracteres de control.
 * Los mensajes se muestran siempre como texto plano en ChatDrawer.
 */
export function sanitizeChatInput(value: string): string {
  const withoutControlChars = [...value.normalize('NFC')]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code === 0x09 || code === 0x0a || (code >= 0x20 && code !== 0x7f)
    })
    .join('')

  return withoutControlChars
    .replace(/[<>]/g, '')
    .replace(/[\u2028\u2029]/g, '\n')
    .trim()
    .slice(0, 2000)
}
