from pathlib import Path
import re

# Admin HTML
path = Path('admin/index.html')
html = path.read_text()
refresh = '<button class="secondary" type="button" data-refresh>Refresh</button>'
if 'data-bulk-mode-toggle' not in html:
    if refresh not in html:
        raise SystemExit('refresh button anchor missing')
    html = html.replace(refresh, refresh + '\n              <button class="secondary admin-bulk-mode-toggle" type="button" data-bulk-mode-toggle>Bulk edit</button>', 1)

start = html.find('            <div class="admin-bulk" data-bulk-panel>')
end_marker = '          </div>\n          <div class="status-box" data-admin-status'
end = html.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('bulk HTML block anchors missing')

bulk = '''            <div class="admin-bulk" data-bulk-panel hidden>
              <div class="admin-bulk-main">
                <div class="admin-bulk-title">
                  <strong data-selection-count>0 selected</strong>
                  <span data-bulk-instruction>Select the photos you want to work with.</span>
                </div>
                <div class="admin-bulk-selection-tools">
                  <label><input type="checkbox" data-select-all> Select all visible</label>
                  <button class="secondary" type="button" data-clear-selection>Clear</button>
                </div>
                <div class="admin-bulk-workflow">
                  <span>Move selected</span>
                  <div class="admin-bulk-workflow-buttons" data-bulk-workflow-actions></div>
                </div>
                <button class="secondary" type="button" data-bulk-edit-details>Edit details</button>
                <button class="secondary" type="button" data-bulk-mode-done>Done</button>
              </div>

              <div class="admin-bulk-editor" data-bulk-editor hidden>
                <div class="admin-bulk-editor-head">
                  <div><strong>Edit selected photos</strong><span>Only fields you change below will be updated.</span></div>
                  <button class="secondary" type="button" data-bulk-editor-close>Close</button>
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
                <div class="admin-bulk-editor-actions">
                  <button class="primary" type="button" data-bulk-action="save">Apply changes</button>
                  <button class="secondary" type="button" data-bulk-editor-cancel>Cancel</button>
                </div>
              </div>
            </div>
'''
html = html[:start] + bulk + html[end:]
html = re.sub(r'admin\.css\?v=[^"\']+', 'admin.css?v=20260828-bulk3', html, count=1)
html = re.sub(r'admin\.js\?v=[^"\']+', 'admin.js?v=20260828-bulk3', html, count=1)
path.write_text(html)

# Admin JS
path = Path('assets/js/admin.js')
js = path.read_text()
anchor = "  const bulkPanel=document.querySelector('[data-bulk-panel]');\n"
add = """  const bulkModeToggle=document.querySelector('[data-bulk-mode-toggle]');
  const bulkModeDone=document.querySelector('[data-bulk-mode-done]');
  const bulkEditDetails=document.querySelector('[data-bulk-edit-details]');
  const bulkEditor=document.querySelector('[data-bulk-editor]');
  const bulkEditorClose=document.querySelector('[data-bulk-editor-close]');
  const bulkEditorCancel=document.querySelector('[data-bulk-editor-cancel]');
  const bulkInstruction=document.querySelector('[data-bulk-instruction]');
"""
if 'const bulkModeToggle=' not in js:
    if anchor not in js:
        raise SystemExit('bulk panel const anchor missing')
    js = js.replace(anchor, anchor + add, 1)

anchor = "  let currentSession=null;\n"
if 'let bulkMode=false;' not in js:
    if anchor not in js:
        raise SystemExit('currentSession anchor missing')
    js = js.replace(anchor, anchor + "  let bulkMode=false;\n", 1)

old = """  async function load(){
    if(!currentSession||currentSession.user?.must_change_password)return;
    clearObjectUrls();
    if(selectAll)selectAll.checked=false;
    msg('Loading…');
"""
new = """  async function load({preserveSelection=false}={}){
    if(!currentSession||currentSession.user?.must_change_password)return;
    const keep=preserveSelection?new Set(selectedIds()):new Set();
    clearObjectUrls();
    if(selectAll)selectAll.checked=false;
    msg('Loading…');
"""
if old not in js:
    raise SystemExit('load start anchor missing')
js = js.replace(old, new, 1)

old = """      (data.items||[]).forEach(item=>list.append(card(item)));
      if(!(data.items||[]).length)list.innerHTML='<div class=\"admin-empty-state\">No items in this view.</div>';
      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      renderBulkWorkflow();
      updateBulkUi();
"""
new = """      (data.items||[]).forEach(item=>list.append(card(item)));
      if(!(data.items||[]).length)list.innerHTML='<div class=\"admin-empty-state\">No items in this view.</div>';
      if(keep.size)list.querySelectorAll('[data-select-item]').forEach(box=>{const id=box.closest('.admin-card')?.dataset.id;box.checked=keep.has(id);});
      msg(`${(data.items||[]).length} item(s) in ${STATUS_LABELS[currentStatus]||currentStatus}`);
      renderBulkWorkflow();
      updateBulkUi();
"""
if old not in js:
    raise SystemExit('load body anchor missing')
js = js.replace(old, new, 1)

anchor = "  function renderBulkWorkflow(){\n"
helpers = """  function closeBulkEditor(){
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
        const field=el.querySelector('[data-field=\"category\"]');if(field)field.value=body.category||'';
      }
      if(Object.prototype.hasOwnProperty.call(body,'gallery')){
        const field=el.querySelector('[data-field=\"gallery\"]');if(field)field.value=body.gallery||'';
      }
      if(Object.prototype.hasOwnProperty.call(body,'featured')){
        const field=el.querySelector('[data-field=\"featured\"]');if(field)field.checked=!!body.featured;
      }
    }
  }

"""
if 'function setBulkMode(' not in js:
    if anchor not in js:
        raise SystemExit('renderBulkWorkflow anchor missing')
    js = js.replace(anchor, helpers + anchor, 1)

