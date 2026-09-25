import { supabase } from './supabase'
import {
  decryptWithPrivateKey,
  encryptForPublicKey,
  importAesKey,
  newKeyBytes,
} from './vault-crypto'
import { requireActiveVaultSession } from './vault-session'

interface WorkspaceKeyRow {
  workspace_id: string
  user_id: string
  wrapped_key: string
}

interface PublicKeyRow {
  user_id: string
  public_key: string
}

async function readOwnWorkspaceKey(workspaceId: string) {
  const session = requireActiveVaultSession()
  const { data, error } = await supabase
    .from('vault_workspace_keys')
    .select('workspace_id, user_id, wrapped_key')
    .eq('workspace_id', workspaceId)
    .eq('user_id', session.userId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo leer la clave del equipo: ${error.message}`)
  return { data: data as WorkspaceKeyRow | null, session }
}

async function unwrapWorkspaceKey(
  row: WorkspaceKeyRow,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  const raw = await decryptWithPrivateKey(row.wrapped_key, privateKey)
  return importAesKey(raw)
}

/** Devuelve la clave AES del equipo para el usuario autenticado. */
export async function getWorkspaceKey(workspaceId: string): Promise<CryptoKey> {
  const { data, session } = await readOwnWorkspaceKey(workspaceId)
  if (!data) {
    return ensureWorkspaceKey(workspaceId)
  }
  return unwrapWorkspaceKey(data, session.privateKey)
}

/** Crea la clave AES del equipo si el usuario actual es su propietario. */
export async function ensureWorkspaceKey(workspaceId: string): Promise<CryptoKey> {
  const { data, session } = await readOwnWorkspaceKey(workspaceId)
  if (data) return unwrapWorkspaceKey(data, session.privateKey)

  const { data: workspace, error: workspaceError } = await supabase
    .from('vault_workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()
  if (workspaceError || !workspace) {
    throw new Error('No se encontró el espacio de trabajo.')
  }
  if (workspace.owner_id !== session.userId) {
    throw new Error(
      'El propietario todavía no ha compartido la clave cifrada de este equipo contigo.',
    )
  }

  const raw = newKeyBytes(32)
  const key = await importAesKey(raw)
  const wrappedKey = await encryptForPublicKey(raw, session.publicKey)
  const { error } = await supabase.from('vault_workspace_keys').insert({
    workspace_id: workspaceId,
    user_id: session.userId,
    wrapped_key: wrappedKey,
  })
  if (error) throw new Error(`No se pudo crear la clave del equipo: ${error.message}`)
  return key
}

/** El propietario envuelve la clave del equipo con las claves públicas activas. */
export async function syncWorkspaceKeys(
  workspaceId: string,
  memberUserIds: string[],
): Promise<void> {
  const session = requireActiveVaultSession()
  await ensureWorkspaceKey(workspaceId)
  const ids = [...new Set([session.userId, ...memberUserIds])]
  const { data, error } = await supabase.rpc('get_vault_public_keys', {
    target_user_ids: ids,
  })
  if (error) throw new Error(`No se pudieron obtener las claves públicas: ${error.message}`)

  const publicKeys = new Map(
    ((data ?? []) as PublicKeyRow[]).map((row) => [row.user_id, row.public_key]),
  )
  const rawKey = new Uint8Array(32)
  // La clave importada no es exportable; el propietario debe volver a envolver
  // los bytes que genera ensureWorkspaceKey. Para evitar Regenerar una clave
  // distinta, sincronizamos usando la fila propia y su envoltura.
  const ownRow = (await readOwnWorkspaceKey(workspaceId)).data
  if (!ownRow) throw new Error('No se encontró la clave del propietario.')
  const rawForWrapping = await decryptWithPrivateKey(
    ownRow.wrapped_key,
    session.privateKey,
  )
  rawKey.set(new Uint8Array(rawForWrapping))

  for (const userId of ids) {
    const publicKey = publicKeys.get(userId)
    if (!publicKey) continue
    const wrappedKey = await encryptForPublicKey(rawKey, publicKey)
    const { error: upsertError } = await supabase.from('vault_workspace_keys').upsert(
      { workspace_id: workspaceId, user_id: userId, wrapped_key: wrappedKey },
      { onConflict: 'workspace_id,user_id' },
    )
    if (upsertError) {
      throw new Error(`No se pudo compartir la clave con un miembro: ${upsertError.message}`)
    }
  }
  // La clave AES nunca se exporta desde Web Crypto; solo se distribuye
  // envuelta con la clave pública de cada miembro.
}
