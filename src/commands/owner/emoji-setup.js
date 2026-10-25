'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { setupEmojis } = require('../../services/emojiService');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed, warningEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('emoji-setup').setDescription('Install or refresh animated custom emojis'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) { await interaction.editReply({ embeds: [errorEmbed('Guild Only', 'Run this inside a server.')] }); return; }
    const result = await setupEmojis(interaction.guild);
    if (!result.ok) { await interaction.editReply({ embeds: [warningEmbed('Emoji Setup', result.message)] }); return; }
    const lines = result.results.map(r => `**${r.key}**: ${r.status}${r.id ? ' (`' + r.id + '`)' : ''}${r.error ? ' — ' + r.error : ''}`);
    await interaction.editReply({ embeds: [successEmbed('Emoji Setup', lines.join('\n') || 'No changes')] });
  }
};
