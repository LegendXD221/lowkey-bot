'use strict';

const KNOWN = [
  { test: /linkvertise\.com|link-to\.net|direct-link\.net/i, name: 'Linkvertise' },
  { test: /adfoc\.us/i, name: 'AdFoc.us' },
  { test: /boost\.gg|boost.gg/i, name: 'Boost.gg' },
  { test: /work\.ink|workink/i, name: 'Work.ink' },
  { test: /loot-link\.com|lootlabs/i, name: 'LootLabs' },
  { test: /mboost\.me/i, name: 'mBoost' },
  { test: /social-unlock\.com/i, name: 'Social Unlock' },
  { test: /sub2get\.com|sub2unlock/i, name: 'Sub2Unlock' },
  { test: /rekonise\.com/i, name: 'Rekonise' },
  { test: /socialwolvez\.com/i, name: 'SocialWolvez' },
  { test: /bitscent\.com/i, name: 'Bitscent' },
  { test: /mediafire\.com/i, name: 'MediaFire' },
  { test: /mega\.nz/i, name: 'MEGA' },
  { test: /drive\.google\.com/i, name: 'Google Drive' },
  { test: /dropbox\.com/i, name: 'Dropbox' },
  { test: /pastebin\.com/i, name: 'Pastebin' },
  { test: /rentry\.co/i, name: 'Rentry' }
];

function detectService(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    for (const k of KNOWN) {
      if (k.test.test(host) || k.test.test(url)) return k.name;
    }
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function hostMatchesPatterns(url, patterns) {
  if (!patterns || !patterns.length) return true; // no filter = accept all
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  for (const p of patterns) {
    const pat = String(p).trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
    // Match the hostname or one of its subdomains, never a lookalike such as
    // `notexample.com` when the configured pattern is `example.com`.
    if (pat && (host === pat || host.endsWith('.' + pat))) return true;
  }
  return false;
}

module.exports = { detectService, hostMatchesPatterns, KNOWN };
