'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../../utils/embeds');
module.exports = {
  data: new SlashCommandBuilder().setName('about').setDescription('About Lowkey'),
  async execute(interaction) {
    await interaction.reply({ embeds: [infoEmbed('Lowkey', [
      'Premium link unlock bot with intelligent multi-provider routing.',
      '',
      '**Features**',
      '• Health-aware routing and automatic failover',
      '• Circuit breakers with gradual recovery',
      '• Domain-scoped providers',
      '• Channel auto-bypass',
      '• Result cache and rate limits',
      '• Secure credential handling (env-only secrets)',
      '',
      `Version **1.1.0** · Node ${process.version}`
    ].join('\n'))], ephemeral: true });
  }
};
