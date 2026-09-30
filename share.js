import {renderTripMap,mountTripMap} from './trip-map.js';
import {bindPlaceImages} from './place-media.js';
// This entry point imports no private workspace modules or data.
import {destinationPhoto, renderItinerary, renderPrepare, destinationArt, themeControl, tripStats, routeSummary, friendlyDate} from './trip-view.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root = document.querySelector('#share-content');
try {
  const response = await fetch('./trip.json');
  if (!response.ok) throw new Error('暂时无法读取行程');
  const data = await response.json();
  const t = data.trip;
  root.innerHTML = `<header class="trip-context trip-cover share-cover"><div class="destination-slot">${destinationPhoto(data)||destinationArt()}</div><div class="trip-context-copy"><p class="eyebrow">A JOURNEY TOGETHER</p><h1>${esc(t.title)}</h1><p class="trip-meta">${friendlyDate(t.startDate)} — ${friendlyDate(t.endDate)} · ${data.days.length} 天 · ${t.countries.length} 个国家</p></div></header><nav class="tabs" aria-label="同行行程导航"><a href="#overview">概览</a><a href="#itinerary">每日安排</a><a href="#map">地图</a><a href="#prepare">食宿行</a></nav><section id="overview" class="overview-story"><p class="eyebrow">THE JOURNEY</p><h2>${esc(t.subtitle)}</h2><p class="share-intro">${esc(t.summary)}</p>${tripStats(data)}${routeSummary(t)}</section><section id="itinerary"><div class="section-label"><span>DAILY ITINERARY</span><span>PLANNED</span></div>${renderItinerary(data)}</section><section id="map">${renderTripMap()}</section><section id="prepare"><div class="section-label"><span>食宿行</span></div>${renderPrepare(data)}</section><p class="sample-banner">行程按提供的计划整理，条件安排需自行判断。</p>`;
  mountTripMap(root.querySelector('.trip-map'),data);
} catch {root.innerHTML='<div class="empty"><h2>暂时无法读取行程.</h2><p>分享内容加载失败，请稍后重试。</p></div>';}

document.querySelector('.share-header').insertAdjacentHTML('beforeend',themeControl());
window.AtlasTheme?.refreshControls();
bindPlaceImages(root);

function updateShareNavigation(){
  const nav=root.querySelector('.tabs');if(!nav)return;
  const links=[...nav.querySelectorAll('a')];
  const active=links.find(a=>a.hash===location.hash)??links[0];
  for(const link of links){link.classList.toggle('active',link===active);if(link===active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  nav.scrollLeft=active.offsetLeft-nav.offsetLeft-(nav.clientWidth-active.offsetWidth)/2;
}
window.addEventListener('hashchange',updateShareNavigation);
window.addEventListener('resize',updateShareNavigation);
updateShareNavigation();