start = js.find('  function updateBulkUi(){')
end = js.find('  function resetBulkFields(){', start)
if start < 0 or end < 0:
    raise SystemExit('updateBulkUi anchors missing')
new_update = """  function updateBulkUi(){
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

"""
js = js[:start] + new_update + js[end:]

old = """    resetBulkFields();
    await load();
    msg(resultMessage);
  }
"""
new = """    if(action==='save'){
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
"""
if old not in js:
    raise SystemExit('bulk action completion anchor missing')
js = js.replace(old, new, 1)
js = js.replace("if(['publish','reject','archive','restore'].includes(action)&&!confirm", "if(['approve','publish','reject','archive','restore'].includes(action)&&!confirm", 1)

old = """  document.querySelector('[data-refresh]')?.addEventListener('click',load);
  statusFilter?.addEventListener('change',load);
  categoryFilter?.addEventListener('change',load);
"""
new = """  document.querySelector('[data-refresh]')?.addEventListener('click',()=>load({preserveSelection:bulkMode}));
  statusFilter?.addEventListener('change',()=>{setBulkMode(false);load();});
  categoryFilter?.addEventListener('change',()=>{setBulkMode(false);load();});
  bulkModeToggle?.addEventListener('click',()=>setBulkMode(!bulkMode));
  bulkModeDone?.addEventListener('click',()=>setBulkMode(false));
  bulkEditDetails?.addEventListener('click',()=>{if(selectedIds().length&&bulkEditor)bulkEditor.hidden=false;});
  bulkEditorClose?.addEventListener('click',closeBulkEditor);
  bulkEditorCancel?.addEventListener('click',()=>{resetBulkFields();closeBulkEditor();});
"""
if old not in js:
    raise SystemExit('filter handler anchor missing')
js = js.replace(old, new, 1)
path.write_text(js)

# Admin CSS
path = Path('assets/css/admin.css')
css = path.read_text()
if 'Bulk edit v3:' not in css:
    css += r'''

/* Bulk edit v3: explicit selection mode with a contextual action tray. */
.admin-card-select{display:none;align-items:center;gap:6px;font-size:12px;font-weight:800}.admin-card-select:after{content:'Select'}.admin-card.is-selected .admin-card-select:after{content:'Selected'}.is-bulk-mode .admin-card-select{display:flex}.is-bulk-mode .admin-card.is-selected{border-color:var(--green);box-shadow:0 0 0 3px rgba(59,125,35,.10)}.admin-bulk-mode-toggle.primary{background:var(--green)!important;color:#fff!important}.admin-bulk[hidden]{display:none!important}.admin-bulk{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:180;width:min(1120px,calc(100vw - 32px));margin:0;padding:12px 14px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 55px rgba(20,28,21,.22)}.admin-bulk.has-selection{border-color:rgba(59,125,35,.55);box-shadow:0 18px 55px rgba(20,28,21,.24),0 0 0 3px rgba(59,125,35,.08)}.admin-bulk-main{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.admin-bulk-title{min-width:150px;margin-right:auto}.admin-bulk-title strong{font-size:16px}.admin-bulk-title span{font-size:12px}.admin-bulk-selection-tools,.admin-bulk-workflow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.admin-bulk-selection-tools label{white-space:nowrap}.admin-bulk-workflow>span{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:800}.admin-bulk-workflow-buttons{display:flex;gap:7px;flex-wrap:wrap}.admin-bulk-main button{padding:9px 12px}.admin-bulk-editor{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.admin-bulk-editor[hidden]{display:none!important}.admin-bulk-editor-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:10px}.admin-bulk-editor-head>div{display:grid;gap:2px}.admin-bulk-editor-head span{font-size:12px;color:var(--muted)}.admin-bulk-editor-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.is-bulk-mode{padding-bottom:120px}.admin-bulk .admin-bulk-fields{padding:10px;background:var(--soft)}
@media(max-width:900px){.admin-bulk{bottom:10px;width:calc(100vw - 20px)}.admin-bulk-main{align-items:stretch}.admin-bulk-title{width:100%;margin-right:0}.admin-bulk-selection-tools,.admin-bulk-workflow{width:100%}.admin-bulk-workflow{align-items:flex-start;flex-direction:column}.admin-bulk-workflow-buttons{width:100%}.admin-bulk-workflow-buttons button{flex:1}.admin-bulk-main>[data-bulk-edit-details],.admin-bulk-main>[data-bulk-mode-done]{flex:1}.admin-bulk-editor-head{align-items:flex-start}.is-bulk-mode{padding-bottom:190px}}
@media(max-width:600px){.admin-bulk{max-height:72vh;overflow:auto;border-radius:14px;padding:11px}.admin-bulk-selection-tools{display:grid;grid-template-columns:1fr auto}.admin-bulk-selection-tools label{align-self:center}.admin-bulk-workflow-buttons{display:grid;grid-template-columns:1fr 1fr}.admin-bulk-workflow-buttons button{width:100%}.admin-bulk-fields{grid-template-columns:1fr!important}.admin-bulk-editor-actions{display:grid;grid-template-columns:1fr 1fr}.admin-bulk-editor-actions button{width:100%}.is-bulk-mode{padding-bottom:230px}}
'''
path.write_text(css)
