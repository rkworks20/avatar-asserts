// code.js

// 1️⃣ Bring in your authenticated headers
import { FETCH_HEADERS } from './token.js';

// 2️⃣ Show the UI
figma.showUI(__html__, { width: 240, height: 200 });

// 3️⃣ Helper: fetch JSON from GitHub API
async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// 4️⃣ Repo + folders config
const GH_USER   = 'rkworks20';
const GH_REPO   = 'avatar-asserts';
const GH_BRANCH = 'main';
const FOLDERS   = ['realistic','character3D','cartoon','funky','notion','robots'];

// 5️⃣ Build items and send to UI
(async () => {
  try {
    const base = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts`;
    const items = [];
    for (const folder of FOLDERS) {
      const data = await fetchJson(`${base}/${folder}?ref=${GH_BRANCH}`);
      const images = data
        .filter(f => f.type === 'file' && /\.(jpe?g|png)$/i.test(f.name))
        .map(f => f.download_url);
      if (images.length) {
        items.push({ folder, preview: images[0], all: images });
      }
    }
    figma.ui.postMessage({ type: 'init', items });
  } catch (err) {
    console.error(err);
    figma.notify(`⚠️ Failed to load avatars: ${err.message}`);
  }
})();

// 6️⃣ Handle UI messages (resize + insert)
figma.ui.onmessage = async msg => {
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    return;
  }
  if (msg.type === 'insert-from') {
    const { folder, items } = msg;
    const sel = figma.currentPage.selection;
    if (!sel.length) return figma.notify('❗ Select at least one shape or frame.');

    const item = items.find(i => i.folder === folder);
    if (!item) return figma.notify(`⚠️ Folder "${folder}" not found.`);

    try {
      // fetch images *without* auth headers
      const hashes = await Promise.all(
        item.all.map(async url => {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`Image ${r.status}`);
          const buf = await r.arrayBuffer();
          return figma.createImage(new Uint8Array(buf)).hash;
        })
      );
      // shuffle
      for (let i = hashes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hashes[i], hashes[j]] = [hashes[j], hashes[i]];
      }
      let idx = 0;
      for (const node of sel) {
        if ('fills' in node) {
          node.fills = [{
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash: hashes[idx++ % hashes.length]
          }];
        }
      }
    } catch (err) {
      console.error(err);
      figma.notify(`⚠️ Insert failed: ${err.message}`);
    }
  }
};