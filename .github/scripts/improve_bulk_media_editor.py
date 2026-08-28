from pathlib import Path
import re

index = Path('admin/index.html')
html = index.read_text()
pattern = re.compile(r'''            <div class="admin-bulk">.*?            </div>\n          </div>\n          <div class="status-box" data-admin-status''', re.S)
replacement = '''            <div class="admin-bulk" data-bulk-panel>
              <div class="admin-bulk-head">
                <div class="admin-bulk-title"><strong>Bulk edit selected</strong><span data-selection-count>0 selected</span></div>
                <div class="admin-bulk-selection-tools">
                  <label><input type="checkbox" data-select-all> Select all visible</label>
                  <button class="secondary" type="button" data-clear-selection>Clear selection</button>
                </div>
              </div>

              <div class="admin-bulk-fields">
                <label>Website section
                  <select data-bulk-category aria-label="Set website section for selected photos">
                    <option value="">No change</option>
                    <option value="housing">Housing</option>
                    <option value="behind-the-wall">Behind-the-Wall</option>
                    <option value="outreach">Outreach</option>
                    <option value="events">Events</option>
                    <option value="team">Team</option>
                    <option value="partners">Partners</option>
                    <option value="__clear__">Unsorted / clear section</option>
                  </select>
                </label>
                <label>Gallery / event
                  <select data-bulk-gallery-mode aria-label="Gallery or event bulk edit mode">
                    <option value="keep">No change</option>
                    <option value="set">Set same gallery / event</option>
                    <option value="clear">Clear gallery / event</option>
                  </select>
                </label>
                <label data-bulk-gallery-value hidden>Gallery / event name
                  <input type="text" placeholder="Enter gallery or event name" data-bulk-gallery aria-label="Gallery or event name for selected photos">
                </label>
                <label>Featured image
                  <select data-bulk-featured aria-label="Featured status for selected photos">
                    <option value="">No change</option>
                    <option value="true">Mark as featured</option>
                    <option value="false">Mark as not featured</option>
                  </select>
                </label>
              </div>

              <div class="admin-bulk-footer">
                <button class="secondary" type="button" data-bulk-action="save">Apply field changes</button>
                <div class="admin-bulk-workflow">
                  <span>Workflow action</span>
                  <div class="admin-bulk-workflow-buttons" data-bulk-workflow-actions></div>
                </div>
              </div>
              <p class="admin-bulk-help" data-bulk-help>Select one or more photos using their checkboxes. Choose only the fields you want to change, then apply them to all selected photos.</p>
            </div>
          </div>
          <div class="status-box" data-admin-status'''
html, count = pattern.subn(replacement, html, count=1)
if count != 1:
    raise SystemExit(f'bulk HTML replacement count={count}')
html = html.replace('admin.css?v=20260827-multiuser1', 'admin.css?v=20260828-bulk2')
html = html.replace('admin.js?v=20260827-multiuser1', 'admin.js?v=20260828-bulk2')
index.write_text(html)

js_path = Path('assets/js/admin.js')
js = js_path.read_text()
old = """  const bulkCategory=document.querySelector('[data-bulk-category]');
  const bulkGallery=document.querySelector('[data-bulk-gallery]');
"""
new = """  const bulkPanel=document.querySelector('[data-bulk-panel]');
  const bulkCategory=document.querySelector('[data-bulk-category]');
  const bulkGalleryMode=document.querySelector('[data-bulk-gallery-mode]');
  const bulkGalleryValue=document.querySelector('[data-bulk-gallery-value]');
  const bulkGallery=document.querySelector('[data-bulk-gallery]');
  const bulkFeatured=document.querySelector('[data-bulk-featured]');
  const selectionCount=document.querySelector('[data-selection-count]');
  const clearSelection=document.querySelector('[data-clear-selection]');
  const bulkWorkflowActions=document.querySelector('[data-bulk-workflow-actions]');
"""
if old not in js: raise SystemExit('bulk const anchor not found')
js = js.replace(old, new, 1)

old = """  function selectedIds(){return [...list.querySelectorAll('[data-select-item]:checked')].map(box=>box.closest('.admin-card')?.dataset.id).filter(Boolean);}

  async function bulkAction(action){
    const ids=selectedIds();
    if(!ids.length){msg('Select at least one media item first.');return;}
    const body={ids,action};
    if(bulkCategory?.value)body.category=bulkCategory.value;
    if(bulkGallery?.value.trim())body.gallery=bulkGallery.value.trim();
    msg(`${action} on ${ids.length} item(s)…`);
    const response=await request('/api/admin/media/bulk',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    const failures=(data.results||[]).filter(item=>!item.ok);
    msg(failures.length?`${ids.length-failures.length} succeeded; ${failures.length} failed.`:`${ids.length} item(s) updated.`);
    await load();
  }
"""
new = """  function selectedBoxes(){return [...list.querySelectorAll('[data-select-item]:checked')];}
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
    if(selectAll){
      selectAll.checked=boxes.length>0&&selected.length===boxes.length;
      selectAll.indeterminate=selected.length>0&&selected.length<boxes.length;
    }
    if(clearSelection)clearSelection.disabled=selected.length===0;
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
    if(['publish','reject','archive','restore'].includes(action)&&!confirm(`${label} ${ids.length} selected photo${ids.length===1?'':'s'}?`))return;
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
    resetBulkFields();
    await load();
    msg(resultMessage);
  }
"""
if old not in js: raise SystemExit('bulk function anchor not found')
js = js.replace(old, new, 1)

