(()=>{
  const root=document.querySelector('[data-admin-root]');
  if(!root)return;

  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const tokenKey='vjl_admin_token';
  const tokenInput=document.querySelector('[data-token]');
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
  const objectUrls=new Set();

  if(tokenInput)tokenInput.value=sessionStorage.getItem(tokenKey)||'';

  const token=()=>sessionStorage.getItem(tokenKey)||'';
  const authHeaders=(jsonContent=false)=>{
    const headers={'Authorization':'Bearer '+token()};
    if(jsonContent)headers['Content-Type']='application/json';
    return headers;
  };

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  function msg(text){
    if(statusBox)statusBox.textContent=text;
  }

  function categoryOptions(selected){
    return ['housing','behind-the-wall','outreach','events','team','partners']
      .map(value=>`<option value="${value}" ${selected===value?'selected':''}>${value}</option>`)
      .join('');
  }

  function actionButtons(item){
    const common='<button class="secondary" data-action="save">Save</button>';
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
    const source=escapeHtml(item.source_folder||'');
    const status=escapeHtml(item.status||'');
    const gallery=escapeHtml(item.gallery||'');
    const caption=escapeHtml(item.caption||'');
    const alt=escapeHtml(item.alt_text||'');
    const preview=escapeHtml(item.preview_url||item.public_url||'');
    const validationCode=escapeHtml(item.validation_code||'');
    const validationMessage=escapeHtml(item.validation_message||'');

    el.innerHTML=`
      <label class="admin-card-select"><input type="checkbox" data-select-item aria-label="Select ${title}"></label>
      <button type="button" class="admin-thumb" data-preview-url="${preview}" data-preview-title="${title}" aria-label="Open larger preview of ${title}"><span class="admin-empty-thumb">Load preview</span></button>
      <div class="admin-fields">
        <div class="admin-meta"><strong>${title}</strong><span>Status: ${status}</span><span>Uploaded: ${uploaded||'Unknown'}</span>${exif?`<span>Photo date: ${exif}</span>`:''}${source?`<span>Source: ${source}</span>`:''}${validationCode?`<span class="admin-validation-error">Validation: ${validationCode}${validationMessage?` — ${validationMessage}`:''}</span>`:''}</div>
        <select data-field="category" aria-label="Category for ${title}"><option value="">Unsorted</option>${categoryOptions(item.category)}</select>
        <input data-field="gallery" placeholder="Gallery / event slug" value="${gallery}" aria-label="Gallery assignment for ${title}">
        <input data-field="caption" placeholder="Caption" value="${caption}" aria-label="Caption for ${title}">
        <textarea data-field="alt_text" placeholder="Alt text" aria-label="Alt text for ${title}">${alt}</textarea>
        <label><input type="checkbox" data-field="featured" ${item.featured?'checked':''}> Featured image</label>
        <div class="admin-actions">${actionButtons(item)}</div>
      </div>`;
    return el;
  }

  function clearObjectUrls(){
    objectUrls.forEach(url=>URL.revokeObjectURL(url));
    objectUrls.clear();
  }

  async function hydratePreview(button){
    const previewUrl=button.dataset.previewUrl;
    if(!previewUrl)return;
    try{
      const response=await fetch(previewUrl,{headers:authHeaders(false)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      objectUrls.add(objectUrl);
      button.dataset.objectUrl=objectUrl;
      const img=document.createElement('img');
      img.src=objectUrl;
      img.alt='';
      button.replaceChildren(img);
    }catch(error){
      button.innerHTML='<span class="admin-empty-thumb">Preview unavailable</span>';
    }
  }

  function hydratePreviews(){
    list.querySelectorAll('[data-preview-url]').forEach(button=>hydratePreview(button));
  }

  function openPreview(button){
    const objectUrl=button.dataset.objectUrl;
    if(!objectUrl||!previewModal)return;
    previewImage.src=objectUrl;
    previewImage.alt=button.dataset.previewTitle||'Media preview';
    previewTitle.textContent=button.dataset.previewTitle||'Media preview';
    previewModal.hidden=false;
    previewClose?.focus();
  }

  function closePreview(){
    if(!previewModal)return;
    previewModal.hidden=true;
    previewImage.removeAttribute('src');
  }

  async function load(){
    if(!api){
      msg('Cloudflare backend is not configured yet. Set API_BASE in assets/js/config.js after the Worker is deployed.');
      list.innerHTML='<div class="status-box">The production review interface is built for the Worker/R2/D1 backend. No simulated media is shown here.</div>';
      return;
    }
    clearObjectUrls();
    if(selectAll)selectAll.checked=false;
    msg('Loading…');
    const currentStatus=statusFilter?.value||'pending';
    const category=categoryFilter?.value||'';
    const params=new URLSearchParams({status:currentStatus});
    if(category)params.set('category',category);
    try{
      const response=await fetch(api.replace(/\/$/,'')+'/api/admin/media?'+params.toString(),{headers:authHeaders(false)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      list.innerHTML='';
      (data.items||[]).forEach(item=>list.append(card(item)));
      msg(`${(data.items||[]).length} item(s) loaded in ${currentStatus}`);
      hydratePreviews();
    }catch(error){
      msg('Unable to load media: '+error.message);
    }
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
    const body=cardBody(el);
    if(action!=='save')body.action=action;
    const response=await fetch(api.replace(/\/$/,'')+'/api/admin/media/'+encodeURIComponent(el.dataset.id),{
      method:'PATCH',
      headers:authHeaders(true),
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    return data;
  }

  function selectedIds(){
    return [...list.querySelectorAll('[data-select-item]:checked')].map(box=>box.closest('.admin-card')?.dataset.id).filter(Boolean);
  }

  async function bulkAction(action){
    const ids=selectedIds();
    if(!ids.length)return msg('Select at least one media item first.');
    const body={ids,action};
    if(bulkCategory?.value)body.category=bulkCategory.value;
    if(bulkGallery?.value.trim())body.gallery=bulkGallery.value.trim();
    msg(`${action} on ${ids.length} item(s)…`);
    const response=await fetch(api.replace(/\/$/,'')+'/api/admin/media/bulk',{
      method:'PATCH',
      headers:authHeaders(true),
      body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    const failures=(data.results||[]).filter(item=>!item.ok);
    if(failures.length)msg(`${ids.length-failures.length} succeeded; ${failures.length} failed.`);
    else msg(`${ids.length} item(s) updated.`);
    await load();
  }

  tokenInput?.addEventListener('input',()=>sessionStorage.setItem(tokenKey,tokenInput.value));
  document.querySelector('[data-refresh]')?.addEventListener('click',load);
  statusFilter?.addEventListener('change',load);
  categoryFilter?.addEventListener('change',load);

  document.querySelector('[data-sync]')?.addEventListener('click',async()=>{
    if(!api)return msg('Backend not configured.');
    try{
      msg('Syncing incoming folders…');
      const response=await fetch(api.replace(/\/$/,'')+'/api/admin/sync',{method:'POST',headers:authHeaders(true)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      msg(`Sync complete: ${data.scanned||0} scanned, ${data.added||0} new, ${data.rejected||0} rejected by validation.`);
      await load();
    }catch(error){msg('Sync failed: '+error.message);}
  });

  document.querySelector('[data-seed-galleries]')?.addEventListener('click',async()=>{
    if(!api)return msg('Backend not configured.');
    try{
      msg('Seeding gallery groups…');
      const response=await fetch(api.replace(/\/$/,'')+'/api/admin/galleries/seed',{method:'POST',headers:authHeaders(true)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      msg(`${data.seeded||0} gallery groups seeded or refreshed.`);
    }catch(error){msg('Gallery seed failed: '+error.message);}
  });

  selectAll?.addEventListener('change',()=>{
    list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=selectAll.checked);
  });

  list?.addEventListener('change',event=>{
    if(event.target.matches('[data-select-item]')){
      const boxes=[...list.querySelectorAll('[data-select-item]')];
      if(selectAll)selectAll.checked=boxes.length>0&&boxes.every(box=>box.checked);
    }
  });

  list?.addEventListener('click',async event=>{
    const previewButton=event.target.closest('[data-preview-url]');
    if(previewButton){openPreview(previewButton);return;}
    const button=event.target.closest('button[data-action]');
    if(!button)return;
    const el=button.closest('.admin-card');
    try{
      button.disabled=true;
      msg(`${button.dataset.action}…`);
      await updateCard(el,button.dataset.action);
      await load();
    }catch(error){
      msg('Update failed: '+error.message);
    }finally{
      button.disabled=false;
    }
  });

  document.querySelectorAll('[data-bulk-action]').forEach(button=>button.addEventListener('click',async()=>{
    try{button.disabled=true;await bulkAction(button.dataset.bulkAction);}catch(error){msg('Bulk update failed: '+error.message);}finally{button.disabled=false;}
  }));

  previewClose?.addEventListener('click',closePreview);
  previewModal?.addEventListener('click',event=>{if(event.target===previewModal)closePreview();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewModal&&!previewModal.hidden)closePreview();});
  window.addEventListener('beforeunload',clearObjectUrls);

  load();
})();
