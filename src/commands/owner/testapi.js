'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { executeRequest } = require('../../services/requestEngine');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { formatLatency } = require('../../utils/formatters');
const { validateUrl } = require('../../security/urlValidator');
module.exports = {
  data: new SlashCommandBuilder().setName('testapi').setDescription('Test a provider with a URL')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true))
    .addStringOption(o => o.setName('url').setDescription('Test URL').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    try {
      const provider = await providersRepo.getProviderByName(interaction.options.getString('provider', true));
      if (!provider) { await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Provider not found')] }); return; }
      const { url } = validateUrl(interaction.options.getString('url', true));
      const outcome = await executeRequest(provider, url);
      await interaction.editReply({ embeds: [successEmbed('Test Passed', null).addFields(
        { name: 'Provider', value: provider.name, inline: true },
        { name: 'HTTP', value: String(outcome.httpStatus), inline: true },
        { name: 'Latency', value: formatLatency(outcome.latency), inline: true },
        { name: 'Result', value: `\`${outcome.result.slice(0, 200)}\``, inline: false }
      )] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Test Failed', null).addFields(
        { name: 'Category', value: err.category || err.code || 'ERROR', inline: true },
        { name: 'HTTP', value: String(err.httpStatus || '—'), inline: true },
        { name: 'Latency', value: formatLatency(err.latency), inline: true },
        { name: 'Detail', value: (err.message || 'Unknown').slice(0, 300), inline: false }
      )] });
    }
  }
};
