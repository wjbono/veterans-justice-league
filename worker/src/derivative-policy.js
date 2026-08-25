export const DERIVATIVES=[
  {name:'thumb',field:'thumb_key',width:480,quality:78},
  {name:'web',field:'web_key',width:1280,quality:82},
  {name:'large',field:'large_key',width:1920,quality:85}
];

export function derivativeKey(mediaId,name){
  const safeId=String(mediaId||'').replace(/[^a-zA-Z0-9_-]/g,'_');
  if(!safeId)throw new Error('MEDIA_ID_REQUIRED');
  if(!DERIVATIVES.some(item=>item.name===name))throw new Error('INVALID_DERIVATIVE');
  return `published/${safeId}/${name}.webp`;
}

export function derivativeUrls(origin,mediaId){
  const base=`${String(origin).replace(/\/$/,'')}/media/${encodeURIComponent(mediaId)}`;
  return {
    thumb_url:`${base}?size=thumb`,
    public_url:`${base}?size=web`,
    web_url:`${base}?size=web`,
    large_url:`${base}?size=large`
  };
}
