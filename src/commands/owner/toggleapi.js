'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('toggleapi').setDescription('Enable or disable a provider')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable?').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('provider', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const provider = await providersRepo.getProviderByName(name);
    if (!provider) { await interaction.editReply({ embeds: [errorEmbed('Not Found', `No provider named "${name}"`)] }); return; }
    await providersRepo.setEnabled(provider.id, enabled);
    await interaction.editReply({ embeds: [successEmbed(enabled ? 'Enabled' : 'Disabled', `**${provider.name}** is now ${enabled ? 'enabled' : 'disabled'}.`)] });
  }
};
