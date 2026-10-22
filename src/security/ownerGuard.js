'use strict';
const { loadEnv } = require('../config/env');
const { UnauthorizedError } = require('../utils/errors');
function isOwner(userId) { return loadEnv().ownerIds.includes(String(userId)); }
function requireOwner(interaction) { if (!isOwner(interaction.user.id)) throw new UnauthorizedError(); }
async function ownerOnly(interaction, handler) {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true }).catch(() => {});
    return;
  }
  return handler();
}
module.exports = { isOwner, requireOwner, ownerOnly };
