import { initMemoraPlus } from './memora-plus.js?v=8';
import { initAccountBar, initLoginPage, requireSessionForApp } from './account.js?v=12';

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
  initMemoraPlus();
  initAccountBar();
}
