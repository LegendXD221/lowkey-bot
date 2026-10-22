'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { getEmojiStatus, DEFAULT_KEYS } = require('../../services/emojiService');
const { requireOwner } = require('../../security/ownerGuard');
const { infoEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emoji-status')
    .setDescription('Inspect installed custom emojis and fallback coverage'),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    const rows = await getEmojiStatus();
    const installed = new Set(rows.map(row => row.emoji_key));
    const lines = DEFAULT_KEYS.map(def => {
      const row = rows.find(item => item.emoji_key === def.key);
      return `${installed.has(def.key) ? '✅' : '▫️'} **${def.key}** · ${row ? `<:${row.name}:${row.emoji_id}>` : 'Unicode fallback'}`;
    });
    await interaction.editReply({
      embeds: [infoEmbed('Emoji Status', null).addFields(
        { name: 'Installed', value: `${installed.size}/${DEFAULT_KEYS.length}`, inline: true },
        { name: 'Database rows', value: String(rows.length), inline: true },
        { name: 'Coverage', value: lines.join('\n'), inline: false },
        { name: 'Tip', value: 'Run `/emoji-setup` in a server where the bot has Manage Expressions to install or refresh the visual pack.', inline: false }
      )]
    });
  }
};
