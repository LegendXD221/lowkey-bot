'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server'),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ embeds: [errorEmbed('Guild Only', 'Run this command inside a server.')], ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const owner = guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown';
    await interaction.reply({
      embeds: [infoEmbed(`Server · ${guild.name}`, null).addFields(
        { name: 'Owner', value: owner, inline: true },
        { name: 'Members', value: String(guild.memberCount ?? '—'), inline: true },
        { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Server ID', value: `\`${guild.id}\``, inline: false }
      )],
      allowedMentions: { users: [] }
    });
  }
};
