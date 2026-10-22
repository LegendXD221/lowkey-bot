'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('api-priority').setDescription('Adjust provider priority')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true))
    .addIntegerOption(o => o.setName('priority').setDescription('Lower = preferred').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const p = await providersRepo.getProviderByName(interaction.options.getString('provider', true));
    if (!p) { await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Provider not found')] }); return; }
    await providersRepo.setPriority(p.id, interaction.options.getInteger('priority', true));
    await interaction.editReply({ embeds: [successEmbed('Priority Updated', `**${p.name}** priority set.`)] });
  }
};
