(()=>{
  const roster=document.querySelector('[data-team-roster]');
  if(!roster)return;
  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const testCopy=/^(test|testing|untitled|garbage|mass edited|you know what it is|veterans justice league photo)$/i;
  const clean=value=>{
    const text=String(value||'').trim();
    return text&&!testCopy.test(text)?text:'';
  };
  const source=item=>item.web_url||item.large_url||item.public_url||item.thumb_url||'';
  function empty(){
    roster.innerHTML='';
    const box=document.createElement('div');
    box.className='team-roster-empty';
    const title=document.createElement('strong');
    title.textContent='Approved team profiles are coming soon.';
    const copy=document.createElement('p');
    copy.textContent='VJL has not yet published individual names and biographies for this page. Nothing has been filled in with placeholder people or invented roles.';
    const link=document.createElement('a');
    link.href='contact.html';
    link.textContent='Contact Veterans Justice League';
    box.append(title,copy,link);
    roster.append(box);
  }
  function render(items){
    roster.innerHTML='';
    items.forEach(item=>{
      const card=document.createElement('article');
      card.className='team-profile';
      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=source(item);
      image.alt=clean(item.alt_text)||clean(item.caption)||'Veterans Justice League team member';
      image.addEventListener('error',()=>card.remove(),{once:true});
      const body=document.createElement('div');
      const role=document.createElement('p');
      role.className='team-role';
      role.textContent='VJL Team';
      const name=document.createElement('h3');
      name.textContent=clean(item.caption)||'Veterans Justice League';
      const copy=document.createElement('p');
      copy.textContent=clean(item.alt_text)||'Published team profile';
      body.append(role,name,copy);
      card.append(image,body);
      roster.append(card);
    });
    if(!roster.children.length)empty();
  }
  async function load(){
    if(!api){empty();return;}
    try{
      const response=await fetch(api.replace(/\/$/,'')+'/api/media?status=published&category=team&limit=12');
      if(!response.ok)throw new Error('Team media request failed');
      const data=await response.json();
      const items=(Array.isArray(data.items)?data.items:[]).filter(item=>source(item));
      items.length?render(items):empty();
    }catch(error){empty();}
  }
  load();
})();
