import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_BYTES,
  categoryFromKey,
  detectImageType,
  fileName,
  idForKey,
  validateUpload
} from '../src/media-policy.js';

const jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,0,0,0,0,0,0,0,0]);
const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const webp=new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]);
const gif=new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,0,0,0,0,0,0]);

assert.equal(categoryFromKey('incoming/housing/photo.jpg'),'housing');
assert.equal(categoryFromKey('incoming/behind-the-wall/photo.jpg'),'behind-the-wall');
assert.equal(categoryFromKey('incoming/unsorted/photo.jpg'),null);
assert.equal(categoryFromKey('other/photo.jpg'),null);
assert.equal(fileName('incoming/outreach/photo.jpg'),'photo.jpg');
assert.equal(idForKey('incoming/outreach/photo.jpg'),idForKey('incoming/outreach/photo.jpg'));
assert.notEqual(idForKey('incoming/outreach/photo.jpg'),idForKey('incoming/outreach/photo-2.jpg'));

assert.equal(detectImageType(jpeg),'image/jpeg');
assert.equal(detectImageType(png),'image/png');
assert.equal(detectImageType(webp),'image/webp');
assert.equal(detectImageType(gif),null);

assert.deepEqual(
  validateUpload({filename:'photo.jpg',size:1234,declaredContentType:'image/jpeg',headBytes:jpeg}),
  {ok:true,contentType:'image/jpeg'}
);
assert.deepEqual(
  validateUpload({filename:'photo.png',size:1234,declaredContentType:'application/octet-stream',headBytes:png}),
  {ok:true,contentType:'image/png'}
);
assert.equal(validateUpload({filename:'photo.gif',size:1234,declaredContentType:'image/gif',headBytes:gif}).code,'UNSUPPORTED_IMAGE');
assert.equal(validateUpload({filename:'photo.jpg',size:1234,declaredContentType:'image/png',headBytes:jpeg}).code,'CONTENT_TYPE_MISMATCH');
assert.equal(validateUpload({filename:'photo.jpg',size:1234,declaredContentType:'image/png',headBytes:png}).code,'EXTENSION_MISMATCH');
assert.equal(validateUpload({filename:'photo.bmp',size:1234,declaredContentType:'image/jpeg',headBytes:jpeg}).code,'UNSUPPORTED_EXTENSION');
assert.equal(validateUpload({filename:'photo.jpg',size:MAX_UPLOAD_BYTES+1,declaredContentType:'image/jpeg',headBytes:jpeg}).code,'FILE_TOO_LARGE');
assert.equal(validateUpload({filename:'photo.jpg',size:0,declaredContentType:'image/jpeg',headBytes:jpeg}).code,'EMPTY_FILE');

console.log('Media policy tests passed.');
