(()=>{
  const grid=document.querySelector('[data-gallery-groups]');
  const modal=document.querySelector('[data-gallery-modal]');
  const pageShell=document.querySelector('.site');
  if(!grid||!modal)return;

  const modalTitle=modal.querySelector('[data-gallery-title]');
  const modalImage=modal.querySelector('[data-gallery-image]');
  const modalCaption=modal.querySelector('[data-gallery-caption]');
  const modalCounter=modal.querySelector('[data-gallery-counter]');
  const closeButton=modal.querySelector('[data-gallery-close]');
  const prevButton=modal.querySelector('[data-gallery-prev]');
  const nextButton=modal.querySelector('[data-gallery-next]');
  const viewport=modal.querySelector('[data-gallery-viewport]');

  let galleries=[];
  let activeGallery=null;
  let activeIndex=0;
  let lastFocus=null;
  let touchStartX=null;

  const normalizeGallery=(gallery,index)=>({
    id:gallery.id||gallery.slug||`gallery-${index+1}`,
    title:gallery.title||gallery.name||gallery.category||'Veterans Justice League',
    description:gallery.description||'',
    category:gallery.category||gallery.id||'',
    cover:gallery.cover||gallery.cover_url||gallery.items?.[0]?.url||'',
    items:(gallery.items||gallery.media||[]).map(item=>({
      url:item.public_url||item.url||item.large_url||item.web_url||'',
      caption:item.caption||item.title||gallery.title||'Veterans Justice League',
      alt:item.alt_text||item.alt||item.caption||'Veterans Justice League photo'
    })).filter(item=>item.url)
  });

  async function loadGalleries(){
    const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
    if(api){
      try{
        const response=await fetch(api.replace(/\/$/,'')+'/api/galleries?status=published');
        if(response.ok){
          const data=await response.json();
          const source=data.galleries||data.items||[];
          galleries=source.map(normalizeGallery).filter(gallery=>gallery.items.length);
        }
      }catch(error){
        console.warn('Gallery API unavailable; using local gallery preview.',error);
      }
    }
    if(!galleries.length){
      galleries=((window.VJL_CONFIG&&window.VJL_CONFIG.STATIC_GALLERIES)||[]).map(normalizeGallery);
    }
    renderGalleries();
  }

  function renderGalleries(){
    grid.innerHTML='';
    if(!galleries.length){
      grid.innerHTML='<div class="status-box">No published galleries are available yet.</div>';
      return;
    }

    galleries.forEach(gallery=>{
      const available=gallery.items.length>0;
      const card=document.createElement(available?'button':'div');
      if(available)card.type='button';
      card.className='gallery-group-card'+(available?'':' gallery-group-card-empty');
      card.dataset.galleryId=gallery.id;
      if(available){
        card.setAttribute('aria-label',`Open ${gallery.title} gallery, ${gallery.items.length} photo${gallery.items.length===1?'':'s'}`);
      }

      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=gallery.cover||gallery.items[0]?.url||'';
      image.alt='';

      const body=document.createElement('span');
      body.className='gallery-group-body';
      const title=document.createElement('strong');
      title.textContent=gallery.title;
      const description=document.createElement('span');
      description.textContent=gallery.description;
      const count=document.createElement('span');
      count.className='gallery-group-count';
      count.textContent=available
        ? `${gallery.items.length} photo${gallery.items.length===1?'':'s'} · Open gallery`
        : 'Approved photos coming soon';

      body.append(title,description,count);
      card.append(image,body);
      if(available)card.addEventListener('click',()=>openGallery(gallery,0,card));
      grid.append(card);
    });
  }

  function openGallery(gallery,index=0,trigger=null){
    if(!gallery||!gallery.items.length)return;
    activeGallery=gallery;
    activeIndex=Math.max(0,Math.min(index,gallery.items.length-1));
    lastFocus=trigger||document.activeElement;
    modal.hidden=false;
    document.body.classList.add('modal-open');
    if(pageShell){pageShell.inert=true;pageShell.setAttribute('aria-hidden','true')}
    updateModal();
    requestAnimationFrame(()=>closeButton?.focus());
  }

  function closeGallery(){
    modal.hidden=true;
    document.body.classList.remove('modal-open');
    if(pageShell){pageShell.inert=false;pageShell.removeAttribute('aria-hidden')}
    const focusTarget=lastFocus;
    activeGallery=null;
    activeIndex=0;
    if(focusTarget&&typeof focusTarget.focus==='function')focusTarget.focus();
  }

  function preloadNeighbor(offset){
    if(!activeGallery||activeGallery.items.length<2)return;
    const i=(activeIndex+offset+activeGallery.items.length)%activeGallery.items.length;
    const nextImage=new Image();
    nextImage.src=activeGallery.items[i].url;
  }

  function updateModal(){
    if(!activeGallery)return;
    const item=activeGallery.items[activeIndex];
    modalTitle.textContent=activeGallery.title;
    modalImage.decoding='async';
    modalImage.src=item.url;
    modalImage.alt=item.alt||item.caption||'Veterans Justice League photo';
    modalCaption.textContent=item.caption||'';
    modalCounter.textContent=`${activeIndex+1} of ${activeGallery.items.length}`;
    const multiple=activeGallery.items.length>1;
    prevButton.hidden=!multiple;
    nextButton.hidden=!multiple;
    if(multiple){preloadNeighbor(1);preloadNeighbor(-1)}
  }

  function previous(){
    if(!activeGallery)return;
    activeIndex=(activeIndex-1+activeGallery.items.length)%activeGallery.items.length;
    updateModal();
  }

  function next(){
    if(!activeGallery)return;
    activeIndex=(activeIndex+1)%activeGallery.items.length;
    updateModal();
  }

  closeButton?.addEventListener('click',closeGallery);
  prevButton?.addEventListener('click',previous);
  nextButton?.addEventListener('click',next);

  modal.addEventListener('click',event=>{
    if(event.target===modal)closeGallery();
  });

  document.addEventListener('keydown',event=>{
    if(modal.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeGallery();}
    if(event.key==='ArrowLeft'){event.preventDefault();previous();}
    if(event.key==='ArrowRight'){event.preventDefault();next();}
    if(event.key==='Tab'){
      const focusable=[...modal.querySelectorAll('button:not([hidden])')].filter(el=>!el.disabled);
      if(!focusable.length)return;
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });

  viewport?.addEventListener('touchstart',event=>{
    touchStartX=event.changedTouches[0]?.clientX??null;
  },{passive:true});
  viewport?.addEventListener('touchend',event=>{
    if(touchStartX===null)return;
    const endX=event.changedTouches[0]?.clientX??touchStartX;
    const delta=endX-touchStartX;
    touchStartX=null;
    if(Math.abs(delta)<45)return;
    if(delta>0)previous();else next();
  },{passive:true});

  loadGalleries();
})();
