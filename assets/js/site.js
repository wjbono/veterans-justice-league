const PLACEHOLDER_IMAGES=[
  'assets/images/placeholders/hero.svg',
  'assets/images/placeholders/gallery-1.svg',
  'assets/images/placeholders/gallery-2.svg',
  'assets/images/placeholders/gallery-3.svg',
  'assets/images/placeholders/gallery-4.svg'
];

document.querySelectorAll('img').forEach((img,index)=>{
  const original=img.getAttribute('src')||'';
  const isLogo=img.classList.contains('logo')||img.classList.contains('footer-logo')||original.includes('vjl-logo');
  if(isLogo){
    img.src=original.startsWith('../')?'../assets/images/vjl-logo.png':'assets/images/vjl-logo.png';
    return;
  }
  const prefix=original.startsWith('../')?'../':'';
  const replacement=prefix+PLACEHOLDER_IMAGES[index%PLACEHOLDER_IMAGES.length];
  if(/^https?:\/\//.test(original)||original.includes('googleusercontent.com')) img.src=replacement;
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
