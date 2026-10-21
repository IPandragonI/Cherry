import media from "nosleep.js/src/media.js";

/** Home-screen apps on iOS before 18.4 get a wake lock that silently does nothing. */
function unreliableWakeLock(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !("wakeLock" in navigator) || standalone;
}

/**
 * Keeps the screen on until the returned function is called. Uses the Screen Wake Lock
 * API, taken again whenever the browser drops it (page hidden, lock released by the OS);
 * where it is missing or unreliable (iOS home-screen apps), a tiny muted video loops
 * invisibly, which iOS also treats as "don't sleep" (the NoSleep.js technique).
 */
export function keepScreenAwake(): () => void {
  let active = true;
  let lock: WakeLockSentinel | null = null;
  let video: HTMLVideoElement | null = null;

  const request = async () => {
    if (!active || lock || !("wakeLock" in navigator) || document.visibilityState !== "visible") {
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!active) return void sentinel.release().catch(() => {});
      lock = sentinel;
      sentinel.addEventListener("release", () => {
        lock = null;
        // Dropped by the OS while the page is still shown: take it again.
        if (active && document.visibilityState === "visible") void request();
      });
    } catch {
      // Refused (e.g. battery saver): fall back on the video.
      startVideo();
    }
  };

  const startVideo = () => {
    if (!active) return;
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.loop = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      video.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0";
      for (const [type, src] of [
        ["webm", media.webm],
        ["mp4", media.mp4],
      ]) {
        const source = document.createElement("source");
        source.src = src;
        source.type = `video/${type}`;
        video.appendChild(source);
      }
      document.body.appendChild(video);
    }
    if (video.paused) void video.play().catch(() => {});
  };

  const refresh = () => {
    if (document.visibilityState !== "visible") return;
    void request();
    if (video || unreliableWakeLock()) startVideo();
  };

  document.addEventListener("visibilitychange", refresh);
  // Some browsers only grant the lock (or play the video) after a user gesture.
  document.addEventListener("pointerdown", refresh, true);
  refresh();

  return () => {
    active = false;
    document.removeEventListener("visibilitychange", refresh);
    document.removeEventListener("pointerdown", refresh, true);
    void lock?.release().catch(() => {});
    lock = null;
    video?.pause();
    video?.remove();
    video = null;
  };
}
