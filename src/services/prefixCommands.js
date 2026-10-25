'use strict';
const { loadEnv } = require('../config/env');
const settingsRepo = require('../database/repositories/settings');
const { isOwner } = require('../security/ownerGuard');
const { maintenanceEmbed, errorEmbed } = require('../utils/embeds');
const { UnauthorizedError } = require('../utils/errors');
const { getLogger } = require('../utils/logger');
const log = getLogger();

const OWNER_COMMANDS = new Set([
  'maintenance', 'maintenance-status', 'status', 'ownerhelp',
  'addapi', 'removeapi', 'toggleapi', 'testapi', 'api-list',
  'api-info', 'api-priority', 'api-stats', 'api-patterns', 'cache-clear',
  'reload-config', 'autobypass', 'autobypass-global', 'autobypass-list', 'api-reset',
  'emoji-setup', 'emoji-status', 'db-stats', 'db-cleanup'
]);

function tokenize(input) {
  const tokens = [];
  let token = '';
  let quote = null;
  for (const char of String(input)) {
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (token) { tokens.push(token); token = ''; }
    } else token += char;
  }
  if (token) tokens.push(token);
  return tokens;
}

function parseArguments(raw) {
  const tokens = tokenize(raw);
  const named = new Map();
  const positional = [];
  for (const token of tokens) {
    const match = token.match(/^([a-z][\w-]*)[:=](.*)$/i);
    if (match && !/^https?:\/\//i.test(token)) named.set(match[1].toLowerCase(), match[2]);
    else positional.push(token);
  }
  return { named, positional };
}

function optionDefinitions(command) {
  return command.data?.options || [];
}

function createOptions(command, raw, message) {
  const { named, positional } = parseArguments(raw);
  const definitions = optionDefinitions(command);
  const values = new Map();
  let position = 0;
  for (const option of definitions) {
    const key = option.name.toLowerCase();
    const value = named.has(key) ? named.get(key) : positional[position++];
    if (value !== undefined && value !== '') values.set(key, value);
  }
  const get = (name, required) => {
    const value = values.get(String(name).toLowerCase());
    if ((required || definitions.find(o => o.name === name)?.required) && value == null) {
      throw new Error(`Missing required option: ${name}`);
    }
    return value ?? null;
  };
  return {
    getString(name, required = false) { return get(name, required); },
    getInteger(name, required = false) {
      const value = get(name, required);
      if (value == null) return null;
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
      return parsed;
    },
    getBoolean(name, required = false) {
      const value = get(name, required);
      if (value == null) return null;
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      throw new Error(`${name} must be true or false`);
    },
    getChannel(name, required = false) {
      const value = get(name, required);
      if (value == null) return null;
      const id = value.match(/^<#(\d+)>$/)?.[1] || value;
      const channel = message.guild?.channels.cache.get(id);
      if (!channel) throw new Error(`Could not find channel: ${value}`);
      return channel;
    }
  };
}

function createPrefixInteraction(message, command, raw) {
  let response = null;
  const interaction = {
    client: message.client,
    commandName: command.data.name,
    command,
    user: message.author,
    member: message.member,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    options: null,
    replied: false,
    deferred: false,
    _prefixMessage: message,
    async deferReply() {
      this.deferred = true;
      response = await message.reply({ content: 'Processing…', allowedMentions: { repliedUser: false } });
      return response;
    },
    async reply(payload = {}) {
      this.replied = true;
      response = await message.reply({ ...payload, ephemeral: undefined });
      return response;
    },
    async editReply(payload = {}) {
      if (!response) response = await message.reply({ content: '', allowedMentions: { repliedUser: false } });
      this.replied = true;
      return response.edit(payload);
    },
    async followUp(payload = {}) {
      return message.channel.send({ ...payload, ephemeral: undefined });
    }
  };
  interaction.options = createOptions(command, raw, message);
  return interaction;
}

async function handlePrefixCommand(message) {
  const prefix = loadEnv().COMMAND_PREFIX;
  if (!message.content.startsWith(prefix)) return false;
  const body = message.content.slice(prefix.length).trim();
  if (!body) return false;
  const [name, ...rest] = tokenize(body);
  const command = message.client.commands.get(name.toLowerCase());
  if (!command) return false;
  const interaction = createPrefixInteraction(message, command, rest.join(' '));
  try {
    const settings = await settingsRepo.getSettings();
    if (settings.maintenance_enabled && !isOwner(message.author.id) && !OWNER_COMMANDS.has(command.data.name)) {
      await message.reply({ embeds: [maintenanceEmbed(settings.maintenance_message)], allowedMentions: { repliedUser: false } });
      return true;
    }
    await command.execute(interaction);
  } catch (err) {
    log.error({ err, command: command.data.name }, 'Prefix command error');
    const payload = { embeds: [err instanceof UnauthorizedError ? errorEmbed('Unauthorized', err.message) : errorEmbed('Error', err.message || 'An unexpected error occurred.')], allowedMentions: { repliedUser: false } };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await message.reply(payload).catch(() => {});
  }
  return true;
}

module.exports = { handlePrefixCommand, tokenize, parseArguments };
