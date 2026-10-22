'use strict';
const { SlashCommandBuilder } = require('discord.js');
const settingsRepo = require('../../database/repositories/settings');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('maintenance').setDescription('Toggle maintenance mode')
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable maintenance?').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Custom message').setRequired(false)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const settings = await settingsRepo.setMaintenance(interaction.options.getBoolean('enabled', true), interaction.options.getString('message'));
    await interaction.editReply({ embeds: [successEmbed(settings.maintenance_enabled ? 'Maintenance ON' : 'Maintenance OFF', settings.maintenance_message)] });
  }
};
