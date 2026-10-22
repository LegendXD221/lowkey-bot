'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed } = require('../../utils/embeds');
const { getLogger } = require('../../utils/logger');
module.exports = {
  data: new SlashCommandBuilder().setName('reload-config').setDescription('Reload provider configuration from database'),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const providers = await providersRepo.listProviders();
    getLogger().info({ count: providers.length }, 'Providers reloaded');
    await interaction.editReply({ embeds: [successEmbed('Reloaded', `${providers.length} provider(s) loaded from database.`)] });
  }
};
