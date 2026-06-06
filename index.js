const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, AttachmentBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => { res.send('Bot Husaria dziala 24/7!'); });
app.listen(port, () => { 
  console.log(`[SYSTEM] Serwer HTTP nasluchuje na porcie ${port}`);
  setInterval(() => {
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
      axios.get(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}.onrender.com`)
        .then(() => console.log('[ANTY-SLEEP] Bot pomyslnie szturchniety!'))
        .catch((err) => console.log('[ANTY-SLEEP] Blad pingu: ' + err.message));
    }
  }, 300000);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

// --- CONFIG ID ---
const BYPASS_ROLE_ID = '1512577411315663038';
const TICKET_CHANNEL_ID = '1512574570903900253';
const SUPPORT_ROLE_ID = '1512580895385849998';
const TRANSFER_ALLOWED_ROLE_ID = '1512587126506655774';
const WELCOME_CHANNEL_ID = '1512410099518410782';
const VERIFY_CHANNEL_ID = '1512591912450920558';
const AUTOROLE_ON_JOIN_ID = '1512592026900627487';
const VERIFIED_ROLE_ID = '1512580404974981120';

const userLog = new Map();
const ticketCreators = new Map();
const verificationSessions = new Map();

client.once('ready', async () => {
  console.log(`[SUKCES] Zaawansowany bot Husaria gotowy do akcji!`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('transfer')
      .setDescription('Oglos oficjalny transfer panstwa do Husarii')
      .addStringOption(option => option.setName('panstwo').setDescription('Wpisz nazwe panstwa').setRequired(true))
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SYSTEM] Komendy (/) zarejestrowane.');
  } catch (error) { console.error(error); }

  // Panel ticketów
  try {
    const channel = await client.channels.fetch(TICKET_CHANNEL_ID);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 10 });
      if (messages.filter(m => m.author.id === client.user.id).size === 0) {
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎫 SYSTEM ZGŁOSZEŃ (TICKETS)').setDescription('Potrzebujesz pomocy administracji, chcesz zgłosić fuzję lub sojusz?\nKliknij poniższy przycisk.');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_ticket').setLabel('Stwórz zgłoszenie').setEmoji('📩').setStyle(ButtonStyle.Primary));
        await channel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (e) { console.log(e); }

  // Panel weryfikacji
  try {
    const vChannel = await client.channels.fetch(VERIFY_CHANNEL_ID);
    if (vChannel) {
      const vMessages = await vChannel.messages.fetch({ limit: 10 });
      if (vMessages.filter(m => m.author.id === client.user.id).size === 0) {
        const vEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🛡️ WERYFIKACJA BEZPIECZENSTWA').setDescription('Aby uzyskac pelny dostep do serwera, kliknij przycisk i rozwiaz proste zadanie.');
        const vRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_verify').setLabel('Zweryfikuj sie').setEmoji('✅').setStyle(ButtonStyle.Success));
        await vChannel.send({ embeds: [vEmbed], components: [vRow] });
      }
    }
  } catch (e) { console.log(e); }
});

client.on('guildMemberAdd', async (member) => {
  try {
    const startRole = member.guild.roles.cache.get(AUTOROLE_ON_JOIN_ID);
    if (startRole) await member.roles.add(startRole);

    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
    if
