'use strict';

const { Events } = require('discord.js');
const settingsRepo = require('../database/repositories/settings');
const { isOwner } = require('../security/ownerGuard');
const {
  maintenanceEmbed,
  errorEmbed,
  extractResultUrlFromMessage
} = require('../utils/embeds');
const resultStore = require('../services/resultStore');
const { UnauthorizedError } = require('../utils/errors');
const { getLogger } = require('../utils/logger');

const log = getLogger();

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
  ]).finally(() => clearTimeout(timer));
}

async function handleCopyButton(interaction) {
  const customId = interaction.customId;
  if (customId !== 'lowkey:copy:mobile' && customId !== 'lowkey:copy:pc') return false;

  let resultUrl = resultStore.get(interaction.message?.id);
  if (!resultUrl) {
    resultUrl = extractResultUrlFromMessage(interaction.message);
  }
  if (!resultUrl) {
    await interaction.reply({
      content: 'This result has expired. Run `/bypass` again.',
      ephemeral: true
    }).catch(() => {});
    return true;
  }

  const body = customId === 'lowkey:copy:mobile'
    ? resultUrl
    : '```\n' + resultUrl + '\n```';

  await interaction.reply({ content: body, ephemeral: true, allowedMentions: { parse: [] } }).catch(() => {});
  return true;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton()) {
      try {
        const handled = await handleCopyButton(interaction);
        if (handled) return;
      } catch (err) {
        log.error({ err }, 'Button interaction error');
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
        }
      }
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'This button has expired. Run `/bypass` again.', ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      log.warn({ command: interaction.commandName, guildId: interaction.guildId }, 'Unknown command interaction');
      await interaction.reply({ content: 'This command is no longer available. Please reopen the command list.', ephemeral: true }).catch(() => {});
      return;
    }

    log.info({ command: interaction.commandName, guildId: interaction.guildId }, 'Command interaction received');

    // /bypass performs network work and must acknowledge before any database gate.
    if (interaction.commandName === 'bypass' && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      // Keep this gate short: commands such as /bypass acknowledge after dispatch.
      const settings = await withTimeout(settingsRepo.getSettings(), 750, 'Settings lookup');
      if (settings.maintenance_enabled && !isOwner(interaction.user.id)) {
        const ownerCmds = new Set([
          'maintenance', 'maintenance-status', 'status', 'ownerhelp',
          'addapi', 'removeapi', 'toggleapi', 'testapi', 'api-list',
          'api-info', 'api-priority', 'api-stats', 'api-patterns', 'cache-clear',
          'reload-config', 'autobypass', 'autobypass-global', 'autobypass-list', 'api-reset',
          'emoji-setup', 'emoji-status', 'db-stats', 'db-cleanup'
        ]);
        if (!ownerCmds.has(interaction.commandName)) {
          const maintenanceEmbedPayload = { embeds: [maintenanceEmbed(settings.maintenance_message)] };
          if (interaction.deferred || interaction.replied) await interaction.editReply(maintenanceEmbedPayload).catch(() => {});
          else await interaction.reply({ ...maintenanceEmbedPayload, ephemeral: true }).catch(() => {});
          return;
        }
      }
    } catch (err) {
      log.error({ err }, 'Settings check failed');
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      log.error({ err, command: interaction.commandName }, 'Command error');
      const payload = {
        embeds: [
          err instanceof UnauthorizedError
            ? errorEmbed('Unauthorized', err.message)
            : errorEmbed('Error', 'An unexpected error occurred.')
        ],
        ephemeral: true
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
};
