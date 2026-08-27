import worker from './index.js';
import {CATEGORIES,INCOMING,MAX_UPLOAD_BYTES,validateUpload} from './media-policy.js';

const SESSION_SECONDS=7*24*60*60;
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8',...headers}
});

function cors(env,req){
  const origin=req.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean);
  return allowed.includes(origin)?{
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Headers':'Authorization, Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'
  }:{};
}

function legacyAuthorized(env,req){
  const header=req.headers.get('Authorization')||'';
  return Boolean(env.ADMIN_TOKEN&&header===`Bearer ${env.ADMIN_TOKEN}`);
}

function authConfig(env){
  return {
    username:String(env.ADMIN_USERNAME||'admin'),
    password:String(env.ADMIN_PASSWORD||env.ADMIN_TOKEN||'')
  };
}

function base64UrlEncode(bytes){
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for(const byte of view)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function base64UrlDecode(value){
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

async function hmac(env,value){
  const {password}=authConfig(env);
  if(!password)throw new Error('AUTH_NOT_CONFIGURED');
  const key=await crypto.subtle.importKey(
    'raw',new TextEncoder().encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}

function timingSafeEqual(a,b){
  const left=new TextEncoder().encode(String(a));
  const right=new TextEncoder().encode(String(b));
  let diff=left.length^right.length;
  const length=Math.max(left.length,right.length);
  for(let i=0;i<length;i++)diff|=(left[i%left.length]||0)^(right[i%right.length]||0);
  return diff===0;
}

async function issueSession(env,username){
  const now=Math.floor(Date.now()/1000);
  const payload={sub:username,iat:now,exp:now+SESSION_SECONDS,v:1};
  const encoded=base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature=base64UrlEncode(await hmac(env,encoded));
  return {token:`${encoded}.${signature}`,expires_at:new Date(payload.exp*1000).toISOString()};
}

async function verifySession(env,token){
  try{
    const parts=String(token||'').split('.');
    if(parts.length!==2)return null;
    const [payloadPart,signaturePart]=parts;
    const expected=base64UrlEncode(await hmac(env,payloadPart));
    if(!timingSafeEqual(signaturePart,expected))return null;
    const payload=JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
    const now=Math.floor(Date.now()/1000);
    if(payload.v!==1||!payload.sub||!payload.exp||payload.exp<=now)return null;
    const {username}=authConfig(env);
    if(payload.sub!==username)return null;
    return payload;
  }catch(error){
    return null;
  }
}

function bearer(req){
  const header=req.headers.get('Authorization')||'';
  return header.startsWith('Bearer ')?header.slice(7):'';
}

async function authenticateRequest(env,req){
  if(legacyAuthorized(env,req))return {ok:true,request:req,user:'admin',legacy:true};
  const payload=await verifySession(env,bearer(req));
  if(!payload)return {ok:false,request:req,user:null,legacy:false};
  const headers=new Headers(req.headers);
  headers.set('Authorization',`Bearer ${env.ADMIN_TOKEN}`);
  headers.set('X-VJL-Admin-User',payload.sub);
  return {ok:true,request:new Request(req,{headers}),user:payload.sub,legacy:false};
}

async function login(req,env,corsHeaders){
  const {username,password}=authConfig(env);
  if(!password)return json({error:'Admin authentication is not configured.'},503,corsHeaders);
  const body=await req.json().catch(()=>({}));
  if(!timingSafeEqual(body.username||'',username)||!timingSafeEqual(body.password||'',password)){
    return json({error:'Incorrect username or password.'},401,corsHeaders);
  }
  const session=await issueSession(env,username);
  return json({ok:true,username,...session},200,corsHeaders);
}

async function sessionStatus(req,env,corsHeaders){
  const payload=await verifySession(env,bearer(req));
  if(!payload)return json({error:'Session expired.'},401,corsHeaders);
  return json({ok:true,username:payload.sub,expires_at:new Date(payload.exp*1000).toISOString()},200,corsHeaders);
}

function compatibleEnv(env){
  const markerKeys=new Set(INCOMING);

  let wrappedImages=env.IMAGES;
  if(env.IMAGES&&typeof env.IMAGES.input==='function'){
    const images=env.IMAGES;
    wrappedImages=new Proxy(images,{
      get(target,prop,receiver){
        if(prop==='input'){
          return value=>{
            let input=value;
            if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))input=new Blob([value]).stream();
            return target.input(input);
          };
        }
        const member=Reflect.get(target,prop,receiver);
        return typeof member==='function'?member.bind(target):member;
      }
    });
  }

  let wrappedMedia=env.MEDIA;
  if(env.MEDIA&&typeof env.MEDIA.list==='function'){
    const media=env.MEDIA;
    wrappedMedia=new Proxy(media,{
      get(target,prop,receiver){
        if(prop==='list'){
          return async options=>{
            const page=await target.list(options);
            return {...page,objects:(page.objects||[]).filter(object=>!markerKeys.has(object.key))};
          };
        }
        const member=Reflect.get(target,prop,receiver);
        return typeof member==='function'?member.bind(target):member;
      }
    });
  }

  return new Proxy(env,{
    get(target,prop,receiver){
      if(prop==='IMAGES')return wrappedImages;
      if(prop==='MEDIA')return wrappedMedia;
      return Reflect.get(target,prop,receiver);
    }
  });
}

async function cleanupFolderMarkerRows(env){
  let removed=0;
  for(const objectKey of INCOMING){
    const row=await env.DB.prepare('SELECT id FROM media WHERE object_key=?').bind(objectKey).first();
    if(!row)continue;
    await env.DB.prepare('DELETE FROM media_history WHERE media_id=?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM media WHERE id=?').bind(row.id).run();
    removed++;
  }
  return removed;
}

function safeName(name){
  const cleaned=String(name||'image')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(-120);
  return cleaned||'image';
}

function uploadKey(category,name){
  const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
  const unique=crypto.randomUUID().slice(0,8);
  return `incoming/${category}/${stamp}-${unique}-${safeName(name)}`;
}

async function uploadMedia(req,env,ctx,url,corsHeaders){
  if(!legacyAuthorized(env,req))return json({error:'Unauthorized'},401,corsHeaders);

  const form=await req.formData();
  const category=String(form.get('category')||'unsorted');
  if(category!=='unsorted'&&!CATEGORIES.has(category))return json({error:'Invalid upload category.'},400,corsHeaders);

  const files=form.getAll('files').filter(value=>value&&typeof value.arrayBuffer==='function'&&typeof value.name==='string');
  if(!files.length)return json({error:'Select at least one image.'},400,corsHeaders);
  if(files.length>10)return json({error:'Upload no more than 10 images at a time.'},400,corsHeaders);

  const prepared=[];
  for(const file of files){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const validation=validateUpload({
      filename:file.name,size:bytes.byteLength,declaredContentType:file.type,
      headBytes:bytes.subarray(0,16),maxBytes:MAX_UPLOAD_BYTES
    });
    if(!validation.ok)return json({error:`${file.name}: ${validation.message}`,code:validation.code},400,corsHeaders);
    prepared.push({file,bytes,contentType:validation.contentType,key:uploadKey(category,file.name)});
  }

  const uploaded=[];
  for(const item of prepared){
    await env.MEDIA.put(item.key,item.bytes,{httpMetadata:{contentType:item.contentType}});
    uploaded.push({name:item.file.name,key:item.key,bytes:item.bytes.byteLength});
  }

  await cleanupFolderMarkerRows(env);
  const syncRequest=new Request(`${url.origin}/api/admin/sync`,{
    method:'POST',headers:{'Authorization':req.headers.get('Authorization')||'','Origin':req.headers.get('Origin')||''}
  });
  const syncResponse=await worker.fetch(syncRequest,compatibleEnv(env),ctx);
  const sync=await syncResponse.json().catch(()=>({}));
  if(!syncResponse.ok)return json({error:'Files reached R2, but the review queue sync failed.',uploaded,sync},500,corsHeaders);
  return json({ok:true,uploaded,sync},201,corsHeaders);
}

async function cleanupOrphans(req,env,corsHeaders){
  if(!legacyAuthorized(env,req))return json({error:'Unauthorized'},401,corsHeaders);
  const body=await req.json().catch(()=>({}));
  if(body.confirm!=='CLEAN_ORPHANS')return json({error:'Cleanup confirmation is required.'},400,corsHeaders);

  const result=await env.DB.prepare(`
    SELECT id,object_key,filename,validation_code FROM media WHERE status='rejected' ORDER BY uploaded_at DESC
  `).all();
  const deleted=[];
  const retained=[];
  for(const row of result.results||[]){
    const source=await env.MEDIA.head(row.object_key);
    if(source){retained.push({id:row.id,filename:row.filename});continue;}
    await env.DB.prepare('DELETE FROM media_history WHERE media_id=?').bind(row.id).run();
    await env.DB.prepare('DELETE FROM media WHERE id=?').bind(row.id).run();
    deleted.push({id:row.id,filename:row.filename,validation_code:row.validation_code});
  }
  return json({ok:true,deleted_count:deleted.length,retained_count:retained.length,deleted,retained},200,corsHeaders);
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const corsHeaders=cors(env,req);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});

    if(url.pathname==='/api/auth/login'&&req.method==='POST'){
      try{return await login(req,env,corsHeaders);}catch(error){return json({error:'Sign-in failed.'},500,corsHeaders);}
    }
    if(url.pathname==='/api/auth/session'&&req.method==='GET')return sessionStatus(req,env,corsHeaders);
    if(url.pathname==='/api/auth/logout'&&req.method==='POST')return json({ok:true},200,corsHeaders);

    const needsAdmin=url.pathname.startsWith('/api/admin/')||(url.pathname.startsWith('/media/')&&url.searchParams.get('admin')==='1');
    let effectiveReq=req;
    if(needsAdmin){
      const authResult=await authenticateRequest(env,req);
      if(!authResult.ok)return json({error:'Unauthorized'},401,corsHeaders);
      effectiveReq=authResult.request;
    }

    if(url.pathname==='/api/admin/upload'&&req.method==='POST'){
      try{return await uploadMedia(effectiveReq,env,ctx,url,corsHeaders);}
      catch(error){return json({error:'Upload failed.',detail:String(error&&error.message||error)},500,corsHeaders);}
    }
    if(url.pathname==='/api/admin/cleanup-orphans'&&req.method==='POST'){
      try{return await cleanupOrphans(effectiveReq,env,corsHeaders);}
      catch(error){return json({error:'Cleanup failed.',detail:String(error&&error.message||error)},500,corsHeaders);}
    }
    if(url.pathname==='/api/admin/sync'&&req.method==='POST'){
      try{await cleanupFolderMarkerRows(env);}
      catch(error){return json({error:'Folder marker cleanup failed.',detail:String(error&&error.message||error)},500,corsHeaders);}
    }

    return worker.fetch(effectiveReq,compatibleEnv(env),ctx);
  },

  async scheduled(event,env,ctx){
    ctx.waitUntil(cleanupFolderMarkerRows(env));
    return worker.scheduled(event,compatibleEnv(env),ctx);
  }
};
