(()=>{
  const panel=document.querySelector('[data-upload-panel]');
  const admin=window.VJL_ADMIN;
  if(!panel||!admin)return;

  const files=panel.querySelector('[data-direct-upload-files]');
  const category=panel.querySelector('[data-direct-upload-category]');
  const upload=panel.querySelector('[data-direct-upload]');
  const status=panel.querySelector('[data-direct-upload-status]');
  const cleanup=document.querySelector('[data-clean-orphans]');
  const maintenanceStatus=document.querySelector('[data-maintenance-status]');

  upload?.addEventListener('click',async()=>{
    const chosen=[...(files.files||[])];
    if(!chosen.length){status.textContent='Choose at least one image first.';return;}
    upload.disabled=true;status.textContent='Uploading…';
    try{
      const form=new FormData();form.set('category',category.value);chosen.forEach(file=>form.append('files',file,file.name));
      const response=await admin.request('/api/admin/upload',{method:'POST',body:form});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      status.textContent=`Uploaded ${(data.uploaded||[]).length} file(s). Ready for review.`;
      files.value='';
      const statusFilter=document.querySelector('[data-status-filter]');if(statusFilter)statusFilter.value='pending';
      await admin.refresh();
    }catch(error){status.textContent='Upload failed: '+error.message;}
    finally{upload.disabled=false;}
  });

  cleanup?.addEventListener('click',async()=>{
    if(!confirm('Clean stale rejected records whose source files no longer exist?'))return;
    cleanup.disabled=true;if(maintenanceStatus)maintenanceStatus.textContent='Cleaning stale records…';
    try{
      const response=await admin.request('/api/admin/cleanup-orphans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'CLEAN_ORPHANS'})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      if(maintenanceStatus)maintenanceStatus.textContent=`Removed ${data.deleted_count||0} stale record(s).`;
      await admin.refresh();
    }catch(error){if(maintenanceStatus)maintenanceStatus.textContent='Cleanup failed: '+error.message;}
    finally{cleanup.disabled=false;}
  });
})();