old = """      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      hydratePreviews();
"""
new = """      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      renderBulkWorkflow();
      updateBulkUi();
      hydratePreviews();
"""
if old not in js: raise SystemExit('load anchor not found')
js = js.replace(old, new, 1)

old = """  selectAll?.addEventListener('change',()=>list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=selectAll.checked));
  list?.addEventListener('change',event=>{if(event.target.matches('[data-select-item]')){const boxes=[...list.querySelectorAll('[data-select-item]')];if(selectAll)selectAll.checked=boxes.length>0&&boxes.every(box=>box.checked);}});
"""
new = """  selectAll?.addEventListener('change',()=>{list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=selectAll.checked);updateBulkUi();});
  clearSelection?.addEventListener('click',()=>{list.querySelectorAll('[data-select-item]').forEach(box=>box.checked=false);updateBulkUi();});
  bulkGalleryMode?.addEventListener('change',()=>{if(bulkGalleryValue)bulkGalleryValue.hidden=bulkGalleryMode.value!=='set';if(bulkGalleryMode.value==='set')bulkGallery?.focus();});
  list?.addEventListener('change',event=>{if(event.target.matches('[data-select-item]'))updateBulkUi();});
"""
if old not in js: raise SystemExit('selection handler anchor not found')
js = js.replace(old, new, 1)

old = """  document.querySelectorAll('[data-bulk-action]').forEach(button=>button.addEventListener('click',async()=>{
    try{button.disabled=true;await bulkAction(button.dataset.bulkAction);}catch(error){msg('Bulk update failed: '+error.message);}finally{button.disabled=false;}
  }));
"""
new = """  bulkPanel?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-bulk-action]');
    if(!button)return;
    try{button.disabled=true;await bulkAction(button.dataset.bulkAction);}catch(error){msg('Bulk update failed: '+error.message);}finally{button.disabled=false;updateBulkUi();}
  });
"""
if old not in js: raise SystemExit('bulk button handler anchor not found')
js = js.replace(old, new, 1)
js_path.write_text(js)

css_path = Path('assets/css/admin.css')
css = css_path.read_text()
css += r'''
/* Bulk media editor: selection-first, explicit field changes, status-aware workflow actions. */
.admin-bulk{display:grid;gap:14px;align-items:stretch;padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--soft);transition:border-color .15s ease,box-shadow .15s ease}.admin-bulk.has-selection{border-color:rgba(59,125,35,.5);box-shadow:0 0 0 3px rgba(59,125,35,.07)}.admin-bulk-head,.admin-bulk-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.admin-bulk-title{display:grid;gap:2px}.admin-bulk-title strong{font-size:16px}.admin-bulk-title span{font-size:13px;color:var(--muted);font-weight:700}.admin-bulk-selection-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-bulk-selection-tools label{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700}.admin-bulk-selection-tools input[type="checkbox"]{width:18px;height:18px}.admin-bulk-selection-tools button{padding:8px 11px}.admin-bulk-fields{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;padding:14px;background:#fff;border:1px solid var(--line);border-radius:11px}.admin-bulk-fields label{display:grid;gap:6px;font-size:13px;font-weight:800}.admin-bulk-fields select,.admin-bulk-fields input{width:100%;padding:10px 11px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);font:inherit}.admin-bulk-fields [hidden]{display:none!important}.admin-bulk-footer>button{padding:11px 16px}.admin-bulk-workflow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-bulk-workflow>span{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:800}.admin-bulk-workflow-buttons{display:flex;gap:8px;flex-wrap:wrap}.admin-bulk-workflow-buttons button{padding:10px 13px}.admin-bulk-workflow-buttons .primary{background:var(--green);color:#fff}.admin-bulk-workflow-buttons .danger{background:#8e2d27;color:#fff}.admin-bulk-workflow-buttons .bulk-publish{background:var(--orange);color:#fff}.admin-bulk-none{font-size:13px;color:var(--muted)}.admin-bulk-help{margin:0;color:var(--muted);font-size:13px}.admin-card.is-selected{border-color:var(--green);box-shadow:0 0 0 3px rgba(59,125,35,.09)}.admin-card.is-selected .admin-card-select{background:#edf6e9}.admin-bulk button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:900px){.admin-bulk-fields{grid-template-columns:1fr 1fr}}
@media(max-width:700px){.admin-bulk{padding:13px}.admin-bulk-head,.admin-bulk-footer{align-items:stretch;flex-direction:column}.admin-bulk-selection-tools{display:grid;grid-template-columns:1fr auto}.admin-bulk-fields{grid-template-columns:1fr}.admin-bulk-footer>button{width:100%}.admin-bulk-workflow{display:grid;gap:7px}.admin-bulk-workflow-buttons{display:grid;grid-template-columns:1fr 1fr}.admin-bulk-workflow-buttons button{width:100%}.admin-bulk-selection-tools button{width:auto}.admin-bulk-help{font-size:12px}}
'''
css_path.write_text(css)

Path('.github/workflows/improve-bulk-media-editor.yml').unlink(missing_ok=True)
Path('.github/scripts/improve_bulk_media_editor.py').unlink(missing_ok=True)
