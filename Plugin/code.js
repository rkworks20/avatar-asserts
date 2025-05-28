// 1️⃣ Show the UI
figma.showUI(__html__, { width: 240, height: 200 });

// 2️⃣ Paste your GitHub PAT here (public_repo scope)
const GITHUB_TOKEN = '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';
const FETCH_HEADERS = { Authorization: `Bearer ${GITHUB_TOKEN}` };

// 3️⃣ Helper for GitHub API JSON (with auth)
async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// 4️⃣ Repo + folder settings
const GH_USER   = 'rkworks20';
const GH_REPO   = 'avatar-asserts';
const GH_BRANCH = 'main';
const FOLDERS   = ['realistic','character3D','cartoon','funky','notion','robots'];

// 5️⃣ Build items and send to UI
(async () => {
  try {
    const baseUrl = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts`;
    const items = [];

    for (const folder of FOLDERS) {
      const url  = `${baseUrl}/${folder}?ref=${GH_BRANCH}`;
      const data = await fetchJson(url);

      // filter only images
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

// 6️⃣ Handle UI messages
figma.ui.onmessage = async msg => {
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    return;
  }

  if (msg.type === 'insert-from') {
    const { folder, items } = msg;
    const sel = figma.currentPage.selection;
    if (!sel.length) {
      figma.notify('❗ Select at least one shape or frame.');
      return;
    }

    const item = items.find(i => i.folder === folder);
    if (!item) {
      figma.notify(`⚠️ Folder "${folder}" not found.`);
      return;
    }

    try {
      // 🚫 No auth headers on image fetch
      const hashes = await Promise.all(
        item.all.map(async url => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Image ${resp.status}`);
          const buf = await resp.arrayBuffer();
          return figma.createImage(new Uint8Array(buf)).hash;
        })
      );

      // shuffle
      for (let i = hashes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hashes[i], hashes[j]] = [hashes[j], hashes[i]];
      }
      let idx = 0;

      // apply fills
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