import { SafeProviderError } from '../types.ts'

export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null) {
    const length = Number(declaredLength)
    if (!Number.isSafeInteger(length) || length < 0) throw new SafeProviderError('INVALID_REQUEST', 'Invalid request body length.', false, 400)
    if (length > maxBytes) throw new SafeProviderError('INVALID_REQUEST', 'Request body is too large.', false, 413)
  }
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel('Request body limit exceeded.').catch(() => undefined)
        throw new SafeProviderError('INVALID_REQUEST', 'Request body is too large.', false, 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const combined = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(combined) }
  catch { throw new SafeProviderError('INVALID_REQUEST', 'Request body must be valid UTF-8.', false, 400) }
}

export async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = response.headers.get('content-length')
  if (declaredLength && Number(declaredLength) > maxBytes) throw new SafeProviderError('INVALID_RESPONSE', 'Provider response exceeded the allowed size.', true)
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        await reader.cancel('Provider response limit exceeded.').catch(() => undefined)
        throw new SafeProviderError('INVALID_RESPONSE', 'Provider response exceeded the allowed size.', true)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const combined = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(combined) }
  catch { throw new SafeProviderError('INVALID_RESPONSE', 'Provider returned invalid text.', true) }
}
