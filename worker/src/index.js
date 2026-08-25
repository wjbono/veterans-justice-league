import {CATEGORIES,INCOMING,categoryFromKey,fileName,idForKey,validateUpload} from './media-policy.js';
import {DERIVATIVES,derivativeKey,derivativeUrls} from './derivative-policy.js';
import {parseExifDate} from './exif-date.js';

const DEFAULT_GALLERIES=[
  {id:'housing',slug:'housing',title:'VJL Housing',description:'Housing, community activities, and Veteran transition support.',category:'housing',sort_order:10},
  {id:'behind-the-wall',slug:'behind-the-wall',title:'Behind-the-Wall Training',description:'Training and prevention work with justice-involved Veterans and active-duty service members.',category:'behind-the-wall',sort_order:20},
  {id:'outreach',slug:'outreach',title:'Outreach',description:'Prison visits, Veteran resources, community education, and outreach.',category:'outreach',sort_order:30},
  {id:'events',slug:'events',title:'Events',description:'Approved photos from VJL events and community activities.',category:'events',sort_order:40},
  {id:'team',slug:'team',title:'Team',description:'Approved team and volunteer photos.',category:'team',sort_order:50},
  {id:'partners',slug:'partners',title:'Partners',description:'Approved photos involving VJL community partners.',category:'partners',sort_order:60}
];

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8',...extra}
});

function cors(env,req){
  const origin=req.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin)?{
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Headers':'Authorization, Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'
  }:{};
}

function auth(env,req){
  const h=req.headers.get('Authorization')||'';
  return Boolean(env.ADMIN_TOKEN&&h===`Bearer ${env.ADMIN_TOKEN}`);
}

async function history(env,mediaId,action,oldStatus,newStatus,actor,details={}){
  await env.DB.prepare(
    'INSERT INTO media_history (media_id,action,old_status,new_status,actor,details) VALUES (?,?,?,?,?,?)'
  ).bind(mediaId,action,oldStatus||null,newStatus||null,actor||null,JSON.stringify(details)).run();
}

async function inspectUpload(env,object){
  const metadata=await env.MEDIA.head(object.key);
  if(!metadata)return {ok:false,code:'SOURCE_MISSING',message:'The R2 source object could not be read during ingestion.',exifDate:null};
  if(!object.size){
    return {...validateUpload({filename:fileName(object.key),size:0,declaredContentType:metadata.httpMetadata?.contentType,headBytes:new Uint8Array()}),exifDate:null};
  }
  const ranged=await env.MEDIA.get(object.key,{range:{offset:0,length:Math.min(object.size,512*1024)}});
  if(!ranged)return {ok:false,code:'SOURCE_MISSING',message:'The R2 source object could not be read during ingestion.',exifDate:null};
  const bytes=new Uint8Array(await ranged.arrayBuffer());
  const validation=validateUpload({
    filename:fileName(object.key),
    size:object.size,
    declaredContentType:metadata.httpMetadata?.contentType,
    headBytes:bytes.subarray(0,16)
  });
  return {...validation,exifDate:validation.ok?parseExifDate(bytes):null};
}

async function syncIncoming(env){
  let scanned=0;
  let added=0;
  let rejected=0;
  for(const prefix of INCOMING){
    let cursor;
    do{
      const page=await env.MEDIA.list({prefix,cursor,limit:1000});
      for(const object of page.objects){
        scanned++;
        const id=idForKey(object.key);
        const category=categoryFromKey(object.key);
        const existing=await env.DB.prepare('SELECT id,status,validation_code FROM media WHERE object_key=?').bind(object.key).first();
        const validation=await inspectUpload(env,object);
        const status=validation.ok?'pending':'rejected';
        const rejectedAt=validation.ok?null:new Date().toISOString();
        const trashDeleteAfter=validation.ok?null:new Date(Date.now()+30*86400000).toISOString();
        if(!validation.ok)rejected++;
        await env.DB.prepare(`
          INSERT INTO media (
            id,object_key,source_folder,filename,content_type,bytes,uploaded_at,exif_date,category,
            validation_code,validation_message,status,rejected_at,trash_delete_after,updated_at
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(object_key) DO UPDATE SET
            content_type=excluded.content_type,
            bytes=excluded.bytes,
            uploaded_at=excluded.uploaded_at,
            exif_date=excluded.exif_date,
            validation_code=excluded.validation_code,
            validation_message=excluded.validation_message,
            status=CASE WHEN excluded.validation_code IS NOT NULL THEN 'rejected' ELSE status END,
            rejected_at=CASE WHEN excluded.validation_code IS NOT NULL THEN excluded.rejected_at ELSE rejected_at END,
            trash_delete_after=CASE WHEN excluded.validation_code IS NOT NULL THEN excluded.trash_delete_after ELSE trash_delete_after END,
            updated_at=CURRENT_TIMESTAMP
        `).bind(
          id,object.key,prefix,fileName(object.key),validation.ok?validation.contentType:null,
          object.size,object.uploaded.toISOString(),validation.exifDate,category,
          validation.ok?null:validation.code,validation.ok?null:validation.message,
          status,rejectedAt,trashDeleteAfter
        ).run();
        if(!existing){
          added++;
          await history(
            env,id,validation.ok?'upload':'ingest_rejected',null,status,'sync',
            {source_folder:prefix,category,exif_date:validation.exifDate,validation_code:validation.ok?null:validation.code,validation_message:validation.ok?null:validation.message}
          );
        }else if(!validation.ok&&(existing.status!=='rejected'||existing.validation_code!==validation.code)){
          await history(env,id,'ingest_rejected',existing.status,'rejected','sync',{
            source_folder:prefix,category,validation_code:validation.code,validation_message:validation.message
          });
        }
      }
      cursor=page.truncated?page.cursor:undefined;
    }while(cursor);
  }
  return {scanned,added,rejected};
}

