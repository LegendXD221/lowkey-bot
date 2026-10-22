'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');
const { truncate } = require('../../utils/formatters');
module.exports = {
  data: new SlashCommandBuilder().setName('api-list').setDescription('List configured providers'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const providers = await providersRepo.listProviders();
    if (!providers.length) { await interaction.editReply({ embeds: [infoEmbed('Providers', 'None configured.')] }); return; }
    const lines = providers.map(p => `**${p.name}** · ${p.http_method} · P${p.priority} · ${p.enabled ? 'ON' : 'OFF'}`);
    await interaction.editReply({ embeds: [infoEmbed('Providers', truncate(lines.join('\n'), 3900))] });
  }
};
