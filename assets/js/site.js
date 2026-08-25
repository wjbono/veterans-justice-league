const ASSET_BASE=location.pathname.includes('/admin/')?'../assets/':'assets/';
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
    return;
  }
  const replacement=ASSET_BASE+PLACEHOLDER_IMAGES[index%PLACEHOLDER_IMAGES.length];
  if(/^https?:\/\//.test(original)||original.includes('googleusercontent.com')) img.src=replacement;
  img.addEventListener('error',()=>{
    if(img.dataset.placeholderFallback==='1') return;
    img.dataset.placeholderFallback='1';
    img.src=replacement;
  });
});

// Older page shells pointed the Programs navigation item directly to Housing.
// Keep every rendered desktop/mobile Programs link routed through the program landing page.
document.querySelectorAll('nav a').forEach(link=>{
  if(link.textContent.trim()==='Programs')link.setAttribute('href',location.pathname.includes('/admin/')?'../programs.html':'programs.html');
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