async function processDerivatives(env,row){
  if(!env.IMAGES)throw new Error('IMAGE_BINDING_MISSING');
  const source=await env.MEDIA.get(row.object_key);
  if(!source)throw new Error('SOURCE_MISSING');
  const bytes=await source.arrayBuffer();
  const created=[];
  const keys={};

  try{
    for(const spec of DERIVATIVES){
      const key=derivativeKey(row.id,spec.name);
      const output=(
        await env.IMAGES.input(bytes)
          .transform({width:spec.width,fit:'scale-down',metadata:'none'})
          .output({format:'image/webp',quality:spec.quality,anim:false})
      ).response();
      if(!output.ok||!output.body)throw new Error('IMAGE_TRANSFORM_FAILED');
      await env.MEDIA.put(key,output.body,{
        httpMetadata:{contentType:'image/webp',cacheControl:'public, max-age=31536000, immutable'}
      });
      created.push(key);
      keys[spec.field]=key;
    }
  }catch(error){
    for(const key of created){
      try{await env.MEDIA.delete(key);}catch(cleanupError){}
    }
    if(String(error&&error.message||error)==='IMAGE_TRANSFORM_FAILED')throw error;
    throw new Error('IMAGE_TRANSFORM_FAILED');
  }

  await env.DB.prepare(`
    UPDATE media SET thumb_key=?,web_key=?,large_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(keys.thumb_key,keys.web_key,keys.large_key,row.id).run();
  return keys;
}

async function listPublic(env,url){
  const status=url.searchParams.get('status')||'published';
  if(status!=='published')return json({error:'Only published media is public.'},400);
  const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||60),1),100);
  const category=url.searchParams.get('category');
  const gallery=url.searchParams.get('gallery');
  let query=`SELECT id,filename,category,caption,alt_text,gallery,featured,uploaded_at,published_at FROM media WHERE status='published'`;
  const values=[];
  if(category){query+=' AND category=?';values.push(category);}
  if(gallery){query+=' AND gallery=?';values.push(gallery);}
  query+=' ORDER BY featured DESC, COALESCE(published_at,uploaded_at) DESC LIMIT ?';
  values.push(limit);
  const result=await env.DB.prepare(query).bind(...values).all();
  const items=(result.results||[]).map(item=>({...item,featured:!!item.featured,...derivativeUrls(url.origin,item.id)}));
  return json({items});
}

async function seedDefaultGalleries(env){
  for(const gallery of DEFAULT_GALLERIES){
    await env.DB.prepare(`
      INSERT INTO galleries (id,slug,title,description,category,sort_order,active,updated_at)
      VALUES (?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
      ON CONFLICT(slug) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        category=excluded.category,
        sort_order=excluded.sort_order,
        updated_at=CURRENT_TIMESTAMP
    `).bind(gallery.id,gallery.slug,gallery.title,gallery.description,gallery.category,gallery.sort_order).run();
  }
  return DEFAULT_GALLERIES.length;
}

async function listGalleries(env,url){
  const galleries=await env.DB.prepare(`
    SELECT id,slug,title,description,category,cover_media_id,sort_order
    FROM galleries
    WHERE active=1
    ORDER BY sort_order,title
  `).all();

  const output=[];
  for(const gallery of galleries.results||[]){
    const media=await env.DB.prepare(`
      SELECT id,caption,alt_text,featured,published_at,uploaded_at
      FROM media
      WHERE status='published' AND (gallery=? OR (gallery IS NULL AND category=?))
      ORDER BY featured DESC, COALESCE(published_at,uploaded_at) DESC
      LIMIT 100
    `).bind(gallery.slug,gallery.category).all();
    const items=(media.results||[]).map(item=>({
      ...item,
      featured:!!item.featured,
      ...derivativeUrls(url.origin,item.id)
    }));
    const coverItem=items.find(item=>item.id===gallery.cover_media_id)||items[0]||null;
    output.push({
      ...gallery,
      cover_url:coverItem?coverItem.thumb_url:null,
      items
    });
  }
  return json({galleries:output});
}

async function listAdmin(env,url){
  const status=url.searchParams.get('status')||'pending';
  const category=url.searchParams.get('category');
  let query='SELECT * FROM media WHERE status=?';
  const values=[status];
  if(category){query+=' AND category=?';values.push(category);}
  query+=' ORDER BY uploaded_at DESC LIMIT 250';
  const result=await env.DB.prepare(query).bind(...values).all();
  const items=(result.results||[]).map(item=>({
    ...item,
    featured:!!item.featured,
    preview_url:`${url.origin}/media/${encodeURIComponent(item.id)}?admin=1&size=thumb`,
    large_preview_url:`${url.origin}/media/${encodeURIComponent(item.id)}?admin=1&size=original`
  }));
  return json({items});
}

async function serveMedia(env,id,adminAccess,size='web'){
  const row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  if(!row)return new Response('Not found',{status:404});
  if(row.status!=='published'&&!adminAccess)return new Response('Not found',{status:404});

  let key=null;
  if(size==='original'){
    if(!adminAccess)return new Response('Not found',{status:404});
    key=row.object_key;
  }else if(size==='thumb')key=row.thumb_key||row.web_key||row.large_key;
  else if(size==='large')key=row.large_key||row.web_key||row.thumb_key;
  else if(size==='web')key=row.web_key||row.large_key||row.thumb_key;
  else return new Response('Not found',{status:404});

  if(!key&&adminAccess)key=row.object_key;
  if(!key)return new Response('Not found',{status:404});

  const object=await env.MEDIA.get(key);
  if(!object)return new Response('Not found',{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag',object.httpEtag);
  const derivative=key!==row.object_key;
  headers.set('cache-control',row.status==='published'?(derivative?'public, max-age=31536000, immutable':'private, no-store'):'private, no-store');
  return new Response(object.body,{headers});
}

function cleanFields(body,row){
  const category=body.category===undefined?row.category:(body.category||null);
  if(category&&!CATEGORIES.has(category))throw new Error('INVALID_CATEGORY');
  return {
    category,
    gallery:body.gallery===undefined?row.gallery:(body.gallery||null),
    caption:body.caption===undefined?row.caption:(body.caption||null),
    alt_text:body.alt_text===undefined?row.alt_text:(body.alt_text||null),
    featured:body.featured===undefined?!!row.featured:!!body.featured
  };
}

async function updateMetadata(env,id,fields,reviewer){
  await env.DB.prepare(`
    UPDATE media SET category=?,gallery=?,caption=?,alt_text=?,featured=?,reviewer=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(fields.category,fields.gallery,fields.caption,fields.alt_text,fields.featured?1:0,reviewer,id).run();
}

function assertTransition(row,action){
  const allowed={
    review:new Set(['pending']),
    approve:new Set(['pending','review']),
    publish:new Set(['approved']),
    reject:new Set(['pending','review']),
    archive:new Set(['published']),
    restore:new Set(['archived','rejected'])
  };
  if(allowed[action]&&!allowed[action].has(row.status))throw new Error('INVALID_TRANSITION');
}

async function transition(env,row,action,fields,actor,body={}){
  assertTransition(row,action);
  const now=new Date().toISOString();
  let next=row.status;
  let approvedAt=row.approved_at||null;
  let processedAt=row.processed_at||null;
  let publishedAt=row.published_at||null;
  let archivedAt=row.archived_at||null;
  let rejectedAt=row.rejected_at||null;
  let trashDeleteAfter=row.trash_delete_after||null;

  if(action==='review')next='review';
  if(action==='approve'){
    if(row.validation_code)throw new Error('INVALID_UPLOAD');
    if(!fields.category)throw new Error('CATEGORY_REQUIRED');
    next='approved';
    if(!approvedAt)approvedAt=now;
  }
  if(action==='publish'){
    if(row.validation_code)throw new Error('INVALID_UPLOAD');
    if(!fields.category)throw new Error('CATEGORY_REQUIRED');
    const object=await env.MEDIA.head(row.object_key);
    if(!object)throw new Error('SOURCE_MISSING');
    await env.DB.prepare(`UPDATE media SET status='processing',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run();
    await history(env,row.id,'processing',row.status,'processing',actor,{note:'Generating thumbnail, web, and lightbox WebP derivatives from the retained R2 original.'});
    try{
      await processDerivatives(env,row);
    }catch(error){
      await env.DB.prepare(`UPDATE media SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run();
      await history(env,row.id,'processing_failed','processing','approved',actor,{code:String(error&&error.message||error)});
      throw error;
    }
    next='published';
    processedAt=now;
    publishedAt=now;
    archivedAt=null;
  }
  if(action==='reject'){
    next='rejected';
    rejectedAt=now;
    trashDeleteAfter=new Date(Date.now()+30*86400000).toISOString();
  }
  if(action==='archive'){
    next='archived';
    archivedAt=now;
  }
  if(action==='restore'){
    if(row.status==='archived'){
      if(!row.thumb_key||!row.web_key||!row.large_key)throw new Error('DERIVATIVES_MISSING');
      next='published';
      archivedAt=null;
      publishedAt=now;
    }else{
      if(row.validation_code)throw new Error('INVALID_UPLOAD');
      next='pending';
      rejectedAt=null;
      trashDeleteAfter=null;
    }
  }

  await env.DB.prepare(`
    UPDATE media SET
      category=?,gallery=?,caption=?,alt_text=?,featured=?,status=?,reviewer=?,
      approved_at=?,processed_at=?,published_at=?,archived_at=?,rejected_at=?,trash_delete_after=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    fields.category,fields.gallery,fields.caption,fields.alt_text,fields.featured?1:0,next,actor,
    approvedAt,processedAt,publishedAt,archivedAt,rejectedAt,trashDeleteAfter,row.id
  ).run();

  await history(env,row.id,action,row.status,next,actor,{category:fields.category,gallery:fields.gallery});
  return next;
}

async function permanentDelete(env,row,body,actor){
  if(row.status!=='rejected')throw new Error('DELETE_REQUIRES_REJECTED');
  if(body.confirm!=='DELETE')throw new Error('DELETE_CONFIRMATION_REQUIRED');
  if(!row.trash_delete_after||new Date(row.trash_delete_after).getTime()>Date.now())throw new Error('RETENTION_NOT_EXPIRED');
  const keys=[row.object_key,row.thumb_key,row.web_key,row.large_key].filter(Boolean);
  for(const key of new Set(keys))await env.MEDIA.delete(key);
  await history(env,row.id,'permanent_delete','rejected',null,actor,{keys_deleted:[...new Set(keys)]});
  await env.DB.prepare('DELETE FROM media WHERE id=?').bind(row.id).run();
}

function errorResponse(error,headers={}){
  const code=String(error&&error.message||error);
  const mapping={
    INVALID_CATEGORY:[400,'Invalid category.'],
    INVALID_UPLOAD:[409,'This media item failed ingestion validation and cannot advance until the source object is replaced with a supported image and synchronized again.'],
    INVALID_TRANSITION:[409,'That media lifecycle action is not valid from the current status.'],
    CATEGORY_REQUIRED:[400,'Category is required before approval or publishing.'],
    SOURCE_MISSING:[409,'The source object is missing from R2.'],
    IMAGE_BINDING_MISSING:[503,'Image processing is not configured. Bind Cloudflare Images to the Worker before publishing media.'],
    IMAGE_TRANSFORM_FAILED:[422,'Cloudflare could not generate the required image derivatives. The item remains approved and is not public.'],
    DERIVATIVES_MISSING:[409,'Archived media cannot be republished because one or more published derivatives are missing. Reprocess the source image first.'],
    DELETE_REQUIRES_REJECTED:[409,'Only rejected media can be permanently deleted.'],
    DELETE_CONFIRMATION_REQUIRED:[400,'Permanent deletion requires confirm="DELETE".'],
    RETENTION_NOT_EXPIRED:[409,'The rejection retention period has not expired.']
  };
  const [status,message]=mapping[code]||[500,'Server error'];
  return json({error:message,code},status,headers);
}

async function patchMedia(env,id,body,actor){
  const row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  if(!row)return json({error:'Not found'},404);
  let fields;
  try{fields=cleanFields(body,row);}catch(error){return errorResponse(error);}
  const action=body.action||'save';
  try{
    if(action==='save'){
      await updateMetadata(env,id,fields,actor);
      await history(env,id,'save',row.status,row.status,actor,{category:fields.category,gallery:fields.gallery});
      return json({ok:true,status:row.status});
    }
    if(action==='permanent-delete'){
      await permanentDelete(env,row,body,actor);
      return json({ok:true,deleted:true});
    }
    const allowed=new Set(['review','approve','publish','reject','archive','restore']);
    if(!allowed.has(action))return json({error:'Invalid action.'},400);
    const status=await transition(env,row,action,fields,actor,body);
    return json({ok:true,status});
  }catch(error){
    return errorResponse(error);
  }
}

async function bulkPatch(env,body,actor){
  const ids=Array.isArray(body.ids)?[...new Set(body.ids)].slice(0,100):[];
  if(!ids.length)return json({error:'At least one media id is required.'},400);
  if(body.action==='permanent-delete')return json({error:'Permanent deletion is intentionally not available as a bulk action.'},400);
  const results=[];
  for(const id of ids){
    const row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
    if(!row){results.push({id,ok:false,error:'Not found'});continue;}
    try{
      const fields=cleanFields(body,row);
      if((body.action||'save')==='save'){
        await updateMetadata(env,id,fields,actor);
        await history(env,id,'bulk_save',row.status,row.status,actor,{category:fields.category,gallery:fields.gallery});
        results.push({id,ok:true,status:row.status});
      }else{
        const status=await transition(env,row,body.action,fields,actor,body);
        results.push({id,ok:true,status});
      }
    }catch(error){
      results.push({id,ok:false,error:String(error&&error.message||error)});
    }
  }
  return json({ok:results.every(item=>item.ok),results});
}

export default{
  async fetch(req,env){
    const url=new URL(req.url);
    const corsHeaders=cors(env,req);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});

    try{
      if(url.pathname==='/api/media'&&req.method==='GET'){
        const response=await listPublic(env,url);
        Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
        return response;
      }

      if(url.pathname==='/api/galleries'&&req.method==='GET'){
        const response=await listGalleries(env,url);
        Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
        return response;
      }

      if(url.pathname.startsWith('/media/')&&req.method==='GET'){
        const adminAccess=url.searchParams.get('admin')==='1'&&auth(env,req);
        const size=url.searchParams.get('size')||'web';
        const response=await serveMedia(env,decodeURIComponent(url.pathname.slice(7)),adminAccess,size);
        Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
        return response;
      }

      if(url.pathname.startsWith('/api/admin/')){
        if(!auth(env,req))return json({error:'Unauthorized'},401,corsHeaders);
        const actor='admin';

        if(url.pathname==='/api/admin/sync'&&req.method==='POST'){
          return json({ok:true,...await syncIncoming(env)},200,corsHeaders);
        }

        if(url.pathname==='/api/admin/galleries/seed'&&req.method==='POST'){
          return json({ok:true,seeded:await seedDefaultGalleries(env)},200,corsHeaders);
        }

        if(url.pathname==='/api/admin/galleries'&&req.method==='GET'){
          const result=await env.DB.prepare('SELECT * FROM galleries ORDER BY sort_order,title').all();
          return json({items:result.results||[]},200,corsHeaders);
        }

        if(url.pathname==='/api/admin/media'&&req.method==='GET'){
          const response=await listAdmin(env,url);
          Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
          return response;
        }

        if(url.pathname==='/api/admin/media/bulk'&&req.method==='PATCH'){
          const response=await bulkPatch(env,await req.json(),actor);
          Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
          return response;
        }

        const match=url.pathname.match(/^\/api\/admin\/media\/([^/]+)$/);
        if(match&&req.method==='PATCH'){
          const response=await patchMedia(env,decodeURIComponent(match[1]),await req.json(),actor);
          Object.entries(corsHeaders).forEach(([key,value])=>response.headers.set(key,value));
          return response;
        }
      }

      return json({error:'Not found'},404,corsHeaders);
    }catch(error){
      return json({error:'Server error',detail:String(error&&error.message||error)},500,corsHeaders);
    }
  },

  async scheduled(event,env,ctx){
    // Rejected media is intentionally NOT automatically deleted. Permanent deletion
    // requires an authenticated explicit action after the retention window expires.
    ctx.waitUntil(syncIncoming(env));
  }
};