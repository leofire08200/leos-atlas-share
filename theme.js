// Shared by both read-only sharing and the workspace; stores appearance only.
(() => {
  const key='leos-atlas.theme';
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  let preference='system';
  try {const saved=localStorage.getItem(key);if(['system','light','dark'].includes(saved))preference=saved;} catch {}
  function refreshControls(){for(const select of document.querySelectorAll?.('select[data-theme-preference]')??[])select.value=preference;}
  function apply(){
    const dark=preference==='dark'||(preference==='system'&&media.matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.documentElement.dataset.themePreference=preference;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#202420':'#f5f5f2');
    refreshControls();
  }
  window.AtlasTheme={refreshControls,setPreference(value){
    if(!['system','light','dark'].includes(value))return;
    preference=value;try {localStorage.setItem(key,value);}catch{}apply();
  }};
  if(media.addEventListener)media.addEventListener('change',apply);else media.addListener(apply);
  window.addEventListener('storage',event=>{if(event.key===key){preference=['light','dark'].includes(event.newValue)?event.newValue:'system';apply();}});
  document.addEventListener?.('change',event=>{if(event.target.matches?.('select[data-theme-preference]'))window.AtlasTheme.setPreference(event.target.value);});
  apply();
})();
