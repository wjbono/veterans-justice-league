import worker from './index.js';
import {CATEGORIES,MAX_UPLOAD_BYTES,validateUpload} from './media-policy.js';

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

function authorized(env,req){
  const header=req.headers.get('Authorization')||'';
  return Boolean(env.ADMIN_TOKEN&&header===`Bearer ${env.ADMIN_TOKEN}`);
}

function imageCompatibleEnv(env){
  if(!env.IMAGES||typeof env.IMAGES.input!=='function')return env;
  const images=env.IMAGES;
  const wrappedImages=new Proxy(images,{
    get(target,prop,receiver){
      if(prop==='input'){
        return value=>{
          let input=value;
          if(value instanceof ArrayBuffer){
            input=new Blob([value]).stream();
          }else if(ArrayBuffer.isView(value)){
            input=new Blob([value]).stream();
          }
          return target.input(input);
        };
      }
      const member=Reflect.get(target,prop,receiver);
      return typeof member==='function'?member.bind(target):member;
    }
  });
  return new Proxy(env,{
    get(target,prop,receiver){
      if(prop==='IMAGES')return wrappedImages;
      return Reflect.get(target,prop,receiver);
    }
  });
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
  if(!authorized(env,req))return json({error:'Unauthorized'},401,corsHeaders);

  const form=await req.formData();
  const category=String(form.get('category')||'unsorted');
  if(category!=='unsorted'&&!CATEGORIES.has(category)){
    return json({error:'Invalid upload category.'},400,corsHeaders);
  }

  const files=form.getAll('files').filter(value=>
    value&&typeof value.arrayBuffer==='function'&&typeof value.name==='string'
  );
  if(!files.length)return json({error:'Select at least one image.'},400,corsHeaders);
  if(files.length>10)return json({error:'Upload no more than 10 images at a time.'},400,corsHeaders);

  const prepared=[];
  for(const file of files){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const validation=validateUpload({
      filename:file.name,
      size:bytes.byteLength,
      declaredContentType:file.type,
      headBytes:bytes.subarray(0,16),
      maxBytes:MAX_UPLOAD_BYTES
    });
    if(!validation.ok){
      return json({
        error:`${file.name}: ${validation.message}`,
        code:validation.code
      },400,corsHeaders);
    }
    prepared.push({file,bytes,contentType:validation.contentType,key:uploadKey(category,file.name)});
  }

  const uploaded=[];
  for(const item of prepared){
    await env.MEDIA.put(item.key,item.bytes,{
      httpMetadata:{contentType:item.contentType}
    });
    uploaded.push({name:item.file.name,key:item.key,bytes:item.bytes.byteLength});
  }

  const syncRequest=new Request(`${url.origin}/api/admin/sync`,{
    method:'POST',
    headers:{
      'Authorization':req.headers.get('Authorization')||'',
      'Origin':req.headers.get('Origin')||''
    }
  });
  const syncResponse=await worker.fetch(syncRequest,imageCompatibleEnv(env),ctx);
  const sync=await syncResponse.json().catch(()=>({}));
  if(!syncResponse.ok){
    return json({error:'Files reached R2, but the review queue sync failed.',uploaded,sync},500,corsHeaders);
  }

  return json({ok:true,uploaded,sync},201,corsHeaders);
}

async function cleanupOrphans(req,env,corsHeaders){
  if(!authorized(env,req))return json({error:'Unauthorized'},401,corsHeaders);
  const body=await req.json().catch(()=>({}));
  if(body.confirm!=='CLEAN_ORPHANS'){
    return json({error:'Cleanup confirmation is required.'},400,corsHeaders);
  }

  const result=await env.DB.prepare(`
    SELECT id,object_key,filename,validation_code
    FROM media
    WHERE status='rejected'
    ORDER BY uploaded_at DESC
  `).all();

  const deleted=[];
  const retained=[];
  for(const row of result.results||[]){
    const source=await env.MEDIA.head(row.object_key);
    if(source){
      retained.push({id:row.id,filename:row.filename});
      continue;
    }
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

    if(req.method==='OPTIONS'&&(url.pathname==='/api/admin/upload'||url.pathname==='/api/admin/cleanup-orphans')){
      return new Response(null,{status:204,headers:corsHeaders});
    }
    if(url.pathname==='/api/admin/upload'&&req.method==='POST'){
      try{return await uploadMedia(req,env,ctx,url,corsHeaders);}
      catch(error){return json({error:'Upload failed.',detail:String(error&&error.message||error)},500,corsHeaders);}
    }
    if(url.pathname==='/api/admin/cleanup-orphans'&&req.method==='POST'){
      try{return await cleanupOrphans(req,env,corsHeaders);}
      catch(error){return json({error:'Cleanup failed.',detail:String(error&&error.message||error)},500,corsHeaders);}
    }
    return worker.fetch(req,imageCompatibleEnv(env),ctx);
  },

  async scheduled(event,env,ctx){
    return worker.scheduled(event,imageCompatibleEnv(env),ctx);
  }
};
