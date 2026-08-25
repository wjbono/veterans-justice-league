const inAdmin=location.pathname.includes('/admin/');
const ASSET_BASE=inAdmin?'../assets/':'assets/';
const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();

// SEO/social metadata and the shared QC stylesheet are generated statically during the Pages build.

// Basic document accessibility normalization.
const main=document.querySelector('main[id="main"]');
if(main&&!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');
document.querySelectorAll('.footer-logo').forEach(img=>{img.alt='';img.setAttribute('aria-hidden','true')});
document.querySelectorAll('a[target="_blank"]').forEach(link=>{
  link.rel='noopener noreferrer';
  if(!link.hasAttribute('aria-label')){
    const text=link.textContent.trim();
    if(text)link.setAttribute('aria-label',`${text} (opens in a new tab)`);
  }
});

const PLACEHOLDER_IMAGES=[
  'images/placeholders/hero.svg',
  'images/placeholders/gallery-1.svg',
  'images/placeholders/gallery-2.svg',
  'images/placeholders/gallery-3.svg',
  'images/placeholders/gallery-4.svg'
];

document.querySelectorAll('img').forEach((img,index)=>{
  const original=img.getAttribute('src')||'';
  const isLogo=img.classList.contains('logo')||img.classList.contains('footer-logo')||original.includes('vjl-logo');
  if(isLogo){
    img.src=ASSET_BASE+'images/vjl-logo.png';
    img.decoding='async';
    return;
  }
  const replacement=ASSET_BASE+PLACEHOLDER_IMAGES[index%PLACEHOLDER_IMAGES.length];
  if(/^https?:\/\//.test(original)||original.includes('googleusercontent.com')) img.src=replacement;
  if(!img.closest('.hero-photo')) img.loading=img.loading||'lazy';
  img.decoding='async';
  img.addEventListener('error',()=>{
    if(img.dataset.placeholderFallback==='1') return;
    img.dataset.placeholderFallback='1';
    img.src=replacement;
  });
});

// Normalize navigation and current-page state.
const currentFile=pageFile;
document.querySelectorAll('nav a').forEach(link=>{
  if(link.textContent.trim()==='Programs') link.setAttribute('href',inAdmin?'../programs.html':'programs.html');
  const href=(link.getAttribute('href')||'').split('#')[0].split('?')[0].toLowerCase();
  const target=href.split('/').pop();
  if(target&&target===currentFile){
    link.setAttribute('aria-current','page');
    link.classList.add('active');
  }
});

const menuButton=document.querySelector('[data-menu-button]');
const mobileMenu=document.querySelector('[data-mobile-menu]');
if(menuButton&&mobileMenu){
  mobileMenu.setAttribute('aria-hidden','true');
  const setMenu=open=>{
    mobileMenu.classList.toggle('open',open);
    mobileMenu.setAttribute('aria-hidden',open?'false':'true');
    menuButton.setAttribute('aria-expanded',open?'true':'false');
    menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    if(open){
      const first=mobileMenu.querySelector('a');
      if(first) first.focus();
    }
  };
  menuButton.addEventListener('click',()=>setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&mobileMenu.classList.contains('open')){
      setMenu(false);
      menuButton.focus();
    }
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>900&&mobileMenu.classList.contains('open')) setMenu(false);
  });
}
