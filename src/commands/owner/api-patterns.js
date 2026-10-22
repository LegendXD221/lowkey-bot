'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed, infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('api-patterns')
    .setDescription('Set domain patterns for a provider (empty = match all)')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true))
    .addStringOption(o => o.setName('patterns').setDescription('Comma-separated host patterns e.g. linkvertise.com,loot-link.com').setRequired(false)),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('provider', true);
    const raw = interaction.options.getString('patterns');
    const p = await providersRepo.getProviderByName(name);
    if (!p) {
      await interaction.editReply({ embeds: [errorEmbed('Not Found', `No provider named "${name}"`)] });
      return;
    }
    if (raw == null) {
      const list = (p.url_patterns || []).join(', ') || '(all domains)';
      await interaction.editReply({ embeds: [infoEmbed(p.name, `Current patterns: ${list}`)] });
      return;
    }
    const patterns = raw.split(',').map(s => s.trim()).filter(Boolean);
    await providersRepo.setPatterns(p.id, patterns);
    await interaction.editReply({
      embeds: [successEmbed('Patterns Updated', patterns.length
        ? `**${p.name}** matches: ${patterns.join(', ')}`
        : `**${p.name}** matches all domains`)]
    });
  }
};
