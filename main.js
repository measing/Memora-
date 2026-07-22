import { initMemoraPlus } from './memora-plus.js?v=59';
import { initAccountBar, initLoginPage, playEntryAnimation, requireSessionForApp } from './account.js?v=26';

function initViewportSupport(){
  const setAppHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.visualViewport?.addEventListener('resize', setAppHeight);
}

function registerServiceWorker(){
  if(!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

initViewportSupport();
registerServiceWorker();
initLoginPage();
if(requireSessionForApp()){
  playEntryAnimation();
  initMemoraPlus();
  initAccountBar();
}
