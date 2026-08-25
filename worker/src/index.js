const CATEGORIES=new Set(['housing','behind-the-wall','outreach','events','team','partners']);
const INCOMING=[
  'incoming/housing/',
  'incoming/behind-the-wall/',
  'incoming/outreach/',
  'incoming/events/',
  'incoming/team/',
  'incoming/partners/',
  'incoming/unsorted/'
];
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

function categoryFromKey(key){
  for(const prefix of INCOMING){
    if(key.startsWith(prefix)){
      const category=prefix.split('/')[1];
      return category==='unsorted'?null:category;
    }
  }
  return null;
}

const fileName=key=>key.split('/').pop()||key;

function idForKey(key){
  let h=2166136261;
  for(let i=0;i<key.length;i++){
    h^=key.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return 'm_'+(h>>>0).toString(16);
}

async function history(env,mediaId,action,oldStatus,newStatus,actor,details={}){
  await env.DB.prepare(
    'INSERT INTO media_history (media_id,action,old_status,new_status,actor,details) VALUES (?,?,?,?,?,?)'
  ).bind(mediaId,action,oldStatus||null,newStatus||null,actor||null,JSON.stringify(details)).run();
}

async function syncIncoming(env){
  let scanned=0;
  let added=0;
  for(const prefix of INCOMING){
    let cursor;
    do{
      const page=await env.MEDIA.list({prefix,cursor,limit:1000});
      for(const object of page.objects){
        scanned++;
        const id=idForKey(object.key);
        const category=categoryFromKey(object.key);
        const existing=await env.DB.prepare('SELECT id FROM media WHERE object_key=?').bind(object.key).first();
        await env.DB.prepare(`
          INSERT INTO media (id,object_key,source_folder,filename,bytes,uploaded_at,category,status,updated_at)
          VALUES (?,?,?,?,?,?,?,'pending',CURRENT_TIMESTAMP)
          ON CONFLICT(object_key) DO UPDATE SET
            bytes=excluded.bytes,
            uploaded_at=excluded.uploaded_at,
            updated_at=CURRENT_TIMESTAMP
        `).bind(id,object.key,prefix,fileName(object.key),object.size,object.uploaded.toISOString(),category).run();
        if(!existing){
          added++;
          await history(env,id,'upload',null,'pending','sync',{source_folder:prefix,category});
        }
      }
      cursor=page.truncated?page.cursor:undefined;
    }while(cursor);
  }
  return {scanned,added};
}

function publicUrl(url,id){
  return `${url.origin}/media/${encodeURIComponent(id)}`;
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
  const items=(result.results||[]).map(item=>({...item,featured:!!item.featured,public_url:publicUrl(url,item.id)}));
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
      public_url:publicUrl(url,item.id)
    }));
    const coverItem=items.find(item=>item.id===gallery.cover_media_id)||items[0]||null;
    output.push({
      ...gallery,
      cover_url:coverItem?coverItem.public_url:null,
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
    preview_url:`${url.origin}/media/${encodeURIComponent(item.id)}?admin=1`
  }));
  return json({items});
}

async function serveMedia(env,id,adminAccess){
  const row=await env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  if(!row)return new Response('Not found',{status:404});
  if(row.status!=='published'&&!adminAccess)return new Response('Not found',{status:404});
  const key=row.web_key||row.large_key||row.object_key;
  const object=await env.MEDIA.get(key);
  if(!object)return new Response('Not found',{status:404});
  const headers=new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag',object.httpEtag);
  headers.set('cache-control',row.status==='published'?'public, max-age=3600':'private, no-store');
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

async function transition(env,row,action,fields,actor,body={}){
  const now=new Date().toISOString();
  let next=row.status;
  let trashDeleteAfter=row.trash_delete_after||null;

  if(action==='review')next='review';
  if(action==='approve'){
    if(!fields.category)throw new Error('CATEGORY_REQUIRED');
    next='approved';
  }
  if(action==='publish'){
    if(!fields.category)throw new Error('CATEGORY_REQUIRED');
    const object=await env.MEDIA.head(row.object_key);
    if(!object)throw new Error('SOURCE_MISSING');
    next='processing';
    await env.DB.prepare(`UPDATE media SET status='processing',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run();
    await history(env,row.id,'processing',row.status,'processing',actor,{note:'Derivative processing hook reached. Original media remains the delivery fallback until optimized derivatives are configured.'});
    next='published';
  }
  if(action==='reject'){
    next='rejected';
    trashDeleteAfter=new Date(Date.now()+30*86400000).toISOString();
  }
  if(action==='archive')next='archived';
  if(action==='restore')next=row.status==='archived'?'published':'pending';

  await env.DB.prepare(`
    UPDATE media SET
      category=?,gallery=?,caption=?,alt_text=?,featured=?,status=?,reviewer=?,
      approved_at=CASE WHEN ?='approved' AND approved_at IS NULL THEN ? ELSE approved_at END,
      processed_at=CASE WHEN ?='published' THEN ? ELSE processed_at END,
      published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,
      archived_at=CASE WHEN ?='archived' THEN ? ELSE archived_at END,
      rejected_at=CASE WHEN ?='rejected' THEN ? ELSE rejected_at END,
      trash_delete_after=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    fields.category,fields.gallery,fields.caption,fields.alt_text,fields.featured?1:0,next,actor,
    next,now,
    next,now,
    next,now,
    next,now,
    next,now,
    trashDeleteAfter,
    row.id
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
    CATEGORY_REQUIRED:[400,'Category is required before approval or publishing.'],
    SOURCE_MISSING:[409,'The source object is missing from R2.'],
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
        const response=await serveMedia(env,decodeURIComponent(url.pathname.slice(7)),adminAccess);
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
