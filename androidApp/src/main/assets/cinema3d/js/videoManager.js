import * as THREE from 'three';
import { fmtTime, showErr } from './utils.js';
import { updateScreenMasking, updateSubtitles } from './sceneBuilder.js';

export const video = document.getElementById('cinema-video');
video.volume = 1.0;

// High-performance Three.js VideoTexture
export const videoTexture = new THREE.VideoTexture(video);
videoTexture.generateMipmaps = false;
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.colorSpace = THREE.SRGBColorSpace;

let activeHls = null;
function destroyActiveHls() {
  if (activeHls) {
    try { activeHls.destroy(); } catch (e) {}
    activeHls = null;
  }
}

// Screen Wake Lock API to prevent phone/tablet screen from sleeping
let wakeLock = null;
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      // Ignore if blocked in iframe/background
    }
  }
}
function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !video.paused) {
    requestWakeLock();
  }
});

video.addEventListener('play', () => { requestWakeLock(); });
video.addEventListener('pause', () => { releaseWakeLock(); });

export const state = { hasVideo: false, isLive: false };

export function updateVideo() {
  let subText = '';
  if (video.textTracks && video.textTracks.length > 0) {
    const activeCues = video.textTracks[0].activeCues;
    if (activeCues && activeCues.length > 0) {
      subText = activeCues[0].text;
    }
  }
  updateSubtitles(subText);
}

export function updateScreenGlow(glowLight) {
  if (!state.hasVideo || video.paused || video.ended || !glowLight) return;
  if (glowLight.intensity < 1.5) {
    glowLight.intensity = 1.5;
    glowLight.color.setHex(0xe8dcc0);
  }
}

function isHlsStreamUrl(url) {
  if (!url) return false;
  const decoded = decodeURIComponent(url).toLowerCase();
  return decoded.includes('.m3u8') || decoded.includes('mpegurl');
}

function extractRawUrlFromProxy(url) {
  if (url && url.startsWith('/api/proxy-video?url=')) {
    const q = url.split('url=')[1] || '';
    const clean = q.split('&_fallback')[0];
    try { return decodeURIComponent(clean); } catch (e) { return clean; }
  }
  return url;
}

export function loadVideoUrl(url, filename, onLoaded) {
  destroyActiveHls();

  if (video.src && video.src.startsWith('blob:')) {
    try { URL.revokeObjectURL(video.src); } catch (e) {}
  }

  const rawCandidate = extractRawUrlFromProxy(url);
  const isHls = isHlsStreamUrl(rawCandidate);

  document.getElementById('hud-filename').textContent = filename || 'Sessão Cinema 3D';
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('buffering-overlay').style.display = 'flex';

  const handleMetadataReady = () => {
    document.getElementById('buffering-overlay').style.display = 'none';
    const dur = video.duration;
    state.isLive = !isFinite(dur) || dur <= 0;
    document.getElementById('total-time').textContent = state.isLive ? '🔴 AO VIVO' : fmtTime(dur || 0);
    state.hasVideo = true;
    const aspect = (video.videoWidth && video.videoHeight) ? (video.videoWidth / video.videoHeight) : (16 / 9);
    updateScreenMasking(aspect, videoTexture);
    video.play().catch((err) => {
      console.warn('Playback gesture required:', err);
    });
    if (onLoaded) onLoaded();
  };

  // HLS (.m3u8) IPTV Live & VOD Support
  if (isHls && window.Hls && window.Hls.isSupported()) {
    video.crossOrigin = 'anonymous';
    activeHls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });
    activeHls.loadSource(rawCandidate);
    activeHls.attachMedia(video);
    activeHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      handleMetadataReady();
    });
    activeHls.on(window.Hls.Events.ERROR, (_event, data) => {
      if (data && data.fatal) {
        console.warn('HLS fatal error:', data);
        destroyActiveHls();
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = rawCandidate;
          video.load();
        } else {
          document.getElementById('buffering-overlay').style.display = 'none';
          showErr('Não foi possível abrir este canal HLS (.m3u8). Verifique o link IPTV.');
        }
      }
    });
    video.addEventListener('loadedmetadata', handleMetadataReady, { once: true });
    return;
  }

  if (url.startsWith('blob:')) {
    video.removeAttribute('crossorigin');
  } else {
    video.crossOrigin = 'anonymous';
  }

  video.src = url;
  video.load();

  video.addEventListener('loadedmetadata', handleMetadataReady, { once: true });

  const errorHandler = () => {
    console.warn('Video load error:', video.error, 'URL:', url);
    document.getElementById('buffering-overlay').style.display = 'none';

    // Automatic fallback from proxy -> direct URL if proxy is unavailable
    if (url.startsWith('/api/proxy-video?url=') && !url.includes('_fallback=1')) {
      const rawUrl = extractRawUrlFromProxy(url);
      console.info('Proxy unavailable, falling back to direct stream URL:', rawUrl);
      loadVideoUrl(rawUrl + (rawUrl.includes('?') ? '&' : '?') + '_fallback=1', filename, onLoaded);
      return;
    }

    let errMsg = 'Não foi possível reproduzir este vídeo no telão 3D.';
    if (video.error) {
      if (video.error.code === 4) {
        errMsg = 'Formato ou link não suportado. Use links diretos (.mp4, .m3u8, .webm, .mkv) ou vídeos do aparelho.';
      } else if (video.error.code === 2) {
        errMsg = 'Erro de rede ao conectar na transmissão.';
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
