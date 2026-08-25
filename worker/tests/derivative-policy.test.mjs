import assert from 'node:assert/strict';
import {DERIVATIVES,derivativeKey,derivativeUrls} from '../src/derivative-policy.js';

assert.deepEqual(DERIVATIVES.map(item=>item.name),['thumb','web','large']);
assert.deepEqual(DERIVATIVES.map(item=>item.width),[480,1280,1920]);
assert.equal(derivativeKey('m_abc123','thumb'),'published/m_abc123/thumb.webp');
assert.equal(derivativeKey('unsafe/id','large'),'published/unsafe_id/large.webp');
assert.throws(()=>derivativeKey('','web'),/MEDIA_ID_REQUIRED/);
assert.throws(()=>derivativeKey('m_1','original'),/INVALID_DERIVATIVE/);
assert.deepEqual(
  derivativeUrls('https://example.workers.dev/','m_abc123'),
  {
    thumb_url:'https://example.workers.dev/media/m_abc123?size=thumb',
    public_url:'https://example.workers.dev/media/m_abc123?size=web',
    web_url:'https://example.workers.dev/media/m_abc123?size=web',
    large_url:'https://example.workers.dev/media/m_abc123?size=large'
  }
);

console.log('Derivative policy tests passed.');
