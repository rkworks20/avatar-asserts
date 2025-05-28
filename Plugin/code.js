// Show the UI; it will resize itself once populated
figma.showUI(__html__, { width: 240, height: 200 });

// GitHub repo settings
const GH_USER   = 'rkworks20';
const GH_REPO   = 'avatar-asserts';
const GH_BRANCH = 'main';

// The exact folders you want to use
const FOLDERS = ['realistic','character3D','cartoon','funky','notion','robots'];

// Helper to fetch JSON and throw on HTTP errors
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Build the items array and send it to the UI
(async () => {
  try {
    const baseUrl = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/contents/asserts`;
    const items = [];

    for (const folder of FOLDERS) {
      const url = `${baseUrl}/${folder}?ref=${GH_BRANCH}`;
      const data = await fetchJson(url);
      // Filter only image files
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

// Handle messages from the UI
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
      // Fetch & hash each image URL
      const hashes = await Promise.all(
        item.all.map(async url => {
          const buf = await (await fetch(url)).arrayBuffer();
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