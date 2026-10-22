'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { collectStatus } = require('../../services/healthMonitor');
const { requireOwner } = require('../../security/ownerGuard');
const { statusEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('Administrative system dashboard'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({ embeds: [statusEmbed(await collectStatus())] });
  }
};
