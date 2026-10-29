import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { Readable } from 'node:stream';
import { createStorage } from '../server/storage.mjs';

test('S3 proxy forwards range requests and streams 206 responses on the stable app URL', async () => {
  const seen = [];
  const storage = createStorage({ bucket: 'test', client: { async send(command) {
    seen.push(command.input);
    return { Body: Readable.from(Buffer.from('test')), ContentType: 'audio/mpeg', ContentLength: 4, ContentRange: 'bytes 0-3/20' };
  } } });
  const app = express(); app.get('/audio', (req, res) => storage.serve('safe-id.mp3', req, res));
  const response = await request(app).get('/audio').set('Range', 'bytes=0-3').expect(206);
  assert.equal(seen[0].Range, 'bytes=0-3'); assert.equal(seen[0].Key, 'safe-id.mp3');
  assert.equal(response.headers['content-range'], 'bytes 0-3/20');
  assert.equal(response.headers['accept-ranges'], 'bytes'); assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(response.headers.location, undefined); assert.equal(response.headers['content-length'], '4');
  await request(app).get('/audio').set('Range', 'bytes=0-3,8-10').expect(416);
  assert.equal(seen.length, 1);
});
test('S3 unavailable media and invalid ranges return recoverable HTTP statuses', async () => {
  for (const [name, status] of [['NoSuchKey',404],['InvalidRange',416]]) {
    const storage = createStorage({ bucket: 'test', client: { async send() { throw Object.assign(new Error(name), { name }); } } });
    const app = express(); app.get('/audio', (req,res) => storage.serve('safe-id.mp3',req,res));
    await request(app).get('/audio').expect(status);
  }
});
test('storage rejects object paths outside its generated-key namespace', async () => {
  const storage = createStorage({ directory: '.', bucket: '' });
  await assert.rejects(() => storage.read('../.env'), /Invalid media key/);
  await assert.rejects(() => storage.read('file.svg'), /Invalid media key/);
});
