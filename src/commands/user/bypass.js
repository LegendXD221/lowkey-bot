'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { bypass } = require('../../services/bypassService');
const rateLimiter = require('../../services/rateLimiter');
const resultStore = require('../../services/resultStore');
const { buildBypassPayload, errorEmbed, maintenanceEmbed } = require('../../utils/embeds');
const { InvalidUrlError, UnsupportedUrlError, BypassUnavailableError, MaintenanceError, RateLimitError } = require('../../utils/errors');
const { getLogger } = require('../../utils/logger');
const log = getLogger();
module.exports = {
  data: new SlashCommandBuilder().setName('bypass').setDescription('Unlock a supported link')
    .addStringOption(o => o.setName('url').setDescription('The URL to unlock').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
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
      const msg = await interaction.editReply(payload);
      if (msg?.id && result.resultUrl) resultStore.set(msg.id, result.resultUrl);
    } catch (err) {
      log.warn({ err: err.message, code: err.code }, 'bypass command failed');
      if (err instanceof MaintenanceError) { await interaction.editReply({ embeds: [maintenanceEmbed(err.message)] }); return; }
      if (err instanceof RateLimitError) { await interaction.editReply({ embeds: [errorEmbed('Rate Limited', err.message)] }); return; }
      if (err instanceof InvalidUrlError) { await interaction.editReply({ embeds: [errorEmbed('Invalid Link', err.message)] }); return; }
      if (err instanceof UnsupportedUrlError) { await interaction.editReply({ embeds: [errorEmbed('Unsupported', err.message)] }); return; }
      if (err instanceof BypassUnavailableError) { await interaction.editReply({ embeds: [errorEmbed('Unavailable', err.message)] }); return; }
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Something went wrong. Please try again later.')] });
    }
  }
};
