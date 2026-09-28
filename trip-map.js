import {MapProvider,mapProviderForTrip,mapAssetsBase,readCoordinates} from './providers.js';
import {routeGeometry,routeNodes,mapBounds} from './trip-route.js';
import {placeImage} from './place-media.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['attraction','accommodation','airport','railwayStation','port'];
export function validCoordinates(p) {return Boolean(readCoordinates(p));}
export function mapPlaces(bundle,filter='all') {
  const lodging=new Set((bundle.accommodations??[]).map(a=>a.placeId));
  const restaurants=new Set((bundle.activities??[]).filter(a=>a.type==='food'&&!lodging.has(a.placeId)).map(a=>a.placeId).filter(Boolean));
  const mobileStays=new Set((bundle.accommodations??[]).filter(a=>a.type==='cruise').map(a=>a.placeId));
  return bundle.places.filter(p=>p.visibility!=='private').map(p=>({...p,coordinates:readCoordinates(p)})).filter(p=>categories.includes(p.mapCategory) && validCoordinates(p) && !mobileStays.has(p.id) && !restaurants.has(p.id) && (filter==='all'||(filter==='hub'?['airport','railwayStation','port'].includes(p.mapCategory):p.mapCategory===filter)));
}
export function renderTripMap() {
  return `<section class="trip-map"><div class="trip-map-filters" aria-label="地图地点筛选">${[['all','全部'],['attraction','景点'],['accommodation','住宿'],['hub','交通枢纽']].map(([id,label])=>`<button class="outline-button" data-map-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><div class="trip-map-canvas" aria-label="行程地图"><div class="trip-map-fallback"><p class="eyebrow">TRIP MAP / LOCAL</p><h2>底图暂不可用</h2><p>已确认坐标的地点仍可在下方查看，完整行程不受影响。</p></div></div><p class="trip-map-status" role="status"></p><div class="trip-map-detail"></div><div class="trip-map-places"></div></section>`;
}
function script(src) {return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=src;node.onload=resolve;node.onerror=reject;document.head.append(node);});}
let libraries;
async function loadLibraries() {
  if(!libraries)libraries=Promise.all([import(new URL('vendor/maplibre-gl.mjs',mapAssetsBase).href),script(new URL('vendor/pmtiles.js',mapAssetsBase).href)]);
  const [maplibregl] = await libraries;
  if(!document.querySelector('[data-maplibre-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('vendor/maplibre-gl.css',mapAssetsBase).href;link.dataset.maplibreCss='';document.head.append(link);}
  return {maplibregl,pmtiles:globalThis.pmtiles};
}
// Provider owns the basemap only; marker filtering and detail rendering use Place data independently.
export async function createLocalMap(container,config=MapProvider) {
  const sources=config.sources??(config.pmtilesPath?[{id:'local',path:config.pmtilesPath}]:[]);
  if(!sources.length)return null;
  if(sources.some(s=>!/^maps\/[a-zA-Z0-9_-]+\.pmtiles$/.test(s.path)))throw Error('Only local PMTiles allowed');
  const {maplibregl,pmtiles}=await loadLibraries();
  const {layers,LIGHT,DARK}=await import(new URL('vendor/basemaps.mjs',mapAssetsBase).href);
  if(!createLocalMap.protocol){createLocalMap.protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',createLocalMap.protocol.tile);}
  // Probe independently: an unavailable archive must not disable the other region.
  const ready=await Promise.allSettled(sources.map(async source=>{
    const url=new URL(source.path,mapAssetsBase).href;
    const archive=new pmtiles.PMTiles(url);createLocalMap.protocol.add(archive);
    const [header,metadata]=await Promise.all([archive.getHeader(),archive.getMetadata()]);
    return {...source,url,maxzoom:header.maxZoom,attribution:metadata.attribution};
  }));
  const available=ready.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(!available.length)throw Error('No local basemap available');
  const isDark=()=>document.documentElement.dataset.theme==='dark';
  const flavor=()=>isDark()?{...DARK,water:'#243c3b',earth:'#29352f'}:{...LIGHT,water:'#c3d6d8',sand:'#eee9dc'};
  const styleLayers=[{id:'paper',type:'background',paint:{'background-color':isDark()?'#29352f':'#eef0e9'}}];
  const vectorSources={};
  for(const source of available){
    vectorSources[source.id]={type:'vector',url:`pmtiles://${source.url}`,bounds:source.bounds,maxzoom:source.maxzoom,attribution:source.attribution};
    styleLayers.push(...layers(source.id,flavor(),{lang:'zh'}).filter(l=>l.type!=='background').map(l=>{
      // Existing V4 sprites omit townspot/capital; retain their city labels.
      if(l.id==='places_locality')delete l.layout['icon-image'];
      return {...l,id:`${source.id}-${l.id}`};
    }));
  }
  const map=new maplibregl.Map({container,style:{version:8,glyphs:new URL('map-assets/fonts/',mapAssetsBase).href+'{fontstack}/{range}.pbf',sprite:new URL('map-assets/sprites/v4/light',mapAssetsBase).href,sources:vectorSources,layers:styleLayers},localIdeographFontFamily:'Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif',attributionControl:true});
  const applyTheme=()=>{
    if(!map.getLayer('paper'))return;
    map.setPaintProperty('paper','background-color',isDark()?'#29352f':'#eef0e9');
    for(const source of available)for(const layer of layers(source.id,flavor(),{lang:'zh'})){const id=`${source.id}-${layer.id}`;if(map.getLayer(id))for(const [key,value] of Object.entries(layer.paint??{}))map.setPaintProperty(id,key,value);}
  };
  return {map,maplibregl,applyTheme,failed:new Set(sources.filter(s=>!available.some(a=>a.id===s.id)).map(s=>s.id)),sourceIds:sources.map(s=>s.id)};
}
export function mountTripMap(root,bundle) {
  if(!root)return ()=>{};
  let filter='all',active=null,markers=[],instance=null,disposed=false;
  const nodes=routeNodes(bundle),geometry=routeGeometry(bundle);
  let resizeObserver,themeObserver,resizeFrame;
  const details=root.querySelector('.trip-map-detail'),list=root.querySelector('.trip-map-places'),status=root.querySelector('.trip-map-status');
  function select(place) {active=place;instance?.map.flyTo({center:[place.coordinates.lng,place.coordinates.lat],zoom:13,essential:false});details.innerHTML=`<div class="place-row"><div><h3>${esc(place.name)}</h3><p>${place.coordinates.lat}, ${place.coordinates.lng}</p>${place.address?`<p>${esc(place.address)}</p>`:''}</div>${placeImage(place)}</div>`;}
  function update() {
    const places=mapPlaces(bundle,filter);status.textContent=`${places.length} 个已确认坐标的地点 · 未确认坐标的地点不显示`;
    if(active&&!places.some(p=>p.id===active.id)){active=null;details.innerHTML='';}
    list.innerHTML=places.map(p=>`<button class="trip-map-place" data-map-place="${esc(p.id)}"><span>${esc(p.name)}</span><span>↗</span></button>`).join('')||'<p>当前分类暂无已确认坐标的地点。</p>';
    markers.forEach(m=>m.remove());markers=[];
    if(instance)for(const p of places){const el=document.createElement('button');el.className=`trip-map-marker trip-map-marker--${p.mapCategory}`;el.setAttribute('aria-label',p.name);el.onclick=()=>select(p);markers.push(new instance.maplibregl.Marker({element:el}).setLngLat([p.coordinates.lng,p.coordinates.lat]).addTo(instance.map));}
  }
  const click=event=>{const f=event.target.closest('[data-map-filter]');if(f){filter=f.dataset.mapFilter;root.querySelectorAll('[data-map-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===f)));update();}const p=event.target.closest('[data-map-place]');if(p){const place=mapPlaces(bundle).find(item=>item.id===p.dataset.mapPlace);if(place)select(place);}};
  root.addEventListener('click',click);update();
  const canvas=root.querySelector('.trip-map-canvas');
  if(nodes.length>1){
    const caption=document.createElement('p');caption.className='trip-route-caption';
    caption.textContent=`${nodes.length} 个路线节点 · ${nodes[0].label} → ${nodes.at(-1).label} · 行程连线，非道路导航；城市节点为示意位置。`;
    canvas.after(caption);
  }
  const fit=()=>{
    if(!instance||disposed)return;
    const points=[...nodes.map(n=>n.coordinates),...mapPlaces(bundle).map(p=>[p.coordinates.lng,p.coordinates.lat])];
    const bounds=mapBounds(points);if(bounds)instance.map.fitBounds(bounds,{padding:canvas.clientWidth<600?{top:32,bottom:40,left:32,right:32}:48,maxZoom:12,animate:false});
  };
  const routePaint=()=>{
    if(!instance?.map.getLayer('trip-route'))return;
    const tokens=getComputedStyle(root);
    instance.map.setPaintProperty('trip-route','line-color',tokens.getPropertyValue('--accent').trim()||'#637958');
    instance.map.setPaintProperty('trip-route-halo','line-color',tokens.getPropertyValue('--paper').trim()||'#f5f5f2');
  };
  const provider=mapProviderForTrip(bundle.trip?.id);
  if(provider.sources?.length){
    const host=document.createElement('div');host.className='trip-map-host';canvas.append(host);
    const fallback=()=>{host.remove();instance?.map.remove();instance=null;canvas.querySelector('.trip-map-fallback').hidden=false;status.textContent='本地底图不可用，仍可浏览地点列表。';};
    createLocalMap(host,provider).then(result=>{
      if(disposed){result?.map.remove();return;}if(!result)return;instance=result;
      instance.map.on('error',event=>{
        if(!instance||disposed)return;
        // Glyph/sprite errors do not invalidate healthy vector sources.
        if(event.sourceId&&instance.sourceIds.includes(event.sourceId)){
          instance.failed.add(event.sourceId);
          if(instance.failed.size===instance.sourceIds.length)fallback();
        }
      });
      instance.map.on('load',()=>{
        if(disposed||!instance)return;
        canvas.querySelector('.trip-map-fallback').hidden=true;update();
        if(geometry.features.length){
          instance.map.addSource('trip-route',{type:'geojson',data:geometry});
          instance.map.addLayer({id:'trip-route-halo',type:'line',source:'trip-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':5,'line-opacity':0.85}});
          instance.map.addLayer({id:'trip-route',type:'line',source:'trip-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-width':2.5,'line-opacity':0.95}});
          routePaint();
        }
        fit();
        resizeObserver=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(instance&&!disposed){instance.map.resize();fit();}});});
        resizeObserver.observe(canvas);
        themeObserver=new MutationObserver(()=>{if(instance&&!disposed){instance.applyTheme();routePaint();}});
        themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      });
    }).catch(error=>{if(!disposed){fallback();status.textContent='MAP DEBUG: '+(error?.stack||error?.message||String(error));}});
  }
  return ()=>{disposed=true;resizeObserver?.disconnect();themeObserver?.disconnect();cancelAnimationFrame(resizeFrame);root.removeEventListener('click',click);markers.forEach(m=>m.remove());instance?.map.remove();};
}
