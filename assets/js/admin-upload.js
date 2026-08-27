(()=>{
  const root=document.querySelector('[data-admin-root]');
  const controls=document.querySelector('.admin-controls');
  if(!root||!controls)return;
  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const token=()=>sessionStorage.getItem('vjl_admin_token')||'';

  const panel=document.createElement('section');
  panel.className='admin-controls';
  panel.innerHTML=`<div class="admin-toolbar"><input type="file" multiple accept="image/jpeg,image/png,image/webp" data-direct-upload-files><select data-direct-upload-category><option value="housing">Housing</option><option value="behind-the-wall">Behind-the-Wall</option><option value="outreach">Outreach</option><option value="events">Events</option><option value="team">Team</option><option value="partners">Partners</option><option value="unsorted">Unsorted</option></select><button type="button" class="primary" data-direct-upload>Upload selected</button><button type="button" class="secondary" data-clean-orphans>Clean deleted rejected records</button></div><div class="status-box" data-direct-upload-status role="status"></div>`;
  controls.parentNode.insertBefore(panel,controls);

  const files=panel.querySelector('[data-direct-upload-files]');
  const category=panel.querySelector('[data-direct-upload-category]');
  const upload=panel.querySelector('[data-direct-upload]');
  const cleanup=panel.querySelector('[data-clean-orphans]');
  const status=panel.querySelector('[data-direct-upload-status]');
  const endpoint=path=>api.replace(/\/$/,'')+path;

  upload.addEventListener('click',async()=>{
    const chosen=[...(files.files||[])];
    if(!chosen.length){status.textContent='Choose at least one image first.';return;}
    upload.disabled=true;
    status.textContent='Uploading…';
    try{
      const form=new FormData();
      form.set('category',category.value);
      chosen.forEach(file=>form.append('files',file,file.name));
      const response=await fetch(endpoint('/api/admin/upload'),{method:'POST',headers:{Authorization:'Bearer '+token()},body:form});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      status.textContent=`Uploaded ${(data.uploaded||[]).length} file(s).`;
      files.value='';
      const statusFilter=document.querySelector('[data-status-filter]');
      if(statusFilter)statusFilter.value='pending';
      document.querySelector('[data-refresh]')?.click();
    }catch(error){status.textContent='Upload failed: '+error.message;}
    finally{upload.disabled=false;}
  });

  cleanup.addEventListener('click',async()=>{
    if(!confirm('Remove rejected database records whose source files were already deleted from R2?'))return;
    cleanup.disabled=true;
    status.textContent='Cleaning…';
    try{
      const response=await fetch(endpoint('/api/admin/cleanup-orphans'),{method:'POST',headers:{Authorization:'Bearer '+token(),'Content-Type':'application/json'},body:JSON.stringify({confirm:'CLEAN_ORPHANS'})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      status.textContent=`Deleted ${data.deleted_count||0} stale database record(s).`;
      document.querySelector('[data-refresh]')?.click();
    }catch(error){status.textContent='Cleanup failed: '+error.message;}
    finally{cleanup.disabled=false;}
  });
})();
