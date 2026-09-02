(()=>{
  const frame=document.querySelector('[data-program-media]');
  if(!frame)return;
  const image=frame.querySelector('img');
  const category=frame.dataset.category||'';
  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  if(!image||!category||!api)return;
  const clean=value=>{
    const text=String(value||'').trim();
    return text&&!/^(test|testing|untitled|garbage|mass edited|you know what it is|veterans justice league photo)$/i.test(text)?text:'';
  };
  const source=item=>item.large_url||item.web_url||item.public_url||item.thumb_url||'';
  async function load(){
    try{
      frame.classList.add('is-loading');
      const response=await fetch(api.replace(/\/$/,'')+`/api/media?status=published&category=${encodeURIComponent(category)}&limit=6`);
      if(!response.ok)throw new Error('Media request failed');
      const data=await response.json();
      const item=(Array.isArray(data.items)?data.items:[]).find(entry=>source(entry));
      if(!item)throw new Error('No published program media');
      const preload=new Image();
      preload.onload=()=>{
        image.src=source(item);
        image.alt=clean(item.alt_text)||clean(item.caption)||'Veterans Justice League Housing program';
        frame.classList.add('has-media');
        frame.classList.remove('is-loading');
      };
      preload.onerror=()=>frame.classList.remove('is-loading');
      preload.src=source(item);
    }catch(error){frame.classList.remove('is-loading');}
  }
  load();
})();
