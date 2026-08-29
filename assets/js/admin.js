(()=>{
  const root=document.querySelector('[data-admin-root]');
  const auth=window.VJL_AUTH;
  if(!root||!auth)return;

  const loginPanel=document.querySelector('[data-login-panel]');
  const bootstrapPanel=document.querySelector('[data-bootstrap-panel]');
  const passwordPanel=document.querySelector('[data-password-panel]');
  const workspace=document.querySelector('[data-admin-workspace]');
  const account=document.querySelector('[data-admin-account]');
  const accountUser=document.querySelector('[data-admin-user]');
  const accountRole=document.querySelector('[data-admin-role]');
  const usersLink=document.querySelector('[data-users-link]');
  const advanced=document.querySelector('[data-admin-advanced]');
  const signOut=document.querySelector('[data-sign-out]');

  const loginForm=document.querySelector('[data-login-form]');
  const loginUsername=document.querySelector('[data-login-username]');
  const loginPassword=document.querySelector('[data-login-password]');
  const loginStatus=document.querySelector('[data-login-status]');
  const loginSubmit=document.querySelector('[data-login-submit]');

  const bootstrapForm=document.querySelector('[data-bootstrap-form]');
  const bootstrapKey=document.querySelector('[data-bootstrap-key]');
  const bootstrapName=document.querySelector('[data-bootstrap-name]');
  const bootstrapUsername=document.querySelector('[data-bootstrap-username]');
  const bootstrapPassword=document.querySelector('[data-bootstrap-password]');
  const bootstrapConfirm=document.querySelector('[data-bootstrap-confirm]');
  const bootstrapStatus=document.querySelector('[data-bootstrap-status]');
  const bootstrapSubmit=document.querySelector('[data-bootstrap-submit]');

  const passwordForm=document.querySelector('[data-password-form]');
  const currentPassword=document.querySelector('[data-current-password]');
  const newPassword=document.querySelector('[data-new-password]');
  const confirmPassword=document.querySelector('[data-confirm-password]');
  const passwordStatus=document.querySelector('[data-password-status]');
  const passwordSubmit=document.querySelector('[data-password-submit]');

  const list=document.querySelector('[data-admin-list]');
  const statusBox=document.querySelector('[data-admin-status]');
  const statusFilter=document.querySelector('[data-status-filter]');
  const categoryFilter=document.querySelector('[data-category-filter]');
  const selectAll=document.querySelector('[data-select-all]');
  const bulkPanel=document.querySelector('[data-bulk-panel]');
  const bulkModeToggle=document.querySelector('[data-bulk-mode-toggle]');
  const bulkModeDone=document.querySelector('[data-bulk-mode-done]');
  const bulkEditDetails=document.querySelector('[data-bulk-edit-details]');
  const bulkEditor=document.querySelector('[data-bulk-editor]');
  const bulkEditorClose=document.querySelector('[data-bulk-editor-close]');
  const bulkEditorCancel=document.querySelector('[data-bulk-editor-cancel]');
  const bulkInstruction=document.querySelector('[data-bulk-instruction]');
  const bulkCategory=document.querySelector('[data-bulk-category]');
  const bulkGalleryMode=document.querySelector('[data-bulk-gallery-mode]');
  const bulkGalleryValue=document.querySelector('[data-bulk-gallery-value]');
  const bulkGallery=document.querySelector('[data-bulk-gallery]');
  const bulkFeatured=document.querySelector('[data-bulk-featured]');
  const selectionCount=document.querySelector('[data-selection-count]');
  const clearSelection=document.querySelector('[data-clear-selection]');
  const bulkWorkflowActions=document.querySelector('[data-bulk-workflow-actions]');
  const previewModal=document.querySelector('[data-admin-preview]');
  const previewImage=document.querySelector('[data-admin-preview-image]');
  const previewTitle=document.querySelector('[data-admin-preview-title]');
  const previewClose=document.querySelector('[data-admin-preview-close]');
  const maintenanceStatus=document.querySelector('[data-maintenance-status]');
  const massEditor=document.querySelector('[data-mass-editor]');
  const massEditorOpen=document.querySelector('[data-mass-editor-open]');
  const massEditorClose=document.querySelector('[data-mass-editor-close]');
  const massEditorCancel=document.querySelector('[data-mass-editor-cancel]');
  const massEditorRows=document.querySelector('[data-mass-editor-rows]');
  const massEditorSave=document.querySelector('[data-mass-editor-save]');
  const massEditorStatus=document.querySelector('[data-mass-editor-status]');
  const massSelectAll=document.querySelector('[data-mass-select-all]');
  const massCount=document.querySelector('[data-mass-count]');
  const massFillCategory=document.querySelector('[data-mass-fill-category]');
  const massFillGallery=document.querySelector('[data-mass-fill-gallery]');
  const massFillFeatured=document.querySelector('[data-mass-fill-featured]');
  const massApplyFill=document.querySelector('[data-mass-apply-fill]');
  const objectUrls=new Set();
  let currentSession=null;
  let bulkMode=false;
  let currentItems=[];

  const STATUS_LABELS={pending:'Needs review',review:'In review',approved:'Approved',processing:'Publishing',published:'Live',archived:'Archived',rejected:'Rejected'};
  const CATEGORY_LABELS={housing:'Housing','behind-the-wall':'Behind-the-Wall',outreach:'Outreach',events:'Events',team:'Team',partners:'Partners'};

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const msg=text=>{if(statusBox)statusBox.textContent=text;};
  const maintenanceMsg=text=>{if(maintenanceStatus)maintenanceStatus.textContent=text;};

  function hideAll(){
    [loginPanel,bootstrapPanel,passwordPanel,workspace].forEach(el=>{if(el)el.hidden=true;});
  }

  function showLogin(message='Enter your username and password.'){
    currentSession=null;
    clearObjectUrls();
    hideAll();
    if(loginPanel)loginPanel.hidden=false;
    if(account)account.hidden=true;
    if(loginStatus)loginStatus.textContent=message;
    if(loginPassword)loginPassword.value='';
    setTimeout(()=>loginUsername?.focus(),0);
  }

  function showBootstrap(){
    hideAll();
    if(account)account.hidden=true;
    if(bootstrapPanel)bootstrapPanel.hidden=false;
    if(bootstrapStatus)bootstrapStatus.textContent='Create the first Administrator account. The setup key is your existing Cloudflare ADMIN_TOKEN and is only used once.';
    setTimeout(()=>bootstrapName?.focus(),0);
  }

  function showPasswordChange(session,message='Set a new password before continuing.'){
    currentSession=session||currentSession;
    hideAll();
    if(passwordPanel)passwordPanel.hidden=false;
    if(account)account.hidden=true;
    if(passwordStatus)passwordStatus.textContent=message;
    if(currentPassword)currentPassword.value='';
    if(newPassword)newPassword.value='';
    if(confirmPassword)confirmPassword.value='';
    setTimeout(()=>currentPassword?.focus(),0);
  }

  function showWorkspace(session){
    currentSession=session;
    const user=session?.user||{};
    hideAll();
    if(workspace)workspace.hidden=false;
    if(account){
      account.hidden=false;
      if(accountUser)accountUser.textContent=user.display_name||user.username||'User';
      if(accountRole)accountRole.textContent=user.role==='admin'?'Administrator':'Editor';
    }
    if(usersLink)usersLink.hidden=user.role!=='admin';
    if(advanced)advanced.hidden=user.role!=='admin';
  }

  async function handleProtectedResponse(response){
    if(response.status===401){showLogin('Your session expired. Sign in again.');return false;}
    if(response.status===403){
      const data=await response.clone().json().catch(()=>({}));
      if(data.code==='PASSWORD_CHANGE_REQUIRED'){showPasswordChange(currentSession);return false;}
    }
    return true;
  }

  async function request(path,options={}){
    const response=await auth.request(path,options);
    await handleProtectedResponse(response);
    return response;
  }

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
    try{const parsed=new URL(value);const base=new URL(auth.api);if(parsed.origin===base.origin)return parsed.pathname+parsed.search;}catch(error){}
    return value;
  }

  async function fetchPreviewObjectUrl(url){
    const response=await request(apiPathFromUrl(url));
    if(!response.ok)throw new Error('HTTP '+response.status);
    return trackObjectUrl(await response.blob());
  }

  async function hydratePreview(button){
    if(!button.dataset.previewUrl)return;
    try{
      const objectUrl=await fetchPreviewObjectUrl(button.dataset.previewUrl);
      const img=document.createElement('img');img.src=objectUrl;img.alt='';button.replaceChildren(img);
    }catch(error){button.innerHTML='<span class="admin-empty-thumb">Preview unavailable</span>';}
  }
  const hydratePreviews=()=>list?.querySelectorAll('[data-preview-url]').forEach(button=>hydratePreview(button));

  async function openPreview(button){
    if(!previewModal)return;
    const sourceUrl=button.dataset.largePreviewUrl||button.dataset.previewUrl;
    if(!sourceUrl)return;
    try{
      msg('Loading larger preview…');
      const objectUrl=await fetchPreviewObjectUrl(sourceUrl);
      previewImage.src=objectUrl;
      previewImage.alt=button.dataset.previewTitle||'Media preview';
      previewTitle.textContent=button.dataset.previewTitle||'Media preview';
      previewModal.hidden=false;
      previewClose?.focus();
      msg('Preview loaded.');
    }catch(error){msg('Unable to load larger preview: '+error.message);}
  }

  function closePreview(){if(previewModal){previewModal.hidden=true;previewImage.removeAttribute('src');}}

  async function load({preserveSelection=false}={}){
    if(!currentSession||currentSession.user?.must_change_password)return;
    const keep=preserveSelection?new Set(selectedIds()):new Set();
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
      currentItems=data.items||[];
      list.innerHTML='';
      currentItems.forEach(item=>list.append(card(item)));
      if(!(data.items||[]).length)list.innerHTML='<div class="admin-empty-state">No items in this view.</div>';
      if(keep.size)list.querySelectorAll('[data-select-item]').forEach(box=>{const id=box.closest('.admin-card')?.dataset.id;box.checked=keep.has(id);});
      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      renderBulkWorkflow();
      updateBulkUi();
      hydratePreviews();
    }catch(error){msg('Unable to load media: '+error.message);}
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
    const response=await request('/api/admin/media/'+encodeURIComponent(el.dataset.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
  }

  function massActionOptions(status){
    const options={
      pending:[['','No status change'],['review','Start review'],['approve','Approve'],['reject','Reject']],
      review:[['','No status change'],['approve','Approve'],['reject','Reject']],
      approved:[['','No status change'],['publish','Publish']],
      processing:[['','No status change']],
      published:[['','No status change'],['archive','Archive']],
      archived:[['','No status change'],['restore','Republish']],
      rejected:[['','No status change'],['restore','Restore to pending']]
    };
    return (options[status]||options.processing).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  }

  function massRow(item){
    const title=escapeHtml(item.filename||item.object_key||'Media item');
    const row=document.createElement('tr');
    row.dataset.id=item.id;
    row.innerHTML=`
      <td><input type="checkbox" data-mass-select aria-label="Select ${title}"></td>
      <td class="mass-photo"><button type="button" data-mass-preview-url="${escapeHtml(item.preview_url||item.public_url||'')}" data-large-preview-url="${escapeHtml(item.large_preview_url||item.large_url||item.preview_url||item.public_url||'')}" data-preview-title="${title}" aria-label="Preview ${title}"><span>Loading…</span></button><div><strong>${title}</strong><small>${escapeHtml(STATUS_LABELS[item.status]||item.status)}</small></div></td>
      <td><select data-mass-field="category" aria-label="Section for ${title}"><option value="">Unsorted</option>${categoryOptions(item.category)}</select></td>
      <td><input data-mass-field="gallery" value="${escapeHtml(item.gallery||'')}" placeholder="Optional"></td>
      <td><textarea data-mass-field="caption" rows="2" placeholder="Optional caption">${escapeHtml(item.caption||'')}</textarea></td>
      <td><textarea data-mass-field="alt_text" rows="2" placeholder="Describe the photo">${escapeHtml(item.alt_text||'')}</textarea></td>
      <td class="mass-featured"><input type="checkbox" data-mass-field="featured" ${item.featured?'checked':''} aria-label="Featured ${title}"></td>
      <td><select data-mass-action aria-label="Next action for ${title}">${massActionOptions(item.status)}</select></td>`;
    return row;
  }

  async function hydrateMassPreview(button){
    if(!button.dataset.massPreviewUrl)return;
    try{const url=await fetchPreviewObjectUrl(button.dataset.massPreviewUrl);const img=document.createElement('img');img.src=url;img.alt='';button.replaceChildren(img);}catch(error){button.innerHTML='<span>Unavailable</span>';}
  }

  function updateMassCount(){
    const boxes=[...massEditorRows.querySelectorAll('[data-mass-select]')];
    const checked=boxes.filter(box=>box.checked);
    if(massCount)massCount.textContent=`${checked.length} selected`;
    if(massSelectAll){massSelectAll.checked=boxes.length>0&&checked.length===boxes.length;massSelectAll.indeterminate=checked.length>0&&checked.length<boxes.length;}
  }

  function updateMassDirty(){
    const count=massEditorRows.querySelectorAll('tr.is-dirty').length;
    if(massEditorStatus)massEditorStatus.textContent=count?`${count} photo${count===1?' has':'s have'} unsaved changes.`:'No unsaved changes.';
  }

  function openMassEditor(){
    if(!currentItems.length){msg('There are no photos in this filtered view.');return;}
    massEditorRows.innerHTML='';
    currentItems.forEach(item=>massEditorRows.append(massRow(item)));
    massEditor.hidden=false;
    document.body.classList.add('mass-editor-open');
    massEditorRows.querySelectorAll('[data-mass-preview-url]').forEach(hydrateMassPreview);
    updateMassCount();updateMassDirty();massEditorClose?.focus();
  }

  function closeMassEditor(force=false){
    const dirty=massEditorRows.querySelectorAll('tr.is-dirty').length;
    if(!force&&dirty&&!confirm(`Discard unsaved changes to ${dirty} photo${dirty===1?'':'s'}?`))return;
    massEditor.hidden=true;document.body.classList.remove('mass-editor-open');
    massEditorRows.innerHTML='';
  }

  function massRowBody(row){
    const body={
      category:row.querySelector('[data-mass-field="category"]').value||null,
      gallery:row.querySelector('[data-mass-field="gallery"]').value.trim()||null,
      caption:row.querySelector('[data-mass-field="caption"]').value.trim()||null,
      alt_text:row.querySelector('[data-mass-field="alt_text"]').value.trim()||null,
      featured:row.querySelector('[data-mass-field="featured"]').checked
    };
    const action=row.querySelector('[data-mass-action]').value;if(action)body.action=action;
    return body;
  }

  function applyMassFill(){
    const rows=[...massEditorRows.querySelectorAll('tr')].filter(row=>row.querySelector('[data-mass-select]').checked);
    if(!rows.length){massEditorStatus.textContent='Check at least one row first.';return;}
    const category=massFillCategory.value;const gallery=massFillGallery.value;const featured=massFillFeatured.value;
    if(!category&&gallery===''&&!featured){massEditorStatus.textContent='Choose a fill value first.';return;}
    rows.forEach(row=>{
      if(category)row.querySelector('[data-mass-field="category"]').value=category==='__clear__'?'':category;
      if(gallery!=='')row.querySelector('[data-mass-field="gallery"]').value=gallery;
      if(featured)row.querySelector('[data-mass-field="featured"]').checked=featured==='true';
      row.classList.add('is-dirty');
    });
    updateMassDirty();massEditorStatus.textContent=`Fill applied to ${rows.length} row${rows.length===1?'':'s'}. Save when ready.`;
  }

  async function saveMassEditor(){
    const rows=[...massEditorRows.querySelectorAll('tr.is-dirty')];
    if(!rows.length){massEditorStatus.textContent='There are no changes to save.';return;}
    massEditorSave.disabled=true;massEditorStatus.textContent=`Saving 0 of ${rows.length}…`;
    let saved=0;const failures=[];
    for(const row of rows){
      try{
        const response=await request('/api/admin/media/'+encodeURIComponent(row.dataset.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(massRowBody(row))});
        const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
        saved+=1;row.classList.remove('is-dirty');massEditorStatus.textContent=`Saving ${saved} of ${rows.length}…`;
      }catch(error){failures.push(error.message);row.classList.add('has-error');}
    }
    massEditorSave.disabled=false;
    if(failures.length){massEditorStatus.textContent=`${saved} saved; ${failures.length} failed. ${failures[0]}`;updateMassDirty();return;}
    closeMassEditor(true);await load();msg(`${saved} photo${saved===1?'':'s'} updated.`);
  }

  function selectedBoxes(){return [...list.querySelectorAll('[data-select-item]:checked')];}
  function selectedIds(){return selectedBoxes().map(box=>box.closest('.admin-card')?.dataset.id).filter(Boolean);}

  const BULK_WORKFLOW={
    pending:[['review','Start review','secondary'],['approve','Approve','primary'],['reject','Reject','danger']],
    review:[['approve','Approve','primary'],['reject','Reject','danger']],
    approved:[['publish','Publish','publish']],
    processing:[],
    published:[['archive','Archive','secondary']],
    archived:[['restore','Republish','primary']],
    rejected:[['restore','Restore to pending','secondary']]
  };
  const BULK_ACTION_LABELS={save:'Apply field changes',review:'Start review',approve:'Approve',publish:'Publish',reject:'Reject',archive:'Archive',restore:'Restore'};
  const BULK_ERRORS={
    INVALID_TRANSITION:'One or more selected photos are not in a status that allows that action.',
    CATEGORY_REQUIRED:'Assign a website section before approving or publishing.',
    INVALID_UPLOAD:'One or more selected files failed validation.',
    SOURCE_MISSING:'The original file is missing for one or more selected photos.',
    DERIVATIVES_MISSING:'One or more archived photos cannot be republished because its web images are missing.'
  };

  function closeBulkEditor(){
    if(bulkEditor)bulkEditor.hidden=true;
  }

  function setBulkMode(enabled){
    bulkMode=!!enabled;
    workspace?.classList.toggle('is-bulk-mode',bulkMode);
    if(bulkPanel)bulkPanel.hidden=!bulkMode;
    if(bulkModeToggle){bulkModeToggle.classList.toggle('primary',bulkMode);bulkModeToggle.textContent=bulkMode?'Exit bulk edit':'Bulk edit';}
    if(!bulkMode){
      list?.querySelectorAll('[data-select-item]').forEach(box=>box.checked=false);
      closeBulkEditor();
      resetBulkFields();
    }
    updateBulkUi();
  }

  function applyBulkChangesToCards(body,ids){
    for(const id of ids){
      const el=[...list.querySelectorAll('.admin-card')].find(card=>card.dataset.id===id);
      if(!el)continue;
      if(Object.prototype.hasOwnProperty.call(body,'category')){
        const field=el.querySelector('[data-field="category"]');if(field)field.value=body.category||'';
      }
      if(Object.prototype.hasOwnProperty.call(body,'gallery')){
        const field=el.querySelector('[data-field="gallery"]');if(field)field.value=body.gallery||'';
      }
      if(Object.prototype.hasOwnProperty.call(body,'featured')){
        const field=el.querySelector('[data-field="featured"]');if(field)field.checked=!!body.featured;
      }
    }
  }

  function renderBulkWorkflow(){
    if(!bulkWorkflowActions)return;
    const actions=BULK_WORKFLOW[statusFilter?.value||'pending']||[];
    bulkWorkflowActions.innerHTML=actions.length?actions.map(([action,label,kind])=>`<button type="button" class="${kind==='primary'?'primary':kind==='danger'?'danger':kind==='publish'?'bulk-publish':'secondary'}" data-bulk-action="${action}">${label}</button>`).join(''):'<span class="admin-bulk-none">No workflow action is available for this status.</span>';
  }

  function updateBulkUi(){
    const boxes=[...list.querySelectorAll('[data-select-item]')];
    const selected=boxes.filter(box=>box.checked);
    boxes.forEach(box=>box.closest('.admin-card')?.classList.toggle('is-selected',box.checked));
    if(selectionCount)selectionCount.textContent=`${selected.length} selected`;
    if(bulkInstruction)bulkInstruction.textContent=selected.length?'Choose an action below, or edit details for the selected photos.':'Select the photos you want to work with.';
    if(selectAll){
      selectAll.checked=boxes.length>0&&selected.length===boxes.length;
      selectAll.indeterminate=selected.length>0&&selected.length<boxes.length;
      selectAll.disabled=!boxes.length;
    }
    if(clearSelection)clearSelection.disabled=selected.length===0;
    if(bulkEditDetails)bulkEditDetails.disabled=selected.length===0;
    bulkPanel?.classList.toggle('has-selection',selected.length>0);
    bulkPanel?.querySelectorAll('[data-bulk-action]').forEach(button=>button.disabled=selected.length===0);
  }

  function resetBulkFields(){
    if(bulkCategory)bulkCategory.value='';
    if(bulkGalleryMode)bulkGalleryMode.value='keep';
    if(bulkGallery)bulkGallery.value='';
    if(bulkGalleryValue)bulkGalleryValue.hidden=true;
    if(bulkFeatured)bulkFeatured.value='';
  }

  function bulkPayload(ids,action){
    const body={ids,action};
    const category=bulkCategory?.value||'';
    if(category==='__clear__')body.category=null;
    else if(category)body.category=category;
    const galleryMode=bulkGalleryMode?.value||'keep';
    if(galleryMode==='clear')body.gallery=null;
    if(galleryMode==='set'){
      const value=bulkGallery?.value.trim()||'';
      if(!value)throw new Error('Enter a gallery / event name, or choose “No change.”');
      body.gallery=value;
    }
    if(bulkFeatured?.value==='true')body.featured=true;
    if(bulkFeatured?.value==='false')body.featured=false;
    return body;
  }

  function hasBulkFieldChange(body){return ['category','gallery','featured'].some(key=>Object.prototype.hasOwnProperty.call(body,key));}

  async function bulkAction(action){
    const ids=selectedIds();
    if(!ids.length){msg('Select at least one photo first.');return;}
    const body=bulkPayload(ids,action);
    if(action==='save'&&!hasBulkFieldChange(body)){msg('Choose at least one bulk field to change first.');return;}
    const label=BULK_ACTION_LABELS[action]||action;
    if(['approve','publish','reject','archive','restore'].includes(action)&&!confirm(`${label} ${ids.length} selected photo${ids.length===1?'':'s'}?`))return;
    msg(`${label}: updating ${ids.length} selected photo${ids.length===1?'':'s'}…`);
    const response=await request('/api/admin/media/bulk',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    const failures=(data.results||[]).filter(item=>!item.ok);
    let resultMessage;
    if(failures.length){
      const reasons=[...new Set(failures.map(item=>BULK_ERRORS[item.error]||item.error||'Unknown error'))].slice(0,2);
      resultMessage=`${ids.length-failures.length} succeeded; ${failures.length} failed. ${reasons.join(' ')}`;
    }else resultMessage=`${label} completed for ${ids.length} photo${ids.length===1?'':'s'}.`;
    if(action==='save'){
      applyBulkChangesToCards(body,ids);
      resetBulkFields();
      closeBulkEditor();
      updateBulkUi();
    }else{
      resetBulkFields();
      closeBulkEditor();
      await load();
    }
    msg(resultMessage);
  }

  loginForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    loginSubmit.disabled=true;loginStatus.textContent='Signing in…';
    try{
      const {response,data}=await auth.login(loginUsername.value.trim(),loginPassword.value);
      if(!response.ok){
        if(data.code==='BOOTSTRAP_REQUIRED'){showBootstrap();return;}
        throw new Error(data.error||'Sign-in failed.');
      }
      loginPassword.value='';
      const session={user:data.user,expires_at:data.expires_at};
      if(data.user?.must_change_password)showPasswordChange(session);
      else{showWorkspace(session);await load();}
    }catch(error){loginStatus.textContent=error.message;}
    finally{loginSubmit.disabled=false;}
  });

  bootstrapForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(bootstrapPassword.value!==bootstrapConfirm.value){bootstrapStatus.textContent='Passwords do not match.';return;}
    bootstrapSubmit.disabled=true;bootstrapStatus.textContent='Creating Administrator…';
    try{
      const {response,data}=await auth.bootstrap(bootstrapKey.value,bootstrapName.value,bootstrapUsername.value,bootstrapPassword.value);
      if(!response.ok)throw new Error(data.error||'Setup failed.');
      bootstrapKey.value='';bootstrapPassword.value='';bootstrapConfirm.value='';
      const session={user:data.user,expires_at:data.expires_at};
      showWorkspace(session);await load();
    }catch(error){bootstrapStatus.textContent=error.message;}
    finally{bootstrapSubmit.disabled=false;}
  });

  passwordForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(newPassword.value!==confirmPassword.value){passwordStatus.textContent='New passwords do not match.';return;}
    passwordSubmit.disabled=true;passwordStatus.textContent='Updating password…';
    try{
      const {response,data}=await auth.changePassword(currentPassword.value,newPassword.value);
      if(!response.ok)throw new Error(data.error||'Password change failed.');
      const session={user:data.user,expires_at:data.expires_at};
      showWorkspace(session);await load();
    }catch(error){passwordStatus.textContent=error.message;}
    finally{passwordSubmit.disabled=false;}
  });

  signOut?.addEventListener('click',async()=>{await auth.logout();showLogin('Signed out.');});
  document.querySelector('[data-refresh]')?.addEventListener('click',()=>load({preserveSelection:bulkMode}));
  statusFilter?.addEventListener('change',()=>{setBulkMode(false);load();});
  categoryFilter?.addEventListener('change',()=>{setBulkMode(false);load();});
  massEditorOpen?.addEventListener('click',openMassEditor);
  massEditorClose?.addEventListener('click',()=>closeMassEditor());
  massEditorCancel?.addEventListener('click',()=>closeMassEditor());
  massEditorSave?.addEventListener('click',saveMassEditor);
  massSelectAll?.addEventListener('change',()=>{massEditorRows.querySelectorAll('[data-mass-select]').forEach(box=>box.checked=massSelectAll.checked);updateMassCount();});
  massApplyFill?.addEventListener('click',applyMassFill);
  massEditorRows?.addEventListener('change',event=>{
    if(event.target.matches('[data-mass-select]')){updateMassCount();return;}
    if(event.target.matches('[data-mass-field],[data-mass-action]')){event.target.closest('tr')?.classList.add('is-dirty');updateMassDirty();}
  });
  massEditorRows?.addEventListener('input',event=>{if(event.target.matches('[data-mass-field]')){event.target.closest('tr')?.classList.add('is-dirty');updateMassDirty();}});
  massEditorRows?.addEventListener('click',async event=>{const button=event.target.closest('[data-mass-preview-url]');if(button)await openPreview(button);});
  bulkModeToggle?.addEventListener('click',()=>setBulkMode(!bulkMode));
  bulkModeDone?.addEventListener('click',()=>setBulkMode(false));
  bulkEditDetails?.addEventListener('click',()=>{if(selectedIds().length&&bulkEditor)bulkEditor.hidden=false;});
  bulkEditorClose?.addEventListener('click',closeBulkEditor);
  bulkEditorCancel?.addEventListener('click',()=>{resetBulkFields();closeBulkEditor();});

  document.querySelector('[data-sync]')?.addEventListener('click',async()=>{
    try{maintenanceMsg('Syncing incoming folders…');const response=await request('/api/admin/sync',{method:'POST'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));maintenanceMsg(`Sync complete: ${data.scanned||0} scanned, ${data.added||0} new, ${data.rejected||0} rejected.`);await load();}catch(error){maintenanceMsg('Sync failed: '+error.message);}
  });
  document.querySelector('[data-seed-galleries]')?.addEventListener('click',async()=>{
    try{maintenanceMsg('Refreshing gallery groups…');const response=await request('/api/admin/galleries/seed',{method:'POST'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||('HTTP '+response.status));maintenanceMsg(`${data.seeded||0} gallery groups refreshed.`);}catch(error){maintenanceMsg('Gallery refresh failed: '+error.message);}
  });

  selectAll?.addEventListener('change',()=>{list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=selectAll.checked);updateBulkUi();});
  clearSelection?.addEventListener('click',()=>{list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=false);updateBulkUi();});
  bulkGalleryMode?.addEventListener('change',()=>{if(bulkGalleryValue)bulkGalleryValue.hidden=bulkGalleryMode.value!=='set';if(bulkGalleryMode.value==='set')bulkGallery?.focus();});
  list?.addEventListener('change',event=>{if(event.target.matches('[data-select-item]'))updateBulkUi();});
  list?.addEventListener('click',async event=>{
    const previewButton=event.target.closest('[data-preview-url]');if(previewButton){await openPreview(previewButton);return;}
    const button=event.target.closest('button[data-action]');if(!button)return;
    const el=button.closest('.admin-card');
    try{button.disabled=true;msg(`${button.textContent.trim()}…`);await updateCard(el,button.dataset.action);await load();}catch(error){msg('Update failed: '+error.message);}finally{button.disabled=false;}
  });
  bulkPanel?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-bulk-action]');
    if(!button)return;
    try{button.disabled=true;await bulkAction(button.dataset.bulkAction);}catch(error){msg('Bulk update failed: '+error.message);}finally{button.disabled=false;updateBulkUi();}
  });

  previewClose?.addEventListener('click',closePreview);
  previewModal?.addEventListener('click',event=>{if(event.target===previewModal)closePreview();});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(previewModal&&!previewModal.hidden)closePreview();else if(massEditor&&!massEditor.hidden)closeMassEditor();});
  window.addEventListener('beforeunload',clearObjectUrls);

  window.VJL_ADMIN={request,refresh:load,getSession:()=>currentSession};

  (async()=>{
    if(!auth.api){showLogin('Backend not configured.');return;}
    const state=await auth.status();
    if(state.needs_bootstrap){showBootstrap();return;}
    const session=await auth.session();
    if(!session){showLogin();return;}
    if(session.user?.must_change_password){showPasswordChange(session);return;}
    showWorkspace(session);
    await load();
  })();
})();
