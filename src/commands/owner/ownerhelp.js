'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { requireOwner } = require('../../security/ownerGuard');
const { ownerHelpEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('ownerhelp').setDescription('Owner command reference'),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.reply({ embeds: [ownerHelpEmbed()], ephemeral: true });
  }
};
