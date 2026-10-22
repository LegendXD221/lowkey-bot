'use strict';
const { SlashCommandBuilder } = require('discord.js');
const autobypassRepo = require('../../database/repositories/autobypass');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('autobypass-list').setDescription('List configured auto-bypass channels'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const rows = await autobypassRepo.listChannels();
    if (!rows.length) { await interaction.editReply({ embeds: [infoEmbed('Auto-bypass', 'No channels configured.')] }); return; }
    const lines = rows.slice(0, 25).map(r => `\`${r.guild_id}\` · <#${r.channel_id}> · **${r.enabled ? 'ON' : 'OFF'}**`);
    await interaction.editReply({ embeds: [infoEmbed('Auto-bypass Channels', lines.join('\n'))] });
  }
};
