import assert from 'node:assert/strict';
import {parseExifDate} from '../src/exif-date.js';

function makeExifJpeg(date='2026:08:25 10:30:45'){
  const tiff=new Uint8Array(64);
  const view=new DataView(tiff.buffer);
  tiff[0]=0x49;tiff[1]=0x49;
  view.setUint16(2,42,true);
  view.setUint32(4,8,true);
  view.setUint16(8,1,true);
  view.setUint16(10,0x8769,true);
  view.setUint16(12,4,true);
  view.setUint32(14,1,true);
  view.setUint32(18,26,true);
  view.setUint32(22,0,true);
  view.setUint16(26,1,true);
  view.setUint16(28,0x9003,true);
  view.setUint16(30,2,true);
  view.setUint32(32,20,true);
  view.setUint32(36,44,true);
  view.setUint32(40,0,true);
  for(let i=0;i<date.length;i++)tiff[44+i]=date.charCodeAt(i);
  tiff[44+date.length]=0;

  const payload=new Uint8Array(6+tiff.length);
  payload.set([0x45,0x78,0x69,0x66,0,0],0);
  payload.set(tiff,6);
  const length=payload.length+2;
  const jpeg=new Uint8Array(2+2+2+payload.length+2);
  jpeg.set([0xff,0xd8,0xff,0xe1,(length>>8)&0xff,length&0xff],0);
  jpeg.set(payload,6);
  jpeg.set([0xff,0xd9],6+payload.length);
  return jpeg;
}

assert.equal(parseExifDate(makeExifJpeg()),'2026-08-25T10:30:45');
assert.equal(parseExifDate(makeExifJpeg('1899:08:25 10:30:45')),null);
assert.equal(parseExifDate(new Uint8Array([0x89,0x50,0x4e,0x47])),null);
assert.equal(parseExifDate(new Uint8Array([0xff,0xd8,0xff,0xd9])),null);

console.log('EXIF date tests passed.');
