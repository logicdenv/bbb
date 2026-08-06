const db = require('./_db');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const PROVIDERS = [
  { name: 'CleanURI', url: 'https://cleanuri.com/api/v1/shorten', method: 'POST', parse: d => d.result_url },
  { name: '1pt.co', url: 'https://1pt.co/api', method: 'POST', parse: d => d.shortened },
  { name: 'Shrtcode', url: (u) => `https://api.shrtco.de/v2/shorten?url=${encodeURIComponent(u)}`, method: 'GET', parse: d => d.result?.full_short_link },
  { name: 'GoTiny', url: 'https://gotiny.cc/api', method: 'POST', parse: d => d[0]?.short_url },
  { name: 'is.gd', url: (u) => `https://is.gd/create.php?format=simple&url=${encodeURIComponent(u)}`, method: 'GET', parse: d => typeof d === 'string' && d.startsWith('http') ? d.trim() : null },
  { name: 'vgd.me', url: (u) => `https://v.gd/create.php?format=simple&url=${encodeURIComponent(u)}`, method: 'GET', parse: d => typeof d === 'string' && d.startsWith('http') ? d.trim() : null },
  { name: 'Ulvis', url: (u) => `https://ulvis.net/api.php?url=${encodeURIComponent(u)}`, method: 'GET', parse: d => typeof d === 'string' && d.startsWith('http') ? d.trim() : null },
  { name: 'Shrtr', url: 'https://shrtr.top/api/v1/urls', method: 'POST', parse: d => d.short_url },
  { name: 'LinkShrink', url: 'https://linkshrink.dev/api/urls', method: 'POST', parse: d => d.short_url || d.url },
  { name: 'owo.vc', url: 'https://owo.vc/api/v2/shorten', method: 'POST', parse: d => d.shortened || d.short_url },
  { name: 'ShortLink', url: 'https://shortlink.ink/api/v1/shorten', method: 'POST', parse: d => d.short_url },
  { name: 'TinyURL', url: (u) => `https://api.tinyurl.com/create?url=${encodeURIComponent(u)}`, method: 'POST', parse: d => d.data?.tiny_url },
  { name: 'Chilp.it', url: (u) => `https://chilp.it/api.php?url=${encodeURIComponent(u)}`, method: 'GET', parse: d => typeof d === 'string' && d.includes('http') ? d.trim() : null },
  { name: 'Git.io', url: (u) => `https://git.io/create?url=${encodeURIComponent(u)}`, method: 'GET', parse: d => typeof d === 'string' && d.startsWith('http') ? d.trim() : null },
  { name: 'URLShort.at', url: 'https://urlshort.at/api/urls', method: 'POST', parse: d => d.short_url },
  { name: 'Meshalive', url: 'https://meshalive.com/api/urls', method: 'POST', parse: d => d.short_url }
];

async function tryProvider(provider, url) {
  try {
    const config = provider;
    let response;
    const options = { headers: { 'Content-Type': 'application/json' } };

    const apiUrl = typeof config.url === 'function' ? config.url(url) : config.url;

    if (config.method === 'POST') {
      const body = { url: url };
      if (provider.name === '1pt.co') {
        const formData = new URLSearchParams();
        formData.append('url', url);
        response = await axios.post(apiUrl, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      } else {
        response = await axios.post(apiUrl, body, options);
      }
    } else {
      response = await axios.get(apiUrl);
    }

    const data = response.data;
    const shortUrl = config.parse(data);
    if (!shortUrl) return { success: false };
    return { success: true, url: shortUrl, provider: provider.name };

  } catch {
    return { success: false };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const tier = user.tier || 'free';
  const providerList = tier === 'vip' ? PROVIDERS : PROVIDERS.slice(0, 5);

  for (const provider of providerList) {
    const result = await tryProvider(provider, url);
    if (result.success) {
      db.run(
        'INSERT INTO links (user_id, original_url, short_url, provider) VALUES (?, ?, ?, ?)',
        [user.id, url, result.url, result.provider]
      );
      return res.json({ success: true, url: result.url, provider: result.provider, tier });
    }
  }

  res.status(503).json({ success: false, error: 'All providers failed' });
};
