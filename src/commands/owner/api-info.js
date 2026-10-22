'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');
const { truncate } = require('../../utils/formatters');
module.exports = {
  data: new SlashCommandBuilder().setName('api-info').setDescription('Inspect non-sensitive provider configuration')
    .addStringOption(o => o.setName('provider').setDescription('Provider name').setRequired(true)),
  async execute(interaction) {
    requireOwner(interaction); await interaction.deferReply({ ephemeral: true });
    const p = await providersRepo.getProviderByName(interaction.options.getString('provider', true));
    if (!p) { await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Provider not found')] }); return; }
    await interaction.editReply({ embeds: [infoEmbed(p.name, null).addFields(
      { name: 'Method', value: p.http_method, inline: true },
      { name: 'Enabled', value: String(p.enabled), inline: true },
      { name: 'Priority', value: String(p.priority), inline: true },
      { name: 'Endpoint', value: `\`${truncate(p.endpoint, 1000)}\``, inline: false },
      { name: 'URL Param', value: truncate(p.url_parameter || '—', 1000), inline: true },
      { name: 'Auth Type', value: p.authentication_type, inline: true },
      { name: 'Secret Env', value: truncate(p.secret_env_key ? `\`${p.secret_env_key}\`` : '—', 1000), inline: true },
      { name: 'Response', value: truncate(`${p.response_format}${p.response_path ? ' → ' + p.response_path : ''}`, 1000), inline: true },
      { name: 'Encoding', value: p.encoding_type, inline: true },
      { name: 'Timeout', value: `${p.timeout_ms}ms`, inline: true }
    )] });
  }
};
