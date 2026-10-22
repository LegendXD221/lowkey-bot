'use strict';
const { SlashCommandBuilder } = require('discord.js');
const settingsRepo = require('../../database/repositories/settings');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');
const { truncate } = require('../../utils/formatters');
module.exports = {
  data: new SlashCommandBuilder().setName('maintenance-status').setDescription('Inspect current maintenance state'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const s = await settingsRepo.getSettings();
    await interaction.editReply({ embeds: [infoEmbed('Maintenance', null).addFields(
      { name: 'Enabled', value: String(s.maintenance_enabled), inline: true },
      { name: 'Message', value: truncate(s.maintenance_message || '—', 1024), inline: false }
    )] });
  }
};
