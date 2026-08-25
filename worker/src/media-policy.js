export const CATEGORIES=new Set(['housing','behind-the-wall','outreach','events','team','partners']);
export const INCOMING=[
  'incoming/housing/',
  'incoming/behind-the-wall/',
  'incoming/outreach/',
  'incoming/events/',
  'incoming/team/',
  'incoming/partners/',
  'incoming/unsorted/'
];
export const MAX_UPLOAD_BYTES=25*1024*1024;

const EXTENSION_TYPES=new Map([
  ['jpg','image/jpeg'],['jpeg','image/jpeg'],
  ['png','image/png'],
  ['webp','image/webp']
]);

export function categoryFromKey(key){
  for(const prefix of INCOMING){
    if(key.startsWith(prefix)){
      const category=prefix.split('/')[1];
      return category==='unsorted'?null:category;
    }
  }
  return null;
}

export const fileName=key=>key.split('/').pop()||key;

export function idForKey(key){
  let h=2166136261;
  for(let i=0;i<key.length;i++){
    h^=key.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return 'm_'+(h>>>0).toString(16);
}

function extensionType(filename){
  const match=String(filename||'').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?EXTENSION_TYPES.get(match[1])||null:null;
}

export function detectImageType(bytes){
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
  if(b.length>=8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===0x0d&&b[5]===0x0a&&b[6]===0x1a&&b[7]===0x0a)return 'image/png';
  if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
  return null;
}

export function validateUpload({filename,size,declaredContentType,headBytes,maxBytes=MAX_UPLOAD_BYTES}){
  const bytes=Number(size||0);
  if(!Number.isFinite(bytes)||bytes<=0)return {ok:false,code:'EMPTY_FILE',message:'The uploaded object is empty.'};
  if(bytes>maxBytes)return {ok:false,code:'FILE_TOO_LARGE',message:`The uploaded object exceeds the ${Math.floor(maxBytes/1024/1024)} MB limit.`};

  const detected=detectImageType(headBytes);
  if(!detected)return {ok:false,code:'UNSUPPORTED_IMAGE',message:'Only JPEG, PNG, and WebP image files are accepted.'};

  const expected=extensionType(filename);
  if(!expected)return {ok:false,code:'UNSUPPORTED_EXTENSION',message:'The filename must use .jpg, .jpeg, .png, or .webp.'};
  if(expected!==detected)return {ok:false,code:'EXTENSION_MISMATCH',message:'The filename extension does not match the image content.'};

  const declared=String(declaredContentType||'').toLowerCase().split(';')[0].trim();
  if(declared&&declared!=='application/octet-stream'&&declared!==detected){
    return {ok:false,code:'CONTENT_TYPE_MISMATCH',message:'The stored content type does not match the image content.'};
  }

  return {ok:true,contentType:detected};
}
