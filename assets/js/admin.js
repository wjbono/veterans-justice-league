(()=>{
  const root=document.querySelector('[data-admin-root]');
  if(!root)return;

  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const SESSION_KEY='vjl_admin_session';
  const loginPanel=document.querySelector('[data-login-panel]');
  const workspace=document.querySelector('[data-admin-workspace]');
  const loginForm=document.querySelector('[data-login-form]');
  const loginUsername=document.querySelector('[data-login-username]');
  const loginPassword=document.querySelector('[data-login-password]');
  const loginStatus=document.querySelector('[data-login-status]');
  const loginSubmit=document.querySelector('[data-login-submit]');
  const account=document.querySelector('[data-admin-account]');
  const accountUser=document.querySelector('[data-admin-user]');
  const signOut=document.querySelector('[data-sign-out]');
  const list=document.querySelector('[data-admin-list]');
  const statusBox=document.querySelector('[data-admin-status]');
  const statusFilter=document.querySelector('[data-status-filter]');
  const categoryFilter=document.querySelector('[data-category-filter]');
  const selectAll=document.querySelector('[data-select-all]');
  const bulkCategory=document.querySelector('[data-bulk-category]');
  const bulkGallery=document.querySelector('[data-bulk-gallery]');
  const previewModal=document.querySelector('[data-admin-preview]');
  const previewImage=document.querySelector('[data-admin-preview-image]');
  const previewTitle=document.querySelector('[data-admin-preview-title]');
  const previewClose=document.querySelector('[data-admin-preview-close]');
  const maintenanceStatus=document.querySelector('[data-maintenance-status]');
  const objectUrls=new Set();
  let currentUser='';

  const STATUS_LABELS={pending:'Needs review',review:'In review',approved:'Approved',processing:'Publishing',published:'Live',archived:'Archived',rejected:'Rejected'};
  const CATEGORY_LABELS={housing:'Housing','behind-the-wall':'Behind-the-Wall',outreach:'Outreach',events:'Events',team:'Team',partners:'Partners'};
  const endpoint=path=>api.replace(/\/$/,'')+path;
  const sessionToken=()=>localStorage.getItem(SESSION_KEY)||'';

  function clearSession(){
    localStorage.removeItem(SESSION_KEY);
    currentUser='';
  }

  function showLogin(message='Enter your admin credentials.'){
    clearObjectUrls();
    if(workspace)workspace.hidden=true;
    if(loginPanel)loginPanel.hidden=false;
    if(account)account.hidden=true;
    if(loginStatus)loginStatus.textContent=message;
    if(loginPassword)loginPassword.value='';
    setTimeout(()=>loginUsername?.focus(),0);
  }

  function showWorkspace(username){
    currentUser=username||'Admin';
    if(loginPanel)loginPanel.hidden=true;
    if(workspace)workspace.hidden=false;
    if(account){account.hidden=false;if(accountUser)accountUser.textContent=currentUser;}
  }

  async function request(path,options={}){
    if(!api)throw new Error('Backend not configured.');
    const headers=new Headers(options.headers||{});
    const token=sessionToken();
    if(token)headers.set('Authorization','Bearer '+token);
    const response=await fetch(endpoint(path),{...options,headers});
    if(response.status===401&&path!=='/api/auth/login'){
      clearSession();
      showLogin('Your session expired. Sign in again.');
    }
    return response;
  }

  window.VJL_ADMIN={request,sessionToken,refresh:()=>load(),showLogin};

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  function msg(text){if(statusBox)statusBox.textContent=text;}
  function maintenanceMsg(text){if(maintenanceStatus)maintenanceStatus.textContent=text;}

  function categoryOptions(selected){
    return Object.entries(CATEGORY_LABELS).map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');
  }

  function actionButtons(item){
    const common='<button class="secondary" data-action="save">Save changes</button>';
    if(item.status==='pending')return common+'<button data-action="review">Start review</button><button class="primary" data-action="approve">Approve</button><button class="danger" data-action="reject">Reject</button>';
    if(item.status==='review')return common+'<button class="primary" data-action="approve">Approve</button><button class="danger" data-action="reject">Reject</button>';
    if(item.status==='approved')return common+'<button data-action="publish">Publish</button>';
    if(item.status==='published')return common+'<button class="secondary" data-action="archive">Archive</button>';
    if(item.status==='archived')return common+'<button data-action="restore">Republish</button>';
    if(item.status==='rejected')return common+'<button data-action="restore">Restore to pending</button>';
    return common;
  }

  function card(item){
    const el=document.createElement('article');
    el.className='admin-card';
    el.dataset.id=item.id;
    const title=escapeHtml(item.filename||item.object_key||'Media item');
    const uploaded=escapeHtml(item.uploaded_at||'');
    const exif=escapeHtml(item.exif_date||'');
    const status=escapeHtml(STATUS_LABELS[item.status]||item.status||'');
    const gallery=escapeHtml(item.gallery||'');
    const caption=escapeHtml(item.caption||'');
    const alt=escapeHtml(item.alt_text||'');
    const preview=escapeHtml(item.preview_url||item.public_url||'');
    const largePreview=escapeHtml(item.large_preview_url||item.large_url||preview);
    const validationCode=escapeHtml(item.validation_code||'');
    const validationMessage=escapeHtml(item.validation_message||'');

    el.innerHTML=`
      <label class="admin-card-select"><input type="checkbox" data-select-item aria-label="Select ${title}"></label>
      <button type="button" class="admin-thumb" data-preview-url="${preview}" data-large-preview-url="${largePreview}" data-preview-title="${title}" aria-label="Open larger preview of ${title}"><span class="admin-empty-thumb">Loading preview…</span></button>
      <div class="admin-fields">
        <div class="admin-meta"><strong>${title}</strong><span class="admin-status-pill">${status}</span><span>Uploaded: ${uploaded||'Unknown'}</span>${exif?`<span>Photo date: ${exif}</span>`:''}${validationCode?`<span class="admin-validation-error">${validationMessage||validationCode}</span>`:''}</div>
        <label>Website section<select data-field="category" aria-label="Website section for ${title}"><option value="">Unsorted</option>${categoryOptions(item.category)}</select></label>
        <label>Gallery / event <span class="field-note">optional</span><input data-field="gallery" placeholder="Leave blank for section gallery" value="${gallery}" aria-label="Gallery assignment for ${title}"></label>
        <label>Caption<input data-field="caption" placeholder="Optional caption shown with the photo" value="${caption}" aria-label="Caption for ${title}"></label>
        <label>Image description <span class="field-note">for accessibility</span><textarea data-field="alt_text" placeholder="Describe what is visible in the photo" aria-label="Image description for ${title}">${alt}</textarea></label>
        <label class="featured-label"><input type="checkbox" data-field="featured" ${item.featured?'checked':''}> Featured image</label>
        <div class="admin-actions">${actionButtons(item)}</div>
      </div>`;
    return el;
  }

  function trackObjectUrl(blob){const objectUrl=URL.createObjectURL(blob);objectUrls.add(objectUrl);return objectUrl;}
  function clearObjectUrls(){objectUrls.forEach(url=>URL.revokeObjectURL(url));objectUrls.clear();}

  function apiPathFromUrl(value){
    try{const parsed=new URL(value);const base=new URL(api);if(parsed.origin===base.origin)return parsed.pathname+parsed.search;}catch(error){}
    return value;
  }

  async function fetchPreviewObjectUrl(url){
    const response=await request(apiPathFromUrl(url),{method:'GET'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return trackObjectUrl(await response.blob());
  }

  async function hydratePreview(button){
    const previewUrl=button.dataset.previewUrl;
    if(!previewUrl)return;
    try{
      const objectUrl=await fetchPreviewObjectUrl(previewUrl);
      button.dataset.objectUrl=objectUrl;
      const img=document.createElement('img');img.src=objectUrl;img.alt='';button.replaceChildren(img);
    }catch(error){button.innerHTML='<span class="admin-empty-thumb">Preview unavailable</span>';}
  }

  function hydratePreviews(){list.querySelectorAll('[data-preview-url]').forEach(button=>hydratePreview(button));}

  async function openPreview(button){
    if(!previewModal)return;
    const sourceUrl=button.dataset.largePreviewUrl||button.dataset.previewUrl;
    if(!sourceUrl)return;
    try{
      let objectUrl=button.dataset.largeObjectUrl;
      if(!objectUrl){msg('Loading larger preview…');objectUrl=await fetchPreviewObjectUrl(sourceUrl);button.dataset.largeObjectUrl=objectUrl;}
      previewImage.src=objectUrl;previewImage.alt=button.dataset.previewTitle||'Media preview';previewTitle.textContent=button.dataset.previewTitle||'Media preview';previewModal.hidden=false;previewClose?.focus();msg('Preview loaded.');
    }catch(error){msg('Unable to load larger preview: '+error.message);}
  }

  function closePreview(){if(!previewModal)return;previewModal.hidden=true;previewImage.removeAttribute('src');}

  const responseUnauthorizedText=text=>String(text||'').toLowerCase().includes('unauthorized')||String(text||'').includes('401');

  async function load(){
    if(!sessionToken())return;
    clearObjectUrls();
    if(selectAll)selectAll.checked=false;
    msg('Loading…');
    const currentStatus=statusFilter?.value||'pending';
    const category=categoryFilter?.value||'';
    const params=new URLSearchParams({status:currentStatus});
    if(category)params.set('category',category);
    try{
      const response=await request('/api/admin/media?'+params.toString());
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      list.innerHTML='';
      (data.items||[]).forEach(item=>list.append(card(item)));
      if(!(data.items||[]).length)list.innerHTML='<div class="admin-empty-state">No items in this view.</div>';
      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      hydratePreviews();
    }catch(error){if(responseUnauthorizedText(error.message))return;msg('Unable to load media: '+error.message);}
  }

  function cardBody(el){
    return {
      category:el.querySelector('[data-field="category"]').value||null,
      gallery:el.querySelector('[data-field="gallery"]').value||null,
      caption:el.querySelector('[data-field="caption"]').value||null,
      alt_text:el.querySelector('[data-field="alt_text"]').value||null,
      featured:el.querySelector('[data-field="featured"]').checked
    };
  }

  async function updateCard(el,action){
    const body=cardBody(el);if(action!=='save')body.action=action;
    const response=await request('/api/admin/media/'+encodeURIComponent(el.dataset.id),{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    return data;
  }

  function selectedIds(){return [...list.querySelectorAll('[data-select-item]:checked')].map(box=>box.closest('.admin-card')?.dataset.id).filter(Boolean);}

  async function bulkAction(action){
    const ids=selectedIds();if(!ids.length)return msg('Select at least one media item first.');
    const body={ids,action};if(bulkCategory?.value)body.category=bulkCategory.value;if(bulkGallery?.value.trim())body.gallery=bulkGallery.value.trim();
    msg(`${action} on ${ids.length} item(s)…`);
    const response=await request('/api/admin/media/bulk',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    const failures=(data.results||[]).filter(item=>!item.ok);
    msg(failures.length?`${ids.length-failures.length} succeeded; ${failures.length} failed.`:`${ids.length} item(s) updated.`);
    await load();
  }

  loginForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!api){loginStatus.textContent='Backend not configured.';return;}
    loginSubmit.disabled=true;loginStatus.textContent='Signing in…';
    try{
      const response=await fetch(endpoint('/api/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:loginUsername.value.trim(),password:loginPassword.value})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Sign-in failed.');
      localStorage.setItem(SESSION_KEY,data.token);
      loginPassword.value='';
      showWorkspace(data.username);
      await load();
    }catch(error){loginStatus.textContent=error.message;}
    finally{loginSubmit.disabled=false;}
  });

  signOut?.addEventListener('click',async()=>{
    try{if(sessionToken())await request('/api/auth/logout',{method:'POST'});}catch(error){}
    clearSession();showLogin('Signed out.');
  });

  document.querySelector('[data-refresh]')?.addEventListener('click',load);
  statusFilter?.addEventListener('change',load);
  categoryFilter?.addEventListener('change',load);

  document.querySelector('[data-sync]')?.addEventListener('click',async()=>{
    try{maintenanceMsg('Syncing incoming folders…');const response=await request('/api/admin/sync',{method:'POST'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));maintenanceMsg(`Sync complete: ${data.scanned||0} scanned, ${data.added||0} new, ${data.rejected||0} rejected.`);await load();}catch(error){maintenanceMsg('Sync failed: '+error.message);}
  });

  document.querySelector('[data-seed-galleries]')?.addEventListener('click',async()=>{
    try{maintenanceMsg('Refreshing gallery groups…');const response=await request('/api/admin/galleries/seed',{method:'POST'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));maintenanceMsg(`${data.seeded||0} gallery groups refreshed.`);}catch(error){maintenanceMsg('Gallery refresh failed: '+error.message);}
  });

  selectAll?.addEventListener('change',()=>list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=selectAll.checked));
  list?.addEventListener('change',event=>{if(event.target.matches('[data-select-item]')){const boxes=[...list.querySelectorAll('[data-select-item]')];if(selectAll)selectAll.checked=boxes.length>0&&boxes.every(box=>box.checked);}});

  list?.addEventListener('click',async event=>{
    const previewButton=event.target.closest('[data-preview-url]');if(previewButton){await openPreview(previewButton);return;}
    const button=event.target.closest('button[data-action]');if(!button)return;
    const el=button.closest('.admin-card');
    try{button.disabled=true;msg(`${button.textContent.trim()}…`);await updateCard(el,button.dataset.action);await load();}catch(error){msg('Update failed: '+error.message);}finally{button.disabled=false;}
  });

  document.querySelectorAll('[data-bulk-action]').forEach(button=>button.addEventListener('click',async()=>{
    try{button.disabled=true;await bulkAction(button.dataset.bulkAction);}catch(error){msg('Bulk update failed: '+error.message);}finally{button.disabled=false;}
  }));

  previewClose?.addEventListener('click',closePreview);
  previewModal?.addEventListener('click',event=>{if(event.target===previewModal)closePreview();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewModal&&!previewModal.hidden)closePreview();});
  window.addEventListener('beforeunload',clearObjectUrls);

  (async()=>{
    if(!api){showLogin('The media backend is not configured yet.');return;}
    if(!sessionToken()){showLogin();return;}
    try{
      const response=await request('/api/auth/session');
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Session expired.');
      showWorkspace(data.username);
      await load();
    }catch(error){showLogin('Your session expired. Sign in again.');}
  })();
})();
