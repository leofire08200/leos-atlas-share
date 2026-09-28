export const mapAssetsBase=new URL('./assets/',import.meta.url);
export const MapProvider={"id":"maplibre-pmtiles","label":"本地矢量地图","supportsOffline":true,"sources":[{"id":"zhejiang","path":"maps/zhejiang.pmtiles","bounds":[118,27,123,31.3]},{"id":"jiangxi","path":"maps/jiangxi.pmtiles","bounds":[113.3,24.2,118.6,30.1]},{"id":"guangdong","path":"maps/guangdong.pmtiles","bounds":[114,22.25,117.35,25.55]}]};
export function mapProviderForTrip(){return MapProvider;}
// Accept supplied GeoJSON coordinate order without changing the stored document.
export function normalizeCoordinates(coordinates) {
  return Array.isArray(coordinates)&&coordinates.length===2
    ? {lng:coordinates[0],lat:coordinates[1]} : coordinates;
}
export function readCoordinates(place) {
  const valid=c=>c&&Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&Math.abs(c.lat)<=90&&Math.abs(c.lng)<=180;
  const current=normalizeCoordinates(place?.coordinates);
  if(valid(current))return {lat:current.lat,lng:current.lng};
  const legacy={lat:place?.latitude,lng:place?.longitude};
  return valid(legacy)?legacy:null;
}
