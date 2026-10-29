(function(){
 'use strict';
 // Host uses the standard fixed panel layout. No edit, drag, resize, or saved layout.
 if(!new URLSearchParams(location.search).has('host'))return;
 function cleanup(){
  document.querySelectorAll('#ph-dashboard,#ph-edit-button,.ph-return,#hostLayoutOpen,#hostLayoutWorkspace,#prontoHostDashboard,#prontoHostReturn').forEach(el=>el.remove());
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar)return;
  // Keep the earlier request to remove Manual Score Editor; retain Manual Scoring.
  const heading=[...sidebar.querySelectorAll('h1,h2,h3,h4,h5')].find(el=>el.textContent.trim().toUpperCase()==='MANUAL SCORE EDITOR');
  if(heading){
   const section=heading.closest('section,.panel,.card,.control-section')||heading.parentElement;
   if(section&&section!==sidebar)section.remove();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanup,{once:true});
 else cleanup();
})();
