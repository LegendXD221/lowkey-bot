'use strict';
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { formatLatency, formatPercent, truncate } = require('./formatters');
const { detectService } = require('./serviceDetect');

const THEME = { primary: 0x2b2d31, accent: 0x5865f2, success: 0x57f287, warning: 0xfee75c, error: 0xed4245, muted: 0x4e5058 };
const EMOJI = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', unlock: '🔓', gear: '⚙️', chart: '📊', health: '💚', degraded: '💛', down: '❤️', disabled: '⚫', link: '🔗' };
let customEmojis = {};
function setCustomEmojis(map) { customEmojis = map || {}; }
function e(key) { return customEmojis[key] || EMOJI[key] || ''; }
function emojiData(key) {
  const value = e(key);
  const custom = typeof value === 'string' && value.match(/^<(a?):([\w~]+):(\d+)>$/);
  return custom
    ? { id: custom[3], name: custom[2], animated: Boolean(custom[1]) }
    : { name: value };
}
function baseEmbed() {
  return new EmbedBuilder().setColor(THEME.primary).setTimestamp().setFooter({ text: 'Lowkey' });
}
function embedTitle(icon, title) {
  return truncate(`${icon} ${title || ''}`.trim(), 256);
}
function embedDescription(description) {
  return description == null ? null : truncate(String(description), 4096);
}
function successEmbed(title, description) {
  return baseEmbed().setColor(THEME.success).setTitle(embedTitle(e('success'), title)).setDescription(embedDescription(description));
}
function errorEmbed(title, description) {
  return baseEmbed().setColor(THEME.error).setTitle(embedTitle(e('error'), title)).setDescription(embedDescription(description));
}
function warningEmbed(title, description) {
  return baseEmbed().setColor(THEME.warning).setTitle(embedTitle(e('warning'), title)).setDescription(embedDescription(description));
}
function infoEmbed(title, description) {
  return baseEmbed().setColor(THEME.accent).setTitle(embedTitle(e('info'), title)).setDescription(embedDescription(description));
}

function isHttpResult(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function bypassSuccessEmbed({ originalUrl, resultUrl, provider, latencyMs, service, fromCache }) {
  const emb = baseEmbed().setColor(THEME.success).setTitle(`${e('unlock')} Bypass Complete`);
  const svc = service || detectService(originalUrl);
  if (svc) emb.addFields({ name: 'Service', value: svc, inline: true });
  if (latencyMs != null) {
    emb.addFields({ name: 'Time', value: fromCache ? `${formatLatency(latencyMs)} · cache` : formatLatency(latencyMs), inline: true });
  }
  if (resultUrl) {
    // Display as markdown link only — raw URL lives in resultStore for copy buttons
    const resultValue = String(resultUrl).length <= 850
      ? `[Open unlocked link](<${resultUrl}>)`
      : 'Result available — use the copy buttons below.';
    emb.addFields({ name: 'Result', value: resultValue, inline: false });
  } else {
    emb.addFields({ name: 'Result', value: '—', inline: false });
  }
  if (originalUrl) {
    emb.addFields({ name: 'Original', value: `\`${truncate(originalUrl, 90)}\``, inline: false });
  }
  return emb;
}

function buildBypassComponents(resultUrl) {
  if (!resultUrl || typeof resultUrl !== 'string') return [];
  const url = resultUrl.trim();
  if (!url) return [];

  const row = new ActionRowBuilder();

  // Discord Link buttons require a valid URL ≤ 512 chars
  if (isHttpResult(url) && url.length <= 512) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Open Result')
        .setStyle(ButtonStyle.Link)
        .setEmoji(emojiData('link'))
        .setURL(url)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('lowkey:copy:mobile')
      .setLabel('Mobile Copy')
      .setEmoji('📱')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('lowkey:copy:pc')
      .setLabel('PC Copy')
      .setEmoji('🖥️')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row];
}

function buildBypassPayload(data) {
  return {
    embeds: [bypassSuccessEmbed(data)],
    components: buildBypassComponents(data.resultUrl)
  };
}

/** @deprecated use resultStore — kept for older messages that still have a URL field */
function extractResultUrlFromMessage(message) {
  const embeds = message?.embeds;
  if (!embeds || !embeds.length) return null;
  const fields = embeds[0].fields || [];
  const urlField = fields.find(f => f.name === 'URL');
  if (urlField?.value) return urlField.value.replace(/…$/, '').trim();
  const resultField = fields.find(f => f.name === 'Result');
  if (resultField?.value) {
    const m = resultField.value.match(/\((https?:\/\/[^)\s]+)\)/i);
    if (m) return m[1];
  }
  return null;
}

