const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

// Serwer HTTP dla Rendera
app.get('/', (req, res) => {
  res.send('Bot Husaria działa z systemem anty-spam!');
});

app.listen(port, () => {
  console.log(`[SYSTEM] Serwer HTTP nasłuchuje na porcie ${port}`);
});

// Włączamy intencje wiadomości, aby bot mógł wykrywać spam
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ID rangi, która OMIJA anty-spam
const BYPASS_ROLE_ID = '1512577411315663038';

// Pamięć bota do zapisywania czasu wiadomości użytkowników
const userLog = new Map();

client.once('ready', () => {
  console.log(`[SUKCES] Zalogowano jako ${client.user.tag}! Anty-spam aktywny.`);
});

client.on('messageCreate', async (message) => {
  // Ignoruj wiadomości od innych botów oraz wiadomości prywatne (DM)
  if (message.author.bot || !message.guild) return;

  // Sprawdzamy, czy użytkownik ma rangę, która omija anty-spam
  if (message.member && message.member.roles.cache.has(BYPASS_ROLE_ID)) {
    return; // Osoba z tą rangą może spamować
  }

  const userId = message.author.id;
  const now = Date.now();
  
  // Konfiguracja anty-spamu: max 3 wiadomości w 4 sekundy
  const LIMIT = 3;
  const TIME_WINDOW = 4000; 

  if (!userLog.has(userId)) {
    userLog.set(userId, []);
  }

  const timestamps = userLog.get(userId);
  
  // Usuwamy stare wpisy spoza okna czasowego (starsze niż 4 sekundy)
  while (timestamps.length > 0 && now - timestamps[0] > TIME_WINDOW) {
    timestamps.shift();
  }

  // Dodajemy obecną wiadomość do historii użytkownika
  timestamps.push(now);

  // Jeśli użytkownik przekroczył limit wiadomości w danym czasie
  if (timestamps.length > LIMIT) {
    try {
      // Usuwamy spamerską wiadomość
      await message.delete();
      
      // Wysyłamy ostrzeżenie, które samo zniknie po 5 sekundach, żeby nie śmiecić
      const warning = await message.channel.send(`⚠️ **<@${userId}>, nie spamuj!** Twój wolny czas pisania został przekroczony.`);
      setTimeout(() => warning.delete().catch(() => {}), 5000);
    } catch (error) {
      console.log(`[BŁĄD] Nie udało się usunąć wiadomości: ${error.message}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
