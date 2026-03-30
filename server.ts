import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import cookieParser from "cookie-parser";
import FormData from "form-data";
import { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, EmbedBuilder } from "discord.js";
import fs from "fs";
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  getVoiceConnection,
  NoSubscriberBehavior
} from '@discordjs/voice';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(process.cwd(), 'bot_data.json');

// In-memory storage for bot clients and configs
const botClients: Record<string, Client> = {};
let botConfigs: Record<string, any> = {};
let userBots: Record<string, any[]> = {};
const audioPlayers: Record<string, any> = {};
const guildsCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30000; // 30 seconds

// Load data from file if it exists
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    botConfigs = data.botConfigs || {};
    userBots = data.userBots || {};
    console.log("Loaded bot data from file.");
  } catch (error) {
    console.error("Error loading bot data:", error);
  }
}

function saveData() {
  try {
    const data = { botConfigs, userBots };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving bot data:", error);
  }
}

async function syncSlashCommands(botId: string, token: string) {
  const commandsConfig = botConfigs[botId]?.commands;
  const quranConfig = botConfigs[botId]?.quran;
  
  const slashCommands: any[] = [];

  if (commandsConfig && commandsConfig.commands) {
    slashCommands.push(...commandsConfig.commands
      .filter((cmd: any) => cmd.type === 'slash' && cmd.enabled)
      .map((cmd: any) => ({
        name: cmd.name.toLowerCase(),
        description: `Custom slash command: ${cmd.name}`,
      })));
  }

  if (quranConfig && quranConfig.enabled) {
    slashCommands.push({
      name: quranConfig.commandName.toLowerCase(),
      description: 'Listen to the Holy Quran',
      options: [
        {
          name: 'channel',
          description: 'The voice channel to join',
          type: 7, // CHANNEL
          required: false
        }
      ]
    });
    slashCommands.push({
      name: 'exitquran',
      description: 'Make the bot leave the voice channel',
    });
  }

  if (slashCommands.length === 0) return;

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    const client = botClients[botId];
    if (!client || !client.user) return;

    console.log(`Started refreshing ${slashCommands.length} application (/) commands for bot ${botId}.`);

    // Register globally for now
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: slashCommands },
    );

    console.log(`Successfully reloaded application (/) commands for bot ${botId}.`);
  } catch (error) {
    console.error(`Error syncing slash commands for bot ${botId}:`, error);
  }
}

