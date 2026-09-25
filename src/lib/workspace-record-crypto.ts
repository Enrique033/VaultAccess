import { supabase } from './supabase'
import {
  getVaultSessionGeneration,
  requireActiveVaultSession,
} from './vault-session'
import {
  decryptJson,
  encryptJson,
  workspaceRecordAad,
} from './vault-crypto'
import type { WorkspaceItemPayload } from './vault-payloads'
import type { WorkspaceItem } from '@/types'
import type { WorkspaceItemRow } from './workspace-mapper'
import { originOf } from './workspace-mapper'

function required(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`No se pudo descifrar ${field}: el registro está incompleto.`)
  }
  return value
}

export async function toEncryptedWorkspaceItem(
  row: WorkspaceItemRow,
  workspaceId: string,
  key: CryptoKey,
): Promise<WorkspaceItem> {
  const aad = workspaceRecordAad(workspaceId, row.id)
  const vaultGeneration = getVaultSessionGeneration()
  requireActiveVaultSession()
  const { kind, sourceId } = originOf(row)
  let payload: WorkspaceItemPayload
  if (row.encrypted_payload) {
    payload = await decryptJson<WorkspaceItemPayload>(
      row.encrypted_payload,
      key,
      aad,
    )
    if (vaultGeneration !== getVaultSessionGeneration()) {
      throw new Error('La sesión del Vault cambió durante el descifrado.')
    }
  } else {
    /*
      Fila heredada en claro (creada antes del cifrado). Los enlaces y las
      notas no tienen usuario ni clave, así que sólo se exigen si el tipo es
      credencial.
    */
    payload = {
      title: required(row.title, 'el título compartido'),
      username: kind === 'credential' ? required(row.username, 'el usuario compartido') : '',
      password: kind === 'credential' ? required(row.password, 'la contraseña compartida') : '',
      url: row.url ?? undefined,
      notes: row.notes ?? undefined,
      description: row.description ?? undefined,
      content: row.content ?? undefined,
    }
    const encryptedPayload = await encryptJson(payload, key, aad)
    if (vaultGeneration !== getVaultSessionGeneration()) {
      throw new Error('La sesión del Vault cambió durante el cifrado.')
    }
    const { error } = await supabase
      .from('vault_workspace_items')
      .update({
        encrypted_payload: encryptedPayload,
        title: null,
        username: null,
        password: null,
        url: null,
        notes: null,
        description: null,
        content: null,
      })
      .eq('id', row.id)
    if (error) {
      // Un viewer puede leer la fila heredada, pero no puede limpiarla porque
      // RLS solo permite editar a owner/editor. El propietario la migrará al
      // abrirla; no se debe bloquear la lectura de datos ya disponibles.
      console.warn(
        '[Workvaul] No se pudo limpiar un elemento compartido heredado:',
        error.message,
      )
    }
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind,
    sourceId,
    createdBy: row.created_by,
    title: payload.title,
    username: payload.username,
    password: payload.password,
    url: payload.url,
    notes: payload.notes,
    description: payload.description,
    content: payload.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
