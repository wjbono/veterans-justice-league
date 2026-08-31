(()=>{
  const root=document.querySelector('[data-users-root]');
  const auth=window.VJL_AUTH;
  if(!root||!auth)return;

  const accessPanel=document.querySelector('[data-users-access-panel]');
  const accessMessage=document.querySelector('[data-users-access-message]');
  const workspace=document.querySelector('[data-users-workspace]');
  const account=document.querySelector('[data-users-account]');
  const currentName=document.querySelector('[data-users-current-name]');
  const signOut=document.querySelector('[data-users-sign-out]');
  const refresh=document.querySelector('[data-users-refresh]');
  const list=document.querySelector('[data-users-list]');
  const status=document.querySelector('[data-users-status]');
  const counts=document.querySelector('[data-user-counts]');
  const search=document.querySelector('[data-users-search]');
  const roleFilter=document.querySelector('[data-users-role-filter]');
  const statusFilter=document.querySelector('[data-users-status-filter]');
  const toast=document.querySelector('[data-users-toast]');
  const createModal=document.querySelector('[data-create-user-modal]');
  const createForm=document.querySelector('[data-user-create-form]');
  const createName=document.querySelector('[data-create-name]');
  const createUsername=document.querySelector('[data-create-username]');
  const createRole=document.querySelector('[data-create-role]');
  const createPassword=document.querySelector('[data-create-password]');
  const createButton=document.querySelector('[data-create-user]');
  const createStatus=document.querySelector('[data-create-status]');
  const manageModal=document.querySelector('[data-manage-user-modal]');
  const manageForm=document.querySelector('[data-user-manage-form]');
  const manageTitle=document.querySelector('[data-manage-title]');
  const manageSubtitle=document.querySelector('[data-manage-subtitle]');
  const manageName=document.querySelector('[data-manage-name]');
  const manageUsername=document.querySelector('[data-manage-username]');
  const manageRole=document.querySelector('[data-manage-role]');
  const selfRoleNote=document.querySelector('[data-self-role-note]');
  const manageMeta=document.querySelector('[data-manage-meta]');
  const manageStatus=document.querySelector('[data-manage-status]');
  const saveUser=document.querySelector('[data-save-user]');
  const managePassword=document.querySelector('[data-manage-password]');
  const nonselfActions=document.querySelector('[data-nonself-actions]');
  const toggleActive=document.querySelector('[data-manage-action="toggle_active"]');
  const confirmModal=document.querySelector('[data-confirm-modal]');
  const confirmTitle=document.querySelector('[data-confirm-title]');
  const confirmMessage=document.querySelector('[data-confirm-message]');
  const confirmAccept=document.querySelector('[data-confirm-accept]');
  const confirmCancel=document.querySelector('[data-confirm-cancel]');

  let session=null;
  let users=[];
  let selectedUser=null;
  let manageOriginal=null;
  let toastTimer=null;
  let confirmResolver=null;

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const roleLabel=role=>role==='admin'?'Administrator':'Editor';
  const dateLabel=value=>{
    if(!value)return 'Never';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleString();
  };

  function showAccess(message){
    if(workspace)workspace.hidden=true;
    if(account)account.hidden=true;
    if(accessPanel)accessPanel.hidden=false;
    if(accessMessage)accessMessage.textContent=message;
  }

  function showWorkspace(){
    if(accessPanel)accessPanel.hidden=true;
    if(workspace)workspace.hidden=false;
    if(account)account.hidden=false;
    if(currentName)currentName.textContent=session.user.display_name||session.user.username;
  }

  async function request(path,options={}){
    const response=await auth.request(path,options);
    if(response.status===401)showAccess('Your session expired. Sign in again through Media Manager.');
    if(response.status===403){
      const data=await response.clone().json().catch(()=>({}));
      if(data.code==='PASSWORD_CHANGE_REQUIRED')showAccess('You must change your password in Media Manager before continuing.');
      else showAccess('Administrator access is required to manage users.');
    }
    return response;
  }

  function showToast(message,type='success'){
    if(!toast)return;
    clearTimeout(toastTimer);
    toast.textContent=message;
    toast.className=`admin-toast is-${type}`;
    toast.hidden=false;
    toastTimer=setTimeout(()=>{toast.hidden=true;},6500);
  }

  function syncModalState(){
    const open=[createModal,manageModal,confirmModal].some(modal=>modal&&!modal.hidden);
    document.body.classList.toggle('admin-modal-open',open);
  }

  function openModal(modal,focusTarget){
    if(!modal)return;
    modal.hidden=false;
    syncModalState();
    requestAnimationFrame(()=>focusTarget?.focus());
  }

  function closeModal(modal){
    if(!modal)return;
    modal.hidden=true;
    syncModalState();
  }

  async function closeStandardModals(){
    if(!confirmModal.hidden)return;
    if(!createModal.hidden)closeModal(createModal);
    if(!manageModal.hidden){
      if(!saveUser.disabled){
        const discard=await confirmAction({title:'Discard unsaved changes?',message:'The changes to this account have not been saved.',label:'Discard changes'});
        if(!discard)return;
      }
      closeModal(manageModal);
    }
  }

  function confirmAction({title,message,label,danger=true}){
    confirmTitle.textContent=title;
    confirmMessage.textContent=message;
    confirmAccept.textContent=label;
    confirmAccept.className=danger?'danger':'primary';
    openModal(confirmModal,confirmCancel);
    return new Promise(resolve=>{confirmResolver=resolve;});
  }

  function resolveConfirmation(value){
    closeModal(confirmModal);
    const resolve=confirmResolver;
    confirmResolver=null;
    resolve?.(value);
  }

  function userCard(user){
    const self=user.id===session.user.id;
    const card=document.createElement('article');
    card.className='admin-user-card admin-user-row';
    card.dataset.userId=user.id;
    card.innerHTML=`
      <div class="admin-user-identity">
        <span class="admin-user-avatar" aria-hidden="true">${escapeHtml((user.display_name||user.username||'?').trim().charAt(0).toUpperCase())}</span>
        <div><strong>${escapeHtml(user.display_name)}</strong><span>@${escapeHtml(user.username)}</span></div>
      </div>
      <div class="admin-user-column"><span class="admin-user-column-label">Role</span><span class="admin-user-role">${roleLabel(user.role)}</span></div>
      <div class="admin-user-column"><span class="admin-user-column-label">Status</span><span class="admin-user-state ${user.active?'is-active':'is-disabled'}">${user.active?'Active':'Disabled'}</span></div>
      <div class="admin-user-last-login"><span class="admin-user-column-label">Last sign-in</span><strong>${escapeHtml(dateLabel(user.last_login_at))}</strong></div>
      <div class="admin-user-row-badges">
        ${self?'<span class="admin-user-state">You</span>':''}
        ${user.must_change_password?'<span class="admin-user-state is-warning">Password change required</span>':''}
      </div>
      <button class="secondary admin-manage-user" type="button" data-manage-user="${escapeHtml(user.id)}">Manage</button>`;
    return card;
  }

  function filteredUsers(){
    const query=search.value.trim().toLowerCase();
    return users.filter(user=>{
      const matchesSearch=!query||`${user.display_name} ${user.username}`.toLowerCase().includes(query);
      const matchesRole=roleFilter.value==='all'||user.role===roleFilter.value;
      const matchesStatus=statusFilter.value==='all'||(statusFilter.value==='active'?user.active:!user.active);
      return matchesSearch&&matchesRole&&matchesStatus;
    });
  }

  function render(){
    const visible=filteredUsers();
    const active=users.filter(user=>user.active).length;
    const admins=users.filter(user=>user.role==='admin'&&user.active).length;
    counts.innerHTML=`<span><strong>${users.length}</strong> total</span><span><strong>${active}</strong> active</span><span><strong>${admins}</strong> administrator${admins===1?'':'s'}</span>`;
    list.innerHTML='';
    visible.forEach(user=>list.append(userCard(user)));
    if(!visible.length){
      const empty=document.createElement('div');
      empty.className='admin-empty-state';
      empty.textContent=users.length?'No users match these filters.':'No user accounts were found.';
      list.append(empty);
    }
    status.textContent=visible.length===users.length?`${users.length} user account${users.length===1?'':'s'}.`:`Showing ${visible.length} of ${users.length} accounts.`;
  }

  async function load(notice=''){
    if(!session||session.user.role!=='admin')return;
    status.textContent='Loading users…';
    refresh.disabled=true;
    try{
      const response=await request('/api/admin/users');
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      users=data.items||[];
      render();
      if(notice)showToast(notice);
    }catch(error){
      status.textContent='Unable to load users: '+error.message;
      showToast('Unable to load user accounts.','error');
    }finally{refresh.disabled=false;}
  }

  function openCreate(){
    createForm.reset();
    createRole.value='editor';
    createStatus.textContent='Editors can manage media. Administrators can also manage users.';
    createStatus.className='status-box';
    openModal(createModal,createName);
  }

  function currentManageValues(){
    return {display_name:manageName.value.trim(),username:manageUsername.value.trim(),role:manageRole.value};
  }

  function syncSaveState(){
    const current=currentManageValues();
    const changed=manageOriginal&&Object.keys(current).some(key=>current[key]!==manageOriginal[key]);
    saveUser.disabled=!changed;
  }

  function openManage(userId){
    selectedUser=users.find(user=>String(user.id)===String(userId));
    if(!selectedUser)return;
    const self=selectedUser.id===session.user.id;
    manageTitle.textContent=selectedUser.display_name;
    manageSubtitle.textContent=`@${selectedUser.username}${self?' · This is your account':''}`;
    manageName.value=selectedUser.display_name;
    manageUsername.value=selectedUser.username;
    manageRole.value=selectedUser.role;
    manageRole.disabled=self;
    selfRoleNote.hidden=!self;
    manageOriginal=currentManageValues();
    manageMeta.innerHTML=`<span>Created: ${escapeHtml(dateLabel(selectedUser.created_at))}</span><span>Last sign-in: ${escapeHtml(dateLabel(selectedUser.last_login_at))}</span>`;
    manageStatus.textContent='';
    manageStatus.className='status-box';
    managePassword.value='';
    nonselfActions.hidden=self;
    toggleActive.textContent=selectedUser.active?'Disable account':'Enable account';
    toggleActive.className=selectedUser.active?'secondary':'primary';
    saveUser.disabled=true;
    openModal(manageModal,manageName);
  }

  function generatePassword(length=16){
    const groups=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%'];
    const all=groups.join('');
    const pick=chars=>{
      const value=new Uint32Array(1);
      crypto.getRandomValues(value);
      return chars[value[0]%chars.length];
    };
    const password=groups.map(pick);
    while(password.length<length)password.push(pick(all));
    for(let index=password.length-1;index>0;index--){
      const value=new Uint32Array(1);
      crypto.getRandomValues(value);
      const swap=value[0]%(index+1);
      [password[index],password[swap]]=[password[swap],password[index]];
    }
    return password.join('');
  }

  async function patchUser(body,workingMessage,successMessage){
    manageStatus.textContent=workingMessage;
    const response=await request('/api/admin/users/'+encodeURIComponent(selectedUser.id),{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
    closeModal(manageModal);
    await load(successMessage);
  }

  document.querySelector('[data-open-create-user]')?.addEventListener('click',openCreate);
  document.querySelectorAll('[data-close-user-modal]').forEach(button=>button.addEventListener('click',closeStandardModals));
  [createModal,manageModal].forEach(modal=>modal?.addEventListener('click',event=>{if(event.target===modal)closeStandardModals();}));
  confirmCancel?.addEventListener('click',()=>resolveConfirmation(false));
  confirmAccept?.addEventListener('click',()=>resolveConfirmation(true));

  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    if(!confirmModal.hidden)resolveConfirmation(false);
    else closeStandardModals();
  });

  document.querySelectorAll('[data-password-toggle]').forEach(button=>button.addEventListener('click',()=>{
    const input=button.parentElement.querySelector('input');
    const showing=input.type==='text';
    input.type=showing?'password':'text';
    button.textContent=showing?'Show':'Hide';
  }));

  document.querySelectorAll('[data-generate-password]').forEach(button=>button.addEventListener('click',()=>{
    const input=button.dataset.generatePassword==='create'?createPassword:managePassword;
    input.value=generatePassword();
    input.type='text';
    const toggle=input.parentElement.querySelector('[data-password-toggle]');
    if(toggle)toggle.textContent='Hide';
    input.focus();
    input.select();
  }));

  [search,roleFilter,statusFilter].forEach(control=>control?.addEventListener(control===search?'input':'change',render));
  refresh?.addEventListener('click',()=>load());
  list?.addEventListener('click',event=>{
    const button=event.target.closest('[data-manage-user]');
    if(button)openManage(button.dataset.manageUser);
  });
  [manageName,manageUsername,manageRole].forEach(control=>{
    control?.addEventListener('input',syncSaveState);
    control?.addEventListener('change',syncSaveState);
  });

  createForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    createButton.disabled=true;
    createStatus.textContent='Creating user…';
    createStatus.className='status-box';
    try{
      const response=await request('/api/admin/users',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({display_name:createName.value.trim(),username:createUsername.value.trim(),role:createRole.value,password:createPassword.value})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      closeModal(createModal);
      await load(`Created ${data.user.display_name}. They’ll change the temporary password at first sign-in.`);
    }catch(error){
      createStatus.textContent='Create failed: '+error.message;
      createStatus.className='status-box is-error';
    }finally{createButton.disabled=false;}
  });

  manageForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    if(saveUser.disabled)return;
    saveUser.disabled=true;
    try{
      await patchUser({action:'update',...currentManageValues()},'Saving changes…','Account changes saved.');
    }catch(error){
      manageStatus.textContent='Save failed: '+error.message;
      manageStatus.className='status-box is-error';
      syncSaveState();
    }
  });

  document.querySelector('[data-account-actions]')?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-manage-action]');
    if(!button||!selectedUser)return;
    const action=button.dataset.manageAction;
    button.disabled=true;
    try{
      if(action==='reset_password'){
        const password=managePassword.value;
        if(password.length<12)throw new Error('Temporary password must be at least 12 characters.');
        const approved=await confirmAction({title:'Reset password?',message:`This will sign ${selectedUser.display_name} out everywhere and require a password change at next sign-in.`,label:'Reset password'});
        if(!approved)return;
        await patchUser({action:'reset_password',password},'Resetting password…',`Password reset for ${selectedUser.display_name}.`);
      }else if(action==='toggle_active'){
        if(selectedUser.active){
          const approved=await confirmAction({title:'Disable account?',message:`${selectedUser.display_name} will immediately lose access and be signed out everywhere.`,label:'Disable account'});
          if(!approved)return;
          await patchUser({action:'disable'},'Disabling account…',`${selectedUser.display_name} has been disabled.`);
        }else{
          await patchUser({action:'enable'},'Enabling account…',`${selectedUser.display_name} has been enabled.`);
        }
      }else if(action==='delete'){
        const approved=await confirmAction({title:'Delete account permanently?',message:`Delete @${selectedUser.username}? This cannot be undone and will sign the user out everywhere.`,label:'Delete account'});
        if(!approved)return;
        manageStatus.textContent='Deleting account…';
        const response=await request('/api/admin/users/'+encodeURIComponent(selectedUser.id),{
          method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:selectedUser.username.trim().toLowerCase()})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
        const name=selectedUser.display_name;
        closeModal(manageModal);
        await load(`${name}’s account was deleted.`);
      }
    }catch(error){
      manageStatus.textContent='Action failed: '+error.message;
      manageStatus.className='status-box is-error';
    }finally{button.disabled=false;}
  });

  signOut?.addEventListener('click',async()=>{await auth.logout();location.href='index.html';});

  (async()=>{
    if(!auth.api){showAccess('Backend not configured.');return;}
    const state=await auth.status();
    if(state.needs_bootstrap){showAccess('Create the first Administrator through Media Manager before managing users.');return;}
    session=await auth.session();
    if(!session){showAccess('Sign in through Media Manager to manage users.');return;}
    if(session.user.must_change_password){showAccess('Change your password in Media Manager before continuing.');return;}
    if(session.user.role!=='admin'){showAccess('Administrator access is required to manage users.');return;}
    showWorkspace();
    await load();
  })();
})();