function startBotClient(botId: string, token: string) {
  if (botClients[botId]) return;

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ]
  });

  client.on('ready', () => {
    console.log(`Bot logged in as ${client.user?.tag}`);
    syncSlashCommands(botId, token);
  });

  client.on('guildMemberAdd', async (member) => {
    const config = botConfigs[botId]?.welcome;
    if (!config || !config.enabled || !config.channelId) return;

    try {
      const channel = await member.guild.channels.fetch(config.channelId);
      if (channel && channel.isTextBased()) {
        const welcomeMessage = config.message
          .replace(/{name}/g, member.user.username)
          .replace(/{username}/g, `${member.user.username}#${member.user.discriminator}`)
          .replace(/{servername}/g, member.guild.name)
          .replace(/{number}/g, member.guild.memberCount.toString());

        const embed: any = {
          description: welcomeMessage,
          color: parseInt(config.color.replace('#', ''), 16) || 0x5865f2,
          timestamp: new Date().toISOString()
        };

        const payload: any = { embeds: [embed] };

        if (config.image) {
          if (config.image.startsWith('data:image')) {
            const base64Data = config.image.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = 'welcome.png';
            
            // For discord.js, we can send files directly
            payload.files = [{ attachment: buffer, name: filename }];
            embed.image = { url: `attachment://${filename}` };
          } else {
            embed.image = { url: config.image };
          }
        }

        await (channel as any).send(payload);
      }
    } catch (error) {
      console.error("Error sending welcome message:", error);
    }
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const config = botConfigs[botId]?.commands;
    if (!config || !config.commands) return;

    const prefix = '!'; // Default prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    const cmd = config.commands.find((c: any) => c.name.toLowerCase() === commandName && c.enabled && c.type === 'prefix');
    if (!cmd) return;

    // Check roles
    if (cmd.roles && cmd.roles.length > 0) {
      const hasRole = message.member?.roles.cache.some(r => cmd.roles.includes(r.id));
      if (!hasRole) return message.reply("You don't have permission to use this command.");
    }

    // Check channels
    if (cmd.channels && cmd.channels.length > 0) {
      if (!cmd.channels.includes(message.channel.id)) return;
    }

    try {
      if (cmd.language === 'javascript') {
        // Simple execution environment
        const context = {
          message,
          client,
          guild: message.guild,
          channel: message.channel,
          author: message.author,
          args
        };
        
        const script = `(async () => { ${cmd.response} })()`;
        const func = new Function(...Object.keys(context), script);
        await func(...Object.values(context));
      } else {
        message.reply(`Python commands are currently under development. Here is your response: ${cmd.response}`);
      }
    } catch (error: any) {
      console.error("Command Execution Error:", error);
      message.reply(`Error executing command: ${error.message}`);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const quranConfig = botConfigs[botId]?.quran;
      if (quranConfig && quranConfig.enabled && interaction.commandName.toLowerCase() === quranConfig.commandName.toLowerCase()) {
        const channelOption = interaction.options.getChannel('channel');
        const voiceChannel = channelOption || (interaction.member as any).voice.channel;

        if (!voiceChannel || (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice)) {
          return interaction.reply({ content: "Please join a voice channel or specify one!", ephemeral: true });
        }

        try {
          joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId!,
            adapterCreator: interaction.guild!.voiceAdapterCreator as any,
          });

          const embed = new EmbedBuilder()
            .setTitle(quranConfig.title || "Holy Quran")
            .setDescription(quranConfig.description || "Select a reader to start listening")
            .setColor(parseInt(quranConfig.color.replace('#', ''), 16) || 0x5865f2);

          const rows: ActionRowBuilder<ButtonBuilder>[] = [];
          let currentRow = new ActionRowBuilder<ButtonBuilder>();

          if (quranConfig.readers && quranConfig.readers.length > 0) {
            quranConfig.readers.forEach((reader: any, index: number) => {
              if (index > 0 && index % 5 === 0) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
              }
              currentRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(`quran_reader_${index}`)
                  .setLabel(reader.name)
                  .setStyle(ButtonStyle.Primary)
              );
            });
            if (currentRow.components.length > 0) rows.push(currentRow);
          }

          await interaction.reply({ embeds: [embed], components: rows });
        } catch (error) {
          console.error("Error joining voice channel:", error);
          await interaction.reply({ content: "Failed to join the voice channel.", ephemeral: true });
        }
        return;
      }

      if (interaction.commandName === 'exitquran') {
        const connection = getVoiceConnection(interaction.guildId!);
        if (connection) {
          connection.destroy();
          if (audioPlayers[interaction.guildId!]) {
            audioPlayers[interaction.guildId!].stop();
            delete audioPlayers[interaction.guildId!];
          }
          await interaction.reply({ content: "Left the voice channel.", ephemeral: true });
        } else {
          await interaction.reply({ content: "I'm not in a voice channel!", ephemeral: true });
        }
        return;
      }

      const config = botConfigs[botId]?.commands;
      if (!config || !config.commands) return;

      const cmd = config.commands.find((c: any) => c.name.toLowerCase() === interaction.commandName.toLowerCase() && c.enabled && c.type === 'slash');
      if (!cmd) return;

      // Check roles
      if (cmd.roles && cmd.roles.length > 0) {
        const hasRole = (interaction.member?.roles as any).cache.some((r: any) => cmd.roles.includes(r.id));
        if (!hasRole) return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }

      // Check channels
      if (cmd.channels && cmd.channels.length > 0) {
        if (!cmd.channels.includes(interaction.channelId)) return interaction.reply({ content: "This command cannot be used in this channel.", ephemeral: true });
      }

      try {
        if (cmd.language === 'javascript') {
          const context = {
            interaction,
            client,
            guild: interaction.guild,
            channel: interaction.channel,
            user: interaction.user,
            options: interaction.options
          };
          
          const script = `(async () => { ${cmd.response} })()`;
          const func = new Function(...Object.keys(context), script);
          await func(...Object.values(context));
        } else {
          await interaction.reply(`Python commands are currently under development. Here is your response: ${cmd.response}`);
        }
      } catch (error: any) {
        console.error("Slash Command Execution Error:", error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: `Error executing command: ${error.message}`, ephemeral: true });
        } else {
          await interaction.reply({ content: `Error executing command: ${error.message}`, ephemeral: true });
        }
      }
      return;
    }

    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const customId = interaction.customId;

    if (customId.startsWith('quran_reader_')) {
      const readerIndex = parseInt(customId.split('_')[2]);
      const quranConfig = botConfigs[botId]?.quran;
      if (!quranConfig || !quranConfig.readers || !quranConfig.readers[readerIndex]) {
        return interaction.reply({ content: "Reader configuration not found.", ephemeral: true });
      }

      const reader = quranConfig.readers[readerIndex];
      const guildId = interaction.guildId!;

      try {
        let player = audioPlayers[guildId];
        if (!player) {
          player = createAudioPlayer({
            behaviors: {
              noSubscriber: NoSubscriberBehavior.Play,
            },
          });
          audioPlayers[guildId] = player;
        }

        const connection = getVoiceConnection(guildId);
        if (!connection) {
          return interaction.reply({ content: "I'm not in a voice channel! Use the quran command first.", ephemeral: true });
        }

        connection.subscribe(player);

        const resource = createAudioResource(reader.url);
        player.play(resource);

        await interaction.reply({ content: `Now playing: **${reader.name}**`, ephemeral: true });
      } catch (error) {
        console.error("Error playing Quran audio:", error);
        await interaction.reply({ content: "Failed to play audio. Please check the URL.", ephemeral: true });
      }
      return;
    }

    if (customId.startsWith('ticket_') || customId.startsWith('select_ticket_')) {
      const config = botConfigs[botId]?.ticket;
      if (!config || !config.enabled) return;

      try {
        const guild = interaction.guild;
        if (!guild) return;

        const member = interaction.member;
        if (!member) return;

        // Create ticket channel
        const channelName = `ticket-${interaction.user.username}`;
        const permissionOverwrites: any[] = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
          }
        ];

        // Add view roles
        if (config.viewRoles) {
          config.viewRoles.forEach((roleId: string) => {
            permissionOverwrites.push({
              id: roleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            });
          });
        }

        const channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: config.categoryId || null,
          permissionOverwrites
        });

        await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });

        // Mention roles and user
        let mentionContent = `${interaction.user}`;
        if (config.mentionRoles && config.mentionRoles.length > 0) {
          mentionContent += ` ${config.mentionRoles.map((id: string) => `<@&${id}>`).join(' ')}`;
        }

        const embed = {
          title: "Ticket Opened",
          description: `Welcome ${interaction.user}! Support will be with you shortly.\nType: ${interaction.isStringSelectMenu() ? interaction.values[0] : 'General'}`,
          color: 0x5865f2,
          timestamp: new Date().toISOString()
        };

        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('Close Ticket')
              .setStyle(ButtonStyle.Danger)
          );

        await channel.send({ content: mentionContent, embeds: [embed], components: [row] });

      } catch (error) {
        console.error("Error handling ticket interaction:", error);
        await interaction.reply({ content: "Failed to create ticket channel.", ephemeral: true });
      }
    } else if (customId === 'close_ticket') {
      try {
        await interaction.reply("Closing ticket in 5 seconds...");
        setTimeout(() => {
          interaction.channel?.delete().catch(console.error);
        }, 5000);
      } catch (error) {
        console.error("Error closing ticket:", error);
      }
    }
  });

  client.login(token).catch(err => {
    console.error(`Failed to login bot ${botId}:`, err);
  });

  botClients[botId] = client;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`API Request: ${req.method} ${req.url}`);
    }
    next();
  });

  // Discord OAuth Config
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  
  const getRedirectUri = () => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || '';
    return `${baseUrl}/api/auth/discord/callback`;
  };

  // API routes
  app.get("/api/info", (req, res) => {
    res.json({
      name: "SDMX BOT",
      status: "online",
      user: req.cookies.user ? JSON.parse(req.cookies.user) : null
    });
  });

  // Authentication routes
  app.post("/api/auth/register", (req, res) => {
    const { username, name, email, avatar } = req.body;
    
    if (!username || !name || !email) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const userData = {
      id: Math.random().toString(36).substring(7),
      username,
      global_name: name,
      email,
      avatar: avatar || null
    };

    res.cookie("user", JSON.stringify(userData), {
      secure: true,
      sameSite: "none",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: userData });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("user", { secure: true, sameSite: "none" });
    res.json({ success: true });
  });

  app.get("/api/bots", (req, res) => {
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.json({ bots: userBots[user.id] || [] });
  });

  app.post("/api/bots/verify", async (req, res) => {
    const { token } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
      // Verify bot token with Discord API
      const botResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bot ${token}` },
      });

      const botData = botResponse.data;
      
      // Store bot (associated with user)
      if (!userBots[user.id]) userBots[user.id] = [];
      
      // Check if bot already exists in list
      const exists = userBots[user.id].find(b => b.id === botData.id);
      if (!exists) {
        userBots[user.id].push({
          id: botData.id,
          username: botData.username,
          avatar: botData.avatar,
          token: token // In real app, encrypt this!
        });
      }

      // Start bot client
      startBotClient(botData.id, token);
      
      saveData();

      res.json({ success: true, bot: botData });
    } catch (error) {
      console.error("Bot Verification Error:", error);
      res.status(400).json({ error: "Invalid Bot Token" });
    }
  });

  app.get("/api/bots/:botId/guilds", async (req, res) => {
    const { botId } = req.params;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    // Check cache
    if (guildsCache[botId] && (Date.now() - guildsCache[botId].timestamp < CACHE_TTL)) {
      return res.json({ guilds: guildsCache[botId].data });
    }

    try {
      const response = await axios.get("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bot ${bot.token}` },
      });
      
      // Update cache
      guildsCache[botId] = {
        data: response.data,
        timestamp: Date.now()
      };

      res.json({ guilds: response.data });
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`Discord API Rate Limit for bot ${botId}. Retry after: ${error.response.headers['retry-after']}s`);
        return res.status(429).json({ 
          error: "Rate limited by Discord", 
          retryAfter: error.response.headers['retry-after'] 
        });
      }
      console.error("Fetch Guilds Error:", error);
      res.status(500).json({ error: "Failed to fetch guilds" });
    }
  });

  app.get("/api/guilds/:guildId/channels", async (req, res) => {
    const { guildId } = req.params;
    const botId = req.query.botId as string;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    try {
      const response = await axios.get(`https://discord.com/api/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${bot.token}` },
      });
      // Filter for text channels (type 0)
      const textChannels = response.data.filter((c: any) => c.type === 0);
      res.json({ channels: textChannels });
    } catch (error) {
      console.error("Fetch Channels Error:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  app.get("/api/guilds/:guildId/roles", async (req, res) => {
    const { guildId } = req.params;
    const botId = req.query.botId as string;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    try {
      const response = await axios.get(`https://discord.com/api/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${bot.token}` },
      });
      res.json({ roles: response.data });
    } catch (error) {
      console.error("Fetch Roles Error:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/embed/send", async (req, res) => {
    const { botId, channelId, content, embed, buttons, selectMenu } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    try {
      let components: any[] = [];
      
      if (buttons && buttons.length > 0) {
        components.push({
          type: 1, // Action Row
          components: buttons.map((btn: any) => ({
            type: 2, // Button
            style: 1, // Primary
            label: btn.label,
            custom_id: `ticket_${Math.random().toString(36).substring(7)}`
          }))
        });
      } else if (selectMenu) {
        components.push({
          type: 1, // Action Row
          components: [{
            type: 3, // Select Menu
            custom_id: `select_ticket_${Math.random().toString(36).substring(7)}`,
            placeholder: selectMenu.placeholder || "Select an option",
            options: selectMenu.options.map((opt: any) => ({
              label: opt.label,
              value: opt.value,
              description: opt.description || ""
            }))
          }]
        });
      }

      let payload: any = {
        content: content || "",
        embeds: embed ? [embed] : [],
        components
      };

      // Handle base64 image if present
      if (embed?.image?.url && embed.image.url.startsWith('data:image')) {
        const base64Data = embed.image.url.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = 'image.png';

        const formData = new FormData();
        
        // The 'payload_json' field contains the message data
        const payloadWithAttachment = { ...payload };
        payloadWithAttachment.embeds[0].image.url = `attachment://${filename}`;
        
        formData.append('payload_json', JSON.stringify(payloadWithAttachment));
        formData.append('files[0]', buffer, { filename });

        const response = await axios.post(`https://discord.com/api/channels/${channelId}/messages`, formData, {
          headers: { 
            Authorization: `Bot ${bot.token}`,
            ...formData.getHeaders()
          },
        });
        console.log("Discord API Success (with attachment):", response.status);
        return res.json({ success: true, message: response.data });
      }

      const response = await axios.post(`https://discord.com/api/channels/${channelId}/messages`, payload, {
        headers: { Authorization: `Bot ${bot.token}` },
      });
      console.log("Discord API Success:", response.status);

      res.json({ success: true, message: response.data });
    } catch (error: any) {
      console.error("Send Embed Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to send message", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Generic Save Endpoint for all systems
  app.post("/api/config/save", (req, res) => {
    const { botId, system, config } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Store config for bot
    if (!botConfigs[botId]) botConfigs[botId] = {};
    botConfigs[botId][system] = config;

    console.log(`Saving ${system} config for bot ${botId}:`, config);

    // If commands or quran are updated, sync slash commands
    if (system === 'commands' || system === 'quran') {
      const bot = userBots[user.id]?.find(b => b.id === botId);
      if (bot) {
        syncSlashCommands(botId, bot.token);
      }
    }

    saveData();

    res.json({ success: true });
  });

  app.post("/api/welcome/test", async (req, res) => {
    const { botId, guildId } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const client = botClients[botId];
    if (!client) return res.status(404).json({ error: "Bot not found" });

    const config = botConfigs[botId]?.welcome;
    if (!config || !config.enabled || !config.channelId) {
      return res.status(400).json({ error: "Welcome system not configured or enabled" });
    }

    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(config.channelId);
      
      if (channel && channel.isTextBased()) {
        const welcomeMessage = config.message
          .replace(/{name}/g, user.username)
          .replace(/{username}/g, `${user.username}#0000`)
          .replace(/{servername}/g, guild.name)
          .replace(/{number}/g, guild.memberCount.toString());

        const embed: any = {
          description: welcomeMessage,
          color: parseInt(config.color.replace('#', ''), 16) || 0x5865f2,
          timestamp: new Date().toISOString()
        };

        const payload: any = { embeds: [embed] };

        if (config.image) {
          if (config.image.startsWith('data:image')) {
            const base64Data = config.image.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const filename = 'welcome.png';
            payload.files = [{ attachment: buffer, name: filename }];
            embed.image = { url: `attachment://${filename}` };
          } else {
            embed.image = { url: config.image };
          }
        }

        await (channel as any).send(payload);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid channel" });
      }
    } catch (error: any) {
      console.error("Error sending test welcome message:", error);
      res.status(500).json({ error: "Failed to send test message", details: error.message });
    }
  });

  app.get("/api/config/:botId/:system", (req, res) => {
    const { botId, system } = req.params;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const config = botConfigs[botId]?.[system] || null;
    res.json({ config });
  });

  // Create channel/category
  app.post("/api/rooms/create", async (req, res) => {
    const { botId, serverId, name, type } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    try {
      const response = await axios.post(
        `https://discord.com/api/v10/guilds/${serverId}/channels`,
        { name, type },
        {
          headers: {
            Authorization: `Bot ${bot.token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error('Error creating channel:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to create channel' });
    }
  });

  // Create role
  app.post("/api/roles/create", async (req, res) => {
    const { botId, serverId, name, color } = req.body;
    const user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const bot = userBots[user.id]?.find(b => b.id === botId);
    if (!bot) return res.status(404).json({ error: "Bot not found" });

    try {
      const response = await axios.post(
        `https://discord.com/api/v10/guilds/${serverId}/roles`,
        { name, color },
        {
          headers: {
            Authorization: `Bot ${bot.token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      console.error('Error creating role:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to create role' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-start existing bots
    Object.values(userBots).forEach(bots => {
      bots.forEach(bot => {
        if (bot.token) {
          startBotClient(bot.id, bot.token);
        }
      });
    });
  });
}

startServer();
