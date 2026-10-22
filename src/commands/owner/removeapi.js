'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed, warningEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('removeapi').setDescription('Remove an API provider')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true))
    .addBooleanOption(o => o.setName('confirm').setDescription('Confirm permanent deletion').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('provider', true);
    const confirm = interaction.options.getBoolean('confirm', true);
    const provider = await providersRepo.getProviderByName(name);
    if (!provider) { await interaction.editReply({ embeds: [errorEmbed('Not Found', `No provider named "${name}"`)] }); return; }
    if (!confirm) { await interaction.editReply({ embeds: [warningEmbed('Confirmation Required', `Set confirm=true to permanently delete **${provider.name}**.`)] }); return; }
    await providersRepo.deleteProvider(provider.id);
    await interaction.editReply({ embeds: [successEmbed('Removed', `Provider **${provider.name}** deleted.`)] });
  }
};
