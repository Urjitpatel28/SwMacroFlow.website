/*
  Click-to-play for the intro teaser on the home page.

  The file is 6 MB of music-led type: there is nothing to gain from autoplaying it muted, and a
  lot to lose from having it - or even its <video> element - in the page at load, right under the
  hero screenshot that the rest of index.html works hard to make the LCP. So the markup ships a
  facade instead: a lazily loaded poster behind a button. This swaps in the real player on click,
  which is a user gesture, so the browser lets it start with sound.

  index.html carries a <noscript> copy of the same video with preload="none" for anyone without
  this script, so the section is never a dead poster.
*/
(function () {
  "use strict";

  const frame = document.querySelector("[data-intro-video]");
  const button = frame && frame.querySelector("[data-intro-play]");
  if (!frame || !button) return;

  const src = frame.getAttribute("data-src");
  const poster = frame.getAttribute("data-poster");
  if (!src) return;

  button.addEventListener("click", function () {
    const video = document.createElement("video");
    video.className = "intro-player";
    video.src = src;
    if (poster) video.poster = poster;
    video.controls = true;
    video.preload = "auto";
    // iOS Safari full-screens an inline video on play without this, which throws the reader out
    // of the page for a 24 second clip.
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-label", "SwMacroFlow intro video");

    button.replaceWith(video);

    const started = video.play();
    // A rejected play() is not a failure worth surfacing: the controls are already there, and the
    // reader can start it themselves.
    if (started && typeof started.catch === "function") started.catch(function () {});
  }, { once: true });
})();
