'use strict';
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const autobypassRepo = require('../../database/repositories/autobypass');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('autobypass').setDescription('Enable or disable auto-bypass in a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable auto-bypass?').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) {
      await interaction.editReply({ embeds: [errorEmbed('Guild Only', 'Run this command inside a server.')] });
      return;
    }
    const channel = interaction.options.getChannel('channel', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const me = interaction.guild.members.me;
    if (!me) { await interaction.editReply({ embeds: [errorEmbed('Error', 'Could not resolve bot member')] }); return; }
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.SendMessages)) {
      await interaction.editReply({ embeds: [errorEmbed('Permissions', 'Bot needs View Channel and Send Messages in that channel.')] }); return;
    }
    await autobypassRepo.setChannel(interaction.guildId, channel.id, enabled, interaction.user.id);
    await interaction.editReply({ embeds: [successEmbed(enabled ? 'Auto-bypass Enabled' : 'Auto-bypass Disabled', `${channel} is now ${enabled ? 'enabled' : 'disabled'} for automatic link processing.`)] });
  }
};
