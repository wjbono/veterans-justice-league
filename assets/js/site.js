const inAdmin=location.pathname.includes('/admin/');
const ASSET_BASE=inAdmin?'../assets/':'assets/';
const pageFile=(location.pathname.split('/').pop()||'index.html').toLowerCase();

// Load the shared responsive/accessibility QC layer on every page.
const qcStyles=document.createElement('link');
qcStyles.rel='stylesheet';
qcStyles.href=ASSET_BASE+'css/qc.css?v=20260824-2026';
document.head.append(qcStyles);

// Shared launch metadata for public pages. Canonicals point to the intended production domain so the temporary GitHub Pages preview is not treated as authoritative.
if(!inAdmin&&pageFile!=='404.html'){
  const PROD_BASE='https://www.veteransjusticeleague.com';
  const PREVIEW_IMAGE='https://wjbono.github.io/veterans-justice-league/assets/images/vjl-logo.png';
  const canonicalPath=pageFile==='index.html'?'/':'/'+pageFile;
  function upsertMeta(selector,attrs){let el=document.head.querySelector(selector);if(!el){el=document.createElement('meta');document.head.append(el)}Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));return el}
  let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=PROD_BASE+canonicalPath;
  const desc=document.head.querySelector('meta[name="description"]')?.content||'Veterans Justice League supports justice-involved Veterans through housing, advocacy, outreach, and prevention work with active-duty service members.';
  upsertMeta('meta[property="og:title"]',{property:'og:title',content:document.title});
  upsertMeta('meta[property="og:description"]',{property:'og:description',content:desc});
  upsertMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
  upsertMeta('meta[property="og:url"]',{property:'og:url',content:PROD_BASE+canonicalPath});
  upsertMeta('meta[property="og:image"]',{property:'og:image',content:PREVIEW_IMAGE});
  upsertMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'Veterans Justice League'});
  upsertMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});
  upsertMeta('meta[name="twitter:title"]',{name:'twitter:title',content:document.title});
  upsertMeta('meta[name="twitter:description"]',{name:'twitter:description',content:desc});
  upsertMeta('meta[name="twitter:image"]',{name:'twitter:image',content:PREVIEW_IMAGE});
  upsertMeta('meta[name="theme-color"]',{name:'theme-color',content:'#3b7d23'});
  let favicon=document.head.querySelector('link[rel="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/png';favicon.href=ASSET_BASE+'images/vjl-logo.png';document.head.append(favicon)}
  if(pageFile==='index.html'&&!document.getElementById('vjl-org-schema')){const s=document.createElement('script');s.id='vjl-org-schema';s.type='application/ld+json';s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:'Veterans Justice League',url:PROD_BASE+'/',logo:PROD_BASE+'/assets/images/vjl-logo.png',telephone:'+1-719-306-8947',address:{'@type':'PostalAddress',streetAddress:'3617 Betty Dr. STE G',addressLocality:'Colorado Springs',addressRegion:'CO',postalCode:'80917',addressCountry:'US'}});document.head.append(s)}
}else{
  let favicon=document.head.querySelector('link[rel="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/png';favicon.href=ASSET_BASE+'images/vjl-logo.png';document.head.append(favicon)}
}

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