function maintenanceEmbed(message) {
  return baseEmbed().setColor(THEME.warning).setTitle(embedTitle(e('gear'), 'Maintenance'))
    .setDescription(embedDescription(message || 'The bot is currently under maintenance. Please try again later.'));
}

function statusEmbed(data) {
  const emb = baseEmbed().setColor(THEME.accent).setTitle(`${e('chart')} System Status`);
  emb.addFields(
    { name: 'Providers', value: `${data.enabled}/${data.total} enabled`, inline: true },
    { name: 'Healthy', value: String(data.healthy), inline: true },
    { name: 'Degraded', value: String(data.degraded), inline: true },
    { name: 'Down', value: String(data.down), inline: true },
    { name: 'Disabled', value: String(data.disabled), inline: true },
    { name: 'Avg Latency', value: formatLatency(data.avgLatency), inline: true },
    { name: 'Database', value: data.dbOk ? 'Connected' : 'Disconnected', inline: true },
    { name: 'Maintenance', value: data.maintenance ? 'ON' : 'OFF', inline: true }
  );
  if (data.providers && data.providers.length) {
    const lines = data.providers.slice(0, 15).map(p => {
      const icon = p.state === 'HEALTHY' ? e('health') : p.state === 'DEGRADED' ? e('degraded') : p.state === 'DOWN' ? e('down') : e('disabled');
      return `${icon} **${p.name}** · ${p.state} · ${formatPercent(p.successRate)} · ${formatLatency(p.avgLatency)}`;
    });
    emb.addFields({ name: 'Provider Detail', value: truncate(lines.join('\n') || '—', 1024) });
  }
  return emb;
}

function helpEmbed(isOwner) {
  const emb = baseEmbed().setColor(THEME.accent).setTitle('Lowkey — Commands');
  emb.addFields(
    { name: '/bypass', value: 'Unlock a supported link', inline: false },
    { name: '/inspect', value: 'Validate and inspect a link safely', inline: true },
    { name: '/health', value: 'Check service health', inline: true },
    { name: '/providers', value: 'List known services', inline: true },
    { name: '/help', value: 'Show this help', inline: true },
    { name: '/ping', value: 'Latency check', inline: true },
    { name: '/about', value: 'Bot info', inline: true },
    { name: '/stats', value: 'Public usage stats', inline: true },
    { name: '/privacy', value: 'Data & privacy', inline: true }
  );
  if (isOwner) emb.addFields({ name: 'Owner', value: 'Use `/ownerhelp` for administrative commands.', inline: false });
  return emb;
}

function ownerHelpEmbed() {
  return baseEmbed().setColor(THEME.accent).setTitle('Lowkey — Owner Commands').setDescription([
    '`/addapi` — Register API provider', '`/removeapi` — Remove provider', '`/toggleapi` — Enable/disable provider',
    '`/testapi` — Test a provider', '`/api-list` — List providers', '`/api-info` — Provider details',
    '`/api-priority` — Set priority', '`/api-stats` — Usage statistics', '`/api-patterns` — Set domain filters', '`/api-reset` — Reset provider health/circuit',
    '`/maintenance` — Toggle maintenance', '`/maintenance-status` — View maintenance',
    '`/autobypass` — Channel auto-bypass', '`/autobypass-global` — Toggle global auto-bypass', '`/autobypass-list` — List auto channels',
    '`/cache-clear` — Clear result cache', '`/reload-config` — Reload providers', '`/status` — Full dashboard',
    '`/emoji-setup` — Install custom emojis', '`/emoji-status` — Inspect emoji coverage', '`/db-stats` — DB storage usage', '`/db-cleanup` — Purge cache / rate buckets', '`/ownerhelp` — This list'
  ].join('\n'));
}

module.exports = {
  THEME, EMOJI, setCustomEmojis, e, baseEmbed,
  successEmbed, errorEmbed, warningEmbed, infoEmbed,
  bypassSuccessEmbed, buildBypassComponents, buildBypassPayload,
  extractResultUrlFromMessage, isHttpResult,
  maintenanceEmbed, statusEmbed, helpEmbed, ownerHelpEmbed
};
