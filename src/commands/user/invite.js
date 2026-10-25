'use strict';
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('invite').setDescription('Get a link to invite Lowkey to another server'),
  async execute(interaction) {
    const url = await interaction.client.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.UseApplicationCommands
      ]
    });
    await interaction.reply({
      embeds: [infoEmbed('Invite Lowkey', `[Add Lowkey to a server](${url})`)],
      allowedMentions: { users: [] }
    });
  }
};
