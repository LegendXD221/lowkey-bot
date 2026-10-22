'use strict';
const { SlashCommandBuilder } = require('discord.js');
const metricsRepo = require('../../database/repositories/metrics');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');
const { formatPercent, formatLatency } = require('../../utils/formatters');
const { loadEnv } = require('../../config/env');
module.exports = {
  data: new SlashCommandBuilder().setName('api-stats').setDescription('Provider usage and latency statistics'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const env = loadEnv();
    const rows = await metricsRepo.getAllMetrics();
    if (!rows.length) { await interaction.editReply({ embeds: [infoEmbed('API Stats', 'No metrics yet.')] }); return; }
    const lines = rows.slice(0, 15).map(m => {
      const rate = metricsRepo.successRate(m);
      const health = metricsRepo.classifyHealth(m, env);
      return `**${m.name}** · ${health} · ${formatPercent(rate)} · ${formatLatency(m.average_latency_ms)} · ${m.total_requests} req · CB:${m.circuit_state}`;
    });
    await interaction.editReply({ embeds: [infoEmbed('API Stats', lines.join('\n'))] });
  }
};
