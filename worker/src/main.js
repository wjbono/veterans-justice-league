import worker from './index.js';
import {CATEGORIES,INCOMING,MAX_UPLOAD_BYTES,validateUpload} from './media-policy.js';

const SESSION_SECONDS=7*24*60*60;
const PASSWORD_ITERATIONS=120000;
const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_LOCK_MS=15*60*1000;
const LOGIN_MAX_FAILURES=5;
const ROLES=new Set(['admin','editor']);

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8',...headers}
});
const nowIso=()=>new Date().toISOString();

function cors(env,req){
  const origin=req.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean);
  return allowed.includes(origin)?{
    'Access-Control-Allow-Origin':origin,
    'Vary':'Origin',
    'Access-Control-Allow-Headers':'Authorization, Content-Type',
    'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'
  }:{};
}

function bytesToBase64Url(bytes){
  let binary='';
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  for(const byte of view)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function base64UrlToBytes(value){
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}

function randomToken(bytes=32){
  const data=new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bytesToBase64Url(data);
}

async function sha256(value){
  const input=typeof value==='string'?new TextEncoder().encode(value):value;
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',input)));
}

function constantTimeEqual(a,b){
  const left=new TextEncoder().encode(String(a??''));
  const right=new TextEncoder().encode(String(b??''));
  let diff=left.length^right.length;
  const length=Math.max(left.length,right.length,1);
  for(let i=0;i<length;i++)diff|=(left[i%Math.max(left.length,1)]||0)^(right[i%Math.max(right.length,1)]||0);
  return diff===0;
}

async function derivePasswordHash(password,salt,iterations=PASSWORD_ITERATIONS){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return bytesToBase64Url(new Uint8Array(bits));
}

async function makePasswordRecord(password){
  validatePassword(password);
  const salt=new Uint8Array(16);
  crypto.getRandomValues(salt);
  return {
    salt:bytesToBase64Url(salt),
    hash:await derivePasswordHash(password,salt,PASSWORD_ITERATIONS),
    iterations:PASSWORD_ITERATIONS
  };
}

async function verifyPassword(password,user){
  const hash=await derivePasswordHash(String(password||''),base64UrlToBytes(user.password_salt),Number(user.password_iterations)||PASSWORD_ITERATIONS);
  return constantTimeEqual(hash,user.password_hash);
}

function validatePassword(password){
  const value=String(password||'');
  if(value.length<12)throw new Error('PASSWORD_TOO_SHORT');
  if(value.length>128)throw new Error('PASSWORD_TOO_LONG');
}

function normalizeUsername(value){
  const username=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new Error('INVALID_USERNAME');
  return username;
}

function normalizeDisplayName(value){
  const displayName=String(value||'').trim();
  if(!displayName||displayName.length>100)throw new Error('INVALID_DISPLAY_NAME');
  return displayName;
}

function normalizeRole(value){
  const role=String(value||'editor').toLowerCase();
  if(!ROLES.has(role))throw new Error('INVALID_ROLE');
  return role;
}

function bearer(req){
  const header=req.headers.get('Authorization')||'';
  return header.startsWith('Bearer ')?header.slice(7):'';
}

async function ensureAuthSchema(env){
  const statements=[
    `CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','editor')),
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_admin_users_role_active ON admin_users(role,active)`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      revoked_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at)`,
    `CREATE TABLE IF NOT EXISTS admin_login_attempts (
      username TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL,
      locked_until TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS admin_auth_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_user_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_admin_auth_audit_created ON admin_auth_audit(created_at DESC)`
  ];
  for(const statement of statements)await env.DB.prepare(statement).run();
}

async function auditAuth(env,actor,action,target,details={}){
  await env.DB.prepare('INSERT INTO admin_auth_audit (actor_user_id,action,target_user_id,details,created_at) VALUES (?,?,?,?,?)')
    .bind(actor?.id||null,action,target?.id||target||null,JSON.stringify(details),nowIso()).run();
}

function publicUser(row){
  return {
    id:row.id,
    username:row.username,
    display_name:row.display_name,
    role:row.role,
    active:!!row.active,
    must_change_password:!!row.must_change_password,
    created_at:row.created_at,
    updated_at:row.updated_at,
    last_login_at:row.last_login_at||null
  };
}

async function userCount(env){
  const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM admin_users').first();
  return Number(row?.count||0);
}

async function issueSession(env,user){
  const token=randomToken(32);
  const tokenHash=await sha256(token);
  const created=nowIso();
  const expires=new Date(Date.now()+SESSION_SECONDS*1000).toISOString();
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash,user_id,created_at,expires_at,last_seen_at,revoked_at) VALUES (?,?,?,?,?,NULL)')
    .bind(tokenHash,user.id,created,expires,created).run();
  return {token,expires_at:expires,user:publicUser(user)};
}

async function revokeUserSessions(env,userId){
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').bind(nowIso(),userId).run();
}

async function authenticateSession(env,req){
  const token=bearer(req);
  if(!token)return null;
  await ensureAuthSchema(env);
  const tokenHash=await sha256(token);
  const row=await env.DB.prepare(`
    SELECT s.token_hash,s.expires_at,s.last_seen_at,s.revoked_at,
           u.id,u.username,u.display_name,u.password_hash,u.password_salt,u.password_iterations,
           u.role,u.active,u.must_change_password,u.created_at,u.updated_at,u.last_login_at
    FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id
    WHERE s.token_hash=?
  `).bind(tokenHash).first();
  if(!row||row.revoked_at||!row.active)return null;
  if(new Date(row.expires_at).getTime()<=Date.now()){
    await env.DB.prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').bind(nowIso(),tokenHash).run();
    return null;
  }
  const lastSeen=new Date(row.last_seen_at||0).getTime();
  if(!Number.isFinite(lastSeen)||Date.now()-lastSeen>5*60*1000){
    await env.DB.prepare('UPDATE admin_sessions SET last_seen_at=? WHERE token_hash=?').bind(nowIso(),tokenHash).run();
  }
  return {...row,token_hash:tokenHash};
}

async function authStatus(env,corsHeaders){
  await ensureAuthSchema(env);
  const count=await userCount(env);
  return json({ok:true,needs_bootstrap:count===0,user_count:count},200,corsHeaders);
}

async function bootstrap(req,env,corsHeaders){
  await ensureAuthSchema(env);
  if(await userCount(env)>0)return json({error:'Initial administrator has already been created.'},409,corsHeaders);
  if(!env.ADMIN_TOKEN)return json({error:'Bootstrap is not configured.'},503,corsHeaders);
  if(!constantTimeEqual(bearer(req),env.ADMIN_TOKEN))return json({error:'Incorrect setup key.'},401,corsHeaders);
  const body=await req.json().catch(()=>({}));
  try{
    const username=normalizeUsername(body.username);
    const displayName=normalizeDisplayName(body.display_name);
    const password=await makePasswordRecord(body.password);
    const id=crypto.randomUUID();
    const now=nowIso();
    await env.DB.prepare(`INSERT INTO admin_users
      (id,username,display_name,password_hash,password_salt,password_iterations,role,active,must_change_password,created_at,updated_at,last_login_at)
      VALUES (?,?,?,?,?,?,'admin',1,0,?,?,?)`)
      .bind(id,username,displayName,password.hash,password.salt,password.iterations,now,now,now).run();
    const user=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(id).first();
    await auditAuth(env,null,'bootstrap_admin',user,{username});
    return json({ok:true,...await issueSession(env,user)},201,corsHeaders);
  }catch(error){return authError(error,corsHeaders);}
}

async function loginLocked(env,username){
  const row=await env.DB.prepare('SELECT * FROM admin_login_attempts WHERE username=?').bind(username).first();
  if(!row?.locked_until)return false;
  if(new Date(row.locked_until).getTime()>Date.now())return true;
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE username=?').bind(username).run();
  return false;
}

async function recordLoginFailure(env,username){
  const row=await env.DB.prepare('SELECT * FROM admin_login_attempts WHERE username=?').bind(username).first();
  const now=Date.now();
  let count=1;
  let started=nowIso();
  if(row&&now-new Date(row.window_started_at).getTime()<=LOGIN_WINDOW_MS){
    count=Number(row.failed_count||0)+1;
    started=row.window_started_at;
  }
  const lockedUntil=count>=LOGIN_MAX_FAILURES?new Date(now+LOGIN_LOCK_MS).toISOString():null;
  await env.DB.prepare(`INSERT INTO admin_login_attempts (username,failed_count,window_started_at,locked_until)
    VALUES (?,?,?,?) ON CONFLICT(username) DO UPDATE SET failed_count=excluded.failed_count,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until`)
    .bind(username,count,started,lockedUntil).run();
}

async function login(req,env,corsHeaders){
  await ensureAuthSchema(env);
  if(await userCount(env)===0)return json({error:'Administrator setup is required.',code:'BOOTSTRAP_REQUIRED'},409,corsHeaders);
  const body=await req.json().catch(()=>({}));
  let username;
  try{username=normalizeUsername(body.username);}catch(error){return json({error:'Incorrect username or password.'},401,corsHeaders);}
  if(await loginLocked(env,username))return json({error:'Too many failed attempts. Try again later.'},429,corsHeaders);
  const user=await env.DB.prepare('SELECT * FROM admin_users WHERE username=?').bind(username).first();
  if(!user||!user.active||!(await verifyPassword(body.password,user))){
    await recordLoginFailure(env,username);
    return json({error:'Incorrect username or password.'},401,corsHeaders);
  }
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE username=?').bind(username).run();
  const now=nowIso();
  await env.DB.prepare('UPDATE admin_users SET last_login_at=?,updated_at=updated_at WHERE id=?').bind(now,user.id).run();
  user.last_login_at=now;
  await auditAuth(env,user,'login',user,{});
  return json({ok:true,...await issueSession(env,user)},200,corsHeaders);
}

async function sessionStatus(req,env,corsHeaders){
  const user=await authenticateSession(env,req);
  if(!user)return json({error:'Session expired.'},401,corsHeaders);
  return json({ok:true,user:publicUser(user),expires_at:user.expires_at},200,corsHeaders);
}

async function logout(req,env,corsHeaders){
  const user=await authenticateSession(env,req);
  if(user){
    await env.DB.prepare('UPDATE admin_sessions SET revoked_at=? WHERE token_hash=?').bind(nowIso(),user.token_hash).run();
    await auditAuth(env,user,'logout',user,{});
  }
  return json({ok:true},200,corsHeaders);
}

async function changePassword(req,env,corsHeaders){
  const user=await authenticateSession(env,req);
  if(!user)return json({error:'Session expired.'},401,corsHeaders);
  const body=await req.json().catch(()=>({}));
  if(!(await verifyPassword(body.current_password,user)))return json({error:'Current password is incorrect.'},400,corsHeaders);
  try{
    const record=await makePasswordRecord(body.new_password);
    await env.DB.prepare(`UPDATE admin_users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,updated_at=? WHERE id=?`)
      .bind(record.hash,record.salt,record.iterations,nowIso(),user.id).run();
    await revokeUserSessions(env,user.id);
    const refreshed=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(user.id).first();
    await auditAuth(env,user,'change_password',user,{});
    return json({ok:true,...await issueSession(env,refreshed)},200,corsHeaders);
  }catch(error){return authError(error,corsHeaders);}
}

async function activeAdminCount(env){
  const row=await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users WHERE role='admin' AND active=1").first();
  return Number(row?.count||0);
}

async function listUsers(env,corsHeaders){
  const result=await env.DB.prepare(`SELECT id,username,display_name,role,active,must_change_password,created_at,updated_at,last_login_at
    FROM admin_users ORDER BY active DESC,role,display_name,username`).all();
  return json({items:(result.results||[]).map(publicUser)},200,corsHeaders);
}

async function createUser(req,env,actor,corsHeaders){
  const body=await req.json().catch(()=>({}));
  try{
    const username=normalizeUsername(body.username);
    const displayName=normalizeDisplayName(body.display_name);
    const role=normalizeRole(body.role);
    const password=await makePasswordRecord(body.password);
    const id=crypto.randomUUID();
    const now=nowIso();
    await env.DB.prepare(`INSERT INTO admin_users
      (id,username,display_name,password_hash,password_salt,password_iterations,role,active,must_change_password,created_at,updated_at,last_login_at)
      VALUES (?,?,?,?,?,?,?,1,1,?,?,NULL)`)
      .bind(id,username,displayName,password.hash,password.salt,password.iterations,role,now,now).run();
    const user=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(id).first();
    await auditAuth(env,actor,'create_user',user,{username,role});
    return json({ok:true,user:publicUser(user)},201,corsHeaders);
  }catch(error){return authError(error,corsHeaders);}
}

async function updateUser(req,env,actor,userId,corsHeaders){
  const target=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(userId).first();
  if(!target)return json({error:'User not found.'},404,corsHeaders);
  const body=await req.json().catch(()=>({}));
  const action=body.action||'update';
  try{
    if(action==='update'){
      const username=body.username===undefined?target.username:normalizeUsername(body.username);
      const displayName=body.display_name===undefined?target.display_name:normalizeDisplayName(body.display_name);
      const role=body.role===undefined?target.role:normalizeRole(body.role);
      if(actor.id===target.id&&role!==target.role)throw new Error('SELF_ROLE_CHANGE');
      if(target.active&&target.role==='admin'&&role!=='admin'&&await activeAdminCount(env)<=1)throw new Error('LAST_ADMIN');
      await env.DB.prepare('UPDATE admin_users SET username=?,display_name=?,role=?,updated_at=? WHERE id=?')
        .bind(username,displayName,role,nowIso(),target.id).run();
      await auditAuth(env,actor,'update_user',target,{username,display_name:displayName,role});
    }else if(action==='disable'){
      if(actor.id===target.id)throw new Error('SELF_DISABLE');
      if(target.active&&target.role==='admin'&&await activeAdminCount(env)<=1)throw new Error('LAST_ADMIN');
      await env.DB.prepare('UPDATE admin_users SET active=0,updated_at=? WHERE id=?').bind(nowIso(),target.id).run();
      await revokeUserSessions(env,target.id);
      await auditAuth(env,actor,'disable_user',target,{});
    }else if(action==='enable'){
      await env.DB.prepare('UPDATE admin_users SET active=1,updated_at=? WHERE id=?').bind(nowIso(),target.id).run();
      await auditAuth(env,actor,'enable_user',target,{});
    }else if(action==='reset_password'){
      const record=await makePasswordRecord(body.password);
      await env.DB.prepare(`UPDATE admin_users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=1,updated_at=? WHERE id=?`)
        .bind(record.hash,record.salt,record.iterations,nowIso(),target.id).run();
      await revokeUserSessions(env,target.id);
      await auditAuth(env,actor,'reset_password',target,{});
    }else throw new Error('INVALID_USER_ACTION');
    const updated=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(target.id).first();
    return json({ok:true,user:publicUser(updated)},200,corsHeaders);
  }catch(error){return authError(error,corsHeaders);}
}

async function deleteUser(req,env,actor,userId,corsHeaders){
  const target=await env.DB.prepare('SELECT * FROM admin_users WHERE id=?').bind(userId).first();
  if(!target)return json({error:'User not found.'},404,corsHeaders);
  if(actor.id===target.id)return json({error:'You cannot delete your own account.'},409,corsHeaders);
  if(target.active&&target.role==='admin'&&await activeAdminCount(env)<=1)return json({error:'The final active administrator cannot be deleted.'},409,corsHeaders);
  const body=await req.json().catch(()=>({}));
  if(body.confirm!==target.username)return json({error:'Deletion confirmation does not match the username.'},400,corsHeaders);
  await revokeUserSessions(env,target.id);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE user_id=?').bind(target.id).run();
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE username=?').bind(target.username).run();
  await auditAuth(env,actor,'delete_user',target,{username:target.username,role:target.role});
  await env.DB.prepare('DELETE FROM admin_users WHERE id=?').bind(target.id).run();
  return json({ok:true},200,corsHeaders);
}

function authError(error,headers={}){
  const code=String(error&&error.message||error);
  const mapping={
    PASSWORD_TOO_SHORT:[400,'Password must be at least 12 characters.'],
    PASSWORD_TOO_LONG:[400,'Password must be 128 characters or fewer.'],
    INVALID_USERNAME:[400,'Username must be 3–64 characters using letters, numbers, periods, underscores, or hyphens.'],
    INVALID_DISPLAY_NAME:[400,'Display name is required and must be 100 characters or fewer.'],
    INVALID_ROLE:[400,'Role must be Administrator or Editor.'],
    LAST_ADMIN:[409,'The final active administrator cannot be disabled or demoted.'],
    SELF_DISABLE:[409,'You cannot disable your own account.'],
    SELF_ROLE_CHANGE:[409,'You cannot change your own administrator role.'],
    INVALID_USER_ACTION:[400,'Invalid user-management action.']
  };
  if(code.includes('UNIQUE constraint failed: admin_users.username'))return json({error:'That username is already in use.'},409,headers);
  const mapped=mapping[code]||[500,'User-management operation failed.'];
  return json({error:mapped[1],code},mapped[0],headers);
}

function compatibleEnv(env){
  const markerKeys=new Set(INCOMING);
  let wrappedImages=env.IMAGES;
  if(env.IMAGES&&typeof env.IMAGES.input==='function'){
    const images=env.IMAGES;
    wrappedImages=new Proxy(images,{
      get(target,prop,receiver){
        if(prop==='input')return value=>{
          let input=value;
          if(value instanceof ArrayBuffer||ArrayBuffer.isView(value))input=new Blob([value]).stream();
          return target.input(input);
        };
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
        if(prop==='list')return async options=>{
          const page=await target.list(options);
          return {...page,objects:(page.objects||[]).filter(object=>!markerKeys.has(object.key))};
        };
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
  const cleaned=String(name||'image').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120);
  return cleaned||'image';
}

function uploadKey(category,name){
  const stamp=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
  return `incoming/${category}/${stamp}-${crypto.randomUUID().slice(0,8)}-${safeName(name)}`;
}

async function uploadMedia(req,env,ctx,url,corsHeaders,actor){
  const form=await req.formData();
  const category=String(form.get('category')||'unsorted');
  if(category!=='unsorted'&&!CATEGORIES.has(category))return json({error:'Invalid upload category.'},400,corsHeaders);
  const files=form.getAll('files').filter(value=>value&&typeof value.arrayBuffer==='function'&&typeof value.name==='string');
  if(!files.length)return json({error:'Select at least one image.'},400,corsHeaders);
  if(files.length>10)return json({error:'Upload no more than 10 images at a time.'},400,corsHeaders);
  const prepared=[];
  for(const file of files){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const validation=validateUpload({filename:file.name,size:bytes.byteLength,declaredContentType:file.type,headBytes:bytes.subarray(0,16),maxBytes:MAX_UPLOAD_BYTES});
    if(!validation.ok)return json({error:`${file.name}: ${validation.message}`,code:validation.code},400,corsHeaders);
    prepared.push({file,bytes,contentType:validation.contentType,key:uploadKey(category,file.name)});
  }
  const uploaded=[];
  for(const item of prepared){
    await env.MEDIA.put(item.key,item.bytes,{httpMetadata:{contentType:item.contentType}});
    uploaded.push({name:item.file.name,key:item.key,bytes:item.bytes.byteLength});
  }
  await cleanupFolderMarkerRows(env);
  if(!env.ADMIN_TOKEN)return json({error:'Internal media authorization is not configured.'},503,corsHeaders);
  const syncRequest=new Request(`${url.origin}/api/admin/sync`,{method:'POST',headers:{'Authorization':`Bearer ${env.ADMIN_TOKEN}`,'Origin':req.headers.get('Origin')||''}});
  const syncResponse=await worker.fetch(syncRequest,compatibleEnv(env),ctx);
  const sync=await syncResponse.json().catch(()=>({}));
  if(!syncResponse.ok)return json({error:'Files reached R2, but the review queue sync failed.',uploaded,sync},500,corsHeaders);
  for(const item of uploaded){
    const row=await env.DB.prepare('SELECT id FROM media WHERE object_key=?').bind(item.key).first();
    if(row?.id)await env.DB.prepare("UPDATE media_history SET actor=? WHERE media_id=? AND action='upload' AND actor='sync'").bind(actor.username,row.id).run();
  }
  return json({ok:true,uploaded,sync},201,corsHeaders);
}

async function cleanupOrphans(req,env,corsHeaders){
  const body=await req.json().catch(()=>({}));
  if(body.confirm!=='CLEAN_ORPHANS')return json({error:'Cleanup confirmation is required.'},400,corsHeaders);
  const result=await env.DB.prepare(`SELECT id,object_key,filename,validation_code FROM media WHERE status='rejected' ORDER BY uploaded_at DESC`).all();
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

async function forwardCoreAdmin(req,env,actor){
  if(!env.ADMIN_TOKEN)return json({error:'Internal media authorization is not configured.'},503,cors(env,req));
  const url=new URL(req.url);
  let ids=[];
  let historyStart=0;
  if(url.pathname==='/api/admin/media/bulk'&&req.method==='PATCH'){
    const body=await req.clone().json().catch(()=>({}));
    ids=Array.isArray(body.ids)?body.ids.map(String):[];
  }else{
    const match=url.pathname.match(/^\/api\/admin\/media\/([^/]+)$/);
    if(match&&(req.method==='PATCH'||req.method==='DELETE'))ids=[decodeURIComponent(match[1])];
  }
  if(ids.length){
    const row=await env.DB.prepare('SELECT COALESCE(MAX(id),0) AS max_id FROM media_history').first();
    historyStart=Number(row?.max_id||0);
  }
  const headers=new Headers(req.headers);
  headers.set('Authorization',`Bearer ${env.ADMIN_TOKEN}`);
  const response=await worker.fetch(new Request(req,{headers}),compatibleEnv(env));
  if(response.ok&&ids.length){
    for(const id of ids){
      await env.DB.prepare("UPDATE media_history SET actor=? WHERE id>? AND media_id=? AND actor='admin'").bind(actor.username,historyStart,id).run();
      await env.DB.prepare("UPDATE media SET reviewer=? WHERE id=? AND reviewer='admin'").bind(actor.username,id).run();
    }
  }
  return response;
}

export default{
  async fetch(req,env,ctx){
    const url=new URL(req.url);
    const corsHeaders=cors(env,req);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});

    try{
      if(url.pathname==='/api/auth/status'&&req.method==='GET')return await authStatus(env,corsHeaders);
      if(url.pathname==='/api/auth/bootstrap'&&req.method==='POST')return await bootstrap(req,env,corsHeaders);
      if(url.pathname==='/api/auth/login'&&req.method==='POST')return await login(req,env,corsHeaders);
      if(url.pathname==='/api/auth/session'&&req.method==='GET')return await sessionStatus(req,env,corsHeaders);
      if(url.pathname==='/api/auth/logout'&&req.method==='POST')return await logout(req,env,corsHeaders);
      if(url.pathname==='/api/auth/change-password'&&req.method==='POST')return await changePassword(req,env,corsHeaders);

      const protectedMedia=url.pathname.startsWith('/api/admin/')||(url.pathname.startsWith('/media/')&&url.searchParams.get('admin')==='1');
      if(!protectedMedia)return worker.fetch(req,compatibleEnv(env),ctx);

      const actor=await authenticateSession(env,req);
      if(!actor)return json({error:'Unauthorized'},401,corsHeaders);
      if(actor.must_change_password)return json({error:'Password change required.',code:'PASSWORD_CHANGE_REQUIRED'},403,corsHeaders);

      if(url.pathname.startsWith('/api/admin/users')){
        if(actor.role!=='admin')return json({error:'Administrator access required.'},403,corsHeaders);
        if(url.pathname==='/api/admin/users'&&req.method==='GET')return await listUsers(env,corsHeaders);
        if(url.pathname==='/api/admin/users'&&req.method==='POST')return await createUser(req,env,actor,corsHeaders);
        const match=url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
        if(match&&req.method==='PATCH')return await updateUser(req,env,actor,decodeURIComponent(match[1]),corsHeaders);
        if(match&&req.method==='DELETE')return await deleteUser(req,env,actor,decodeURIComponent(match[1]),corsHeaders);
        return json({error:'Not found'},404,corsHeaders);
      }

      const adminOnly=new Set(['/api/admin/sync','/api/admin/galleries/seed','/api/admin/cleanup-orphans']);
      if(adminOnly.has(url.pathname)&&actor.role!=='admin')return json({error:'Administrator access required.'},403,corsHeaders);

      if(url.pathname==='/api/admin/upload'&&req.method==='POST')return await uploadMedia(req,env,ctx,url,corsHeaders,actor);
      if(url.pathname==='/api/admin/cleanup-orphans'&&req.method==='POST')return await cleanupOrphans(req,env,corsHeaders);
      if(url.pathname==='/api/admin/sync'&&req.method==='POST')await cleanupFolderMarkerRows(env);

      return await forwardCoreAdmin(req,env,actor);
    }catch(error){
      return json({error:'Server error',detail:String(error&&error.message||error)},500,corsHeaders);
    }
  },

  async scheduled(event,env,ctx){
    ctx.waitUntil(cleanupFolderMarkerRows(env));
    ctx.waitUntil((async()=>{
      await ensureAuthSchema(env);
      await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<? OR revoked_at IS NOT NULL').bind(nowIso()).run();
    })());
    return worker.scheduled(event,compatibleEnv(env),ctx);
  }
};
