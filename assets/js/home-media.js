(()=>{
  const strip=document.querySelector('[data-home-media]');
  const hero=document.querySelector('[data-home-hero]');
  if(!strip)return;

  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  const testCopy=/^(test|testing|untitled|garbage|mass edited|you know what it is|veterans justice league photo)$/i;
  const labels={housing:'Housing','behind-the-wall':'Training',outreach:'Outreach',events:'Events',team:'Team',partners:'Partners'};
  const categoryLabel=value=>labels[value]||'VJL Community';
  const clean=value=>{
    const text=String(value||'').trim();
    return text&&!testCopy.test(text)?text:'';
  };
  const imageUrl=item=>item.large_url||item.web_url||item.public_url||item.thumb_url||'';
  const thumbUrl=item=>item.thumb_url||item.web_url||item.public_url||item.large_url||'';
  const altText=item=>clean(item.alt_text)||clean(item.caption)||`${categoryLabel(item.category)} photo from Veterans Justice League`;
  const displayLabel=item=>clean(item.caption)||categoryLabel(item.category);

  function showMessage(title,body){
    strip.innerHTML='';
    const box=document.createElement('div');
    box.className='home-media-empty';
    const strong=document.createElement('strong');
    strong.textContent=title;
    const text=document.createElement('span');
    text.textContent=body;
    const link=document.createElement('a');
    link.href='gallery.html';
    link.textContent='Visit the Gallery';
    box.append(strong,text,link);
    strip.append(box);
  }

  function updateHero(item){
    if(!hero||!item)return;
    const image=hero.querySelector('img');
    const src=imageUrl(item);
    if(!image||!src)return;
    hero.classList.add('is-loading');
    const preload=new Image();
    preload.onload=()=>{
      image.src=src;
      image.alt=altText(item);
      hero.classList.remove('is-loading');
    };
    preload.onerror=()=>hero.classList.remove('is-loading');
    preload.src=src;
  }

  function render(items){
    strip.innerHTML='';
    items.forEach(item=>{
      const src=thumbUrl(item);
      if(!src)return;
      const tile=document.createElement('a');
      tile.className='gallery-tile';
      tile.href='gallery.html';
      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=src;
      image.alt=altText(item);
      image.addEventListener('error',()=>tile.remove(),{once:true});
      const label=document.createElement('span');
      label.textContent=displayLabel(item);
      tile.append(image,label);
      strip.append(tile);
    });
    if(!strip.children.length)showMessage('Photos are coming soon.','Published VJL moments will appear here.');
  }

  async function load(){
    if(!api){
      showMessage('Recent photos are temporarily unavailable.','You can still explore the full gallery.');
      return;
    }
    try{
      const response=await fetch(api.replace(/\/$/,'')+'/api/media?status=published&limit=8');
      if(!response.ok)throw new Error('Media request failed');
      const data=await response.json();
      const items=(Array.isArray(data.items)?data.items:[]).filter(item=>thumbUrl(item)).slice(0,4);
      if(!items.length){
        showMessage('Photos are coming soon.','Published VJL moments will appear here.');
        return;
      }
      updateHero(items[0]);
      render(items);
    }catch(error){
      showMessage('Recent photos are temporarily unavailable.','You can still explore the full gallery.');
    }
  }

  load();
})();
