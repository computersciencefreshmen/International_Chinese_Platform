import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export function createObjectStorage(config = {}) {
  const configured = Boolean(
    config.s3Endpoint &&
    config.s3Bucket &&
    config.s3AccessKeyId &&
    config.s3SecretAccessKey
  )
  if (!configured) return null

  const client = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    forcePathStyle: config.s3ForcePathStyle,
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey
    }
  })
  const Bucket = config.s3Bucket

  return Object.freeze({
    async probe() {
      await client.send(new HeadBucketCommand({ Bucket }))
      return 'up'
    },
    async createUploadUrl({ key, mimeType, sizeBytes, expiresIn = 600 }) {
      return getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket,
          Key: key,
          ContentType: mimeType,
          ContentLength: sizeBytes
        }),
        {
          expiresIn,
          signableHeaders: new Set(['content-length', 'content-type'])
        }
      )
    },
    async copy({ sourceKey, destinationKey, sourceEtag, mimeType, sha256 }) {
      const copySource = `${Bucket}/${sourceKey
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
      return client.send(
        new CopyObjectCommand({
          Bucket,
          Key: destinationKey,
          CopySource: copySource,
          CopySourceIfMatch: sourceEtag,
          MetadataDirective: 'REPLACE',
          ContentType: mimeType,
          Metadata: { sha256 }
        })
      )
    },
    async head(key) {
      return client.send(new HeadObjectCommand({ Bucket, Key: key }))
    },
    async read(key) {
      return client.send(new GetObjectCommand({ Bucket, Key: key }))
    },
    async createDownloadUrl({
      key,
      contentDisposition,
      contentType,
      expiresIn = 300
    }) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: contentDisposition,
          ResponseContentType: contentType
        }),
        { expiresIn }
      )
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }))
    }
  })
}

export default createObjectStorage
