'use strict';
const { SlashCommandBuilder } = require('discord.js');
const settingsRepo = require('../../database/repositories/settings');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autobypass-global')
    .setDescription('Enable or disable automatic link processing everywhere')
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable global autobypass?').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    const enabled = interaction.options.getBoolean('enabled', true);
    const settings = await settingsRepo.setAutobypassGlobal(enabled);
    await interaction.editReply({
      embeds: [successEmbed(
        enabled ? 'Global Auto-bypass Enabled' : 'Global Auto-bypass Disabled',
        enabled
          ? 'Automatic processing is active in channels individually enabled with `/autobypass`.'
          : 'Automatic processing is paused globally. Existing channel settings were preserved.'
      )]
    });
  }
};
