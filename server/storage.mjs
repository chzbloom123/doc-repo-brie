import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export function createStorage({ directory = process.env.DATA_DIR || './data', bucket = process.env.S3_BUCKET, client: providedClient } = {}) {
  const root = path.resolve(directory, 'media');
  if (bucket && !providedClient && (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY)) throw new Error('S3 storage requires its endpoint and both server-side credentials.');
  const client = bucket ? providedClient || new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    // Railway Buckets require virtual-hosted style.
    forcePathStyle: false,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
  }) : null;
  const safe = key => {
    if (!/^[a-zA-Z0-9-]+\.(mp3|jpg|png|webp)$/.test(key)) throw new Error('Invalid media key');
    return path.join(root, key);
  };
  return {
    kind: client ? 's3' : 'local',
    async put(key, body, contentType) {
      const target = safe(key);
      if (client) await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      else { await fs.mkdir(root, { recursive: true }); await fs.writeFile(target, body, { flag: 'wx' }); }
    },
    async remove(key) {
      const target = safe(key);
      if (client) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      else await fs.rm(target, { force: true });
    },
    async read(key) {
      const target = safe(key);
      if (!client) return fs.readFile(target);
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async serve(key, req, res) {
      const target = safe(key);
      res.set('Cache-Control', 'private, no-store');
      if (client) {
        // Keep the browser on the authorized endpoint: seeking hours later cannot hit an expired URL.
        const range = req.get('range');
        if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return res.status(416).end();
        const abort = new AbortController();
        const disconnected = () => { if (!res.writableEnded) abort.abort(); };
        res.on('close', disconnected);
        try {
          const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...(range ? { Range: range } : {}) }), { abortSignal: abort.signal });
          res.status(result.ContentRange ? 206 : 200);
          res.set('Accept-Ranges', 'bytes');
          res.set('Content-Type', result.ContentType || (key.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream'));
          if (result.ContentLength != null) res.set('Content-Length', String(result.ContentLength));
          if (result.ContentRange) res.set('Content-Range', result.ContentRange);
          if (req.method === 'HEAD') { result.Body.destroy(); return res.end(); }
          await pipeline(result.Body, res);
        } catch (error) {
          if (abort.signal.aborted || res.destroyed) return;
          if (!res.headersSent && (error.name === 'InvalidRange' || error.$metadata?.httpStatusCode === 416)) return res.status(416).end();
          if (!res.headersSent && error.name === 'NoSuchKey') return res.status(404).json({ error: 'Audio is unavailable. Please try again.' });
          throw error;
        } finally { res.off('close', disconnected); }
        return;
      }
      // Express sendFile implements range/conditional requests, including 206 and 416.
      return res.sendFile(target, { cacheControl: false, acceptRanges: true }, error => {
        if (error && !res.headersSent) res.status(error.statusCode || 404).json({ error: 'Audio is unavailable. Please try again.' });
      });
    },
  };
}
