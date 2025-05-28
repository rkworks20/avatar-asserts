// 1️⃣ Show the UI; it will resize itself once populated
figma.showUI(__html__, { width: 240, height: 200 });

// 2️⃣ Paste your Personal Access Token here (public_repo scope)
const GITHUB_TOKEN = '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';

// 3️⃣ Automatically include it in every GitHub API request
const FETCH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`
};

// 4️⃣ Helper to fetch JSON from GitHub and throw on error
async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// 5️⃣ Repo settings and hard-coded folders
const GH_USER   = 'rkworks20';
const GH_REPO   = 'avatar-asserts';
const GH_BRANCH = 'main';
const FOLDERS   = ['realistic','character3D','cartoon','funky','notion','robots'];

// 6️⃣ Build items array and send it to the UI
(async () => {
  try {
    const baseUrl = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts`;
    const items = [];

    for (const folder of FOLDERS) {
      const url  = `${baseUrl}/${folder}?ref=${GH_BRANCH}`;
      const data = await fetchJson(url);

      // keep only image files
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

// 7️⃣ Handle messages from the UI
figma.ui.onmessage = async msg => {
  if (msg.type === 'resize') {
    figma.ui.resize(msg.width, msg.height);
    return;
  }

  if (msg.type === 'insert-from') {
    const { folder, items } = msg;
    const selection = figma.currentPage.selection;
    if (!selection.length) {
      figma.notify('❗ Select at least one shape or frame.');
      return;
    }

    const item = items.find(i => i.folder === folder);
    if (!item) {
      figma.notify(`⚠️ Folder "${folder}" not found.`);
      return;
    }

    try {
      // fetch & hash each image URL
      const hashes = await Promise.all(
        item.all.map(async url => {
          const buf = await (await fetch(url, { headers: FETCH_HEADERS })).arrayBuffer();
          return figma.createImage(new Uint8Array(buf)).hash;
        })
      );

      // shuffle
      for (let i = hashes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hashes[i], hashes[j]] = [hashes[j], hashes[i]];
      }
      let idx = 0;

      // fill each selected node
      for (const node of selection) {
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