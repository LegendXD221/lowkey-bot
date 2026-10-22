'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { runCleanup, storageStats, formatBytes } = require('../../services/storageCleanup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('db-cleanup')
    .setDescription('Purge expired cache, enforce row caps, clear stale rate buckets'),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await runCleanup();
      const s = await storageStats();
      await interaction.editReply({
        embeds: [
          successEmbed('Cleanup Done', [
            `Rows removed: **${result.deleted}**`,
            `Cache cap: **${result.maxRows}**`,
            `DB size now: **${formatBytes(s.dbBytes)}**`,
            `Cache rows: **${s.cacheRows}**`
          ].join('\n'))
        ]
      });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Cleanup Failed', err.message)] });
    }
  }
};
