(()=>{
  const grid=document.querySelector('[data-gallery-groups]');
  const modal=document.querySelector('[data-gallery-modal]');
  const pageShell=document.querySelector('.site');
  if(!grid||!modal)return;

  const modalTitle=modal.querySelector('[data-gallery-title]');
  const modalImage=modal.querySelector('[data-gallery-image]');
  const imageShell=modal.querySelector('[data-gallery-image-shell]');
  const imageError=modal.querySelector('[data-gallery-image-error]');
  const modalCaption=modal.querySelector('[data-gallery-caption]');
  const modalCounter=modal.querySelector('[data-gallery-counter]');
  const thumbnails=modal.querySelector('[data-gallery-thumbnails]');
  const closeButton=modal.querySelector('[data-gallery-close]');
  const prevButton=modal.querySelector('[data-gallery-prev]');
  const nextButton=modal.querySelector('[data-gallery-next]');
  const viewport=modal.querySelector('[data-gallery-viewport]');

  let galleries=[];
  let activeGallery=null;
  let activeIndex=0;
  let lastFocus=null;
  let touchStartX=null;
  let loadSequence=0;

  const genericText=/^(test|testing|untitled|veterans justice league photo)$/i;
  const cleanText=value=>{
    const text=String(value||'').trim();
    return !text||genericText.test(text)?'':text;
  };

  const normalizeGallery=(gallery,index)=>{
    const title=gallery.title||gallery.name||gallery.category||'Veterans Justice League';
    const items=(gallery.items||gallery.media||[]).map((item,itemIndex)=>{
      const web=item.public_url||item.web_url||item.url||item.large_url||item.thumb_url||'';
      const caption=cleanText(item.caption||item.title);
      const suppliedAlt=cleanText(item.alt_text||item.alt);
      return {
        thumb:item.thumb_url||web,
        url:item.large_url||web,
        caption,
        alt:suppliedAlt||caption||`${title} photo ${itemIndex+1}`
      };
    }).filter(item=>item.url);
    return {
      id:gallery.id||gallery.slug||`gallery-${index+1}`,
      title,
      description:gallery.description||'',
      category:gallery.category||gallery.id||'',
      cover:gallery.cover||gallery.cover_url||items[0]?.thumb||items[0]?.url||'',
      items
    };
  };

  function renderMessage(message,{error=false,retry=false}={}){
    grid.innerHTML='';
    const panel=document.createElement('div');
    panel.className='gallery-message'+(error?' is-error':'');
    const heading=document.createElement('strong');
    heading.textContent=error?'Gallery temporarily unavailable':'No published galleries yet';
    const copy=document.createElement('span');
    copy.textContent=message;
    panel.append(heading,copy);
    if(retry){
      const button=document.createElement('button');
      button.type='button';
      button.textContent='Try again';
      button.addEventListener('click',loadGalleries);
      panel.append(button);
    }
    grid.append(panel);
  }

  async function loadGalleries(){
    grid.innerHTML='<div class="gallery-loading-state"><span class="gallery-spinner" aria-hidden="true"></span><span>Loading galleries…</span></div>';
    const api=(window.VJL_CONFIG&&window.VJL_CONFIG.API_BASE)||'';
    if(!api){
      galleries=((window.VJL_CONFIG&&window.VJL_CONFIG.STATIC_GALLERIES)||[]).map(normalizeGallery).filter(gallery=>gallery.items.length);
      renderGalleries();
      return;
    }
    try{
      const response=await fetch(api.replace(/\/$/,'')+'/api/galleries?status=published');
      if(!response.ok)throw new Error('Gallery service returned '+response.status);
      const data=await response.json();
      const source=data.galleries||data.items||[];
      galleries=source.map(normalizeGallery).filter(gallery=>gallery.items.length);
      renderGalleries();
    }catch(error){
      galleries=[];
      renderMessage('Please try again in a moment.',{error:true,retry:true});
    }
  }

  function renderGalleries(){
    grid.innerHTML='';
    if(!galleries.length){
      renderMessage('Published photos will appear here as they become available.');
      return;
    }

    galleries.forEach(gallery=>{
      const card=document.createElement('button');
      card.type='button';
      card.className='gallery-group-card';
      card.dataset.galleryId=gallery.id;
      card.setAttribute('aria-label',`Open ${gallery.title} gallery, ${gallery.items.length} photo${gallery.items.length===1?'':'s'}`);

      const media=document.createElement('span');
      media.className='gallery-card-media';
      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=gallery.cover||gallery.items[0]?.thumb||gallery.items[0]?.url||'';
      image.alt='';
      image.addEventListener('error',()=>media.classList.add('has-image-error'),{once:true});
      const count=document.createElement('span');
      count.className='gallery-card-count';
      count.textContent=`${gallery.items.length} photo${gallery.items.length===1?'':'s'}`;
      const action=document.createElement('span');
      action.className='gallery-card-action';
      action.textContent='View gallery →';
      media.append(image,count,action);

      const body=document.createElement('span');
      body.className='gallery-group-body';
      const title=document.createElement('strong');
      title.textContent=gallery.title;
      const description=document.createElement('span');
      description.textContent=gallery.description;
      body.append(title,description);
      card.append(media,body);
      card.addEventListener('click',()=>openGallery(gallery,0,card));
      grid.append(card);
    });
  }

  function renderThumbnails(){
    thumbnails.innerHTML='';
    if(!activeGallery||activeGallery.items.length<2){
      thumbnails.hidden=true;
      return;
    }
    thumbnails.hidden=false;
    activeGallery.items.forEach((item,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='gallery-thumbnail';
      button.dataset.galleryThumbnail=String(index);
      button.setAttribute('aria-label',`View photo ${index+1}${item.caption?`: ${item.caption}`:''}`);
      const image=document.createElement('img');
      image.loading='lazy';
      image.decoding='async';
      image.src=item.thumb||item.url;
      image.alt='';
      image.addEventListener('error',()=>button.classList.add('has-image-error'),{once:true});
      button.append(image);
      button.addEventListener('click',()=>{
        activeIndex=index;
        updateModal();
      });
      thumbnails.append(button);
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
    modalTitle.textContent=gallery.title;
    renderThumbnails();
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
    loadSequence++;
    if(focusTarget&&typeof focusTarget.focus==='function')focusTarget.focus();
  }

  function preloadNeighbor(offset){
    if(!activeGallery||activeGallery.items.length<2)return;
    const index=(activeIndex+offset+activeGallery.items.length)%activeGallery.items.length;
    const nextImage=new Image();
    nextImage.src=activeGallery.items[index].url;
  }

  function setImageLoaded(sequence){
    if(sequence!==loadSequence)return;
    imageShell.classList.remove('is-loading','has-error');
    imageError.hidden=true;
  }

  function setImageError(sequence){
    if(sequence!==loadSequence)return;
    imageShell.classList.remove('is-loading');
    imageShell.classList.add('has-error');
    imageError.hidden=false;
  }

  function updateModal(){
    if(!activeGallery)return;
    const item=activeGallery.items[activeIndex];
    const sequence=++loadSequence;
    imageShell.classList.add('is-loading');
    imageShell.classList.remove('has-error');
    imageError.hidden=true;
    modalImage.onload=()=>setImageLoaded(sequence);
    modalImage.onerror=()=>setImageError(sequence);
    modalImage.alt=item.alt;
    modalImage.src=item.url;
    if(modalImage.complete){
      if(modalImage.naturalWidth)setImageLoaded(sequence);
      else setImageError(sequence);
    }
    modalCaption.textContent=item.caption;
    modalCaption.hidden=!item.caption;
    modalCounter.textContent=`${activeIndex+1} of ${activeGallery.items.length}`;
    const multiple=activeGallery.items.length>1;
    prevButton.hidden=!multiple;
    nextButton.hidden=!multiple;
    thumbnails.querySelectorAll('[data-gallery-thumbnail]').forEach((button,index)=>{
      const current=index===activeIndex;
      button.classList.toggle('is-current',current);
      if(current){button.setAttribute('aria-current','true');button.scrollIntoView({block:'nearest',inline:'center'});}
      else button.removeAttribute('aria-current');
    });
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
  modal.addEventListener('click',event=>{if(event.target===modal)closeGallery();});

  document.addEventListener('keydown',event=>{
    if(modal.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closeGallery();return;}
    if(event.key==='ArrowLeft'){event.preventDefault();previous();return;}
    if(event.key==='ArrowRight'){event.preventDefault();next();return;}
    if(event.key==='Tab'){
      const focusable=[...modal.querySelectorAll('button:not([hidden])')].filter(element=>!element.disabled);
      if(!focusable.length)return;
      const first=focusable[0];
      const last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });

  viewport?.addEventListener('touchstart',event=>{touchStartX=event.changedTouches[0]?.clientX??null;},{passive:true});
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
