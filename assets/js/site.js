const VJL_LOGO_URL='https://trademarks.justia.com/media/image.php?serial=98564453';
const PLACEHOLDER_IMAGES=[
  'https://images.unsplash.com/photo-1771340590660-61ffd7937f88?auto=format&fit=crop&w=1600&q=82',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82'
];

document.querySelectorAll('img').forEach((img,index)=>{
  const original=img.getAttribute('src')||'';
  const isLogo=img.classList.contains('logo')||img.classList.contains('footer-logo')||original.includes('vjl-logo');
  if(isLogo){
    img.src=VJL_LOGO_URL;
    img.referrerPolicy='no-referrer';
    return;
  }
  const replacement=PLACEHOLDER_IMAGES[index%PLACEHOLDER_IMAGES.length];
  if(original.includes('googleusercontent.com')) img.src=replacement;
  img.addEventListener('error',()=>{
    if(img.dataset.placeholderFallback==='1') return;
    img.dataset.placeholderFallback='1';
    img.src=replacement;
  });
});

const menuButton=document.querySelector('[data-menu-button]');
const mobileMenu=document.querySelector('[data-mobile-menu]');
if(menuButton&&mobileMenu){
  menuButton.addEventListener('click',()=>{
    const open=mobileMenu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',open?'true':'false');
  });
  mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    mobileMenu.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
  }));
}
