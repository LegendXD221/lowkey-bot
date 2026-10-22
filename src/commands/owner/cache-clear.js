'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { clearAll } = require('../../services/cacheService');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('cache-clear').setDescription('Clear cached bypass results'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    await clearAll();
    await interaction.editReply({ embeds: [successEmbed('Cache Cleared', 'All bypass cache entries removed.')] });
  }
};
