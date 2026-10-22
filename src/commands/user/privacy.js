'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('privacy').setDescription('How Lowkey handles data'),
  async execute(interaction) {
    await interaction.reply({ embeds: [infoEmbed('Privacy', [
      '**What we store**', '• Normalized URL hashes and short-lived bypass results (cache)',
      '• Aggregate request counters and latency (no personal content)',
      '• Channel IDs you explicitly enable for auto-bypass', '• Owner Discord user IDs for authorization', '',
      '**What we do not store**', '• API keys or authorization headers',
      '• Full message content beyond the URL being processed',
      '• Personal identifying data beyond Discord snowflakes required for operation', '',
      'Cache entries expire automatically. You can ask an owner to clear the cache.'
    ].join('\n'))], ephemeral: true });
  }
};
