import {placeImage,responsiveImage} from './place-media.js';
import {tripImages,tripImageRefs} from './trip-image-data.js';
function photographedPlace(place){
  const image=tripImages[tripImageRefs[place?.id]??place?.id];
  return image?{...place,image:{...image,variants:image.variants.map(v=>({...v,path:v.path.startsWith('./')?v.path:'/'+v.path}))}}:place;
}
export function destinationPhoto(bundle){
  return tripCover(bundle.trip);
}
export function tripCover(trip,slot='hero'){
  const placeId=trip.coverImage?.placeId;
  const image=photographedPlace({id:placeId})?.image;
  return image?.heroEligible?responsiveImage(image,trip.title,slot==='hero',slot):'';
}
// Pure presentation helpers. No private data access or repository imports.
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={transport:'交通',flight:'航班',hotel:'酒店',attraction:'景点',food:'餐饮',cruise:'巡游',tour:'跟团',shopping:'购物',rest:'休息',activity:'活动',freeTime:'自由活动',other:'其他'};
const statuses={planned:'计划',optional:'可选',backup:'备选',cancelled:'已取消',completed:'已完成',skipped:'已跳过'};
const conditionNames={if:'如果',else:'否则',dependsOn:'取决于'};
export function activityTime(a) {
  if(a.timeQualifier==='before') return `${a.endTime} 前`;
  if(a.startTime && a.endTime) return `${a.startTime}–${a.endTime}${a.timeQualifier==='window'?' 间':''}`;
  return a.startTime || a.endTime || '时间未定';
}
export const friendlyDate=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(value??'');return m?`${Number(m[2])}月${Number(m[3])}日`:'日期未定';};
export function renderItinerary(bundle) {
  return bundle.days.map((day,i)=>{
    const activities=bundle.activities.filter(a=>a.dayId===day.id);
    return `<details class="day day-disclosure"${i===0?' open':''}><summary class="day-title"><span class="day-num">D${day.dayNumber??i+1}</span><div><p class="day-date">${friendlyDate(day.date)}</p><h3>${esc(day.title??day.cityOrArea??day.summary??day.city)}</h3></div><span class="day-count">${activities.length} 项安排</span><span class="disclosure-chevron" aria-hidden="true"></span></summary><div class="timeline">${activities.map(a=>{
      const place=bundle.places?.find(p=>p.id===a.placeId),title=a.title??place?.name??'行程安排';
      return `<article class="activity"><time>${esc(activityTime(a))}</time><div><h3>${esc(title)}</h3><span class="activity-meta">${esc(types[a.type]??a.type)} · ${esc(statuses[a.status]??'计划')}</span>${(a.type==='attraction'||(a.id==='jx-d07-a01'&&a.type==='activity'&&a.placeId==='jx-place-017'))?placeImage(photographedPlace(place)):''}${place&&!title.includes(place.name)?`<p>${esc(place.name)}</p>`:''}${(a.notes??[]).map(n=>`<p>${esc(n)}</p>`).join('')}${(a.conditions??[]).map(c=>`<p><strong>${conditionNames[c.kind]??''}：</strong>${esc(c.text)}</p>`).join('')}</div></article>`;
    }).join('')}</div></details>`;
  }).join('');
}
export function renderPrepare(bundle) {return renderTravelPrepare({...bundle,accommodations:bundle.accommodations??[],transports:bundle.transports??[]});}
export function renderGuides(guides,places=[]) {return guides.map(g=>`<section class="day"><p class="eyebrow">${esc(g.category)}</p><h3>${esc(g.title)}</h3>${placeImage(places.find(p=>p.id===g.placeId))}<p>${esc(g.content??'尚未提供资料正文。')}</p></section>`).join('');}

