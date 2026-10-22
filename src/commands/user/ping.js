'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
const { formatLatency } = require('../../utils/formatters');
module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  async execute(interaction) {
    const sent = await interaction.reply({ embeds: [infoEmbed('Pinging…', 'Measuring latency')], fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({ embeds: [infoEmbed('Pong', null).addFields(
      { name: 'Round-trip', value: formatLatency(roundtrip), inline: true },
      { name: 'WebSocket', value: formatLatency(interaction.client.ws.ping), inline: true }
    )] });
  }
};
