'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { bypass } = require('../../services/bypassService');
const rateLimiter = require('../../services/rateLimiter');
const resultStore = require('../../services/resultStore');
const { buildBypassPayload, bypassLoadingEmbed, errorEmbed, maintenanceEmbed } = require('../../utils/embeds');
const { InvalidUrlError, UnsupportedUrlError, BypassUnavailableError, MaintenanceError, RateLimitError } = require('../../utils/errors');
const { getLogger } = require('../../utils/logger');
const log = getLogger();
const MIN_LOADING_DISPLAY_MS = 900;
module.exports = {
  data: new SlashCommandBuilder().setName('bypass').setDescription('Unlock a supported link')
    .addStringOption(o => o.setName('url').setDescription('The URL to unlock').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
      const mention = `<@${interaction.user.id}>`;
      await interaction.editReply({
        content: `${mention} is bypassing your link…`,
        embeds: [bypassLoadingEmbed()],
        components: [],
        allowedMentions: { users: [interaction.user.id] }
      });
      const loadingStartedAt = Date.now();
      await rateLimiter.checkUser(interaction.user.id);
      if (interaction.guildId) await rateLimiter.checkGuild(interaction.guildId);
      const result = await bypass(interaction.options.getString('url', true));
      const payload = buildBypassPayload({
        originalUrl: result.originalUrl,
        resultUrl: result.resultUrl,
        latencyMs: result.latencyMs,
        service: result.service,
        fromCache: result.fromCache
      });
      const remainingLoadingMs = MIN_LOADING_DISPLAY_MS - (Date.now() - loadingStartedAt);
      if (remainingLoadingMs > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingLoadingMs));
      }
      const msg = await interaction.editReply({ ...payload, content: '' });
      if (msg?.id && result.resultUrl) resultStore.set(msg.id, result.resultUrl);
    } catch (err) {
      log.warn({ err: err.message, code: err.code }, 'bypass command failed');
      if (err instanceof MaintenanceError) { await interaction.editReply({ content: '', embeds: [maintenanceEmbed(err.message)] }); return; }
      if (err instanceof RateLimitError) { await interaction.editReply({ content: '', embeds: [errorEmbed('Rate Limited', err.message)] }); return; }
      if (err instanceof InvalidUrlError) { await interaction.editReply({ content: '', embeds: [errorEmbed('Invalid Link', err.message)] }); return; }
      if (err instanceof UnsupportedUrlError) { await interaction.editReply({ content: '', embeds: [errorEmbed('Unsupported', err.message)] }); return; }
      if (err instanceof BypassUnavailableError) { await interaction.editReply({ content: '', embeds: [errorEmbed('Unavailable', err.message)] }); return; }
      await interaction.editReply({ content: '', embeds: [errorEmbed('Error', 'Something went wrong. Please try again later.')] });
    }
  }
};
