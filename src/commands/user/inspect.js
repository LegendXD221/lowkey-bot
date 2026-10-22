'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { validateUrl } = require('../../security/urlValidator');
const { detectService } = require('../../utils/serviceDetect');
const { infoEmbed, errorEmbed } = require('../../utils/embeds');
const { truncate } = require('../../utils/formatters');
const { InvalidUrlError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inspect')
    .setDescription('Inspect a link without sending it to a bypass provider')
    .addStringOption(o => o.setName('url').setDescription('The URL to inspect').setRequired(true)),
  async execute(interaction) {
    const raw = interaction.options.getString('url', true);
    try {
      const { url, parsed } = validateUrl(raw);
      const service = detectService(url);
      await interaction.reply({
        embeds: [infoEmbed('Link Inspection', null).addFields(
          { name: 'Valid', value: 'Yes', inline: true },
          { name: 'Protocol', value: parsed.protocol.replace(':', '').toUpperCase(), inline: true },
          { name: 'Service', value: service || 'Unknown', inline: true },
          { name: 'Host', value: `\`${parsed.hostname}\``, inline: false },
          { name: 'Normalized URL', value: `\`${truncate(url, 900)}\``, inline: false },
          { name: 'Next step', value: 'Use `/bypass` when you are ready to process it.', inline: false }
        )
      ], ephemeral: true
      });
    } catch (err) {
      const message = err instanceof InvalidUrlError
        ? err.message
        : 'This link could not be inspected.';
      await interaction.reply({ embeds: [errorEmbed('Invalid Link', message)], ephemeral: true });
    }
  }
};
