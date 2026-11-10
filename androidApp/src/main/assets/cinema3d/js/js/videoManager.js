import * as THREE from 'three';
import { fmtTime, showErr } from './utils.js';
import { updateScreenMasking, updateSubtitles } from './sceneBuilder.js';

export const video = document.getElementById('cinema-video');
video.volume = 1.0;

// High-performance Three.js VideoTexture (Three.js r168 handles requestVideoFrameCallback natively)
export const videoTexture = new THREE.VideoTexture(video);
videoTexture.generateMipmaps = false; // Zero mipmap overhead for 4K/high-res frames
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.colorSpace = THREE.SRGBColorSpace;

// Screen Wake Lock API to prevent laptop screen from sleeping while watching a movie
let wakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.error('WakeLock Error:', err);
    }
  }
}
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release();
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !video.paused) {
    requestWakeLock();
  }
});

video.addEventListener('play', () => { 
  requestWakeLock();
});

video.addEventListener('pause', () => {
  releaseWakeLock();
});

export const state = { hasVideo: false };

export function updateVideo() {
  // Read active subtitle cues for the 3D Subtitle Mesh
  let subText = '';
  if (video.textTracks && video.textTracks.length > 0) {
    const activeCues = video.textTracks[0].activeCues;
    if (activeCues && activeCues.length > 0) {
      subText = activeCues[0].text;
    }
  }
  updateSubtitles(subText);
}

// Zero-overhead screen glow: UnrealBloomPass handles the real-time optical light spill in the GPU shader.
// glowLight maintains a gentle cinematic theater ambiance without costly CPU readbacks.
export function updateScreenGlow(glowLight) {
  if (!state.hasVideo || video.paused || video.ended || !glowLight) return;
  // Constant, warm cinematic illumination around the front stage without GPU-to-CPU stalls
  if (glowLight.intensity < 1.5) {
    glowLight.intensity = 1.5;
    glowLight.color.setHex(0xe8dcc0);
  }
}

export function loadVideoUrl(url, filename, onLoaded) {
  if (video.src && video.src.startsWith('blob:')) {
    try { URL.revokeObjectURL(video.src); } catch(e){}
  }

  if (url.startsWith('blob:')) {
    video.removeAttribute('crossorigin');
  } else {
    video.crossOrigin = 'anonymous'; // Important for WebGL textures!
  }

  video.src = url;
  video.load();
  document.getElementById('hud-filename').textContent = filename;
  document.getElementById('welcome-screen').style.display = 'none';
  
  video.addEventListener('loadedmetadata', () => {
    document.getElementById('total-time').textContent = fmtTime(video.duration || 0);
    state.hasVideo = true;
    updateScreenMasking(video.videoWidth / video.videoHeight, videoTexture);
    video.play().catch((err)=>{
      console.warn('Playback gesture required:', err);
    });
    if (onLoaded) onLoaded();
  }, { once: true });
  
  const errorHandler = () => {
    console.error('Video load error:', video.error);
    // If proxied and failed, try direct URL fallback once
    if (url.startsWith('/api/proxy-video?url=') && !url.includes('_fallback=1')) {
      const rawUrl = decodeURIComponent(url.replace('/api/proxy-video?url=', ''));
      console.warn('Proxy streaming failed, attempting direct URL fallback:', rawUrl);
      loadVideoUrl(rawUrl + (rawUrl.includes('?') ? '&' : '?') + '_fallback=1', filename, onLoaded);
      return;
    }

    let errMsg = 'Não foi possível reproduzir este vídeo no telão.';
    if (video.error) {
      if (video.error.code === 4) { // MEDIA_ERR_SRC_NOT_SUPPORTED
        errMsg = 'Link inválido ou formato não suportado. Certifique-se de que o link aponta diretamente para um arquivo de vídeo (.mp4, .webm).';
      } else if (video.error.code === 2) { // MEDIA_ERR_NETWORK
        errMsg = 'Erro de rede ou conexão ao carregar o vídeo da web.';
      }
    }
    showErr(errMsg);
  };
  video.addEventListener('error', errorHandler, { once: true });
}

export function loadSubtitleTrack(url) {
  Array.from(video.querySelectorAll('track')).forEach(t => t.remove());
  if (url) {
    const track = document.createElement('track');
    track.src = url;
    track.kind = 'subtitles';
    track.default = true;
    
    video.appendChild(track);
    
    // Immediately set mode to 'hidden' AFTER appending so the browser parses cues
    // but does NOT render the default browser subtitle UI (we use our own 3D mesh).
    if (video.textTracks && video.textTracks.length > 0) {
      video.textTracks[video.textTracks.length - 1].mode = 'hidden';
    }
    
    track.addEventListener('load', () => {
      if (video.textTracks && video.textTracks.length > 0) {
        video.textTracks[video.textTracks.length - 1].mode = 'hidden';
      }
    });
  }
}

export function loadSubtitleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let content = e.target.result;
    if (file.name.toLowerCase().endsWith('.srt')) {
      content = 'WEBVTT\n\n' + content
        .replace(/\r\n|\r/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    }
    const blob = new Blob([content], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);
    loadSubtitleTrack(blobUrl);
  };
  reader.readAsText(file);
}
