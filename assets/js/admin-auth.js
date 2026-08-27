(()=>{
  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const SESSION_KEY='vjl_admin_session';
  const endpoint=path=>api.replace(/\/$/,'')+path;
  const token=()=>localStorage.getItem(SESSION_KEY)||'';
  const setToken=value=>value?localStorage.setItem(SESSION_KEY,value):localStorage.removeItem(SESSION_KEY);

  async function parse(response){
    return response.json().catch(()=>({}));
  }

  async function request(path,options={}){
    if(!api)throw new Error('Backend not configured.');
    const headers=new Headers(options.headers||{});
    const current=token();
    if(current)headers.set('Authorization','Bearer '+current);
    const response=await fetch(endpoint(path),{...options,headers});
    if(response.status===401)setToken('');
    return response;
  }

  async function status(){
    if(!api)return {ok:false,error:'Backend not configured.'};
    const response=await fetch(endpoint('/api/auth/status'));
    const data=await parse(response);
    return {...data,http_ok:response.ok};
  }

  async function session(){
    if(!token())return null;
    const response=await request('/api/auth/session');
    if(!response.ok)return null;
    return parse(response);
  }

  async function login(username,password){
    const response=await fetch(endpoint('/api/auth/login'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password})
    });
    const data=await parse(response);
    if(response.ok&&data.token)setToken(data.token);
    return {response,data};
  }

  async function bootstrap(setupKey,displayName,username,password){
    const response=await fetch(endpoint('/api/auth/bootstrap'),{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+setupKey},
      body:JSON.stringify({display_name:displayName,username,password})
    });
    const data=await parse(response);
    if(response.ok&&data.token)setToken(data.token);
    return {response,data};
  }

  async function changePassword(currentPassword,newPassword){
    const response=await request('/api/auth/change-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({current_password:currentPassword,new_password:newPassword})
    });
    const data=await parse(response);
    if(response.ok&&data.token)setToken(data.token);
    return {response,data};
  }

  async function logout(){
    try{if(token())await request('/api/auth/logout',{method:'POST'});}catch(error){}
    setToken('');
  }

  window.VJL_AUTH={api,endpoint,token,setToken,request,status,session,login,bootstrap,changePassword,logout,parse};
})();
