export function fmtTime(s){ 
  if(!isFinite(s)||isNaN(s)) return '0:00:00'; 
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=Math.floor(s%60); 
  return h+':'+String(m).padStart(2,'0')+':'+String(sc).padStart(2,'0'); 
}

export function showErr(msg){ 
  const t = document.getElementById('error-toast') || document.getElementById('app-toast'); 
  const msgEl = document.getElementById('error-msg') || document.getElementById('app-toast-msg');
  if (msgEl) msgEl.textContent = msg;
  if (t) {
    t.style.display = 'block'; 
    setTimeout(() => { t.style.display = 'none'; }, 5000); 
  }
}
