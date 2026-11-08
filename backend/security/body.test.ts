import { describe, expect, test } from 'bun:test'
import { readBoundedResponse, readBoundedText } from './body.ts'

function chunkedBody(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) { controller.close(); return }
      controller.enqueue(encoder.encode(chunks[index++]!))
    },
  })
}

describe('bounded HTTP body readers', () => {
  test('accepts chunked request bodies below the byte limit', async () => {
    const request = new Request('https://king-fun.test/api', { method: 'POST', body: chunkedBody(['{"x":', '1}']), duplex: 'half' } as RequestInit)
    await expect(readBoundedText(request, 16)).resolves.toBe('{"x":1}')
  })

  test('rejects chunked request bodies above the byte limit', async () => {
    const request = new Request('https://king-fun.test/api', { method: 'POST', body: chunkedBody(['1234', '5678']), duplex: 'half' } as RequestInit)
    await expect(readBoundedText(request, 6)).rejects.toMatchObject({ status: 413 })
  })

  test('rejects malformed UTF-8 in a request body', async () => {
    const request = new Request('https://king-fun.test/api', { method: 'POST', body: new Uint8Array([0xc3, 0x28]) })
    await expect(readBoundedText(request, 16)).rejects.toMatchObject({ status: 400 })
  })

  test('bounds streamed provider responses', async () => {
    const response = new Response(chunkedBody(['abc', 'def']))
    await expect(readBoundedResponse(response, 5)).rejects.toMatchObject({ status: 502 })
  })
})
