// 1️⃣ Show the UI; we’ll resize it after we know how many circles we need
figma.showUI(__html__, { width: 240, height: 200 });

// 2️⃣ Your GitHub PAT (public_repo scope)
const GITHUB_TOKEN = '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';
const FETCH_HEADERS = { Authorization: `Bearer ${GITHUB_TOKEN}` };

// 3️⃣ Helper: fetch JSON from GitHub API (with auth)
async function fetchJson(url) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// 4️⃣ Repo settings
const GH_USER   = 'rkworks20';
const GH_REPO   = 'avatar-asserts';
const GH_BRANCH = 'main';

// 5️⃣ List all sub-folders under asserts/
async function listFolders() {
  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts?ref=${GH_BRANCH}`;
  const data = await fetchJson(url);
  return data.filter(item => item.type === 'dir').map(item => item.name);
}

// 6️⃣ Build and send items to UI on plugin open
(async () => {
  try {
    const folders = await listFolders();
    const items = [];

    for (const folder of folders) {
      const url  = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts/${folder}?ref=${GH_BRANCH}`;
      const data = await fetchJson(url);
      const images = data
        .filter(f => f.type === 'file' && /\.(jpe?g|png)$/i.test(f.name))
        .map(f => f.download_url);

      if (images.length) {
        items.push({
          folder,
          preview: images[0],
          all: images
        });
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
      // Fetch & hash each image URL (no auth needed on raw URLs)
      const hashes = await Promise.all(
        item.all.map(async url => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Image ${resp.status}`);
          const buf = await resp.arrayBuffer();
          return figma.createImage(new Uint8Array(buf)).hash;
        })
      );
      // Shuffle
      for (let i = hashes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hashes[i], hashes[j]] = [hashes[j], hashes[i]];
      }
      let idx = 0;
      // Fill each selected node
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