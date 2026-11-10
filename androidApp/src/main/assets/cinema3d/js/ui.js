import { BASE_PITCH } from './config.js';
import { fmtTime, showErr } from './utils.js';
import { video, state, loadVideoUrl, loadSubtitleTrack, loadSubtitleFile } from './videoManager.js';
import { initAudio, resumeAudio, switchAudioTrack, resetAudioToNative } from './audioManager.js';

// Fallback 100% WebGL-compatible Filmes & Séries when opened outside the app backend
const FALLBACK_COMPATIBLE_CATALOG = [
  {
    id: 'builtin_movie_demo_3d',
    type: 'movie',
    title: 'Sessão Demo IMAX 3D',
    badge: 'FILME • LOCAL',
    thumb: 'thumbnails/Cinema_Demo_Test.mp4.jpg',
    directUrl: 'movies/Cinema_Demo_Test.mp4',
    isDirectLocal: true,
  },
  {
    id: 'builtin_movie_tears_of_steel',
    type: 'movie',
    title: 'Tears of Steel',
    badge: 'FILME • SCI-FI HD',
    thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
    directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    id: 'builtin_movie_sintel',
    type: 'movie',
    title: 'Sintel — Edição Cinema',
    badge: 'FILME • FANTASIA',
    thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
    directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  {
    id: 'builtin_movie_big_buck_bunny',
    type: 'movie',
    title: 'Big Buck Bunny',
    badge: 'FILME • ANIMAÇÃO',
    thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id: 'builtin_movie_oceans',
    type: 'movie',
    title: 'Oceans — Documentário IMAX',
    badge: 'FILME • DOC',
    thumb: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=600&q=80',
    directUrl: 'https://vjs.zencdn.net/v/oceans.mp4',
  },
  {
    id: 'builtin_series_cronicas_imax',
    type: 'series',
    title: 'Crônicas IMAX: Mundos Fantásticos',
    badge: 'SÉRIE • 2 TEMP',
    thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
    episodes: [
      {
        videoId: 'builtin_series_cronicas_imax:1:1',
        season: 1,
        episode: 1,
        title: 'A Resistência em Amsterdã',
        overview: 'Cientistas e guerreiros tentam reverter a crise dos robôs no domo central.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      },
      {
        videoId: 'builtin_series_cronicas_imax:1:2',
        season: 1,
        episode: 2,
        title: 'A Guardiã do Dragão',
        overview: 'A travessia pelas montanhas geladas até o covil ancestral.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      },
      {
        videoId: 'builtin_series_cronicas_imax:1:3',
        season: 1,
        episode: 3,
        title: 'Engrenagens da Mente',
        overview: 'Proog e Emo confrontam os limites da máquina infinita.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      },
      {
        videoId: 'builtin_series_cronicas_imax:2:1',
        season: 2,
        episode: 1,
        title: 'Transmissão Especial HLS',
        overview: 'Episódio transmitido via protocolo adaptativo HLS (.m3u8) na tela curva.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        directUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        isDirectLocal: true,
      },
      {
        videoId: 'builtin_series_cronicas_imax:2:2',
        season: 2,
        episode: 2,
        title: 'A Floresta em Festa',
        overview: 'Aventura completa em alta taxa de quadros e som espacial.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      },
    ],
  },
  {
    id: 'builtin_series_motores_expedicoes',
    type: 'series',
    title: 'Motores & Expedições HD',
    badge: 'SÉRIE • 1 TEMP',
    thumb: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
    episodes: [
      {
        videoId: 'builtin_series_motores_expedicoes:1:1',
        season: 1,
        episode: 1,
        title: 'Asfalto & Terra Off-Road',
        overview: 'Teste completo em trilhas e estradas de montanha.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
      },
      {
        videoId: 'builtin_series_motores_expedicoes:1:2',
        season: 1,
        episode: 2,
        title: 'Rota Bullrun Coast-to-Coast',
        overview: 'Preparação e largada do rali pelas rodovias.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/WeAreGoingOnBullrun.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      },
      {
        videoId: 'builtin_series_motores_expedicoes:1:3',
        season: 1,
        episode: 3,
        title: 'Especial Pista GTI',
        overview: 'Análise dinâmica em circuito fechado.',
        thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/VolkswagenGTIReview.jpg',
        directUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
      },
    ],
  },
];

// ── Strict WebGL 3D Screen Media Compatibility Validator ──────────
const BLOCKED_CODEC_REGEX = /(?:\b(?:x265|h\.?265|hevc|10-?bit|hi10p|12-?bit|dovi|bdremux|remux|vc-?1|mpeg-?2|xvid|divx|truehd|dts(?:-?hd|x)?|eac-?3|e-ac-3|ddp\b|dd\+|ac-?3|dolby\s*vision|atmos)\b)/i;
const BLOCKED_EXT_SET = new Set(['avi', 'wmv', 'flv', 'f4v', 'iso', 'img', 'rar', 'zip', '7z', 'mpd', 'vob', 'rm', 'rmvb', 'asf', 'divx', '3gp', 'm2ts', 'mts', 'mkv']);
const ALLOWED_LOCAL_EXT_SET = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv']);

function extractExtension(str) {
  if (!str) return null;
  const clean = str.split('#')[0].split('?')[0].trim();
  const lastSeg = clean.split('/').pop() || '';
  const idx = lastSeg.lastIndexOf('.');
  if (idx <= 0 || idx === lastSeg.length - 1) return null;
  return lastSeg.slice(idx + 1).toLowerCase();
}

function validateUrlForCinema3D(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) {
    return { ok: false, reason: 'Informe um link válido (.mp4, .webm ou .m3u8).' };
  }
  const clean = rawUrl.trim();
  const lower = clean.toLowerCase();

  if (lower.startsWith('magnet:') || lower.startsWith('torrent://') || lower.startsWith('acestream://')) {
    return { ok: false, reason: 'Links Torrent / Magnet P2P não rodam diretamente no Telão WebGL 3D. Use links diretos (.mp4, .webm ou .m3u8).' };
  }
  if (lower.startsWith('rtmp://') || lower.startsWith('rtsp://') || lower.startsWith('mms://')) {
    return { ok: false, reason: 'Protocolos RTMP/RTSP não são suportados no Telão 3D. Use HTTP/HTTPS (.mp4 ou .m3u8 HLS).' };
  }
  if (/(?:youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv)/i.test(lower)) {
    return { ok: false, reason: 'Links de páginas web (YouTube/Vimeo) não fornecem fluxo de vídeo bruto para projeção 3D. Use links diretos .mp4, .webm ou .m3u8.' };
  }
  if (BLOCKED_CODEC_REGEX.test(clean)) {
    return { ok: false, reason: 'Esta mídia usa codec incompatível com o Telão 3D (HEVC/x265, Dolby Vision ou áudio AC3/EAC3/DTS).' };
  }

  const isHls = lower.includes('.m3u8') || lower.includes('mpegurl') || lower.includes('format=m3u8');
  if (isHls) return { ok: true };

  const ext = extractExtension(clean);
  if (ext === 'ts') {
    return { ok: false, reason: 'Fluxos .ts brutos não são suportados diretamente. Use a lista .m3u8 (HLS) ou .mp4.' };
  }
  if (ext && BLOCKED_EXT_SET.has(ext)) {
    return { ok: false, reason: `O formato .${ext.toUpperCase()} possui limitação no Telão WebGL 3D. Use MP4, WebM, MOV ou HLS (.m3u8).` };
  }
  return { ok: true };
}

function validateLocalFileForCinema3D(file) {
  if (!file) return { ok: false, reason: 'Nenhum arquivo selecionado.' };
  const name = file.name || '';
  const ext = extractExtension(name);
  const mime = (file.type || '').toLowerCase();

  if (BLOCKED_CODEC_REGEX.test(name)) {
    return { ok: false, reason: 'Este arquivo possui codec incompatível com o Telão 3D (HEVC/x265 ou áudio AC3/EAC3/DTS). Escolha um vídeo MP4 (H.264/AAC), WebM ou MOV.' };
  }
  if (ext && !ALLOWED_LOCAL_EXT_SET.has(ext)) {
    return { ok: false, reason: `O formato .${ext.toUpperCase()} não pode ser projetado no Telão 3D. Escolha um arquivo .MP4, .WebM, .MOV ou .M4V.` };
  }
  if (!ext && mime && !['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'].includes(mime)) {
    return { ok: false, reason: 'Formato de vídeo do aparelho incompatível com o Telão 3D. Use MP4, WebM ou MOV.' };
  }
  return { ok: true };
}

export function initUI(deps) {
  const { camera, renderer, lights, scene, getDefaultFov } = deps;
  const canvas = renderer.domElement;

  // Fixed VIP Center camera position (seat selection removed per user preference)
  camera.position.set(0, 2.43, 4.66);

  // ── Look, Pinch-to-Zoom & Tap Controls (Desktop + Mobile Perfected) ──
  const look = { yaw: 0, pitch: 0, dragging: false, lx: 0, ly: 0, sens: 0.0029, my: 1.35, mp: 0.58 };
  let currentFov = camera.fov;
  let userAdjustedFov = false;

  deps.onResizeFov = (defaultFov) => {
    if (!userAdjustedFov) {
      currentFov = defaultFov;
      camera.fov = currentFov;
    }
  };

  function setFov(nextFov, manual = true) {
    currentFov = Math.max(24, Math.min(98, nextFov));
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
    if (manual) userAdjustedFov = true;
  }

  function recenterView(announce = true) {
    look.yaw = 0;
    look.pitch = 0;
    userAdjustedFov = false;
    setFov(getDefaultFov ? getDefaultFov() : 58, false);
    if (announce) showToast('🎯 Visão centralizada no telão 3D', 2200);
  }

  // Mouse drag
  let mouseDownPos = { x: 0, y: 0, time: 0 };
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    look.dragging = true;
    look.lx = e.clientX;
    look.ly = e.clientY;
    mouseDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
  });
  window.addEventListener('mouseup', e => {
    if (!look.dragging) return;
    look.dragging = false;
    const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
    if (dist < 6 && Date.now() - mouseDownPos.time < 260) {
      toggleHUDVisibility();
    }
  });
  canvas.addEventListener('mousemove', e => {
    if (!look.dragging) return;
    look.yaw   -= (e.clientX - look.lx) * look.sens;
    look.pitch -= (e.clientY - look.ly) * look.sens;
    look.yaw   = Math.max(-look.my, Math.min(look.my, look.yaw));
    look.pitch = Math.max(-look.mp, Math.min(look.mp, look.pitch));
    look.lx = e.clientX;
    look.ly = e.clientY;
  });
  canvas.addEventListener('dblclick', () => recenterView(true));

  // Touch: 1-finger look + 2-finger pinch zoom + single tap HUD toggle + double tap recenter
  let pinchStartDist = 0;
  let pinchStartFov = currentFov;
  let isPinching = false;
  let touchStartInfo = { x: 0, y: 0, time: 0, moved: false };
  let lastTapTime = 0;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      isPinching = true;
      look.dragging = false;
      pinchStartDist = getTouchDistance(e.touches);
      pinchStartFov = currentFov;
      touchStartInfo.moved = true;
    } else if (e.touches.length === 1) {
      isPinching = false;
      look.dragging = true;
      look.lx = e.touches[0].clientX;
      look.ly = e.touches[0].clientY;
      touchStartInfo = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        moved: false,
      };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && isPinching) {
      const dist = getTouchDistance(e.touches);
      if (pinchStartDist > 10) {
        const scale = pinchStartDist / Math.max(10, dist);
        setFov(pinchStartFov * scale, true);
      }
      return;
    }
    if (e.touches.length === 1 && look.dragging && !isPinching) {
      const cx = e.touches[0].clientX;
      const cy = e.touches[0].clientY;
      if (Math.hypot(cx - touchStartInfo.x, cy - touchStartInfo.y) > 9) {
        touchStartInfo.moved = true;
      }
      look.yaw   -= (cx - look.lx) * (look.sens * 1.15);
      look.pitch -= (cy - look.ly) * (look.sens * 1.15);
      look.yaw   = Math.max(-look.my, Math.min(look.my, look.yaw));
      look.pitch = Math.max(-look.mp, Math.min(look.mp, look.pitch));
      look.lx = cx;
      look.ly = cy;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', e => {
    if (e.touches.length === 1 && isPinching) {
      isPinching = false;
      look.dragging = true;
      look.lx = e.touches[0].clientX;
      look.ly = e.touches[0].clientY;
      return;
    }
    if (e.touches.length === 0) {
      const wasPinching = isPinching;
      look.dragging = false;
      isPinching = false;

      if (!wasPinching && !touchStartInfo.moved && Date.now() - touchStartInfo.time < 280) {
        const now = Date.now();
        if (now - lastTapTime < 320) {
          recenterView(true);
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          toggleHUDVisibility();
        }
      }
    }
  }, { passive: true });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setFov(currentFov + e.deltaY * 0.05, true);
  }, { passive: false });

  deps.updateCamera = () => {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = look.yaw;
    camera.rotation.x = BASE_PITCH + look.pitch;
  };

  // ── Toast Notification Helper ──────────────────────────────────
  let toastTimer = null;
  function showToast(msg, duration = 3200) {
    const toast = document.getElementById('app-toast');
    const toastMsg = document.getElementById('app-toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  // ── HUD & Top Bar Visibility Management ─────────────────────────
  const hudEl = document.getElementById('hud');
  const topBarEl = document.getElementById('mobile-top-bar');
  const welcomeScreen = document.getElementById('welcome-screen');
  let hudTimer = null;

  function showHUD() {
    hudEl.classList.remove('hud-hidden');
    if (topBarEl) topBarEl.classList.remove('top-bar-hidden');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => {
      if (state.hasVideo && !video.paused && welcomeScreen.style.display === 'none') {
        hudEl.classList.add('hud-hidden');
        if (topBarEl) topBarEl.classList.add('top-bar-hidden');
      }
    }, 3800);
  }

  function hideHUD() {
    clearTimeout(hudTimer);
    if (state.hasVideo && !video.paused) {
      hudEl.classList.add('hud-hidden');
      if (topBarEl) topBarEl.classList.add('top-bar-hidden');
    }
  }

  function toggleHUDVisibility() {
    if (hudEl.classList.contains('hud-hidden')) {
      showHUD();
    } else {
      hideHUD();
    }
  }

  document.addEventListener('mousemove', () => {
    if (state.hasVideo && !('ontouchstart' in window)) showHUD();
  });

  // ── Top Bar Actions ────────────────────────────────────────────
  const exitCinemaBtn = document.getElementById('exit-cinema-btn');
  const recenterViewBtn = document.getElementById('recenter-view-btn');
  const rotateScreenBtn = document.getElementById('rotate-screen-btn');
  const quickHubBtn = document.getElementById('quick-hub-btn');

  if (exitCinemaBtn) {
    exitCinemaBtn.addEventListener('click', () => {
      video.pause();
      if (window.AndroidCinemaBridge && typeof window.AndroidCinemaBridge.closeCinema === 'function') {
        window.AndroidCinemaBridge.closeCinema();
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'CLOSE_CINEMA_3D' }, '*');
      } else if (window.history.length > 1) {
        window.history.back();
      } else {
        openMediaModal();
      }
    });
  }

  if (recenterViewBtn) {
    recenterViewBtn.addEventListener('click', () => recenterView(true));
  }

  if (rotateScreenBtn) {
    rotateScreenBtn.addEventListener('click', () => {
      if (window.AndroidCinemaBridge && typeof window.AndroidCinemaBridge.toggleOrientation === 'function') {
        window.AndroidCinemaBridge.toggleOrientation();
        showToast('🔄 Alternando orientação da tela...', 2000);
      } else if (screen.orientation && screen.orientation.lock) {
        const isLandscape = window.innerWidth > window.innerHeight;
        const nextMode = isLandscape ? 'portrait' : 'landscape';
        screen.orientation.lock(nextMode).catch(() => toggleFS());
      } else {
        toggleFS();
      }
    });
  }

  if (quickHubBtn) {
    quickHubBtn.addEventListener('click', () => {
      if (welcomeScreen.style.display === 'flex') closeMediaModal();
      else openMediaModal();
    });
  }

  // ── Playback Controls ──────────────────────────────────────────
  function togglePlay() {
    if (!state.hasVideo) {
      openMediaModal();
      return;
    }
    initAudio(camera, scene, video);
    resumeAudio();
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  video.addEventListener('play', () => {
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = 'block';
    if (lights.screenGlow) lights.screenGlow.intensity = 1.8;
    showHUD();
  });
  video.addEventListener('pause', () => {
    document.getElementById('play-icon').style.display = 'block';
    document.getElementById('pause-icon').style.display = 'none';
    if (topBarEl) topBarEl.classList.remove('top-bar-hidden');
    showHUD();
    if (lights.screenGlow) lights.screenGlow.intensity = 0.55;
  });
  video.addEventListener('ended', () => {
    document.getElementById('play-icon').style.display = 'block';
    document.getElementById('pause-icon').style.display = 'none';
    if (topBarEl) topBarEl.classList.remove('top-bar-hidden');
    showHUD();
  });
  video.addEventListener('seeking', () => { document.getElementById('buffering-overlay').style.display = 'flex'; });
  video.addEventListener('seeked',  () => { document.getElementById('buffering-overlay').style.display = 'none'; });
  video.addEventListener('waiting', () => { document.getElementById('buffering-overlay').style.display = 'flex'; });
  video.addEventListener('canplay', () => { document.getElementById('buffering-overlay').style.display = 'none'; });

  // ── Seek Bar & Time Display ────────────────────────────────────
  const seekBar = document.getElementById('seek-bar');
  const seekProg = document.getElementById('seek-progress');
  const seekBuf = document.getElementById('seek-buffered');
  let isSeeking = false;

  seekBar.addEventListener('mousedown',  () => { isSeeking = true; });
  seekBar.addEventListener('touchstart', () => { isSeeking = true; }, { passive: true });
  seekBar.addEventListener('input', () => {
    if (state.isLive || !isFinite(video.duration)) return;
    const t = (seekBar.value / 10000) * (video.duration || 0);
    document.getElementById('current-time').textContent = fmtTime(t);
    seekProg.style.width = (seekBar.value / 100) + '%';
  });
  seekBar.addEventListener('change', () => {
    if (!state.isLive && isFinite(video.duration)) {
      video.currentTime = (seekBar.value / 10000) * (video.duration || 0);
    }
    isSeeking = false;
  });

  video.addEventListener('timeupdate', () => {
    if (isSeeking) return;
    if (state.isLive || !isFinite(video.duration) || !video.duration) {
      document.getElementById('current-time').textContent = fmtTime(video.currentTime);
      seekProg.style.width = '100%';
      return;
    }
    const pv = video.currentTime / video.duration;
    seekBar.value = (pv * 10000).toFixed(0);
    seekProg.style.width = (pv * 100).toFixed(3) + '%';
    document.getElementById('current-time').textContent = fmtTime(video.currentTime);
    if (video.buffered.length > 0) {
      const be = video.buffered.end(video.buffered.length - 1);
      seekBuf.style.width = (be / video.duration * 100).toFixed(2) + '%';
    }
    if (lights.screenGlow) {
      lights.screenGlow.intensity = 1.8 + Math.sin(video.currentTime * 0.08) * 0.15;
    }
  });

  // ── Volume & Mute Controls ─────────────────────────────────────
  const volBar = document.getElementById('volume-bar');
  volBar.addEventListener('input', () => {
    video.volume = volBar.value / 100;
    video.muted = (volBar.value == 0);
    updMute();
  });
  function updMute() {
    document.getElementById('vol-icon').style.display = video.muted ? 'none' : 'block';
    document.getElementById('muted-icon').style.display = video.muted ? 'block' : 'none';
  }
  function toggleMute() {
    video.muted = !video.muted;
    if (!video.muted && volBar.value == 0) {
      volBar.value = 50;
      video.volume = 0.5;
    }
    updMute();
  }
  const speedSelect = document.getElementById('speed-select');
  if (speedSelect) {
    speedSelect.addEventListener('change', e => {
      video.playbackRate = parseFloat(e.target.value);
    });
  }

  // ── Fullscreen & Lighting ──────────────────────────────────────
  function toggleFS() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      document.getElementById('fs-expand').style.display = 'none';
      document.getElementById('fs-collapse').style.display = 'block';
    } else {
      document.exitFullscreen?.().catch(() => {});
      document.getElementById('fs-expand').style.display = 'block';
      document.getElementById('fs-collapse').style.display = 'none';
    }
  }

  let lightsOn = false;
  function setLightsState(turnOn) {
    lightsOn = turnOn;
    const targetSpot = lightsOn ? 4000.0 : 0;
    const targetAmb  = lightsOn ? 8.0 : 1.0;
    lights.ceilSpots.forEach(s => { s.intensity = targetSpot; });
    lights.ambientLight.intensity = targetAmb;
    document.getElementById('lights-btn').classList.toggle('active', lightsOn);
  }
  function toggleLights() { setLightsState(!lightsOn); }

  document.getElementById('play-btn').addEventListener('click', togglePlay);
  document.getElementById('seek-back-btn').addEventListener('click', () => { video.currentTime = Math.max(0, video.currentTime - 10); });
  document.getElementById('seek-fwd-btn').addEventListener('click',  () => {
    if (!state.isLive && isFinite(video.duration)) {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    }
  });
  document.getElementById('mute-btn').addEventListener('click', toggleMute);
  document.getElementById('lights-btn').addEventListener('click', toggleLights);
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFS);

  // ── Stream Sources, Audio & Subtitle Menu ──────────────────────
  const subsBtn = document.getElementById('subs-btn');
  const tracksMenu = document.getElementById('tracks-menu');
  if (subsBtn && tracksMenu) {
    subsBtn.addEventListener('click', () => {
      tracksMenu.style.display = tracksMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  function setupStreamOptionsMenu(streamOptions = null, activeDisplayTitle = '') {
    const aList = document.getElementById('audio-list');
    const sList = document.getElementById('sub-list');
    if (aList) {
      aList.innerHTML = '';
      if (Array.isArray(streamOptions) && streamOptions.length > 1) {
        streamOptions.forEach((opt, idx) => {
          const btn = document.createElement('button');
          btn.className = 'track-option' + (idx === 0 ? ' active' : '');
          btn.textContent = opt.label || `Fonte Compatível ${idx + 1}`;
          btn.onclick = () => {
            Array.from(aList.children).forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            playStreamInCinema(opt.url, activeDisplayTitle || opt.subtitle || opt.label, !!opt.direct, true);
            if (tracksMenu) tracksMenu.style.display = 'none';
          };
          aList.appendChild(btn);
        });
      } else {
        aList.innerHTML = '<div class="track-option active">Áudio Espacial 5.1 (Acústica IMAX)</div>';
      }
    }
    if (sList && sList.children.length === 0) {
      sList.innerHTML = '<div class="track-option active">Legenda: Carregue na aba Do Aparelho</div>';
    }
  }

  // ── Media Hub Modal (Open / Close & Tabs) ──────────────────────
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const openBtn = document.getElementById('open-btn');
  const addMediaTopBtn = document.getElementById('add-media-top-btn');

  function openMediaModal(tabId = null) {
    welcomeScreen.style.display = 'flex';
    if (topBarEl) topBarEl.classList.remove('top-bar-hidden');
    if (tabId) switchTab(tabId);
  }
  function closeMediaModal() {
    welcomeScreen.style.display = 'none';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeMediaModal);
  if (openBtn) openBtn.addEventListener('click', () => {
    welcomeScreen.style.display = welcomeScreen.style.display === 'none' ? 'flex' : 'none';
  });
  if (addMediaTopBtn) addMediaTopBtn.addEventListener('click', () => openMediaModal());
  welcomeScreen.addEventListener('click', (e) => {
    if (e.target === welcomeScreen) closeMediaModal();
  });

  const tabButtons = document.querySelectorAll('.media-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  function switchTab(targetTabId) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === targetTabId));
    tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === targetTabId));
  }
  tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ── Stream / URL Launcher (With Strict Compatibility Gate) ─────
  const urlStatus = document.getElementById('url-status');

  function playStreamInCinema(url, customName = null, forceDirect = false, skipMenuReset = false) {
    if (!url) return;
    let cleanUrl = url.trim();
    const isInternalPath =
      cleanUrl.startsWith('movies/') ||
      cleanUrl.startsWith('/stream/') ||
      cleanUrl.startsWith('/api/') ||
      cleanUrl.startsWith('blob:');

    if (!isInternalPath && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    if (!isInternalPath) {
      const check = validateUrlForCinema3D(cleanUrl);
      if (!check.ok) {
        if (urlStatus) {
          urlStatus.className = 'url-status-message error';
          urlStatus.textContent = '⚠️ ' + check.reason;
        }
        showToast('⚠️ ' + check.reason, 4500);
        return;
      }
    }

    initAudio(camera, scene, video);
    resumeAudio();
    resetAudioToNative();

    const isHls = cleanUrl.toLowerCase().includes('.m3u8') || cleanUrl.toLowerCase().includes('mpegurl');
    const finalUrl = (isInternalPath || forceDirect || isHls)
      ? cleanUrl
      : `/api/proxy-video?url=${encodeURIComponent(cleanUrl)}`;

    let displayName = customName;
    if (!displayName) {
      try {
        const u = new URL(cleanUrl, window.location.href);
        displayName = decodeURIComponent(u.pathname.split('/').pop() || u.hostname);
      } catch (e) {
        displayName = 'Sessão Cinema 3D';
      }
    }

    loadVideoUrl(finalUrl, displayName, showHUD);
    if (!skipMenuReset) setupStreamOptionsMenu(null, displayName);
    closeMediaModal();
    showToast(`🍿 Projetando: ${displayName}`, 3400);
  }

  window.CineUltimate3D = {
    play: (url, title) => playStreamInCinema(url, title, false),
    setLights: (on) => setLightsState(!!on),
    recenter: () => recenterView(false),
  };

  // ── Tab 1: Compatible Movies & Series Catalog + Episode Picker ──
  const catalogMainView = document.getElementById('catalog-main-view');
  const seriesEpisodesPanel = document.getElementById('series-episodes-panel');
  const backToCatalogBtn = document.getElementById('back-to-catalog-btn');
  const seriesPanelTitle = document.getElementById('series-panel-title');
  const seasonTabsRow = document.getElementById('season-tabs-row');
  const episodesList = document.getElementById('episodes-list');
  const movieGrid = document.getElementById('movie-grid');
  const librarySearch = document.getElementById('library-search');
  const refreshLibraryBtn = document.getElementById('refresh-library-btn');
  const catChips = document.querySelectorAll('.cat-chip');

  let catalogItems = [];
  let activeCategoryFilter = 'all'; // 'all' | 'movie' | 'series'

  const fallbackThumbSvg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxYTAwMDUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2M4YTk2ZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DSU5FIFVMVElNQVRFIDNEPC90ZXh0Pjwvc3ZnPg==";

  function showCatalogGridView() {
    if (seriesEpisodesPanel) seriesEpisodesPanel.style.display = 'none';
    if (catalogMainView) catalogMainView.style.display = 'block';
  }

  if (backToCatalogBtn) {
    backToCatalogBtn.addEventListener('click', showCatalogGridView);
  }

  catChips.forEach(chip => {
    chip.addEventListener('click', () => {
      activeCategoryFilter = chip.dataset.filter || 'all';
      catChips.forEach(c => c.classList.toggle('active', c === chip));
      renderCatalogGrid(librarySearch ? librarySearch.value : '');
    });
  });

  async function launchCatalogMovieOrEpisode({ type, metaId, videoId, season, episode, displayTitle, directUrl, isDirectLocal }) {
    if (directUrl) {
      playStreamInCinema(directUrl, displayTitle, !!isDirectLocal);
      return;
    }

    const bufOverlay = document.getElementById('buffering-overlay');
    const bufText = document.getElementById('buffering-text');
    if (bufText) bufText.textContent = 'Buscando stream compatível com o Telão 3D...';
    if (bufOverlay) bufOverlay.style.display = 'flex';

    try {
      const qs = new URLSearchParams({
        type: type || 'movie',
        id: metaId || '',
        videoId: videoId || metaId || '',
      });
      if (season != null) qs.set('season', String(season));
      if (episode != null) qs.set('episode', String(episode));

      const resp = await fetch(`/api/cinema-streams?${qs.toString()}`);
      if (!resp.ok) throw new Error('Falha ao consultar streams');
      const data = await resp.json();
      const streams = Array.isArray(data.streams) ? data.streams.filter(s => s && s.url) : [];

      if (bufText) bufText.textContent = 'Projetando no Telão 3D...';
      if (streams.length === 0) {
        if (bufOverlay) bufOverlay.style.display = 'none';
        showToast('⚠️ Nenhuma fonte compatível (MP4/WebM/HLS) encontrada para esta mídia.', 4200);
        return;
      }

      const best = streams[0];
      setupStreamOptionsMenu(streams, displayTitle);
      playStreamInCinema(best.url, displayTitle, !!best.direct, true);
    } catch (err) {
      if (bufOverlay) bufOverlay.style.display = 'none';
      if (bufText) bufText.textContent = 'Projetando no Telão 3D...';
      showToast('⚠️ Não foi possível abrir esta mídia no Telão 3D.', 3800);
    }
  }

  async function openSeriesEpisodesDrawer(seriesItem) {
    if (!seriesEpisodesPanel || !catalogMainView) return;
    catalogMainView.style.display = 'none';
    seriesEpisodesPanel.style.display = 'flex';
    seriesPanelTitle.textContent = seriesItem.title || 'Série';
    seasonTabsRow.innerHTML = '';
    episodesList.innerHTML = '<div class="loading-spinner">Carregando temporadas e episódios compatíveis...</div>';

    let episodes = Array.isArray(seriesItem.episodes) && seriesItem.episodes.length > 0
      ? seriesItem.episodes
      : null;

    if (!episodes) {
      try {
        const resp = await fetch(`/api/cinema-episodes?id=${encodeURIComponent(seriesItem.id)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.episodes)) {
            episodes = data.episodes;
          }
        }
      } catch (e) {
        episodes = [];
      }
    }

    if (!episodes || episodes.length === 0) {
      episodesList.innerHTML = '<div class="loading-spinner">Nenhum episódio compatível com o Telão 3D disponível para esta série.</div>';
      return;
    }

    const seasonsMap = new Map();
    episodes.forEach(ep => {
      const sNum = Number(ep.season || 1);
      if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
      seasonsMap.get(sNum).push(ep);
    });

    const sortedSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
    let currentSeason = sortedSeasons[0];

    function renderSeasonEpisodes(seasonNum) {
      currentSeason = seasonNum;
      Array.from(seasonTabsRow.children).forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.season) === seasonNum);
      });
      const list = seasonsMap.get(seasonNum) || [];
      episodesList.innerHTML = '';
      list.forEach(ep => {
        const row = document.createElement('div');
        row.className = 'episode-row-card';
        const epNum = ep.episode || 1;
        const epLabel = `T${seasonNum}:E${epNum} — ${ep.title || ('Episódio ' + epNum)}`;
        const thumbUrl = ep.thumbnail || seriesItem.thumb || fallbackThumbSvg;
        row.innerHTML = `
          <img class="episode-row-thumb" src="${thumbUrl}" alt="${epLabel}" onerror="this.src='${fallbackThumbSvg}'" />
          <div class="episode-row-info">
            <div class="episode-row-title">${epLabel}</div>
            <div class="episode-row-desc">${ep.overview || 'Compatível com projeção IMAX 3D & Áudio 5.1'}</div>
          </div>
          <span class="episode-row-play">&#9654; Projetar</span>
        `;
        row.addEventListener('click', () => {
          launchCatalogMovieOrEpisode({
            type: 'series',
            metaId: seriesItem.id,
            videoId: ep.videoId || `${seriesItem.id}:${seasonNum}:${epNum}`,
            season: seasonNum,
            episode: epNum,
            displayTitle: `${seriesItem.title} • T${seasonNum}E${epNum}`,
            directUrl: ep.directUrl || null,
            isDirectLocal: !!ep.isDirectLocal,
          });
        });
        episodesList.appendChild(row);
      });
    }

    sortedSeasons.forEach(sNum => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'season-tab-btn' + (sNum === currentSeason ? ' active' : '');
      btn.dataset.season = String(sNum);
      btn.textContent = `Temporada ${sNum}`;
      btn.addEventListener('click', () => renderSeasonEpisodes(sNum));
      seasonTabsRow.appendChild(btn);
    });

    renderSeasonEpisodes(currentSeason);
  }

  function renderCatalogGrid(filterText = '') {
    if (!movieGrid) return;
    const query = filterText.toLowerCase().trim();
    const filtered = catalogItems.filter(item => {
      if (activeCategoryFilter !== 'all' && item.type !== activeCategoryFilter) return false;
      if (query && !item.title.toLowerCase().includes(query)) return false;
      return true;
    });

    movieGrid.innerHTML = '';
    if (filtered.length === 0) {
      movieGrid.innerHTML = `<div class="loading-spinner">Nenhum filme ou série compatível encontrado.</div>`;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      const isSeries = item.type === 'series';
      const defaultBadge = isSeries ? 'SÉRIE • COMPATÍVEL' : 'FILME • COMPATÍVEL';
      const thumbSrc = item.thumb || fallbackThumbSvg;
      card.innerHTML = `
        <div class="movie-card-thumb-container">
          <img class="movie-card-thumb" src="${thumbSrc}" alt="${item.title}" onerror="this.src='${fallbackThumbSvg}'" />
          <span class="movie-card-badge">${item.badge || defaultBadge}</span>
          <div class="movie-card-play-overlay">
            <div class="movie-card-play-icon">
              <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </div>
        <div class="movie-card-title" title="${item.title}">${item.title}</div>
      `;
      card.addEventListener('click', () => {
        if (isSeries) {
          openSeriesEpisodesDrawer(item);
        } else {
          launchCatalogMovieOrEpisode({
            type: 'movie',
            metaId: item.id,
            videoId: item.videoId || item.id,
            season: null,
            episode: null,
            displayTitle: item.title,
            directUrl: item.directUrl || null,
            isDirectLocal: !!item.isDirectLocal,
          });
        }
      });
      movieGrid.appendChild(card);
    });
  }

  function loadCompatibleCatalog() {
    if (!movieGrid) return;
    showCatalogGridView();
    movieGrid.innerHTML = '<div class="loading-spinner">Filtrando filmes e séries compatíveis com o Telão 3D...</div>';

    fetch('/api/cinema-catalog')
      .then(r => { if (!r.ok) throw new Error('no-catalog-api'); return r.json(); })
      .then(payload => {
        if (payload && Array.isArray(payload.items) && payload.items.length > 0) {
          catalogItems = payload.items;
        } else {
          catalogItems = [...FALLBACK_COMPATIBLE_CATALOG];
        }
        renderCatalogGrid(librarySearch ? librarySearch.value : '');
      })
      .catch(() => {
        catalogItems = [...FALLBACK_COMPATIBLE_CATALOG];
        renderCatalogGrid(librarySearch ? librarySearch.value : '');
      });
  }

  if (librarySearch) {
    librarySearch.addEventListener('input', (e) => renderCatalogGrid(e.target.value));
  }
  if (refreshLibraryBtn) {
    refreshLibraryBtn.addEventListener('click', () => {
      loadCompatibleCatalog();
      showToast('🔄 Catálogo compatível atualizado!');
    });
  }
  loadCompatibleCatalog();

  // ── Tab 2: Do Aparelho (Com Filtro de Compatibilidade WebGL) ────
  const localFileInput = document.getElementById('local-file-input');
  const browseLocalBtn = document.getElementById('browse-local-btn');
  const localDropZone = document.getElementById('local-drop-zone');
  const localCompatAlert = document.getElementById('local-compat-alert');
  const selectedFileCard = document.getElementById('selected-file-card');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');
  const btnPlayInstant = document.getElementById('btn-play-instant');
  const browseSubBtn = document.getElementById('browse-sub-btn');
  const subFileInput = document.getElementById('sub-file-input');
  const subFileName = document.getElementById('sub-file-name');

  let currentSelectedLocalFile = null;

  function formatBytes(bytes, decimals = 1) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  function handleFileSelected(file) {
    if (!file) return;
    const check = validateLocalFileForCinema3D(file);
    if (!check.ok) {
      currentSelectedLocalFile = null;
      if (selectedFileCard) selectedFileCard.style.display = 'none';
      if (localCompatAlert) {
        localCompatAlert.className = 'url-status-message error';
        localCompatAlert.textContent = '⚠️ ' + check.reason;
      }
      showToast('⚠️ ' + check.reason, 4500);
      return;
    }
    if (localCompatAlert) {
      localCompatAlert.className = 'url-status-message';
      localCompatAlert.textContent = '';
    }
    currentSelectedLocalFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);
    selectedFileCard.style.display = 'block';
  }

  if (browseLocalBtn && localFileInput) {
    browseLocalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localFileInput.click();
    });
  }
  if (localDropZone && localFileInput) {
    localDropZone.addEventListener('click', () => localFileInput.click());
    localDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      localDropZone.classList.add('drag-over');
    });
    localDropZone.addEventListener('dragleave', () => localDropZone.classList.remove('drag-over'));
    localDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      localDropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
    localFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelected(e.target.files[0]);
      }
    });
  }

  if (btnPlayInstant) {
    btnPlayInstant.addEventListener('click', () => {
      if (!currentSelectedLocalFile) return;
      initAudio(camera, scene, video);
      resumeAudio();
      resetAudioToNative();
      const blobUrl = URL.createObjectURL(currentSelectedLocalFile);
      loadVideoUrl(blobUrl, currentSelectedLocalFile.name, showHUD);
      setupStreamOptionsMenu(null, currentSelectedLocalFile.name);
      closeMediaModal();
      showToast(`🎬 Projetando ${currentSelectedLocalFile.name} no telão 3D!`, 3500);
    });
  }

  if (browseSubBtn && subFileInput) {
    browseSubBtn.addEventListener('click', () => subFileInput.click());
    subFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const subFile = e.target.files[0];
        subFileName.textContent = subFile.name;
        loadSubtitleFile(subFile);
        showToast(`💬 Legenda ${subFile.name} ativada no telão 3D!`);
      }
    });
  }

  // ── Tab 3: Por Link (Com Validação de Compatibilidade) ──────────
  const webUrlInput = document.getElementById('web-url-input');
  const btnPlayUrl = document.getElementById('btn-play-url');

  if (webUrlInput) {
    webUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnPlayUrl) btnPlayUrl.click();
      }
    });
    webUrlInput.addEventListener('input', () => {
      if (urlStatus) {
        urlStatus.className = 'url-status-message';
        urlStatus.textContent = '';
      }
    });
  }

  if (btnPlayUrl) {
    btnPlayUrl.addEventListener('click', () => {
      const url = webUrlInput.value.trim();
      const check = validateUrlForCinema3D(url);
      if (!check.ok) {
        if (urlStatus) {
          urlStatus.className = 'url-status-message error';
          urlStatus.textContent = '⚠️ ' + check.reason;
        }
        return;
      }
      playStreamInCinema(url);
    });
  }

  // ── Global Drag & Drop (Desktop) ───────────────────────────────
  const globalDragOverlay = document.getElementById('global-drag-overlay');
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (globalDragOverlay) globalDragOverlay.style.display = 'flex';
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0 && globalDragOverlay) globalDragOverlay.style.display = 'none';
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (globalDragOverlay) globalDragOverlay.style.display = 'none';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = extractExtension(file.name);
      if (ext === 'srt' || ext === 'vtt') {
        loadSubtitleFile(file);
        showToast(`💬 Legenda ${file.name} aplicada!`);
        return;
      }
      const check = validateLocalFileForCinema3D(file);
      if (!check.ok) {
        showToast('⚠️ ' + check.reason, 4500);
        return;
      }
      initAudio(camera, scene, video);
      resumeAudio();
      resetAudioToNative();
      loadVideoUrl(URL.createObjectURL(file), file.name, showHUD);
      setupStreamOptionsMenu(null, file.name);
      closeMediaModal();
      showToast(`🎬 Projetando ${file.name} no telão 3D!`, 3500);
    }
  });

  // ── Keyboard Shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    switch (e.key) {
      case ' ':          e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':  e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
      case 'ArrowRight': e.preventDefault(); if (!state.isLive) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); break;
      case 'ArrowUp':    e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); volBar.value = video.volume * 100; updMute(); break;
      case 'ArrowDown':  e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); volBar.value = video.volume * 100; updMute(); break;
      case 'f': case 'F': toggleFS(); break;
      case 'l': case 'L': toggleLights(); break;
      case 'm': case 'M': toggleMute(); break;
      case 'c': case 'C': recenterView(true); break;
      case 'Escape':     closeMediaModal(); break;
      case 'o': case 'O':
        welcomeScreen.style.display = welcomeScreen.style.display === 'none' ? 'flex' : 'none';
        break;
    }
  });

  // ── Parse Initial Launch Parameters (?streamUrl=...&title=...&lights=...&explore=...) ──
  const params = new URLSearchParams(window.location.search);
  const initialStreamUrl = params.get('streamUrl') || params.get('url');
  const initialTitle = params.get('title') || 'Sessão Cinema 3D';
  const initialLights = params.get('lights');
  const skipHub = params.get('explore') === '1';

  if (initialLights === 'on') setLightsState(true);

  // ── Intro Curtains Loading Sequence ────────────────────────────
  const bar = document.getElementById('loading-bar');
  const ls = document.getElementById('loading-screen');
  let pct = 0;
  const ti = setInterval(() => {
    pct += Math.random() * 24 + 14;
    bar.style.width = Math.min(pct, 96) + '%';
    if (pct >= 96) {
      clearInterval(ti);
      bar.style.width = '100%';
      setTimeout(() => {
        ls.classList.add('curtains-open');
        setTimeout(() => {
          ls.style.display = 'none';
          if (initialStreamUrl) {
            playStreamInCinema(initialStreamUrl, initialTitle, initialStreamUrl.startsWith('movies/'));
          } else if (!skipHub) {
            welcomeScreen.style.display = 'flex';
          } else {
            showToast('🍿 Arraste na tela para explorar a arquitetura da Sala 3D!', 3500);
          }
        }, 1250);
      }, 250);
    }
  }, 90);
}
