'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { checkConnectivity } = require('../../database/pool');
const { infoEmbed } = require('../../utils/embeds');
const { formatLatency } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Check Lowkey service health'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const started = Date.now();
    const dbOk = await checkConnectivity();
    const botPing = interaction.client.ws.ping;
    const roundTrip = Date.now() - started;
    await interaction.editReply({
      embeds: [infoEmbed('Lowkey Health', null).addFields(
        { name: 'Bot', value: 'Online', inline: true },
        { name: 'Database', value: dbOk ? 'Connected' : 'Unavailable', inline: true },
        { name: 'WebSocket', value: formatLatency(botPing), inline: true },
        { name: 'Check time', value: formatLatency(roundTrip), inline: true },
        { name: 'Tip', value: dbOk ? 'Use `/bypass` to unlock a supported link.' : 'Some features may be temporarily unavailable.', inline: false }
      )],
    });
  }
};
