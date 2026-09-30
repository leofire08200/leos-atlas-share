const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function localImagePath(value) {
  return typeof value==='string' && /^(?:\/|\.\/)?assets\/places\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(value) ? '/'+value.replace(/^\.?\//,'') : null;
}
export function displayImagePath(value) {
  return localImagePath(value) || (typeof value==='string' && /^\.\/images\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(value) ? value : null);
}
export function placeImage(place,slot='content') {
  if(place?.image?.variants)return responsiveImage(place.image,place.name,false,slot);
  const src=displayImagePath(place?.image?.localPath);
  if(!src)return '';
  return `<button class="place-thumbnail" data-place-image aria-label="查看${esc(place.image.alt||place.name)}大图"><img src="${esc(src)}" alt="${esc(place.image.alt||place.name)}" loading="lazy" style="visibility:hidden"></button>`;
}
export function responsiveImage(image,alt,hero=false,slot='content'){
  const safe=path=>typeof path==='string'&&/^(?:\/assets\/trip-images\/jiangxi-2026\/optimized\/|\.\/images\/)[\w.-]+\.webp$/.test(path)&&!path.includes('..');
  const variants=image.variants.filter(v=>safe(v.path)&&v.width>0&&v.width<=image.width);
  if(!variants.length||hero&&!image.heroEligible)return '';
  const position=/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/.test(image.objectPosition)?image.objectPosition:'50% 50%';
  const contentWidth=Math.min(420,280*image.width/image.height);
  // Cover sampling must account for the intrinsic width cropped outside the frame.
  const ratio=image.width/image.height;
  const heroSizes=`(max-width: 700px) max(calc(100vw - 42px), ${Math.ceil(150*ratio)}px), (max-width: 1100px) max(40vw, ${Math.ceil(260*ratio)}px), max(560px, ${Math.ceil(260*ratio)}px)`;
  const sizes=slot==='card'?'72px':hero?heroSizes:slot==='itinerary'?'(max-width: 700px) min(calc(100vw - 145px), 420px), 420px':`(max-width: 700px) min(calc(100vw - 145px), ${contentWidth}px), ${contentWidth}px`;
  const markup=`<img class="trip-photograph${hero?' trip-photograph-hero':''}" src="${esc(variants[0].path)}" srcset="${variants.map(v=>`${esc(v.path)} ${v.width}w`).join(', ')}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${esc(alt)}" loading="${hero?'eager':'lazy'}" decoding="async"${hero?' fetchpriority="high"':''} style="object-position:${position};--photo-ratio:${image.width}/${image.height};--photo-width:${Math.min(420,280*image.width/image.height)}px;max-width:min(100%,${image.width}px)">`;
  return slot==='itinerary'?`<span class="itinerary-photo-frame">${markup}</span>`:markup;
}
export function bindPlaceImages(root) {
  root.addEventListener('load',event=>{if(event.target.matches?.('.place-thumbnail img'))event.target.style.visibility='visible';},true);
  root.addEventListener('error',event=>{if(event.target.matches?.('.place-thumbnail img'))event.target.closest('.place-thumbnail').remove();},true);
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-place-image]');if(!button)return;
    const original=button.querySelector('img');if(!original?.naturalWidth)return;
    const dialog=document.createElement('dialog');dialog.className='place-image-dialog';
    const close=document.createElement('button');close.textContent='关闭';close.className='outline-button';
    const image=document.createElement('img');image.src=original.src;image.alt=original.alt;
    dialog.append(close,image);document.body.append(dialog);close.onclick=()=>dialog.close();
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{dialog.remove();button.focus();});dialog.showModal();
  });
}
