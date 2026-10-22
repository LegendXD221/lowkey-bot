'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');
const { storageStats, formatBytes } = require('../../services/storageCleanup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('db-stats')
    .setDescription('Database storage usage (1 GB Neon-aware)'),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    const s = await storageStats();
    const gbLimit = 1 * 1024 * 1024 * 1024;
    const pct = s.dbBytes != null ? `${((s.dbBytes / gbLimit) * 100).toFixed(1)}% of 1 GB` : '—';
    await interaction.editReply({
      embeds: [
        infoEmbed('Database Storage', null).addFields(
          { name: 'DB size', value: `${formatBytes(s.dbBytes)} (${pct})`, inline: false },
          { name: 'Cache rows', value: `${s.cacheRows} · ${formatBytes(s.cacheBytes)}`, inline: true },
          { name: 'Rate buckets', value: String(s.rateBuckets), inline: true },
          { name: 'Metrics', value: String(s.metricsRows), inline: true },
          { name: 'Providers', value: String(s.providers), inline: true },
          { name: 'Auto channels', value: String(s.channels), inline: true }
        )
      ]
    });
  }
};
