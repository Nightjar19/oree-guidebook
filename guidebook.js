// V14 : les images sont hébergées en fichiers indépendants, auprès du moteur.
// Le dossier assets/ doit être à côté de guidebook.js sur l’hébergement choisi.
const GUIDEBOOK_BASE = new URL('.', document.currentScript.src);
const ART_KEYS = ['scenery','tower','city','architecture','book','archive','garden'];
const CUSTOM_ART = Object.fromEntries(ART_KEYS.map(key => [key, '']));
const getArt = key => CUSTOM_ART[key] || new URL('assets/' + key + '.webp', GUIDEBOOK_BASE).href;

document.querySelectorAll('[data-img]').forEach(el=>el.style.backgroundImage=`url("${getArt(el.dataset.img)}")`);
const SECTIONS=[
['I — Administration','✦',[['reglement','Règlement'],['faq','Foire aux questions']]],
['II — L’Orée','☾',[['contexte','Le Contexte'],['lore','Le lore et l’Univers'],['niveaux','Les niveaux et l’Éveil des Souvenirs'],['foi','La Foi d’Elyra et le Chant des Cloches'],['points','Les Points Souvenirs et les Échos'],['bestiaire','Bestiaire'],['pnj','Les PNJ'],['lore-plus','Pour aller plus loin']]],
['III — Créer son personnage','✧',[['amnesie','Les Souvenirs et l’Amnésie'],['magie','Comprendre la magie à Elyra'],['groupes','Les Groupes'],['guildes','Les Guildes'],['pp','Les PP'],['personnage-plus','Pour aller plus loin']]],
['IV — La vie RP','♧',[['quetes-monde','Les Quêtes Monde'],['quetes-personnage','Les Quêtes Personnage'],['quetes-voyageurs','Les Quêtes Voyageurs'],['boutiques','Les Boutiques'],['mecaniques','Les Mécaniques Immersives']]],
['V — Les Cartes','✣',[['carte-brume','L’Orée et sa Brume'],['carte-sans-brume','L’Orée découverte sans Brume'],['carte-elyra','Elyra, la Cité des Cloches']]]
];
const entries=SECTIONS.flatMap(([section,,items],group)=>items.map(([id,title],order)=>({id,title,section,group,order})));
const $=id=>document.getElementById(id);
const menu=$('menu');SECTIONS.forEach(([heading,symbol,items],i)=>{const group=document.createElement('div');group.className='nav-group';const btn=document.createElement('button');btn.className='nav-heading';btn.type='button';btn.setAttribute('aria-expanded',i===1?'true':'false');btn.innerHTML=`<span class="ico">${symbol}</span><span>${heading}</span><span class="chev">⌄</span>`;const list=document.createElement('div');list.className='nav-items';list.hidden=i!==1;items.forEach(([id,title])=>{const link=document.createElement('a');link.className='nav-item';link.href='#'+id;link.dataset.id=id;link.textContent=title;list.append(link)});btn.onclick=()=>{list.hidden=!list.hidden;btn.setAttribute('aria-expanded',String(!list.hidden))};group.append(btn,list);menu.append(group)});
const lipsum=['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae consequat nibh. Nam quis elit vitae justo rhoncus aliquet. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.','Suspendisse potenti. Nullam porttitor, quam id mollis sodales, metus libero efficitur purus, ac fringilla urna ante eu massa. Quisque imperdiet sem quis dui sagittis, sed faucibus lectus tincidunt.','Aliquam suscipit sem vitae magna posuere, non imperdiet mauris egestas. Vestibulum egestas, mauris non tempus faucibus, dolor lorem scelerisque velit, sit amet placerat erat neque non purus.'];
const keys=['architecture','city','tower','archive','book','garden'];
// Les sources se configurent dans annexes.js, sans modifier le moteur.
const ARCHIVE_SOURCES = window.OREE_ARCHIVES || {};
const cachedPosts=new Map();let currentRequest=0;
function escapeText(value){return String(value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function sanitizePost(markup){
 const d=new DOMParser().parseFromString('<div id="import-root">'+markup+'</div>','text/html');
 const root=d.getElementById('import-root');
 root.querySelectorAll('script,style,iframe,object,embed,form,base,meta,link,input,button,textarea,svg').forEach(n=>n.remove());
 const allowed=new Set(['class','title','alt','href','src','width','height','loading','colspan','rowspan','id']);
 [root,...root.querySelectorAll('*')].forEach(el=>{
  [...el.attributes].forEach(attr=>{if(!allowed.has(attr.name.toLowerCase()))el.removeAttribute(attr.name)});
  ['src','href'].forEach(key=>{if(!el.hasAttribute(key))return;
    try{const u=new URL(el.getAttribute(key),location.origin);if(!['https:','http:'].includes(u.protocol))el.removeAttribute(key);else el.setAttribute(key,u.href)}catch(_){el.removeAttribute(key)}
  });
  if(el.tagName==='IMG')el.loading='lazy';
 });
 return root.innerHTML;
}
function extractFromPage(doc){
 return [...doc.querySelectorAll('.post[id^="p"]')].flatMap(post=>{
  const content=post.querySelector('.postbody .content');if(!content)return [];
  const isStaff=[...post.querySelectorAll('a[href]')].some(link=>{
   try{return new URL(link.getAttribute('href'),location.origin).pathname==='/u1'&&link.textContent.trim()==='Le Tisserand'}catch(_){return false}
  });
  if(!isStaff)return [];
  const header=content.querySelector('h1,h2,h3,h4,h5,h6');
  return [{id:post.id,title:header?.textContent.trim()||'Fragment '+post.id,html:content.innerHTML}];
 });
}
function paginationLinks(doc,topicId){
 return [...doc.querySelectorAll('a[href]')].flatMap(a=>{
  try{
   const u=new URL(a.getAttribute('href'),location.origin);
   if(u.origin!==location.origin||!new RegExp('^/t'+topicId+'p\\d+(?:-|$)').test(u.pathname))return [];
   u.search='';u.hash='';return [u.href];
  }catch(_){return []}
 });
}
async function fetchAllPosts(path){
 const topicId=path.match(/^\/t(\d+)/)?.[1];if(!topicId)throw Error('Adresse du sujet invalide');
 const pending=[new URL(path,location.origin).href],visited=new Set(),found=new Map();
 while(pending.length){
  if(visited.size>=20)throw Error('Plus de vingt pages détectées; limite de sécurité atteinte');
  const url=pending.shift();if(visited.has(url))continue;visited.add(url);
  const response=await fetch(url,{credentials:'same-origin'});
  if(!response.ok)throw Error('HTTP '+response.status+' : accès au sujet impossible');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  if(!doc.querySelector('.post[id^="p"]'))throw Error('Aucun conteneur de message détecté');
  extractFromPage(doc).forEach(post=>found.set(post.id,post));
  paginationLinks(doc,topicId).forEach(link=>{if(!visited.has(link)&&!pending.includes(link))pending.push(link)});
 }
 if(!found.size)throw Error('Aucun message du Tisserand détecté');
 return [...found.values()].sort((x,y)=>Number(x.id.slice(1))-Number(y.id.slice(1)));
}
function showPosts(posts){
 const target=$('articleBody'),toc=$('articleContents');target.replaceChildren();toc.replaceChildren();
 posts.forEach((post,i)=>{
  const section=document.createElement('section');section.className='imported-chapter';section.id='archive-'+post.id;
  if(posts.length>1){const label=document.createElement('div');label.className='archive-kicker';label.textContent='FRAGMENT '+(i+1);section.append(label)}
  const content=document.createElement('div');content.className='imported-content';content.innerHTML=sanitizePost(post.html);section.append(content);target.append(section);
  if(posts.length>1){const link=document.createElement('a');link.href='#'+section.id;link.textContent=post.title;link.onclick=e=>{e.preventDefault();section.scrollIntoView({behavior:'smooth'})};toc.append(link)}
 });
 if(posts.length===1){
  target.querySelectorAll('.imported-content h2,.imported-content h3,.imported-content h4,.imported-content h5,.imported-content h6').forEach((heading,i)=>{
   if(i>=30)return;
   heading.id='heading-'+i;const link=document.createElement('a');link.href='#'+heading.id;link.textContent=heading.textContent.trim();link.onclick=e=>{e.preventDefault();heading.scrollIntoView({behavior:'smooth'})};toc.append(link)
  });
 }
 if(!toc.children.length)toc.textContent='Texte intégral';
}
async function openPage(){
 const ticket=++currentRequest,id=decodeURIComponent(location.hash.slice(1));
 const index=entries.findIndex(e=>e.id===id),home=index<0;
 $('homePage').classList.toggle('hidden',!home);$('articlePage').classList.toggle('hidden',home);
 document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
 if(!home){
  const a=entries[index];
  $('chapterLabel').textContent=a.section;$('articleTitle').textContent=a.title;
  $('articleIntro').textContent='Il est des histoires que la Brume n’efface pas tout à fait. Certaines attendent encore qu’on leur prête attention.';
  $('articleArt').style.backgroundImage=`url("${getArt(keys[a.group%keys.length])}")`;
  $('asideArt').style.backgroundImage=`url("${getArt(keys[(a.group+3)%keys.length])}")`;
  $('asideArtDetail').style.backgroundImage=`url("${getArt(keys[(a.group+4)%keys.length])}")`;
  $('prev').onclick=()=>location.hash=index===0?'accueil':entries[index-1].id;
  $('next').onclick=()=>{if(index<entries.length-1)location.hash=entries[index+1].id};
  $('next').disabled=index===entries.length-1;
  const source=ARCHIVE_SOURCES[id];
  if(source){
   $('articleBody').innerHTML='<p class="imported-loading">✧ Les souvenirs se rassemblent…</p>';
   $('articleContents').textContent='Chargement de l’annexe…';
   try{
    const posts=cachedPosts.get(id)||await fetchAllPosts(source.url);
    if(ticket!==currentRequest)return;
    cachedPosts.set(id,posts);showPosts(posts);
   }catch(error){
    if(ticket!==currentRequest)return;
    $('articleContents').textContent='Erreur de chargement';
    $('articleBody').innerHTML='<div class="imported-error"><h3>La Brume nous cache cette archive…</h3><p>'+escapeText(error.message)+'</p><p>Pour les essais, ouvre le guidebook sur le domaine du forum, pas depuis un fichier local.</p><a href="'+source.url+'" target="_blank" rel="noopener">Lire le sujet original ↗</a></div>';
   }
  }else{
   $('articleContents').textContent='Annexe à connecter';
   $('articleBody').innerHTML='<div class="imported-error"><h3>Cette archive attend son lien</h3><p>La V13 teste trois annexes réelles : le Règlement, le Lore et le Bestiaire. Les autres seront branchées ensuite.</p></div>';
  }
 }
 if(window.matchMedia('(max-width:750px)').matches){$('nav').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false')}
 window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',openPage);openPage();
$('menuToggle').onclick=()=>{const open=$('nav').classList.toggle('open');$('menuToggle').setAttribute('aria-expanded',String(open))};
$('search').addEventListener('input',e=>{const q=e.target.value.trim().toLocaleLowerCase('fr');const matches=entries.filter(x=>(x.title+' '+x.section).toLocaleLowerCase('fr').includes(q));const holder=$('matches');holder.replaceChildren();if(!q)return;matches.slice(0,12).forEach(x=>{const a=document.createElement('a');a.href='#'+x.id;a.className='nav-item';a.textContent='✧ '+x.title;holder.append(a)});if(!matches.length)holder.textContent='Aucun résultat';});
