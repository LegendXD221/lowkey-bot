'use strict';
const { SlashCommandBuilder } = require('discord.js');
const providersRepo = require('../../database/repositories/providers');
const { requireOwner } = require('../../security/ownerGuard');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { ValidationError } = require('../../utils/errors');
const { safeJsonParse } = require('../../utils/formatters');
const { assertSafeUrl } = require('../../security/ssrfProtection');
const { getLogger } = require('../../utils/logger');
const { isAllowedProviderSecretKey } = require('../../config/env');
const log = getLogger();
const SAFE_CUSTOM_HEADERS = new Set(['accept', 'accept-language', 'content-type', 'origin', 'referer', 'user-agent']);
module.exports = {
  data: new SlashCommandBuilder().setName('addapi').setDescription('Register a new API provider')
    .addStringOption(o => o.setName('name').setDescription('Unique provider name').setRequired(true))
    .addStringOption(o => o.setName('endpoint').setDescription('Base endpoint URL').setRequired(true))
    .addStringOption(o => o.setName('method').setDescription('HTTP method').setRequired(true).addChoices({ name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }))
    .addStringOption(o => o.setName('url_parameter').setDescription('Query/body parameter name').setRequired(false))
    .addStringOption(o => o.setName('body_template').setDescription('JSON body template with {{url}}').setRequired(false))
    .addStringOption(o => o.setName('headers_json').setDescription('JSON object of extra headers').setRequired(false))
    .addStringOption(o => o.setName('authentication_type').setDescription('Auth method').addChoices(
      { name: 'None', value: 'none' }, { name: 'Bearer', value: 'bearer' },
      { name: 'API Key Header', value: 'api_key_header' }, { name: 'API Key Query', value: 'api_key_query' }).setRequired(false))
    .addStringOption(o => o.setName('secret_env_key').setDescription('Env var name holding the secret').setRequired(false))
    .addStringOption(o => o.setName('response_format').setDescription('Expected response format').addChoices(
      { name: 'JSON', value: 'json' }, { name: 'Text', value: 'text' }, { name: 'URL', value: 'url' }).setRequired(false))
    .addStringOption(o => o.setName('response_path').setDescription('Dot path to result e.g. data.url').setRequired(false))
    .addStringOption(o => o.setName('encoding').setDescription('How to encode the target URL').addChoices(
      { name: 'None', value: 'none' }, { name: 'URL encode', value: 'url' },
      { name: 'Base64', value: 'base64' }, { name: 'Base64URL', value: 'base64url' }).setRequired(false))
    .addIntegerOption(o => o.setName('priority').setDescription('Lower = preferred').setRequired(false))
    .addIntegerOption(o => o.setName('timeout_ms').setDescription('Timeout ms').setRequired(false)),
  async execute(interaction) {
    requireOwner(interaction);
    await interaction.deferReply({ ephemeral: true });
    try {
      const name = interaction.options.getString('name', true).trim();
      const endpoint = interaction.options.getString('endpoint', true).trim();
      await assertSafeUrl(endpoint);
      let headers = {};
      const headersRaw = interaction.options.getString('headers_json');
      if (headersRaw) {
        headers = safeJsonParse(headersRaw, null);
        if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new ValidationError('headers_json must be a valid JSON object');
        for (const [headerName, value] of Object.entries(headers)) {
          if (!SAFE_CUSTOM_HEADERS.has(headerName.toLowerCase()) || typeof value !== 'string') {
            throw new ValidationError('headers_json may contain only public headers; store API keys in an approved environment variable');
          }
        }
      }
      if (await providersRepo.getProviderByName(name)) throw new ValidationError(`Provider "${name}" already exists`);
      const authenticationType = interaction.options.getString('authentication_type') || 'none';
      const secretEnvKey = interaction.options.getString('secret_env_key')?.trim() || null;
      if (authenticationType !== 'none' && !endpoint.toLowerCase().startsWith('https://')) {
        throw new ValidationError('Authenticated providers must use an HTTPS endpoint');
      }
      if (secretEnvKey && !isAllowedProviderSecretKey(secretEnvKey)) {
        throw new ValidationError('secret_env_key must be an approved provider variable such as CUSTOM_API_KEY_ALPHA');
      }
      if (authenticationType !== 'none' && !secretEnvKey) {
        throw new ValidationError('An approved secret_env_key is required for this authentication method');
      }
      const provider = await providersRepo.createProvider({
        name, endpoint, http_method: interaction.options.getString('method', true),
        url_parameter: interaction.options.getString('url_parameter') || 'url',
        request_body_template: interaction.options.getString('body_template') || null,
        custom_headers: headers,
        authentication_type: authenticationType,
        secret_env_key: secretEnvKey,
        response_format: interaction.options.getString('response_format') || 'json',
        response_path: interaction.options.getString('response_path') || null,
        encoding_type: interaction.options.getString('encoding') || 'none',
        priority: interaction.options.getInteger('priority') ?? 100,
        timeout_ms: interaction.options.getInteger('timeout_ms') ?? 10000, enabled: true
      });
      log.info({ provider: provider.name, id: provider.id }, 'Provider added');
      await interaction.editReply({ embeds: [successEmbed('Provider Added', [
        `**${provider.name}** (id \`${provider.id}\`)`, `Method: \`${provider.http_method}\``,
        `Endpoint: \`${provider.endpoint}\``, `Priority: ${provider.priority}`, '',
        'Secret values are never shown. Use `/testapi` to verify.'
      ].join('\n'))] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Failed', err.message || 'Could not add provider')] });
    }
  }
};
