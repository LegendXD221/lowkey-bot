'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../../utils/embeds');
const { isOwner } = require('../../security/ownerGuard');
module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
  async execute(interaction) {
    await interaction.reply({ embeds: [helpEmbed(isOwner(interaction.user.id))], ephemeral: true });
  }
};
