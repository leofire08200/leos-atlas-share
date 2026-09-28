import {readCoordinates} from './providers.js';
// Sequence is exclusively the stored day/activity order, never geographic sorting.
export function routeNodes(bundle){
  const trip=bundle.trip??bundle;
  if(!trip.routeAnchors&&!trip.routePlaceRefs)return [];
  const places=new Map(bundle.places.map(p=>[p.id,p]));
  const hidden=new Set(trip.privateActivityIds??[]);
  const nodes=[];
  const append=(value,label,dayId,activityId,kind)=>{
    const c=readCoordinates(value);if(!c)return;
    const coordinates=[c.lng,c.lat],last=nodes.at(-1);
    if(last&&last.coordinates[0]===c.lng&&last.coordinates[1]===c.lat)return;
    nodes.push({coordinates,label,dayId,activityId,kind});
  };
  for(const day of bundle.days){
    for(const activity of bundle.activities.filter(a=>a.dayId===day.id)){
      if(hidden.has(activity.id)||activity.visibility==='private')continue;
      const anchors=(trip.routeAnchors??[]).filter(a=>a.activityId===activity.id&&a.kind==='city'&&a.visibility==='public');
      for(const anchor of anchors.filter(a=>a.position==='before'))append(anchor,anchor.name,day.id,activity.id,'city');
      if(!['food','shopping','rest'].includes(activity.type)){
        let place=places.get(activity.placeId);
        if(!readCoordinates(place))place=places.get(trip.routePlaceRefs?.[activity.id]);
        if(place&&place.visibility!=='private'&&['attraction','accommodation','airport','railwayStation','port'].includes(place.mapCategory))append(place,place.name,day.id,activity.id,'place');
      }
      for(const anchor of anchors.filter(a=>a.position==='after'))append(anchor,anchor.name,day.id,activity.id,'city');
    }
  }
  return nodes;
}
export function routeGeometry(bundle){
  const coordinates=routeNodes(bundle).map(n=>n.coordinates);
  return {type:'FeatureCollection',features:coordinates.length>1?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates}}]:[]};
}
export function mapBounds(points){
  if(!points.length)return null;
  return points.reduce((b,[lng,lat])=>[[Math.min(b[0][0],lng),Math.min(b[0][1],lat)],[Math.max(b[1][0],lng),Math.max(b[1][1],lat)]],[[...points[0]],[...points[0]]]);
}