// Trip-specific presentation; native details keep all three disclosures independent.
function renderTravelPrepare(bundle) {
  const friendly=friendlyDate;
  const notes=item=>(item.notes??[]).map(n=>`<p>${esc(n)}</p>`).join('');
  const group=(date,content)=>`<section class="prepare-date"><h3>${friendly(date)}</h3>${content}</section>`;
  const section=(title,summary,content,open)=>`<details class="prepare-disclosure"${open?' open':''}><summary><h2>${title}</h2><span class="muted">${summary}</span><span class="prepare-chevron" aria-hidden="true"></span></summary><div class="prepare-content">${content}</div></details>`;
  const row=(title,time,body)=>`<article class="prepare-entry">${time?`<p class="prepare-time">${esc(time)}</p>`:''}<h4>${esc(title)}</h4>${body}</article>`;
  const food=bundle.activities.filter(a=>a.type==='food');
  const foodContent=bundle.days.map(day=>{
    const items=food.filter(a=>a.dayId===day.id);
    return items.length?group(day.date,items.map(a=>{const place=bundle.places.find(p=>p.id===a.placeId);return row(place?.name??a.title,activityTime(a),`${place&&place.name!==a.title?`<p>${esc(a.title)}</p>`:''}${notes(a)}`);}).join('')):'';
  }).join('');
  const stayDates=[...new Set(bundle.accommodations.map(a=>a.checkIn))].sort();
  const stayContent=stayDates.map(date=>group(date,bundle.accommodations.filter(a=>a.checkIn===date).map(a=>row(a.name,'',`<p>入住 ${friendly(a.checkIn)} · 退房 ${friendly(a.checkOut)} · ${a.nights} 晚</p>${[['房型',a.roomType],['床型',(a.beds??[]).join(' · ')],['餐食',a.mealPlan],['地址',a.address]].filter(([,v])=>v).map(([k,v])=>`<p>${k}：${esc(v)}</p>`).join('')}${notes(a)}`)).join(''))).join('');
  // Keep driving stages; omit explicitly local pickup, parking and taxi transfers.
  const movements=bundle.activities.filter(a=>['transport','flight','cruise'].includes(a.type)&&!/(停车场|回酒店拿车|回酒店退房|打车|步行)/.test(a.title));
  const transportDate=t=>t.departureTime?.slice(0,10)??bundle.days.find(d=>bundle.activities.some(a=>a.dayId===d.id&&a.transportId===t.id))?.date??'';
  const moveDates=[...new Set([...bundle.days.map(d=>d.date),...bundle.transports.map(transportDate)])].sort((a,b)=>a?b?a.localeCompare(b):-1:1);
  const moveContent=moveDates.map(date=>{
    const day=bundle.days.find(d=>d.date===date);
    const main=bundle.transports.filter(t=>transportDate(t)===date);
    const items=movements.filter(a=>day&&a.dayId===day.id);
    if(!main.length&&!items.length)return '';
    return group(date,main.map(t=>row(`${({rentalCar:'租车',car:'用车',flight:'航班',metro:'地铁',taxi:'出租车'})[t.type]??types[t.type]??'交通'} · ${[t.from,t.to].filter(Boolean).join(' → ')}`,t.departureTime?.slice(11,16),`${t.arrivalTime?`<p>抵达：${friendly(t.arrivalTime)} ${esc(t.arrivalTime.slice(11,16))}</p>`:''}${[t.carrier,t.flightNumber,t.terminal].filter(Boolean).map(v=>`<p>${esc(v)}</p>`).join('')}${notes(t)}`)).join('')+items.map(a=>row(a.title,activityTime(a),notes(a))).join(''));
  }).join('');
  const transportSummary=bundle.transports.some(t=>t.type==='rentalCar')?'自驾 · 主要交通':`${bundle.transports.length} 项主要交通 · ${bundle.activities.filter(a=>a.type==='cruise').length} 项巡游`;

  return `<div class="travel-prepare">${section('食',`${food.length} 项餐饮安排`,foodContent||'<p>暂无餐饮安排。</p>',true)}${section('宿',`${bundle.accommodations.length} 项住宿记录`,stayContent||'<p>暂无住宿记录。</p>',true)}${section('行',transportSummary,moveContent||'<p>暂无主要交通安排。</p>',false)}</div>`;
}

export function destinationArt(type='desert') {
  return `<div class="landscape ${type}" aria-hidden="true"><svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice"><defs><pattern id="contours-${type}" width="80" height="55" patternUnits="userSpaceOnUse"><path d="M-20 45 Q20 5 60 40 T140 35" fill="none" stroke="currentColor" stroke-width=".6" opacity=".16"/></pattern></defs><rect width="800" height="400" fill="url(#contours-${type})"/><circle cx="610" cy="95" r="43" fill="currentColor" opacity=".13"/><path d="M0 340 160 230 260 280 422 80 620 315 800 205V400H0Z" fill="currentColor" opacity=".22"/><path d="m422 80 26 250 172-15Z" fill="currentColor" opacity=".24"/><path d="M0 380Q170 290 330 354T800 330V400H0Z" fill="currentColor" opacity=".19"/></svg><span>ATLAS FIELD NOTES / ${type === 'forest' ? '02' : type === 'stone' ? '03' : '01'}</span></div>`;
}
export function themeControl(){return `<label class="theme-control"><span aria-hidden="true">◐</span><span class="visually-hidden">外观主题</span><select data-theme-preference aria-label="外观主题"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>`;}
export function tripStats(bundle){
  const trip=bundle.trip;
  const items=[[bundle.days.length,'天安排'],[trip.cities.length,'城市'],[bundle.places.length,'地点'],...(trip.travelers?[[trip.travelers.length,'同行人']]:[[trip.countries.length,'国家']])];
  return `<div class="trip-stats">${items.map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div>`;
}
export function routeSummary(trip){return `<section class="route-summary"><p class="eyebrow">JOURNEY / ROUTE</p><h3>行程路线</h3><p>${esc(trip.cities.join(' → '))}</p></section>`;}
