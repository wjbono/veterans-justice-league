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
  const createForm=document.querySelector('[data-user-create-form]');
  const createName=document.querySelector('[data-create-name]');
  const createUsername=document.querySelector('[data-create-username]');
  const createRole=document.querySelector('[data-create-role]');
  const createPassword=document.querySelector('[data-create-password]');
  const createButton=document.querySelector('[data-create-user]');
  const createStatus=document.querySelector('[data-create-status]');
  let session=null;

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
    if(response.status===401){showAccess('Your session expired. Sign in again through Media Manager.');}
    if(response.status===403){
      const data=await response.clone().json().catch(()=>({}));
      if(data.code==='PASSWORD_CHANGE_REQUIRED')showAccess('You must change your password in Media Manager before continuing.');
      else showAccess('Administrator access is required to manage users.');
    }
    return response;
  }

  function userCard(user){
    const self=user.id===session.user.id;
    const card=document.createElement('article');
    card.className='admin-user-card';
    card.dataset.userId=user.id;
    const statusText=user.active?'Active':'Disabled';
    card.innerHTML=`
      <div class="admin-user-summary">
        <div>
          <strong>${escapeHtml(user.display_name)}</strong>
          <span>@${escapeHtml(user.username)}</span>
        </div>
        <div class="admin-user-badges">
          <span class="admin-user-role">${roleLabel(user.role)}</span>
          <span class="admin-user-state ${user.active?'is-active':'is-disabled'}">${statusText}</span>
          ${user.must_change_password?'<span class="admin-user-state is-warning">Password change required</span>':''}
          ${self?'<span class="admin-user-state">Current account</span>':''}
        </div>
      </div>
      <div class="admin-user-fields">
        <label>Name<input type="text" data-user-name value="${escapeHtml(user.display_name)}" maxlength="100"></label>
        <label>Username<input type="text" data-user-username value="${escapeHtml(user.username)}" pattern="[A-Za-z0-9._-]{3,64}"></label>
        <label>Role<select data-user-role ${self?'disabled':''}><option value="editor" ${user.role==='editor'?'selected':''}>Editor</option><option value="admin" ${user.role==='admin'?'selected':''}>Administrator</option></select></label>
      </div>
      <div class="admin-user-meta"><span>Created: ${escapeHtml(dateLabel(user.created_at))}</span><span>Last sign-in: ${escapeHtml(dateLabel(user.last_login_at))}</span></div>
      <div class="admin-user-actions">
        <button class="secondary" type="button" data-user-action="save">Save account</button>
        ${self?'':`<button class="secondary" type="button" data-user-action="${user.active?'disable':'enable'}">${user.active?'Disable':'Enable'} account</button>`}
        <div class="admin-reset-group"><input type="password" data-user-reset-password placeholder="New temporary password" minlength="12" autocomplete="new-password"><button class="secondary" type="button" data-user-action="reset_password">Reset password</button></div>
        ${self?'':'<button class="danger" type="button" data-user-action="delete">Delete account</button>'}
      </div>
      <div class="status-box admin-user-message" data-user-message role="status"></div>`;
    return card;
  }

  async function load(){
    if(!session||session.user.role!=='admin')return;
    status.textContent='Loading users…';
    try{
      const response=await request('/api/admin/users');
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      list.innerHTML='';
      (data.items||[]).forEach(user=>list.append(userCard(user)));
      status.textContent=`${(data.items||[]).length} user account(s).`;
    }catch(error){status.textContent='Unable to load users: '+error.message;}
  }

  createForm?.addEventListener('submit',async event=>{
    event.preventDefault();
    createButton.disabled=true;createStatus.textContent='Creating user…';
    try{
      const response=await request('/api/admin/users',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({display_name:createName.value,username:createUsername.value,role:createRole.value,password:createPassword.value})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      createStatus.textContent=`Created ${data.user.display_name}. They must change the temporary password at first sign-in.`;
      createForm.reset();
      createRole.value='editor';
      await load();
    }catch(error){createStatus.textContent='Create failed: '+error.message;}
    finally{createButton.disabled=false;}
  });

  list?.addEventListener('click',async event=>{
    const button=event.target.closest('[data-user-action]');
    if(!button)return;
    const card=button.closest('.admin-user-card');
    const userId=card.dataset.userId;
    const message=card.querySelector('[data-user-message]');
    const action=button.dataset.userAction;
    button.disabled=true;
    try{
      if(action==='delete'){
        const username=card.querySelector('[data-user-username]').value.trim().toLowerCase();
        if(!confirm(`Delete ${username}? This removes the account and signs it out everywhere.`))return;
        message.textContent='Deleting account…';
        const response=await request('/api/admin/users/'+encodeURIComponent(userId),{
          method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:username})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
        await load();
        return;
      }

      let body={action};
      if(action==='save'){
        body={action:'update',display_name:card.querySelector('[data-user-name]').value,username:card.querySelector('[data-user-username]').value,role:card.querySelector('[data-user-role]').value};
      }else if(action==='reset_password'){
        const password=card.querySelector('[data-user-reset-password]').value;
        if(password.length<12)throw new Error('Temporary password must be at least 12 characters.');
        if(!confirm('Reset this user’s password and sign them out on all devices?'))return;
        body.password=password;
      }else if(action==='disable'){
        if(!confirm('Disable this account and sign it out on all devices?'))return;
      }

      message.textContent='Updating account…';
      const response=await request('/api/admin/users/'+encodeURIComponent(userId),{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      if(action==='reset_password')message.textContent='Password reset. The user must change it at next sign-in.';
      else message.textContent='Account updated.';
      await load();
    }catch(error){message.textContent='Update failed: '+error.message;}
    finally{button.disabled=false;}
  });

  refresh?.addEventListener('click',load);
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
