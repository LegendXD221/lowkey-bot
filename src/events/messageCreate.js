'use strict';
const { Events } = require('discord.js');
const settingsRepo = require('../database/repositories/settings');
const autobypassRepo = require('../database/repositories/autobypass');
const { bypass } = require('../services/bypassService');
const rateLimiter = require('../services/rateLimiter');
const { extractUrls } = require('../utils/formatters');
const { buildBypassPayload, bypassLoadingEmbed, errorEmbed } = require('../utils/embeds');
const resultStore = require('../services/resultStore');
const { InvalidUrlError, UnsupportedUrlError, BypassUnavailableError, MaintenanceError, RateLimitError } = require('../utils/errors');
const { getLogger } = require('../utils/logger');
const log = getLogger();
const recent = new Map();
const MIN_LOADING_DISPLAY_MS = 900;
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Autobypass settings lookup timed out')), ms); })
  ]).finally(() => clearTimeout(timer));
}
module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || message.webhookId) return;
    if (!message.guild || !message.channel) return;
    try {
      const settings = await withTimeout(settingsRepo.getSettings(), 3000);
      if (settings.maintenance_enabled || !settings.autobypass_enabled) return;
      if (!(await withTimeout(autobypassRepo.isChannelEnabled(message.guild.id, message.channel.id), 3000))) return;
      const urls = extractUrls(message.content);
      if (!urls.length) return;
      if (recent.has(message.id)) return;
      recent.set(message.id, true);
      setTimeout(() => recent.delete(message.id), 15000);
      try { await rateLimiter.checkAutobypass(message.channel.id, message.author.id); }
      catch (err) { if (err instanceof RateLimitError) return; throw err; }
      let loadingMessage = null;
      try {
        const loadingStartedAt = Date.now();
        try {
          loadingMessage = await message.reply({
            content: `<@${message.author.id}> is bypassing your link…`,
            embeds: [bypassLoadingEmbed()],
            components: [],
            allowedMentions: { users: [message.author.id], repliedUser: false }
          });
        } catch (err) {
          log.warn({ err: err.message }, 'Could not send autobypass loading status');
        }
        const result = await bypass(urls[0]);
        const payload = buildBypassPayload({
          originalUrl: result.originalUrl,
          resultUrl: result.resultUrl,
          latencyMs: result.latencyMs,
          service: result.service,
          fromCache: result.fromCache
        });
        const remainingLoadingMs = MIN_LOADING_DISPLAY_MS - (Date.now() - loadingStartedAt);
        if (remainingLoadingMs > 0) await new Promise(resolve => setTimeout(resolve, remainingLoadingMs));
        const sent = loadingMessage
          ? await loadingMessage.edit({ ...payload, content: '' })
          : await message.reply({ ...payload, allowedMentions: { repliedUser: false } });
        if (sent?.id && result.resultUrl) resultStore.set(sent.id, result.resultUrl);
      } catch (err) {
        const failureEmbed = err instanceof MaintenanceError
          ? errorEmbed('Maintenance', err.message)
          : err instanceof RateLimitError
            ? errorEmbed('Rate Limited', err.message)
            : err instanceof InvalidUrlError
              ? errorEmbed('Invalid Link', err.message)
              : err instanceof UnsupportedUrlError
                ? errorEmbed('Unsupported', err.message)
                : err instanceof BypassUnavailableError
                  ? errorEmbed('Unavailable', err.message)
                  : errorEmbed('Error', 'Something went wrong. Please try again later.');
        if (loadingMessage) {
          await loadingMessage.edit({ content: '', embeds: [failureEmbed], components: [] }).catch(() => {});
          return;
        }
        if (err instanceof MaintenanceError || err instanceof RateLimitError) return;
        if (err instanceof InvalidUrlError || err instanceof UnsupportedUrlError) return;
        if (err instanceof BypassUnavailableError) {
          await message.reply({ embeds: [errorEmbed('Unavailable', err.message)], allowedMentions: { repliedUser: false } }).catch(() => {});
          return;
        }
        log.warn({ err: err.message }, 'Autobypass failed');
      }
    } catch (err) { log.error({ err }, 'messageCreate handler error'); }
  }
};
