import assert from 'node:assert/strict'
import test from 'node:test'

import { createObjectStorage } from '../services/object-storage.js'

test('R2 upload URLs do not request unsupported full-object CRC32 checksums', async () => {
  const storage = createObjectStorage({
    s3Endpoint: 'https://example.r2.cloudflarestorage.com',
    s3Region: 'auto',
    s3Bucket: 'test-bucket',
    s3AccessKeyId: 'test-access-key',
    s3SecretAccessKey: 'test-secret-key',
    s3ForcePathStyle: false
  })

  const uploadUrl = new URL(
    await storage.createUploadUrl({
      key: 'tmp/example.png',
      mimeType: 'image/png',
      sizeBytes: 128
    })
  )

  assert.equal(uploadUrl.searchParams.has('x-amz-checksum-crc32'), false)
  assert.equal(
    uploadUrl.searchParams.has('x-amz-sdk-checksum-algorithm'),
    false
  )
})
