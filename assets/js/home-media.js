(()=>{
  const strip=document.querySelector('.gallery-strip');
  if(!strip)return;
  const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
  if(!api)return;

  const categoryLabel=value=>({
    housing:'Housing',
    'behind-the-wall':'Training',
    outreach:'Outreach',
    events:'Events',
    team:'Team',
    partners:'Partners'
  }[value]||'VJL');

  async function loadRecentMedia(){
    try{
      const response=await fetch(api.replace(/\/$/,'')+'/api/media?status=published&limit=4');
      if(!response.ok)return;
      const data=await response.json();
      const items=(data.items||[]).slice(0,4);
      if(!items.length)return;
      const tiles=[...strip.querySelectorAll('.gallery-tile')];
      items.forEach((item,index)=>{
        const tile=tiles[index];
        if(!tile)return;
        const image=tile.querySelector('img');
        const label=tile.querySelector('span');
        const src=item.thumb_url||item.public_url||item.web_url||item.large_url;
        if(src)image.src=src;
        image.alt=item.alt_text||item.caption||`${categoryLabel(item.category)} photo from Veterans Justice League`;
        label.textContent=item.caption||categoryLabel(item.category);
      });
      const intro=document.querySelector('.section-head .section-intro');
      if(intro)intro.textContent='Recent published photos from Veterans Justice League.';
    }catch(error){}
  }

  loadRecentMedia();
})();
