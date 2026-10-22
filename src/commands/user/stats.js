'use strict';
const { SlashCommandBuilder } = require('discord.js');
const metricsRepo = require('../../database/repositories/metrics');
const providersRepo = require('../../database/repositories/providers');
const { infoEmbed } = require('../../utils/embeds');
const { formatPercent } = require('../../utils/formatters');
module.exports = {
  data: new SlashCommandBuilder().setName('stats').setDescription('Public usage statistics'),
  async execute(interaction) {
    const providers = await providersRepo.listProviders({ enabledOnly: true });
    const metrics = await metricsRepo.getAllMetrics();
    let total = 0, success = 0;
    for (const m of metrics) { total += Number(m.total_requests || 0); success += Number(m.successful_requests || 0); }
    await interaction.reply({ embeds: [infoEmbed('Stats', null).addFields(
      { name: 'Enabled Providers', value: String(providers.length), inline: true },
      { name: 'Total Requests', value: String(total), inline: true },
      { name: 'Success Rate', value: formatPercent(total ? success / total : 0), inline: true }
    )], ephemeral: true });
  }
};
