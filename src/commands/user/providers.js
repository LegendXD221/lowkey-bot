'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { infoEmbed } = require('../../utils/embeds');
const { KNOWN } = require('../../utils/serviceDetect');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('providers')
    .setDescription('Show known services and active provider count'),
  async execute(interaction) {
    const enabled = await providersRepo.listProviders({ enabledOnly: true });
    const names = KNOWN.map(k => k.name);
    const unique = [...new Set(names)].sort();
    const emb = infoEmbed('Supported Services', null)
      .addFields(
        { name: 'Active providers', value: String(enabled.length), inline: true },
        { name: 'Recognized services', value: unique.slice(0, 25).join(', ') || '—', inline: false }
      )
      .setFooter({ text: 'Support depends on configured API providers · Lowkey' });
    await interaction.reply({ embeds: [emb], ephemeral: true });
  }
};
