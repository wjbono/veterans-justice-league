function normalizeExifDate(value){
  const match=String(value||'').trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if(!match)return null;
  const [,year,month,day,hour,minute,second]=match;
  const parts=[Number(year),Number(month),Number(day),Number(hour),Number(minute),Number(second)];
  if(parts[0]<1900||parts[1]<1||parts[1]>12||parts[2]<1||parts[2]>31||parts[3]>23||parts[4]>59||parts[5]>59)return null;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function parseTiffDate(bytes,tiffStart,tiffEnd){
  if(tiffStart+8>tiffEnd)return null;
  const little=bytes[tiffStart]===0x49&&bytes[tiffStart+1]===0x49;
  const big=bytes[tiffStart]===0x4d&&bytes[tiffStart+1]===0x4d;
  if(!little&&!big)return null;

  const u16=offset=>{
    if(offset<0||offset+2>tiffEnd)return null;
    return little
      ? bytes[offset]|(bytes[offset+1]<<8)
      : (bytes[offset]<<8)|bytes[offset+1];
  };
  const u32=offset=>{
    if(offset<0||offset+4>tiffEnd)return null;
    return little
      ? (bytes[offset]|(bytes[offset+1]<<8)|(bytes[offset+2]<<16)|(bytes[offset+3]<<24))>>>0
      : (((bytes[offset]<<24)>>>0)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;
  };
  if(u16(tiffStart+2)!==42)return null;

  const asciiFromEntry=(entry,type,count)=>{
    if(type!==2||!count||count>128)return null;
    let start;
    if(count<=4)start=entry+8;
    else{
      const relative=u32(entry+8);
      if(relative===null)return null;
      start=tiffStart+relative;
    }
    if(start<tiffStart||start+count>tiffEnd)return null;
    let value='';
    for(let i=0;i<count;i++){
      const code=bytes[start+i];
      if(code===0)break;
      if(code<0x20||code>0x7e)return null;
      value+=String.fromCharCode(code);
    }
    return normalizeExifDate(value);
  };

  const scanIfd=relativeOffset=>{
    const start=tiffStart+relativeOffset;
    const count=u16(start);
    if(count===null||count>512)return {date:null,exifOffset:null};
    let fallback=null;
    let exifOffset=null;
    for(let i=0;i<count;i++){
      const entry=start+2+i*12;
      if(entry+12>tiffEnd)break;
      const tag=u16(entry);
      const type=u16(entry+2);
      const valueCount=u32(entry+4);
      if(tag===0x0132&&!fallback)fallback=asciiFromEntry(entry,type,valueCount);
      if(tag===0x8769&&type===4&&valueCount===1)exifOffset=u32(entry+8);
    }
    return {date:fallback,exifOffset};
  };

  const ifd0Offset=u32(tiffStart+4);
  if(ifd0Offset===null)return null;
  const ifd0=scanIfd(ifd0Offset);
  let original=null;
  let digitized=null;
  if(ifd0.exifOffset!==null){
    const start=tiffStart+ifd0.exifOffset;
    const count=u16(start);
    if(count!==null&&count<=512){
      for(let i=0;i<count;i++){
        const entry=start+2+i*12;
        if(entry+12>tiffEnd)break;
        const tag=u16(entry);
        const type=u16(entry+2);
        const valueCount=u32(entry+4);
        if(tag===0x9003&&!original)original=asciiFromEntry(entry,type,valueCount);
        if(tag===0x9004&&!digitized)digitized=asciiFromEntry(entry,type,valueCount);
      }
    }
  }
  return original||digitized||ifd0.date||null;
}

export function parseExifDate(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input||[]);
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  let offset=2;
  while(offset+4<=bytes.length){
    if(bytes[offset]!==0xff){offset++;continue;}
    const marker=bytes[offset+1];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x00||marker===0x01||(marker>=0xd0&&marker<=0xd7)){offset+=2;continue;}
    const length=(bytes[offset+2]<<8)|bytes[offset+3];
    if(length<2)break;
    const dataStart=offset+4;
    const segmentEnd=offset+2+length;
    if(segmentEnd>bytes.length)break;
    if(marker===0xe1&&dataStart+6<=segmentEnd&&
      bytes[dataStart]===0x45&&bytes[dataStart+1]===0x78&&bytes[dataStart+2]===0x69&&bytes[dataStart+3]===0x66&&bytes[dataStart+4]===0&&bytes[dataStart+5]===0){
      return parseTiffDate(bytes,dataStart+6,segmentEnd);
    }
    offset=segmentEnd;
  }
  return null;
}
