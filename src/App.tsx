import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { 
  MessageSquare, 
  Ticket, 
  UserPlus, 
  Code, 
  Shield, 
  Hammer, 
  ScrollText, 
  AlertTriangle, 
  FolderTree, 
  Gamepad2, 
  Mic2, 
  BookOpen, 
  Settings,
  Menu,
  X,
  Users,
  Check,
  Search,
  ChevronRight,
  ChevronDown,
  Send,
  Layout,
  Palette,
  Image as ImageIcon,
  Plus,
  LogOut,
  Trash2,
  User as UserIcon,
  Camera,
  Lock,
  Hash,
  Volume2,
  Lightbulb,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from './lib/utils';
import { 
  db, 
  auth,
  signInWithPopup,
  googleProvider,
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  OperationType,
  handleFirestoreError
} from './firebase';

interface User {
  id: string;
  username: string;
  avatar: string;
  discriminator: string;
}

interface Bot {
  id: string;
  username: string;
  avatar: string;
  token: string;
}

interface Guild {
  id: string;
  name: string;
  icon: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  active?: boolean;
  onClick?: () => void;
}

const FeatureCard = ({ icon, title, description, active, onClick }: FeatureCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "p-4 cursor-pointer transition-all duration-300",
      "glass-card border-transparent",
      active ? "border-primary/50 bg-primary/10" : "hover:bg-white/5"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", active ? "bg-primary text-white" : "bg-white/10 text-primary")}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  </motion.div>
);

const Dashboard = ({ user, bot, onLogout, onBack }: { user: User; bot: Bot; onLogout: () => void; onBack: () => void }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('embed');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(true);

  const [embedData, setEmbedData] = useState({
    channelId: '',
    title: 'Welcome to SDMX!',
    description: 'This is a preview of your embed message. You can customize everything from the dashboard.',
    color: '#8b5cf6',
    image: 'https://picsum.photos/seed/sdmx/800/400',
    buttons: [] as { label: string }[]
  });
  const [ticketConfig, setTicketConfig] = useState({
    enabled: true,
    channelId: '',
    categoryId: '',
    message: 'Click the button below to open a support ticket.',
    buttonLabel: 'Open Ticket',
    types: ['Support', 'Ads', 'Report'],
    viewRoles: [] as string[],
    mentionRoles: [] as string[],
    title: 'Support Ticket',
    color: '#8b5cf6',
    image: '',
    useSelectMenu: true
  });
  const [welcomeConfig, setWelcomeConfig] = useState({
    enabled: true,
    channelId: '',
    message: 'Welcome to the server, {user}!',
    image: 'https://picsum.photos/seed/welcome/800/400',
    color: '#8b5cf6'
  });
  const [miniGamesConfig, setMiniGamesConfig] = useState({
    enabled: true,
    games: [] as { 
      name: string, 
      type: 'prefix' | 'slash', 
      language: 'javascript' | 'python', 
      code: string, 
      roles: string[], 
      channels: string[], 
      enabled: boolean 
    }[]
  });
  const [commands, setCommands] = useState([
    { 
      name: 'ping', 
      response: 'Pong!', 
      enabled: true, 
      type: 'prefix', 
      language: 'javascript', 
      roles: [] as string[], 
      channels: [] as string[] 
    },
    { 
      name: 'help', 
      response: 'Check out our commands list!', 
      enabled: true, 
      type: 'prefix', 
      language: 'javascript', 
      roles: [] as string[], 
      channels: [] as string[] 
    }
  ]);
  const [rolesConfig, setRolesConfig] = useState({
    autoRole: '',
    roles: [] as { 
      id: string, 
      name: string, 
      color: string, 
      permissions: string[], 
      hoist: boolean, 
      mentionable: boolean 
    }[]
  });
  const [members, setMembers] = useState([
    { id: '1', username: 'Ahmed_SDMX', avatar: 'https://picsum.photos/seed/ahmed/100', roles: ['1'] },
    { id: '2', username: 'Sarah_Dev', avatar: 'https://picsum.photos/seed/sarah/100', roles: ['2'] },
    { id: '3', username: 'Khalid_Mod', avatar: 'https://picsum.photos/seed/khalid/100', roles: ['1', '2'] },
    { id: '4', username: 'Layla_Gamer', avatar: 'https://picsum.photos/seed/layla/100', roles: [] },
    { id: '5', username: 'Omar_Pro', avatar: 'https://picsum.photos/seed/omar/100', roles: [] },
    { id: '6', username: 'Fatima_Art', avatar: 'https://picsum.photos/seed/fatima/100', roles: [] },
  ]);
  const [searchMember, setSearchMember] = useState('');
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingRuleOptionIndex, setEditingRuleOptionIndex] = useState<number | null>(null);
  const [banMuteConfig, setBanMuteConfig] = useState({
    banCommand: 'ban',
    muteCommand: 'mute',
    allowedRoles: [] as string[],
    punishment: 'Mute',
    duration: '10m',
    responseType: 'Embed'
  });
  const [badWordsConfig, setBadWordsConfig] = useState({
    enabled: true,
    words: [] as {
      id: string,
      pattern: string,
      type: 'word' | 'link' | 'mention',
      warnings: number,
      punishment: 'Ban' | 'Mute' | 'None',
      duration: { value: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' },
      deleteMessage: boolean,
      logReport: boolean,
      reportRoomId: string,
      warningEmbed: {
        title: string,
        description: string,
        color: string,
        image: string
      }
    }[],
    allowedRoles: [] as string[]
  });
  const [reports, setReports] = useState<any[]>([]);
  const [botControlConfig, setBotControlConfig] = useState({
    username: bot.username,
    status: 'online',
    activity: 'Playing',
    activityText: 'SDMX Dashboard'
  });
  const [quranConfig, setQuranConfig] = useState({
    enabled: true,
    commandName: 'quran',
    title: 'القرآن الكريم',
    description: 'اختر القارئ الذي تود الاستماع إليه من القائمة أدناه.',
    color: '#8b5cf6',
    readers: [
      { name: 'مشاري العفاسي', url: 'https://server8.mp3quran.net/afs/001.mp3' }
    ] as { name: string, url: string }[]
  });

  const [rooms, setRooms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [serverStats, setServerStats] = useState({ memberCount: 100 });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState({
    name: '',
    type: 'chat',
    isPrivate: false,
    categoryId: '',
    bio: '',
    isMemberCount: false,
    permissions: {
      view: true,
      sendMessages: true,
      connect: true,
      manageMessages: false,
      manageChannels: false,
      muteMembers: false,
      deafenMembers: false,
      moveMembers: false
    }
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleFirebaseLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Firebase Login Error:", error);
    }
  };

  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    const unsubStats = onSnapshot(doc(db, 'stats', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setServerStats(snapshot.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stats/global');
    });

    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return () => {
      unsubRooms();
      unsubCategories();
      unsubStats();
      unsubReports();
    };
  }, [isAuthReady, firebaseUser]);

  const handleSaveRoom = async (roomData: any) => {
    try {
      const roomId = roomData.id || Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, 'rooms', roomId), roomData);
      setSendResult('success');
      setTimeout(() => setSendResult('idle'), 3000);
    } catch (error) {
      console.error('Error saving room:', error);
      setSendResult('error');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'rooms', id));
    } catch (error) {
      console.error('Error deleting room:', error);
    }
  };

  const handleAddCategory = async () => {
    const name = prompt(t('category_name'));
    if (name) {
      try {
        const id = Math.random().toString(36).substr(2, 9);
        await setDoc(doc(db, 'categories', id), { name });
      } catch (error) {
        console.error('Error adding category:', error);
      }
    }
  };
  const [rulesConfig, setRulesConfig] = useState({
    enabled: true,
    channelId: '',
    title: 'Server Rules',
    description: 'Please follow the rules below.',
    color: '#8b5cf6',
    image: '',
    options: [] as { 
      label: string, 
      value: string, 
      responseEmbed: { 
        title: string, 
        description: string, 
        color: string, 
        image: string 
      } 
    }[]
  });
  const [voiceConfig, setVoiceConfig] = useState({
    enabled: true,
    channelId: ''
  });
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (!bot || !activeTab) return;
    
    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/config/${bot.id}/${activeTab}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.config) {
          switch (activeTab) {
            case 'welcome': setWelcomeConfig(data.config); break;
            case 'commands': setCommands(data.config.commands || []); break;
            case 'quran': setQuranConfig(data.config); break;
            case 'ticket': setTicketConfig(data.config); break;
            case 'mini_games': setMiniGamesConfig(data.config); break;
            case 'roles': setRolesConfig(data.config); break;
            case 'ban_mute': setBanMuteConfig(data.config); break;
            case 'bad_words': setBadWordsConfig(data.config); break;
            case 'rules': setRulesConfig(data.config); break;
            case 'voice': setVoiceConfig(data.config); break;
            case 'control': setBotControlConfig(data.config); break;
          }
        }
      } catch (e) {
        console.error("Error fetching config:", e);
      }
    };
    
    fetchConfig();
  }, [bot.id, activeTab]);

  useEffect(() => {
    if (!bot?.id) return;
    const fetchGuilds = async () => {
      try {
        const res = await fetch(`/api/bots/${bot.id}/guilds`);
        if (res.status === 429) {
          console.warn("Rate limited by Discord API. Retrying in 5 seconds...");
          setTimeout(fetchGuilds, 5000);
          return;
        }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data.guilds) {
          setGuilds(data.guilds);
          if (data.guilds.length > 0) setSelectedGuild(data.guilds[0].id);
        }
      } catch (e) {
        console.error("Failed to fetch guilds", e);
      } finally {
        setLoadingGuilds(false);
      }
    };
    fetchGuilds();
  }, [bot.id]);

  useEffect(() => {
    if (!selectedGuild) return;
    const fetchChannels = async () => {
      try {
        const res = await fetch(`/api/guilds/${selectedGuild}/channels?botId=${bot.id}`);
        const data = await res.json();
        if (data.channels) setChannels(data.channels);
      } catch (e) {
        console.error("Failed to fetch channels", e);
      }
    };
    fetchChannels();
  }, [selectedGuild, bot.id]);

  useEffect(() => {
    if (!selectedGuild) return;
    const fetchRoles = async () => {
      try {
        const res = await fetch(`/api/guilds/${selectedGuild}/roles?botId=${bot.id}`);
        const data = await res.json();
        if (data.roles) setRoles(data.roles);
      } catch (e) {
        console.error("Failed to fetch roles", e);
      }
    };
    fetchRoles();
  }, [selectedGuild, bot.id]);

  useEffect(() => {
    if (channels.length > 0 && !embedData.channelId) {
      setEmbedData(prev => ({ ...prev, channelId: channels[0].id }));
    }
  }, [channels]);

  useEffect(() => {
    if (channels.length > 0 && !embedData.channelId) {
      setEmbedData(prev => ({ ...prev, channelId: channels[0].id }));
    }
  }, [channels]);

  const [roomName, setRoomName] = useState('');
  const [categoryName, setCategoryName] = useState('');

  const handleCreateRole = async (role: any) => {
    if (!selectedGuild || !bot) return;
    
    setSendResult('sending');
    try {
      const response = await fetch('/api/roles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          serverId: selectedGuild,
          name: role.name,
          color: parseInt(role.color.replace('#', ''), 16)
        })
      });

      if (response.ok) {
        setSendResult('success');
      } else {
        setSendResult('error');
      }
    } catch (error) {
      setSendResult('error');
    }
    setTimeout(() => setSendResult('idle'), 3000);
  };

  const handleCreateChannel = async (type: 'text' | 'category') => {
    if (!selectedGuild || !bot) return;
    const name = type === 'text' ? roomName : categoryName;
    if (!name) return;

    setSendResult('sending');
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          serverId: selectedGuild,
          name,
          type: type === 'text' ? 0 : 4 // 0 for text, 4 for category
        })
      });

      if (response.ok) {
        setSendResult('success');
        if (type === 'text') setRoomName('');
        else setCategoryName('');
        // Refresh channels
        const channelsRes = await fetch(`/api/channels?serverId=${selectedGuild}&botId=${bot.id}`);
        if (channelsRes.ok) setChannels(await channelsRes.json());
      } else {
        setSendResult('error');
      }
    } catch (error) {
      setSendResult('error');
    }
    setTimeout(() => setSendResult('idle'), 3000);
  };

  const handleSave = async (system: string, config: any) => {
    if (!bot || !selectedGuild) return;
    
    setSending(true);
    setSendResult(null);
    
    try {
      const response = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          system,
          config
        })
      });
      
      if (response.ok) {
        setSendResult('success');
        setTimeout(() => setSendResult(null), 3000);
      } else {
        setSendResult('error');
        setTimeout(() => setSendResult(null), 3000);
      }
    } catch (error) {
      console.error('Save Error:', error);
      setSendResult('error');
      setTimeout(() => setSendResult(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleSendEmbed = async () => {
    if (!embedData.channelId) return alert("Please select a channel");
    setSending(true);
    setSendResult(null);
    console.log("Sending Embed:", embedData);
    try {
      const res = await fetch('/api/embed/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          channelId: embedData.channelId,
          embed: {
            title: embedData.title,
            description: embedData.description,
            color: parseInt(embedData.color.replace('#', ''), 16),
            image: embedData.image ? { url: embedData.image } : undefined
          },
          buttons: embedData.buttons
        })
      });
      const data = await res.json();
      if (data.success) {
        setSendResult('success');
        setTimeout(() => setSendResult(null), 3000);
      } else {
        setSendResult('error');
        alert(`Failed to send message: ${data.error}\nDetails: ${JSON.stringify(data.details)}`);
        setTimeout(() => setSendResult(null), 3000);
      }
    } catch (e: any) {
      console.error("Send Embed Error:", e);
      setSendResult('error');
      alert(`Connection Error: ${e.message}`);
      setTimeout(() => setSendResult(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const handleEmbedImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEmbedData({ ...embedData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTicketImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTicketConfig({ ...ticketConfig, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendTicketMessage = async () => {
    if (!ticketConfig.channelId) return alert("Please select a channel");
    setSending(true);
    setSendResult(null);
    console.log("Sending Ticket Message:", ticketConfig);
    try {
      const res = await fetch('/api/embed/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: bot.id,
          channelId: ticketConfig.channelId,
          embed: {
            title: ticketConfig.title,
            description: ticketConfig.message,
            color: parseInt(ticketConfig.color.replace('#', ''), 16),
            image: ticketConfig.image ? { url: ticketConfig.image } : undefined
          },
          buttons: !ticketConfig.useSelectMenu ? [{ label: ticketConfig.buttonLabel }] : [],
          selectMenu: ticketConfig.useSelectMenu ? {
            placeholder: ticketConfig.buttonLabel,
            options: ticketConfig.types.map(t => ({ label: t, value: t.toLowerCase() }))
          } : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setSendResult('success');
        setTimeout(() => setSendResult(null), 3000);
      } else {
        setSendResult('error');
        alert(`Failed to send ticket message: ${data.error}\nDetails: ${JSON.stringify(data.details)}`);
        setTimeout(() => setSendResult(null), 3000);
      }
    } catch (e: any) {
      console.error("Send Ticket Error:", e);
      setSendResult('error');
      alert(`Connection Error: ${e.message}`);
      setTimeout(() => setSendResult(null), 3000);
    } finally {
      setSending(false);
    }
  };

  const menuItems = [
    { id: 'embed', icon: <MessageSquare size={20} />, label: t('embed_message') },
    { id: 'ticket', icon: <Ticket size={20} />, label: t('ticket_system') },
    { id: 'welcome', icon: <UserPlus size={20} />, label: t('welcome_system') },
    { id: 'commands', icon: <Code size={20} />, label: t('commands_editor') },
    { id: 'roles', icon: <Shield size={20} />, label: t('roles_control') },
    { id: 'ban', icon: <Hammer size={20} />, label: t('ban_mute') },
    { id: 'rules', icon: <ScrollText size={20} />, label: t('rules_message') },
    { id: 'badwords', icon: <AlertTriangle size={20} />, label: t('bad_words') },
    { id: 'reports', icon: <ScrollText size={20} />, label: t('reports_log') },
    { id: 'rooms', icon: <FolderTree size={20} />, label: t('room_category_editor') },
    { id: 'games', icon: <Gamepad2 size={20} />, label: t('mini_games') },
    { id: 'voice', icon: <Mic2 size={20} />, label: t('voice_support') },
    { id: 'quran', icon: <BookOpen size={20} />, label: t('quran_bot') },
    { id: 'control', icon: <Settings size={20} />, label: t('bot_control') },
  ];

  const replaceWelcomeVariables = (text: string) => {
    return text
      .replace(/{name}/g, 'User')
      .replace(/{username}/g, 'User#1234')
      .replace(/{servername}/g, guilds.find(g => g.id === selectedGuild)?.name || 'Server Name')
      .replace(/{number}/g, '100');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'embed':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Layout className="text-primary" /> {t('embed_message')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('select_server')}</label>
                    <select 
                      value={selectedGuild}
                      onChange={(e) => setSelectedGuild(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                    >
                      {loadingGuilds ? (
                        <option>Loading servers...</option>
                      ) : guilds.length === 0 ? (
                        <option>No servers found</option>
                      ) : (
                        guilds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('channel')}</label>
                    <select 
                      value={embedData.channelId}
                      onChange={(e) => setEmbedData({...embedData, channelId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                    >
                      {channels.length === 0 ? (
                        <option>No text channels found</option>
                      ) : (
                        channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('title')}</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      value={embedData.title}
                      onChange={(e) => setEmbedData({...embedData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('message')}</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary h-32"
                      placeholder="Enter your message here..."
                      value={embedData.description}
                      onChange={(e) => setEmbedData({...embedData, description: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('color')}</label>
                      <div className="flex gap-2">
                        <input 
                          type="color" 
                          className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" 
                          value={embedData.color}
                          onChange={(e) => setEmbedData({...embedData, color: e.target.value})}
                        />
                        <input 
                          type="text" 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary" 
                          value={embedData.color}
                          onChange={(e) => setEmbedData({...embedData, color: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('image')}</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary text-xs" 
                            placeholder="https://..." 
                            value={embedData.image.startsWith('data:') ? 'Uploaded Image' : embedData.image}
                            onChange={(e) => setEmbedData({...embedData, image: e.target.value})}
                          />
                        </div>
                        <label className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                          <Plus size={18} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleEmbedImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-2">{t('buttons')}</label>
                    <div className="space-y-2">
                      {embedData.buttons.map((btn, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                            value={btn.label}
                            onChange={(e) => {
                              const newBtns = [...embedData.buttons];
                              newBtns[idx].label = e.target.value;
                              setEmbedData({...embedData, buttons: newBtns});
                            }}
                          />
                          <button 
                            onClick={() => {
                              const newBtns = embedData.buttons.filter((_, i) => i !== idx);
                              setEmbedData({...embedData, buttons: newBtns});
                            }}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => setEmbedData({...embedData, buttons: [...embedData.buttons, { label: 'New Button' }]})}
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus size={16} /> Add Button
                    </button>
                  </div>
                </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={handleSendEmbed}
                      disabled={sending}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-50",
                        sendResult === 'success' ? "bg-green-500 text-white" : 
                        sendResult === 'error' ? "bg-red-500 text-white" : 
                        "btn-primary"
                      )}
                    >
                      <Send size={18} /> {sending ? 'Sending...' : sendResult === 'success' ? 'Sent!' : sendResult === 'error' ? 'Failed!' : t('send')}
                    </button>
                    <button 
                      onClick={() => handleSave('embed', embedData)}
                      className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
                    >
                      {t('save')}
                    </button>
                  </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Palette className="text-secondary" /> {t('preview')}
                </h2>
                <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderLeftColor: embedData.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold overflow-hidden">
                      <img src={bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} alt="" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{bot.username}</span>
                        <span className="bg-primary text-[10px] px-1 rounded uppercase">Bot</span>
                      </div>
                      <div className="text-xs text-white/40">Today at 12:00 PM</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold">{embedData.title}</h3>
                    <p className="text-sm text-white/80 whitespace-pre-wrap">{embedData.description}</p>
                    {embedData.image && <img src={embedData.image} alt="Preview" className="rounded-lg mt-2 max-h-64 object-cover" />}
                  </div>
                  {embedData.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {embedData.buttons.map((btn, idx) => (
                        <div key={idx} className="bg-[#5865f2] px-4 py-1.5 rounded text-sm font-medium">
                          {btn.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'ticket':
        return (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Ticket className="text-primary" /> {t('ticket_system')}
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={ticketConfig.enabled}
                      onChange={(e) => setTicketConfig({...ticketConfig, enabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Basic Settings</h3>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('ticket_channel')}</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                          value={ticketConfig.channelId}
                          onChange={(e) => setTicketConfig({...ticketConfig, channelId: e.target.value})}
                        >
                          <option value="">Select Channel</option>
                          {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('ticket_category')}</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                          value={ticketConfig.categoryId}
                          onChange={(e) => setTicketConfig({...ticketConfig, categoryId: e.target.value})}
                        >
                          <option value="">Select Category</option>
                          {channels.filter(c => c.type === 4).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Role Permissions</h3>
                      <div>
                        <label className="block text-sm font-medium mb-2">Roles that can see tickets</label>
                        <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-white/5 border border-white/10 rounded-xl">
                          {roles.length === 0 ? (
                            <p className="text-xs text-white/40 p-2">No roles found</p>
                          ) : (
                            roles.map(role => (
                              <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={ticketConfig.viewRoles.includes(role.id)}
                                  onChange={(e) => {
                                    const newRoles = e.target.checked 
                                      ? [...ticketConfig.viewRoles, role.id]
                                      : ticketConfig.viewRoles.filter(id => id !== role.id);
                                    setTicketConfig({...ticketConfig, viewRoles: newRoles});
                                  }}
                                  className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">{role.name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Roles to mention on creation</label>
                        <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-white/5 border border-white/10 rounded-xl">
                          {roles.map(role => (
                            <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors">
                              <input 
                                type="checkbox" 
                                checked={ticketConfig.mentionRoles.includes(role.id)}
                                onChange={(e) => {
                                  const newRoles = e.target.checked 
                                    ? [...ticketConfig.mentionRoles, role.id]
                                    : ticketConfig.mentionRoles.filter(id => id !== role.id);
                                  setTicketConfig({...ticketConfig, mentionRoles: newRoles});
                                }}
                                className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{role.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Embed Configuration</h3>
                      <div>
                        <label className="block text-sm font-medium mb-2">Embed Title</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                          value={ticketConfig.title}
                          onChange={(e) => setTicketConfig({...ticketConfig, title: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('ticket_message')}</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary h-24"
                          value={ticketConfig.message}
                          onChange={(e) => setTicketConfig({...ticketConfig, message: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Color</label>
                          <input 
                            type="color" 
                            className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-1 py-1 cursor-pointer"
                            value={ticketConfig.color}
                            onChange={(e) => setTicketConfig({...ticketConfig, color: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">{t('interaction_type')}</label>
                          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                            <button 
                              onClick={() => setTicketConfig({...ticketConfig, useSelectMenu: false})}
                              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", !ticketConfig.useSelectMenu ? "bg-primary text-white" : "hover:bg-white/5")}
                            >
                              {t('button')}
                            </button>
                            <button 
                              onClick={() => setTicketConfig({...ticketConfig, useSelectMenu: true})}
                              className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", ticketConfig.useSelectMenu ? "bg-primary text-white" : "hover:bg-white/5")}
                            >
                              {t('menu')}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{ticketConfig.useSelectMenu ? t('menu_placeholder') : t('button_label')}</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                          value={ticketConfig.buttonLabel}
                          onChange={(e) => setTicketConfig({...ticketConfig, buttonLabel: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Embed Image</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-xs"
                            placeholder="Image URL"
                            value={ticketConfig.image.startsWith('data:') ? 'Uploaded Image' : ticketConfig.image}
                            onChange={(e) => setTicketConfig({...ticketConfig, image: e.target.value})}
                          />
                          <label className="p-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                            <ImageIcon size={20} />
                            <input type="file" className="hidden" onChange={handleTicketImageUpload} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-white/40">Ticket Types</h3>
                      <div className="space-y-2">
                        {ticketConfig.types.map((type, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input 
                              type="text" 
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                              value={type}
                              onChange={(e) => {
                                const newTypes = [...ticketConfig.types];
                                newTypes[idx] = e.target.value;
                                setTicketConfig({...ticketConfig, types: newTypes});
                              }}
                            />
                            <button 
                              onClick={() => setTicketConfig({...ticketConfig, types: ticketConfig.types.filter((_, i) => i !== idx)})}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => setTicketConfig({...ticketConfig, types: [...ticketConfig.types, 'New Type']})}
                          className="w-full py-2 border border-dashed border-white/20 rounded-xl text-sm text-white/40 hover:text-white hover:border-white/40 transition-all"
                        >
                          + {t('add_type')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={handleSendTicketMessage}
                    disabled={sending}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all duration-300 disabled:opacity-50",
                      sendResult === 'success' ? "bg-green-500 text-white" : 
                      sendResult === 'error' ? "bg-red-500 text-white" : 
                      "btn-primary"
                    )}
                  >
                    <Send size={18} /> {sending ? 'Sending...' : sendResult === 'success' ? 'Sent!' : sendResult === 'error' ? 'Failed!' : 'Send Ticket Message'}
                  </button>
                  <button 
                    onClick={() => handleSave('ticket', ticketConfig)}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4 sticky top-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Palette className="text-secondary" /> {t('preview')}
                </h2>
                <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderLeftColor: ticketConfig.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold overflow-hidden">
                      <img src={bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} alt="" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{bot.username}</span>
                        <span className="bg-primary text-[10px] px-1 rounded uppercase">Bot</span>
                      </div>
                      <div className="text-xs text-white/40">Today at 12:00 PM</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold">{ticketConfig.title}</h3>
                    <p className="text-sm text-white/80 whitespace-pre-wrap">{ticketConfig.message}</p>
                    {ticketConfig.image && <img src={ticketConfig.image} alt="Preview" className="rounded-lg mt-2 max-h-48 object-cover" />}
                  </div>
                  
                  <div className="mt-4">
                    {ticketConfig.useSelectMenu ? (
                      <div className="bg-[#1e1f22] border border-white/5 rounded p-2 flex items-center justify-between text-white/40 text-sm">
                        <span>{ticketConfig.buttonLabel || 'Select an option...'}</span>
                        <ChevronDown size={16} />
                      </div>
                    ) : (
                      <div className="bg-[#5865f2] px-4 py-1.5 rounded text-sm font-medium inline-block">
                        {ticketConfig.buttonLabel}
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                  <p className="text-xs text-primary leading-relaxed">
                    <strong>Note:</strong> This is how the message will appear in Discord. Users will interact with the {ticketConfig.useSelectMenu ? 'menu' : 'button'} to open a ticket.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'welcome':
        return (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <UserPlus className="text-primary" /> {t('welcome_system')}
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={welcomeConfig.enabled}
                      onChange={(e) => setWelcomeConfig({...welcomeConfig, enabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('welcome_channel')}</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                        value={welcomeConfig.channelId}
                        onChange={(e) => setWelcomeConfig({...welcomeConfig, channelId: e.target.value})}
                      >
                        <option value="">Select Channel</option>
                        {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('welcome_message')}</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary h-32"
                        value={welcomeConfig.message}
                        onChange={(e) => setWelcomeConfig({...welcomeConfig, message: e.target.value})}
                      />
                      <p className="text-xs text-white/40 mt-2">{t('variables_hint')}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('welcome_image')}</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                          placeholder="Image URL"
                          value={welcomeConfig.image}
                          onChange={(e) => setWelcomeConfig({...welcomeConfig, image: e.target.value})}
                        />
                        <label className="p-2 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                          <ImageIcon size={20} />
                          <input type="file" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setWelcomeConfig({...welcomeConfig, image: reader.result as string});
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('color')}</label>
                      <input 
                        type="color" 
                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-1 py-1 cursor-pointer"
                        value={welcomeConfig.color}
                        onChange={(e) => setWelcomeConfig({...welcomeConfig, color: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleSave('welcome', welcomeConfig)}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all duration-300 mb-2",
                    sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                  )}
                >
                  {sendResult === 'success' ? t('save_success') : t('save')}
                </button>
                <button 
                  onClick={async () => {
                    if (!welcomeConfig.channelId) return alert("Please select a channel first");
                    setSending(true);
                    try {
                      const res = await fetch('/api/welcome/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ botId: bot.id, guildId: selectedGuild })
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert("Test welcome message sent!");
                      } else {
                        alert(`Error: ${data.error}`);
                      }
                    } catch (e: any) {
                      alert(`Error: ${e.message}`);
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="w-full py-2 rounded-xl font-medium border border-white/10 hover:bg-white/5 transition-all text-sm"
                >
                  {t('send_test_message')}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4 sticky top-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Palette className="text-secondary" /> {t('preview')}
                </h2>
                <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderLeftColor: welcomeConfig.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold overflow-hidden">
                      <img src={bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} alt="" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{bot.username}</span>
                        <span className="bg-primary text-[10px] px-1 rounded uppercase">Bot</span>
                      </div>
                      <div className="text-xs text-white/40">Today at 12:00 PM</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-white/80 whitespace-pre-wrap">
                      {replaceWelcomeVariables(welcomeConfig.message || 'Welcome to the server!')}
                    </p>
                    {welcomeConfig.image && <img src={welcomeConfig.image} alt="Preview" className="rounded-lg mt-2 max-h-48 object-cover" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'games':
        return (
          <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Gamepad2 className="text-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('games_editor')}</h2>
                    <p className="text-sm text-white/40">Create and manage custom games for your bot</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={miniGamesConfig.enabled}
                      onChange={(e) => setMiniGamesConfig({...miniGamesConfig, enabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <button 
                    onClick={() => setMiniGamesConfig({
                      ...miniGamesConfig,
                      games: [...miniGamesConfig.games, {
                        name: 'newgame',
                        type: 'slash',
                        language: 'javascript',
                        code: '// Write your game code here\ninteraction.reply("Game started!");',
                        roles: [],
                        channels: [],
                        enabled: true
                      }]
                    })}
                    className="btn-primary px-4 py-2 flex items-center gap-2 text-sm"
                  >
                    <Plus size={18} /> {t('add_game')}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {miniGamesConfig.games.map((game, idx) => (
                  <div key={idx} className="glass-card p-6 space-y-6 border-white/5 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-xs">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                            {game.type === 'slash' ? '/' : '!'}
                          </span>
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:border-primary text-sm"
                            value={game.name}
                            onChange={(e) => {
                              const newGames = [...miniGamesConfig.games];
                              newGames[idx].name = e.target.value.toLowerCase().replace(/\s+/g, '');
                              setMiniGamesConfig({...miniGamesConfig, games: newGames});
                            }}
                          />
                        </div>
                        <select 
                          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={game.type}
                          onChange={(e) => {
                            const newGames = [...miniGamesConfig.games];
                            newGames[idx].type = e.target.value as 'prefix' | 'slash';
                            setMiniGamesConfig({...miniGamesConfig, games: newGames});
                          }}
                        >
                          <option value="slash">Slash Command</option>
                          <option value="prefix">Prefix Command</option>
                        </select>
                        <select 
                          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={game.language}
                          onChange={(e) => {
                            const newGames = [...miniGamesConfig.games];
                            newGames[idx].language = e.target.value as 'javascript' | 'python';
                            setMiniGamesConfig({...miniGamesConfig, games: newGames});
                          }}
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const newGames = [...miniGamesConfig.games];
                            newGames[idx].enabled = !newGames[idx].enabled;
                            setMiniGamesConfig({...miniGamesConfig, games: newGames});
                          }}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                            game.enabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          )}
                        >
                          {game.enabled ? t('enabled') : t('disabled')}
                        </button>
                        <button 
                          onClick={() => {
                            const newGames = miniGamesConfig.games.filter((_, i) => i !== idx);
                            setMiniGamesConfig({...miniGamesConfig, games: newGames});
                          }}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-2 text-white/40 uppercase tracking-widest">{t('allowed_roles')}</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-white/5 border border-white/10 rounded-xl min-h-[45px]">
                          {roles.map(role => (
                            <button
                              key={role.id}
                              onClick={() => {
                                const newGames = [...miniGamesConfig.games];
                                if (newGames[idx].roles.includes(role.id)) {
                                  newGames[idx].roles = newGames[idx].roles.filter(id => id !== role.id);
                                } else {
                                  newGames[idx].roles.push(role.id);
                                }
                                setMiniGamesConfig({...miniGamesConfig, games: newGames});
                              }}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs transition-all",
                                game.roles.includes(role.id) 
                                  ? "bg-primary text-white" 
                                  : "bg-white/10 text-white/60 hover:bg-white/20"
                              )}
                            >
                              {role.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-2 text-white/40 uppercase tracking-widest">{t('allowed_channels')}</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-white/5 border border-white/10 rounded-xl min-h-[45px]">
                          {channels.map(channel => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                const newGames = [...miniGamesConfig.games];
                                if (newGames[idx].channels.includes(channel.id)) {
                                  newGames[idx].channels = newGames[idx].channels.filter(id => id !== channel.id);
                                } else {
                                  newGames[idx].channels.push(channel.id);
                                }
                                setMiniGamesConfig({...miniGamesConfig, games: newGames});
                              }}
                              className={cn(
                                "px-3 py-1 rounded-full text-xs transition-all",
                                game.channels.includes(channel.id) 
                                  ? "bg-secondary text-white" 
                                  : "bg-white/10 text-white/60 hover:bg-white/20"
                              )}
                            >
                              #{channel.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-white/40 uppercase tracking-widest">{t('code_editor')}</label>
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-xl opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <textarea 
                          className="relative w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary font-mono text-sm h-48 text-green-400"
                          spellCheck="false"
                          value={game.code}
                          onChange={(e) => {
                            const newGames = [...miniGamesConfig.games];
                            newGames[idx].code = e.target.value;
                            setMiniGamesConfig({...miniGamesConfig, games: newGames});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {miniGamesConfig.games.length === 0 && (
                  <div className="text-center py-12 glass-card border-dashed border-white/10">
                    <Gamepad2 className="mx-auto text-white/20 mb-4" size={48} />
                    <p className="text-white/40">No games created yet. Click "Add Game" to start.</p>
                  </div>
                )}
                <button 
                  onClick={() => handleSave('games', miniGamesConfig)}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg shadow-primary/20",
                    sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                  )}
                >
                  {sendResult === 'success' ? t('save_success') : t('save')}
                </button>
              </div>
            </div>
          </div>
        );
      case 'commands':
        return (
          <div className="max-w-5xl mx-auto space-y-6 pb-20">
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Code className="text-primary" /> {t('commands_editor')}
                  </h2>
                  <p className="text-sm text-white/40 mt-1">Create custom commands with JavaScript or Python code.</p>
                </div>
                <button 
                  onClick={() => setCommands([...commands, { 
                    name: '', 
                    response: '', 
                    enabled: true, 
                    type: 'prefix', 
                    language: 'javascript', 
                    roles: [], 
                    channels: [] 
                  }])}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={18} /> {t('add_command')}
                </button>
              </div>
              <div className="space-y-6">
                {commands.map((cmd, idx) => (
                  <div key={idx} className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                          <label className="block text-xs font-medium mb-1 text-white/40">{t('command_name')}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                              {cmd.type === 'prefix' ? '!' : '/'}
                            </span>
                            <input 
                              type="text" 
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:border-primary"
                              placeholder="command"
                              value={cmd.name}
                              onChange={(e) => {
                                const newCmds = [...commands];
                                newCmds[idx].name = e.target.value;
                                setCommands(newCmds);
                              }}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium mb-1 text-white/40">Type</label>
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                            value={cmd.type}
                            onChange={(e) => {
                              const newCmds = [...commands];
                              newCmds[idx].type = e.target.value as any;
                              setCommands(newCmds);
                            }}
                          >
                            <option value="prefix">Prefix (!)</option>
                            <option value="slash">Slash (/)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1 text-white/40">Language</label>
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                            value={cmd.language}
                            onChange={(e) => {
                              const newCmds = [...commands];
                              newCmds[idx].language = e.target.value as any;
                              setCommands(newCmds);
                            }}
                          >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={cmd.enabled}
                            onChange={(e) => {
                              const newCmds = [...commands];
                              newCmds[idx].enabled = e.target.checked;
                              setCommands(newCmds);
                            }}
                          />
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <button 
                          onClick={() => {
                            const newCmds = commands.filter((_, i) => i !== idx);
                            setCommands(newCmds);
                          }}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Allowed Roles</label>
                        <div className="flex flex-wrap gap-2 p-2 bg-white/5 border border-white/10 rounded-xl min-h-[42px]">
                          {roles.map(role => (
                            <button
                              key={role.id}
                              onClick={() => {
                                const newCmds = [...commands];
                                const currentRoles = newCmds[idx].roles || [];
                                if (currentRoles.includes(role.id)) {
                                  newCmds[idx].roles = currentRoles.filter(id => id !== role.id);
                                } else {
                                  newCmds[idx].roles = [...currentRoles, role.id];
                                }
                                setCommands(newCmds);
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-xs transition-colors",
                                (cmd.roles || []).includes(role.id) 
                                  ? "bg-primary text-white" 
                                  : "bg-white/10 text-white/60 hover:bg-white/20"
                              )}
                            >
                              {role.name}
                            </button>
                          ))}
                          {roles.length === 0 && <span className="text-xs text-white/20 p-1">No roles found</span>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Allowed Channels</label>
                        <div className="flex flex-wrap gap-2 p-2 bg-white/5 border border-white/10 rounded-xl min-h-[42px]">
                          {channels.map(channel => (
                            <button
                              key={channel.id}
                              onClick={() => {
                                const newCmds = [...commands];
                                const currentChannels = newCmds[idx].channels || [];
                                if (currentChannels.includes(channel.id)) {
                                  newCmds[idx].channels = currentChannels.filter(id => id !== channel.id);
                                } else {
                                  newCmds[idx].channels = [...currentChannels, channel.id];
                                }
                                setCommands(newCmds);
                              }}
                              className={cn(
                                "px-2 py-1 rounded text-xs transition-colors",
                                (cmd.channels || []).includes(channel.id) 
                                  ? "bg-secondary text-white" 
                                  : "bg-white/10 text-white/60 hover:bg-white/20"
                              )}
                            >
                              #{channel.name}
                            </button>
                          ))}
                          {channels.length === 0 && <span className="text-xs text-white/20 p-1">No channels found</span>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">
                        {cmd.language === 'javascript' ? 'JavaScript Code' : 'Python Code'}
                      </label>
                      <div className="relative group/code">
                        <textarea 
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary h-48 font-mono text-sm leading-relaxed"
                          placeholder={cmd.language === 'javascript' ? 
                            "// Example:\nmessage.reply('Hello from JS!');" : 
                            "# Example:\nawait message.channel.send('Hello from Python!')"
                          }
                          value={cmd.response}
                          onChange={(e) => {
                            const newCmds = [...commands];
                            newCmds[idx].response = e.target.value;
                            setCommands(newCmds);
                          }}
                        />
                        <div className="absolute top-3 right-3 opacity-0 group-hover/code:opacity-100 transition-opacity">
                          <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold bg-white/5 px-2 py-1 rounded">
                            {cmd.language}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/20 mt-2 italic">
                        Available objects: <code>message</code>, <code>client</code>, <code>guild</code>, <code>channel</code>, <code>author</code>.
                      </p>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => handleSave('commands', { commands })}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold transition-all duration-300 shadow-lg shadow-primary/20",
                    sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                  )}
                >
                  {sendResult === 'success' ? t('save_success') : "Save All Commands"}
                </button>
              </div>
            </div>
          </div>
        );
      case 'ban_mute':
        return (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Hammer className="text-primary" /> {t('member_ban_mute')}
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Ban Command</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">/</span>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:border-primary"
                          value={banMuteConfig.banCommand}
                          onChange={(e) => setBanMuteConfig({...banMuteConfig, banCommand: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Mute Command</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">/</span>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:border-primary"
                          value={banMuteConfig.muteCommand}
                          onChange={(e) => setBanMuteConfig({...banMuteConfig, muteCommand: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('allowed_roles')}</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
                      {roles.map(role => (
                        <button
                          key={role.id}
                          onClick={() => {
                            const newRoles = banMuteConfig.allowedRoles.includes(role.id)
                              ? banMuteConfig.allowedRoles.filter(id => id !== role.id)
                              : [...banMuteConfig.allowedRoles, role.id];
                            setBanMuteConfig({...banMuteConfig, allowedRoles: newRoles});
                          }}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs transition-all border",
                            banMuteConfig.allowedRoles.includes(role.id)
                              ? "bg-primary/20 border-primary/50 text-white"
                              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                          )}
                        >
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('punishments')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Ban', 'Mute', 'Kick'].map(p => (
                        <button 
                          key={p}
                          onClick={() => setBanMuteConfig({...banMuteConfig, punishment: p})}
                          className={cn(
                            "py-2 rounded-xl border transition-all",
                            banMuteConfig.punishment === p ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('duration')}</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      placeholder="e.g. 10m, 1h, 1d"
                      value={banMuteConfig.duration}
                      onChange={(e) => setBanMuteConfig({...banMuteConfig, duration: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Response Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Embed', 'Normal'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setBanMuteConfig({...banMuteConfig, responseType: t})}
                          className={cn(
                            "py-2 rounded-xl border transition-all",
                            banMuteConfig.responseType === t ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSave('ban_mute', banMuteConfig)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all duration-300",
                      sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                    )}
                  >
                    {sendResult === 'success' ? t('save_success') : t('save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Command Preview</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-sm">
                    <span className="text-primary">/</span>{banMuteConfig.muteCommand} <span className="text-white/40">@username</span> <span className="text-white/40">{banMuteConfig.duration}</span>
                  </div>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-sm">
                    <span className="text-primary">/</span>{banMuteConfig.banCommand} <span className="text-white/40">@username</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'bad_words':
        return (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <AlertTriangle className="text-primary" /> {t('bad_words_system')}
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={badWordsConfig.enabled}
                      onChange={(e) => setBadWordsConfig({...badWordsConfig, enabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium">{t('forbidden_list')}</label>
                    <button 
                      onClick={() => {
                        const pattern = prompt('Enter the word, link, or mention to filter:');
                        if (pattern) {
                          setBadWordsConfig({
                            ...badWordsConfig, 
                            words: [...badWordsConfig.words, {
                              id: Math.random().toString(36).substr(2, 9),
                              pattern,
                              type: 'word',
                              warnings: 1,
                              punishment: 'Mute',
                              duration: { value: 10, unit: 'minutes' },
                              deleteMessage: true,
                              logReport: true,
                              reportRoomId: '',
                              warningEmbed: { title: 'Warning', description: 'Forbidden content detected', color: '#ff0000', image: '' }
                            }]
                          });
                        }
                      }}
                      className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm"
                    >
                      <Plus size={16} /> {t('add_entry')}
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {badWordsConfig.words.map((w, idx) => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl group">
                        <div className="flex flex-col">
                          <span className="font-medium">{w.pattern}</span>
                          <span className="text-[10px] text-white/40 uppercase tracking-widest">{w.type}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingWordIndex(idx)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                          >
                            <Settings size={14} />
                          </button>
                          <button 
                            onClick={() => {
                              const newWords = badWordsConfig.words.filter((_, i) => i !== idx);
                              setBadWordsConfig({...badWordsConfig, words: newWords});
                            }}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('allowed_roles')}</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
                      {roles.map(role => (
                        <button
                          key={role.id}
                          onClick={() => {
                            const newRoles = badWordsConfig.allowedRoles.includes(role.id)
                              ? badWordsConfig.allowedRoles.filter(id => id !== role.id)
                              : [...badWordsConfig.allowedRoles, role.id];
                            setBadWordsConfig({...badWordsConfig, allowedRoles: newRoles});
                          }}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs transition-all border",
                            badWordsConfig.allowedRoles.includes(role.id)
                              ? "bg-primary/20 border-primary/50 text-white"
                              : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                          )}
                        >
                          {role.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSave('bad_words', badWordsConfig)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all duration-300",
                      sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                    )}
                  >
                    {sendResult === 'success' ? t('save_success') : t('save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {editingWordIndex !== null ? (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <Settings size={18} className="text-primary" /> Edit: {badWordsConfig.words[editingWordIndex].pattern}
                    </h3>
                    <button onClick={() => setEditingWordIndex(null)} className="text-white/40 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Type</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={badWordsConfig.words[editingWordIndex].type}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].type = e.target.value as any;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        >
                          <option value="word">Word</option>
                          <option value="link">Link</option>
                          <option value="mention">Mention</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Warnings</label>
                        <input 
                          type="number" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={badWordsConfig.words[editingWordIndex].warnings}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].warnings = parseInt(e.target.value);
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Punishment</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={badWordsConfig.words[editingWordIndex].punishment}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].punishment = e.target.value as any;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        >
                          <option value="None">None</option>
                          <option value="Mute">Mute</option>
                          <option value="Ban">Ban</option>
                        </select>
                      </div>
                      {badWordsConfig.words[editingWordIndex].punishment === 'Mute' && (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium mb-1 text-white/40">Value</label>
                            <input 
                              type="number" 
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                              value={badWordsConfig.words[editingWordIndex].duration.value}
                              onChange={(e) => {
                                const newWords = [...badWordsConfig.words];
                                newWords[editingWordIndex].duration.value = parseInt(e.target.value);
                                setBadWordsConfig({...badWordsConfig, words: newWords});
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium mb-1 text-white/40">Unit</label>
                            <select 
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                              value={badWordsConfig.words[editingWordIndex].duration.unit}
                              onChange={(e) => {
                                const newWords = [...badWordsConfig.words];
                                newWords[editingWordIndex].duration.unit = e.target.value as any;
                                setBadWordsConfig({...badWordsConfig, words: newWords});
                              }}
                            >
                              <option value="seconds">Seconds</option>
                              <option value="minutes">Minutes</option>
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary" 
                          checked={badWordsConfig.words[editingWordIndex].deleteMessage}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].deleteMessage = e.target.checked;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        />
                        <span className="text-xs group-hover:text-white transition-colors">Delete Message</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary" 
                          checked={badWordsConfig.words[editingWordIndex].logReport}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].logReport = e.target.checked;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        />
                        <span className="text-xs group-hover:text-white transition-colors">Log Report</span>
                      </label>
                    </div>

                    {badWordsConfig.words[editingWordIndex].logReport && (
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Report Room</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={badWordsConfig.words[editingWordIndex].reportRoomId}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].reportRoomId = e.target.value;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        >
                          <option value="">Select Room</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>#{r.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Warning Embed</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-medium mb-1 text-white/40">Title</label>
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs"
                            value={badWordsConfig.words[editingWordIndex].warningEmbed.title}
                            onChange={(e) => {
                              const newWords = [...badWordsConfig.words];
                              newWords[editingWordIndex].warningEmbed.title = e.target.value;
                              setBadWordsConfig({...badWordsConfig, words: newWords});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium mb-1 text-white/40">Color</label>
                          <input 
                            type="color" 
                            className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-1 py-1 cursor-pointer"
                            value={badWordsConfig.words[editingWordIndex].warningEmbed.color}
                            onChange={(e) => {
                              const newWords = [...badWordsConfig.words];
                              newWords[editingWordIndex].warningEmbed.color = e.target.value;
                              setBadWordsConfig({...badWordsConfig, words: newWords});
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium mb-1 text-white/40">Description</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs h-16"
                          value={badWordsConfig.words[editingWordIndex].warningEmbed.description}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].warningEmbed.description = e.target.value;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium mb-1 text-white/40">Image URL</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs"
                          value={badWordsConfig.words[editingWordIndex].warningEmbed.image}
                          onChange={(e) => {
                            const newWords = [...badWordsConfig.words];
                            newWords[editingWordIndex].warningEmbed.image = e.target.value;
                            setBadWordsConfig({...badWordsConfig, words: newWords});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">System Preview</h3>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <UserIcon size={16} className="text-primary" />
                      </div>
                      <span className="font-bold text-sm">User</span>
                      <span className="text-white/40 text-xs">Today at 12:00</span>
                    </div>
                    <p className="text-sm text-white/80">This is a message with a <span className="bg-red-500/20 text-red-400 px-1 rounded">badword</span></p>
                    <div className="mt-2 p-3 bg-[#2b2d31] rounded-lg border-l-4 border-red-500">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <AlertTriangle size={12} className="text-primary" />
                        </div>
                        <span className="font-bold text-xs">{bot.username}</span>
                        <span className="bg-primary text-[8px] px-1 rounded text-white uppercase">Bot</span>
                      </div>
                      <h5 className="font-bold text-xs text-white">Warning!</h5>
                      <p className="text-[10px] text-white/80">You have used a forbidden word. This is warning 1/3.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <ScrollText className="text-primary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('reports_log')}</h2>
                    <p className="text-sm text-white/40">View all bad word violation reports</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    if (confirm('Are you sure you want to clear all reports?')) {
                      for (const report of reports) {
                        await deleteDoc(doc(db, 'reports', report.id));
                      }
                    }
                  }}
                  className="text-red-400 hover:text-red-300 text-sm flex items-center gap-2"
                >
                  <Trash2 size={18} /> Clear All
                </button>
              </div>

              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="text-center py-12 glass-card border-dashed border-white/10">
                    <ScrollText className="mx-auto text-white/20 mb-4" size={48} />
                    <p className="text-white/40">No reports found.</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="glass-card p-4 border-white/5 hover:border-primary/30 transition-all flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{report.username}</span>
                          <span className="text-xs text-white/40">{new Date(report.timestamp?.seconds * 1000).toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                          <p className="text-sm text-white/80"><span className="text-white/40">Message:</span> {report.message}</p>
                          <p className="text-sm text-white/80 mt-1"><span className="text-white/40">Pattern:</span> {report.pattern}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="bg-white/5 px-2 py-1 rounded">Room: #{report.roomName}</span>
                          <span className={cn(
                            "px-2 py-1 rounded",
                            report.punishment === 'Ban' ? "bg-red-500/20 text-red-400" :
                            report.punishment === 'Mute' ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-blue-500/20 text-blue-400"
                          )}>
                            Punishment: {report.punishment}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteDoc(doc(db, 'reports', report.id))}
                        className="p-2 text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      case 'roles':
        const DISCORD_PERMISSIONS = [
          'ADMINISTRATOR', 'VIEW_AUDIT_LOG', 'MANAGE_GUILD', 'MANAGE_ROLES', 'MANAGE_CHANNELS',
          'KICK_MEMBERS', 'BAN_MEMBERS', 'CREATE_INSTANT_INVITE', 'CHANGE_NICKNAME', 'MANAGE_NICKNAMES',
          'MANAGE_EMOJIS_AND_STICKERS', 'MANAGE_WEBHOOKS', 'VIEW_CHANNEL', 'SEND_MESSAGES', 'SEND_TTS_MESSAGES',
          'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'READ_MESSAGE_HISTORY', 'MENTION_EVERYONE',
          'USE_EXTERNAL_EMOJIS', 'ADD_REACTIONS', 'CONNECT', 'SPEAK', 'STREAM', 'MUTE_MEMBERS',
          'DEAFEN_MEMBERS', 'MOVE_MEMBERS', 'USE_VAD', 'PRIORITY_SPEAKER'
        ];

        return (
          <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Auto Role Section */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <UserPlus className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('auto_role')}</h2>
                  <p className="text-sm text-white/40">{t('auto_role_desc')}</p>
                </div>
              </div>
              <div className="max-w-md">
                <label className="block text-sm font-medium mb-2">{t('select_role')}</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                  value={rolesConfig.autoRole}
                  onChange={(e) => setRolesConfig({...rolesConfig, autoRole: e.target.value})}
                >
                  <option value="">None</option>
                  {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </div>
            </div>

            {/* Roles Editor Section */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-secondary/10 rounded-xl">
                    <Shield className="text-secondary" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('roles_editor')}</h2>
                    <p className="text-sm text-white/40">Create and customize server roles</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRolesConfig({
                    ...rolesConfig, 
                    roles: [...rolesConfig.roles, { 
                      id: Math.random().toString(36).substr(2, 9),
                      name: 'New Role', 
                      color: '#ffffff', 
                      permissions: [],
                      hoist: false,
                      mentionable: false
                    }]
                  })}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <Plus size={18} /> {t('add_role')}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {rolesConfig.roles.map((role, idx) => (
                  <div key={role.id} className="glass-card p-6 border-white/5 hover:border-primary/30 transition-all space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                        <input 
                          type="color" 
                          className="w-10 h-10 rounded-lg bg-transparent cursor-pointer"
                          value={role.color}
                          onChange={(e) => {
                            const newRoles = [...rolesConfig.roles];
                            newRoles[idx].color = e.target.value;
                            setRolesConfig({...rolesConfig, roles: newRoles});
                          }}
                        />
                        <input 
                          type="text" 
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary font-bold"
                          value={role.name}
                          onChange={(e) => {
                            const newRoles = [...rolesConfig.roles];
                            newRoles[idx].name = e.target.value;
                            setRolesConfig({...rolesConfig, roles: newRoles});
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/40">{t('hoist')}</label>
                          <input 
                            type="checkbox" 
                            checked={role.hoist}
                            onChange={(e) => {
                              const newRoles = [...rolesConfig.roles];
                              newRoles[idx].hoist = e.target.checked;
                              setRolesConfig({...rolesConfig, roles: newRoles});
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-white/40">{t('mentionable')}</label>
                          <input 
                            type="checkbox" 
                            checked={role.mentionable}
                            onChange={(e) => {
                              const newRoles = [...rolesConfig.roles];
                              newRoles[idx].mentionable = e.target.checked;
                              setRolesConfig({...rolesConfig, roles: newRoles});
                            }}
                            className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            const newRoles = rolesConfig.roles.filter((_, i) => i !== idx);
                            setRolesConfig({...rolesConfig, roles: newRoles});
                          }}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-3 text-white/40 uppercase tracking-widest">{t('permissions')}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {DISCORD_PERMISSIONS.map(perm => (
                          <button
                            key={perm}
                            onClick={() => {
                              const newRoles = [...rolesConfig.roles];
                              if (newRoles[idx].permissions.includes(perm)) {
                                newRoles[idx].permissions = newRoles[idx].permissions.filter(p => p !== perm);
                              } else {
                                newRoles[idx].permissions.push(perm);
                              }
                              setRolesConfig({...rolesConfig, roles: newRoles});
                            }}
                            className={cn(
                              "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all border",
                              role.permissions.includes(perm)
                                ? "bg-primary/20 border-primary/50 text-white"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            )}
                          >
                            <span>{perm.replace(/_/g, ' ')}</span>
                            {role.permissions.includes(perm) ? <Check size={14} className="text-primary" /> : <X size={14} className="opacity-20" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Member Management Section */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <Users className="text-green-400" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{t('member_management')}</h2>
                    <p className="text-sm text-white/40">Manage roles for server members</p>
                  </div>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    type="text" 
                    placeholder={t('search_members')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-primary text-sm"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members
                  .filter(m => m.username.toLowerCase().includes(searchMember.toLowerCase()))
                  .map(member => (
                    <div key={member.id} className="glass-card p-4 flex items-center gap-4 border-white/5">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.username} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={24} className="text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm truncate">{member.username}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.roles.map(roleId => {
                            const role = [...roles, ...rolesConfig.roles].find(r => r.id === roleId);
                            return role ? (
                              <span key={roleId} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary border border-primary/30">
                                {role.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="relative group">
                        <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                          <Plus size={18} className="text-white/40 group-hover:text-white" />
                        </button>
                        {/* Simple dropdown for role assignment */}
                        <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 hidden group-hover:block p-2">
                          {[...roles, ...rolesConfig.roles].map(role => (
                            <button
                              key={role.id}
                              onClick={() => {
                                const newMembers = [...members];
                                const mIdx = newMembers.findIndex(m => m.id === member.id);
                                if (newMembers[mIdx].roles.includes(role.id)) {
                                  newMembers[mIdx].roles = newMembers[mIdx].roles.filter(id => id !== role.id);
                                } else {
                                  newMembers[mIdx].roles.push(role.id);
                                }
                                setMembers(newMembers);
                              }}
                              className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-white/5 flex items-center justify-between"
                            >
                              <span style={{ color: role.color }}>{role.name}</span>
                              {member.roles.includes(role.id) && <Check size={14} className="text-primary" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <button 
              onClick={() => handleSave('roles', rolesConfig)}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg shadow-primary/20",
                sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
              )}
            >
              {sendResult === 'success' ? t('save_success') : t('save')}
            </button>
          </div>
        );
      case 'rules':
        return (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ScrollText className="text-primary" /> {t('rules_message')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('rules_channel')}</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                      value={rulesConfig.channelId}
                      onChange={(e) => setRulesConfig({...rulesConfig, channelId: e.target.value})}
                    >
                      <option value="">Select Channel</option>
                      {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                    </select>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Main Embed</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Title</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                          value={rulesConfig.title}
                          onChange={(e) => setRulesConfig({...rulesConfig, title: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/40">Color</label>
                        <input 
                          type="color" 
                          className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-2 py-1 cursor-pointer"
                          value={rulesConfig.color}
                          onChange={(e) => setRulesConfig({...rulesConfig, color: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Description</label>
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm h-32"
                        value={rulesConfig.description}
                        onChange={(e) => setRulesConfig({...rulesConfig, description: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Image URL</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                        value={rulesConfig.image}
                        onChange={(e) => setRulesConfig({...rulesConfig, image: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium">Rule Options</label>
                      <button 
                        onClick={() => {
                          const label = prompt('Enter option label (e.g. Minecraft Rules):');
                          if (label) {
                            setRulesConfig({
                              ...rulesConfig,
                              options: [...rulesConfig.options, {
                                id: Math.random().toString(36).substr(2, 9),
                                label,
                                value: label.toLowerCase().replace(/\s+/g, '_'),
                                responseEmbed: {
                                  title: label,
                                  description: `Rules for ${label}...`,
                                  color: rulesConfig.color,
                                  image: ''
                                }
                              }]
                            });
                          }
                        }}
                        className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Plus size={16} /> Add Option
                      </button>
                    </div>
                    <div className="space-y-2">
                      {rulesConfig.options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl group">
                          <span className="font-medium text-sm">{opt.label}</span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingRuleOptionIndex(idx)}
                              className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                            >
                              <Settings size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                const newOptions = rulesConfig.options.filter((_, i) => i !== idx);
                                setRulesConfig({...rulesConfig, options: newOptions});
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSave('rules', rulesConfig)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all duration-300",
                      sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                    )}
                  >
                    {sendResult === 'success' ? t('save_success') : t('save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {editingRuleOptionIndex !== null ? (
                <div className="glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <Settings size={18} className="text-primary" /> Edit Option: {rulesConfig.options[editingRuleOptionIndex].label}
                    </h3>
                    <button onClick={() => setEditingRuleOptionIndex(null)} className="text-white/40 hover:text-white">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Option Label</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                        value={rulesConfig.options[editingRuleOptionIndex].label}
                        onChange={(e) => {
                          const newOptions = [...rulesConfig.options];
                          newOptions[editingRuleOptionIndex].label = e.target.value;
                          setRulesConfig({...rulesConfig, options: newOptions});
                        }}
                      />
                    </div>
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Response Embed</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-medium mb-1 text-white/40">Title</label>
                          <input 
                            type="text" 
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs"
                            value={rulesConfig.options[editingRuleOptionIndex].responseEmbed.title}
                            onChange={(e) => {
                              const newOptions = [...rulesConfig.options];
                              newOptions[editingRuleOptionIndex].responseEmbed.title = e.target.value;
                              setRulesConfig({...rulesConfig, options: newOptions});
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium mb-1 text-white/40">Color</label>
                          <input 
                            type="color" 
                            className="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-1 py-1 cursor-pointer"
                            value={rulesConfig.options[editingRuleOptionIndex].responseEmbed.color}
                            onChange={(e) => {
                              const newOptions = [...rulesConfig.options];
                              newOptions[editingRuleOptionIndex].responseEmbed.color = e.target.value;
                              setRulesConfig({...rulesConfig, options: newOptions});
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium mb-1 text-white/40">Description</label>
                        <textarea 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs h-24"
                          value={rulesConfig.options[editingRuleOptionIndex].responseEmbed.description}
                          onChange={(e) => {
                            const newOptions = [...rulesConfig.options];
                            newOptions[editingRuleOptionIndex].responseEmbed.description = e.target.value;
                            setRulesConfig({...rulesConfig, options: newOptions});
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium mb-1 text-white/40">Image URL</label>
                        <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs"
                          value={rulesConfig.options[editingRuleOptionIndex].responseEmbed.image}
                          onChange={(e) => {
                            const newOptions = [...rulesConfig.options];
                            newOptions[editingRuleOptionIndex].responseEmbed.image = e.target.value;
                            setRulesConfig({...rulesConfig, options: newOptions});
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 space-y-4">
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Rules Preview</h3>
                  <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderColor: rulesConfig.color }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <ScrollText size={16} className="text-primary" />
                      </div>
                      <span className="font-bold text-sm">{bot.username}</span>
                      <span className="bg-primary text-[10px] px-1 rounded text-white uppercase">Bot</span>
                    </div>
                    <h4 className="font-bold text-white mb-1">{rulesConfig.title}</h4>
                    <p className="text-sm text-white/80 whitespace-pre-wrap mb-4">{rulesConfig.description}</p>
                    {rulesConfig.image && (
                      <img src={rulesConfig.image} alt="Rules" className="rounded-lg mb-4 max-h-48 object-cover w-full" referrerPolicy="no-referrer" />
                    )}
                    
                    <div className="space-y-2">
                      <div className="w-full p-2 bg-[#1e1f22] border border-white/10 rounded flex items-center justify-between text-white/60 text-sm">
                        <span>Select a rule category...</span>
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>

                  {rulesConfig.options.length > 0 && (
                    <div className="mt-4 space-y-4">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Example Response</h4>
                      <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderColor: rulesConfig.options[0].responseEmbed.color }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <ScrollText size={16} className="text-primary" />
                          </div>
                          <span className="font-bold text-sm">{bot.username}</span>
                          <span className="bg-primary text-[10px] px-1 rounded text-white uppercase">Bot</span>
                        </div>
                        <h4 className="font-bold text-white mb-1">{rulesConfig.options[0].responseEmbed.title}</h4>
                        <p className="text-sm text-white/80 whitespace-pre-wrap">{rulesConfig.options[0].responseEmbed.description}</p>
                        {rulesConfig.options[0].responseEmbed.image && (
                          <img src={rulesConfig.options[0].responseEmbed.image} alt="Option" className="rounded-lg mt-4 max-h-48 object-cover w-full" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'rooms':
        return (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FolderTree className="text-primary" /> {t('room_category_editor')}
                  </h2>
                  <button 
                    onClick={handleAddCategory}
                    className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm font-bold"
                  >
                    <Plus size={16} /> {t('add_category')}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">{t('room_name')}</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                        value={newRoom.name}
                        onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">{t('room_type')}</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                        value={newRoom.type}
                        onChange={(e) => setNewRoom({...newRoom, type: e.target.value})}
                      >
                        <option value="chat">{t('chat')}</option>
                        <option value="voice">{t('voice')}</option>
                        <option value="suggestion">{t('suggestion')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">{t('select_category')}</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                        value={newRoom.categoryId}
                        onChange={(e) => setNewRoom({...newRoom, categoryId: e.target.value})}
                      >
                        <option value="">No Category</option>
                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-4 pt-6">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all",
                          newRoom.isPrivate ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, isPrivate: !newRoom.isPrivate})}>
                          {newRoom.isPrivate && <Check size={14} />}
                        </div>
                        <span className="text-sm font-medium">{t('private_room')}</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-white/40">{t('room_bio')}</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm h-20"
                      value={newRoom.bio}
                      onChange={(e) => setNewRoom({...newRoom, bio: e.target.value})}
                    />
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                          <Users size={16} className="text-primary" /> {t('member_count_room')}
                        </h3>
                        <p className="text-[10px] text-white/40">{t('member_count_desc')}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={newRoom.isMemberCount}
                          onChange={(e) => setNewRoom({...newRoom, isMemberCount: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">{t('permissions_control')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.view ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, view: !newRoom.permissions.view}})}>
                          {newRoom.permissions.view && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('view_channel')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.sendMessages ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, sendMessages: !newRoom.permissions.sendMessages}})}>
                          {newRoom.permissions.sendMessages && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('send_messages')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.connect ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, connect: !newRoom.permissions.connect}})}>
                          {newRoom.permissions.connect && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('connect_voice')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.manageMessages ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, manageMessages: !newRoom.permissions.manageMessages}})}>
                          {newRoom.permissions.manageMessages && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('manage_messages')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.manageChannels ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, manageChannels: !newRoom.permissions.manageChannels}})}>
                          {newRoom.permissions.manageChannels && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('manage_channels')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.muteMembers ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, muteMembers: !newRoom.permissions.muteMembers}})}>
                          {newRoom.permissions.muteMembers && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('mute_members')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.deafenMembers ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, deafenMembers: !newRoom.permissions.deafenMembers}})}>
                          {newRoom.permissions.deafenMembers && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('deafen_members')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          newRoom.permissions.moveMembers ? "bg-primary border-primary" : "border-white/20 group-hover:border-primary/50"
                        )} onClick={() => setNewRoom({...newRoom, permissions: {...newRoom.permissions, moveMembers: !newRoom.permissions.moveMembers}})}>
                          {newRoom.permissions.moveMembers && <Check size={12} />}
                        </div>
                        <span className="text-xs">{t('move_members')}</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSaveRoom(newRoom)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all duration-300",
                      sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                    )}
                  >
                    {sendResult === 'success' ? t('save_success') : t('create_room')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Server Structure Preview</h3>
                <div className="bg-[#2b2d31] rounded-lg p-4 space-y-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white/80 cursor-pointer">
                        <ChevronDown size={12} /> {cat.name}
                      </div>
                      <div className="space-y-0.5 pl-2">
                        {rooms.filter(r => r.categoryId === cat.id).map(room => (
                          <div key={room.id} className="flex items-center justify-between group p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer">
                            <div className="flex items-center gap-2 text-white/60 group-hover:text-white">
                              {room.isMemberCount ? <Users size={14} /> : room.type === 'voice' ? <Volume2 size={14} /> : room.type === 'suggestion' ? <Lightbulb size={14} /> : <Hash size={14} />}
                              <span className="text-sm font-medium">
                                {room.isMemberCount ? `Members: ${serverStats.memberCount}` : room.name}
                              </span>
                              {room.isPrivate && <Lock size={10} className="text-white/20" />}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleDeleteRoom(room.id)} className="p-1 hover:bg-red-500/10 rounded text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {/* Uncategorized rooms */}
                  <div className="space-y-0.5">
                    {rooms.filter(r => !r.categoryId).map(room => (
                      <div key={room.id} className="flex items-center justify-between group p-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 text-white/60 group-hover:text-white">
                          {room.isMemberCount ? <Users size={14} /> : room.type === 'voice' ? <Volume2 size={14} /> : room.type === 'suggestion' ? <Lightbulb size={14} /> : <Hash size={14} />}
                          <span className="text-sm font-medium">
                            {room.isMemberCount ? `Members: ${serverStats.memberCount}` : room.name}
                          </span>
                          {room.isPrivate && <Lock size={10} className="text-white/20" />}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDeleteRoom(room.id)} className="p-1 hover:bg-red-500/10 rounded text-red-400">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Room Info Preview</h3>
                {rooms.length > 0 ? (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        {rooms[0].type === 'voice' ? <Volume2 size={20} /> : rooms[0].type === 'suggestion' ? <Lightbulb size={20} /> : <Hash size={20} />}
                      </div>
                      <div>
                        <h4 className="font-bold">{rooms[0].name}</h4>
                        <p className="text-xs text-white/40">{rooms[0].type.toUpperCase()} CHANNEL</p>
                      </div>
                    </div>
                    {rooms[0].bio && (
                      <p className="text-sm text-white/60 italic">"{rooms[0].bio}"</p>
                    )}
                    <div className="pt-2 flex flex-wrap gap-2">
                      {rooms[0].isPrivate && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded uppercase">Private</span>}
                      {rooms[0].permissions.view && <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold rounded uppercase">Viewable</span>}
                      {rooms[0].permissions.sendMessages && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded uppercase">Chatting</span>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/20 text-center py-8 italic">No rooms created yet.</p>
                )}
              </div>
            </div>
          </div>
        );
      case 'voice':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Mic2 className="text-primary" /> {t('voice_support')}
                </h2>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={voiceConfig.enabled}
                    onChange={(e) => setVoiceConfig({...voiceConfig, enabled: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('voice_channel')}</label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                    value={voiceConfig.channelId}
                    onChange={(e) => setVoiceConfig({...voiceConfig, channelId: e.target.value})}
                  >
                    <option value="">Select Voice Channel</option>
                    {channels.filter(c => c.type === 2).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </select>
                </div>
                <button 
                  onClick={() => handleSave('voice', voiceConfig)}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all duration-300",
                    sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                  )}
                >
                  {sendResult === 'success' ? t('save_success') : t('save')}
                </button>
              </div>
            </div>
          </div>
        );
      case 'quran':
        return (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="text-primary" /> {t('quran_bot')}
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={quranConfig.enabled}
                      onChange={(e) => setQuranConfig({...quranConfig, enabled: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-white/40">Command Name</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">/</span>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-4 py-2 focus:outline-none focus:border-primary"
                        value={quranConfig.commandName}
                        onChange={(e) => setQuranConfig({...quranConfig, commandName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Embed Title</label>
                      <input 
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                        value={quranConfig.title}
                        onChange={(e) => setQuranConfig({...quranConfig, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-white/40">Embed Color</label>
                      <input 
                        type="color" 
                        className="w-full h-10 bg-white/5 border border-white/10 rounded-xl px-2 py-1 focus:outline-none focus:border-primary cursor-pointer"
                        value={quranConfig.color}
                        onChange={(e) => setQuranConfig({...quranConfig, color: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-white/40">Embed Description</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary h-24"
                      value={quranConfig.description}
                      onChange={(e) => setQuranConfig({...quranConfig, description: e.target.value})}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-white/40">Readers & Audio Links</label>
                      <button 
                        onClick={() => setQuranConfig({
                          ...quranConfig, 
                          readers: [...quranConfig.readers, { name: '', url: '' }]
                        })}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {quranConfig.readers.map((reader, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input 
                            type="text" 
                            placeholder="Reader Name"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                            value={reader.name}
                            onChange={(e) => {
                              const newReaders = [...quranConfig.readers];
                              newReaders[idx].name = e.target.value;
                              setQuranConfig({...quranConfig, readers: newReaders});
                            }}
                          />
                          <input 
                            type="text" 
                            placeholder="Audio URL"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-sm"
                            value={reader.url}
                            onChange={(e) => {
                              const newReaders = [...quranConfig.readers];
                              newReaders[idx].url = e.target.value;
                              setQuranConfig({...quranConfig, readers: newReaders});
                            }}
                          />
                          <button 
                            onClick={() => {
                              const newReaders = quranConfig.readers.filter((_, i) => i !== idx);
                              setQuranConfig({...quranConfig, readers: newReaders});
                            }}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSave('quran', quranConfig)}
                    className={cn(
                      "w-full py-3 rounded-xl font-bold transition-all duration-300",
                      sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                    )}
                  >
                    {sendResult === 'success' ? t('save_success') : t('save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Preview</h3>
                <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4" style={{ borderColor: quranConfig.color }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <BookOpen size={16} className="text-primary" />
                    </div>
                    <span className="font-bold text-sm">{bot.username}</span>
                    <span className="bg-primary text-[10px] px-1 rounded text-white uppercase">Bot</span>
                  </div>
                  <h4 className="font-bold text-white mb-1">{quranConfig.title}</h4>
                  <p className="text-sm text-white/80 whitespace-pre-wrap mb-4">{quranConfig.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {quranConfig.readers.map((reader, idx) => (
                      <div 
                        key={idx}
                        className="px-4 py-1.5 bg-[#4e5058] hover:bg-[#6d6f78] text-white text-sm rounded transition-colors cursor-default"
                      >
                        {reader.name || 'Reader Name'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'control':
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="text-primary" /> {t('bot_control')}
              </h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative group">
                    <img 
                      src={botControlConfig.avatar || (bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`)} 
                      className="w-full h-full object-cover"
                      alt=""
                    />
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                      <Camera size={20} />
                      <input type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setBotControlConfig({...botControlConfig, avatar: reader.result as string});
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2">{t('bot_username')}</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      value={botControlConfig.username}
                      onChange={(e) => setBotControlConfig({...botControlConfig, username: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('bot_status')}</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      value={botControlConfig.status}
                      onChange={(e) => setBotControlConfig({...botControlConfig, status: e.target.value})}
                    >
                      <option value="online">{t('bot_status_online')}</option>
                      <option value="idle">{t('bot_status_idle')}</option>
                      <option value="dnd">{t('bot_status_dnd')}</option>
                      <option value="invisible">{t('bot_status_invisible')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('bot_activity')}</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                      value={botControlConfig.activityType}
                      onChange={(e) => setBotControlConfig({...botControlConfig, activityType: e.target.value})}
                    >
                      <option value="playing">{t('activity_playing')}</option>
                      <option value="streaming">{t('activity_streaming')}</option>
                      <option value="listening">{t('activity_listening')}</option>
                      <option value="watching">{t('activity_watching')}</option>
                      <option value="competing">{t('activity_competing')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Activity Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-primary"
                    value={botControlConfig.activityName}
                    onChange={(e) => setBotControlConfig({...botControlConfig, activityName: e.target.value})}
                  />
                </div>
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <button className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
                    <LogOut size={18} /> {t('leave_server')}
                  </button>
                  <button className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                    <Trash2 size={18} /> {t('delete_bot')}
                  </button>
                </div>
                <button 
                  onClick={() => handleSave('control', botControlConfig)}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all duration-300",
                    sendResult === 'success' ? "bg-green-500 text-white" : "btn-primary"
                  )}
                >
                  {sendResult === 'success' ? t('save_success') : t('save')}
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        className="glass border-r border-white/10 flex flex-col sticky top-0 h-screen z-50"
      >
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-2xl text-gradient"
            >
              SDMX BOT
            </motion.div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300",
                activeTab === item.id 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "hover:bg-white/5 text-white/60 hover:text-white"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-medium whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')}
            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all"
          >
            <span className="shrink-0 text-primary"><BookOpen size={20} /></span>
            {sidebarOpen && (
              <span className="font-medium">
                {i18n.language === 'en' ? 'العربية' : 'English'}
              </span>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {!firebaseUser && isAuthReady && (
          <div className="max-w-4xl mx-auto mb-8 p-6 glass-card border-primary/30 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold flex items-center justify-center md:justify-start gap-2">
                <Lock className="text-primary" /> Firebase Authentication Required
              </h3>
              <p className="text-sm text-white/60">To access real-time features like the Room Editor, please sign in with Google.</p>
            </div>
            <button 
              onClick={handleFirebaseLogin}
              className="px-8 py-3 bg-primary hover:bg-primary/80 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 whitespace-nowrap"
            >
              <UserIcon size={20} /> Sign in with Google
            </button>
          </div>
        )}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{menuItems.find(i => i.id === activeTab)?.label}</h1>
            <p className="text-white/60">Manage your server's {menuItems.find(i => i.id === activeTab)?.label.toLowerCase()} settings.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1"
            >
              <ChevronRight className="rotate-180" size={14} /> Change Bot
            </button>
            <div className="flex items-center gap-2 px-4 py-2 glass-card">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-medium">Bot Online</span>
            </div>
            <div className="flex items-center gap-3 glass-card px-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary p-[1px]">
                <img 
                  src={bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} 
                  alt={bot.username}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold leading-tight">{bot.username}</div>
                <div className="text-[10px] text-white/40 leading-tight">Bot</div>
              </div>
            </div>
            <div className="flex items-center gap-3 glass-card px-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-white/10 p-[1px]">
                <img 
                  src={user.avatar && user.avatar.startsWith('data:') ? user.avatar : user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} 
                  alt={user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <button 
                onClick={onLogout}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

const BotSelection = ({ user, onSelect, onLogout }: { user: User; onSelect: (bot: Bot) => void; onLogout: () => void }) => {
  const { t } = useTranslation();
  const [bots, setBots] = useState<Bot[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch('/api/bots').then(res => res.json()).then(data => setBots(data.bots));
  }, []);

  const handleAddBot = async () => {
    if (!token) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/bots/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        setBots([...bots, data.bot]);
        setShowAdd(false);
        setToken('');
      } else {
        alert("Invalid Bot Token!");
      }
    } catch (e) {
      alert("Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-gradient">Your Bots</h1>
            <p className="text-white/60">Select a bot to manage or add a new one.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 glass-card px-4 py-2">
              <img 
                src={user.avatar && user.avatar.startsWith('data:') ? user.avatar : user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} 
                className="w-8 h-8 rounded-full"
                alt=""
              />
              <span className="font-bold">{user.username}</span>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-white/10 rounded-xl text-red-400"><LogOut size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map(bot => (
            <motion.div
              key={bot.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelect(bot)}
              className="glass-card p-6 cursor-pointer hover:bg-primary/10 transition-all border-transparent hover:border-primary/50 group"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary p-1">
                  <img 
                    src={bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} 
                    className="w-full h-full rounded-full object-cover"
                    alt=""
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{bot.username}</h3>
                  <div className="text-xs text-white/40 uppercase tracking-widest mt-1">Bot ID: {bot.id}</div>
                </div>
                <button className="btn-primary w-full opacity-0 group-hover:opacity-100 transition-opacity">Manage Bot</button>
              </div>
            </motion.div>
          ))}

          <motion.button
            whileHover={{ scale: 1.02 }}
            onClick={() => setShowAdd(true)}
            className="glass-card p-6 border-dashed border-white/20 flex flex-col items-center justify-center space-y-4 hover:bg-white/5 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-primary">
              <Plus size={32} />
            </div>
            <div className="font-bold">Add New Bot</div>
          </motion.button>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-8 max-w-md w-full space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Add Bot Token</h2>
              <button onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            <p className="text-sm text-white/60">Enter your Discord Bot Token to verify and add it to your dashboard.</p>
            <div className="space-y-4">
              <input 
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary"
              />
              <button 
                onClick={handleAddBot}
                disabled={verifying || !token}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Shield size={20} />}
                Verify & Add Bot
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const LandingPage = ({ onStart }: { onStart: () => void }) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Navbar */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="text-2xl font-black text-gradient">SDMX BOT</div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en')}
            className="text-sm font-bold hover:text-primary transition-colors"
          >
            {i18n.language === 'en' ? 'العربية' : 'English'}
          </button>
          <button 
            onClick={() => {
              console.log("Navbar button clicked");
              onStart();
            }} 
            className="btn-primary relative z-50 cursor-pointer"
          >
            {t('try_free')}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 blur-[120px] rounded-full -z-10"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl space-y-8"
        >
          <h1 className="text-5xl md:text-7xl font-black leading-tight">
            {t('welcome')} <br />
            <span className="text-gradient">Professional Dashboard</span>
          </h1>
          <p className="text-xl text-white/60 leading-relaxed">
            {t('description')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-50">
            <button 
              onClick={() => {
                console.log("Hero button clicked");
                onStart();
              }} 
              className="btn-primary w-full sm:w-auto text-lg px-10 cursor-pointer"
            >
              {t('try_free')}
            </button>
            <button className="btn-secondary w-full sm:w-auto text-lg px-10 cursor-pointer">
              {t('about_bot')}
            </button>
          </div>
        </motion.div>

        {/* Discord Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-20 w-full max-w-5xl glass-card p-4 md:p-8 relative group"
        >
          <div className="absolute -top-4 -right-4 bg-primary px-4 py-2 rounded-full text-sm font-bold shadow-lg z-10">
            Live Preview
          </div>
          <div className="flex gap-4 h-[400px] md:h-[500px]">
            {/* Discord Sidebar Mock */}
            <div className="hidden md:flex flex-col gap-2 w-16 shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center font-bold">S</div>
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">+</div>
            </div>
            {/* Discord Content Mock */}
            <div className="flex-1 bg-[#313338] rounded-xl overflow-hidden flex flex-col">
              <div className="h-12 border-b border-black/20 flex items-center px-4 gap-2">
                <span className="text-white/40">#</span>
                <span className="font-bold">general</span>
              </div>
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary shrink-0"></div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">SDMX BOT</span>
                      <span className="bg-primary text-[10px] px-1 rounded uppercase">Bot</span>
                      <span className="text-xs text-white/20">Today at 12:00 PM</span>
                    </div>
                    <div className="bg-[#2b2d31] rounded-lg p-4 border-l-4 border-primary max-w-lg">
                      <h3 className="font-bold mb-1">Welcome to the Server!</h3>
                      <p className="text-sm text-white/80">I am SDMX, your advanced server assistant. Use /help to see my commands.</p>
                      <div className="mt-3 flex gap-2">
                        <button className="bg-[#4e5058] hover:bg-[#6d6f78] px-3 py-1 rounded text-sm transition-colors">Get Started</button>
                        <button className="bg-[#4e5058] hover:bg-[#6d6f78] px-3 py-1 rounded text-sm transition-colors">Rules</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="bg-[#383a40] rounded-lg px-4 py-2 text-white/20 text-sm">
                  Message #general
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section className="py-20 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl font-black">{t('features')}</h2>
          <p className="text-white/60 max-w-2xl mx-auto">Everything you need to manage your Discord community in one place.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<MessageSquare />} 
            title={t('embed_message')} 
            description="Create professional embed messages with custom colors, images, and buttons."
          />
          <FeatureCard 
            icon={<Ticket />} 
            title={t('ticket_system')} 
            description="Advanced ticket system for support, reports, and applications."
          />
          <FeatureCard 
            icon={<UserPlus />} 
            title={t('welcome_system')} 
            description="Custom welcome messages with dynamic variables and images."
          />
          <FeatureCard 
            icon={<Code />} 
            title={t('commands_editor')} 
            description="Create custom commands with JavaScript or Python support."
          />
          <FeatureCard 
            icon={<Shield />} 
            title={t('roles_control')} 
            description="Manage roles, permissions, and auto-role systems easily."
          />
          <FeatureCard 
            icon={<AlertTriangle />} 
            title={t('bad_words')} 
            description="Protect your server with advanced word filtering and auto-moderation."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="p-10 border-t border-white/10 text-center text-white/40">
        <div className="mb-4 font-black text-white">SDMX BOT</div>
        <p>© 2026 SDMX TEAM. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRegister, setShowRegister] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [regData, setRegData] = useState({
    username: '',
    name: '',
    email: '',
    avatar: ''
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/info');
        const data = await res.json();
        if (data.user) setUser(data.user);
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode ? { username: regData.username, email: regData.email } : regData;
    
    console.log(`${isLoginMode ? 'Logging in' : 'Registering'} with data:`, { ...payload, avatar: regData.avatar ? "data:image/..." : null });
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log("Auth response status:", res.status);
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        alert("Server error: Received invalid response format.");
        return;
      }

      const data = await res.json();
      console.log("Auth response data:", data);
      
      if (data.user) {
        setUser(data.user);
        setShowRegister(false);
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (e) {
      console.error("Auth error:", e);
      alert("Error connecting to server. Please try again.");
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setSelectedBot(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!user ? (
        showRegister ? (
          <div className="min-h-screen flex items-center justify-center p-6 bg-[#0f172a]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8 w-full max-w-md space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-gradient">
                  {isLoginMode ? t('login') : t('register')}
                </h2>
                <p className="text-white/60">
                  {isLoginMode ? t('login_desc') : t('create_account')}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/80">{t('username')}</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none transition-all"
                    placeholder="username"
                    value={regData.username}
                    onChange={e => setRegData({...regData, username: e.target.value})}
                  />
                </div>
                
                {!isLoginMode && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-white/80">{t('full_name')}</label>
                      <input 
                        required
                        type="text" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none transition-all"
                        placeholder="John Doe"
                        value={regData.name}
                        onChange={e => setRegData({...regData, name: e.target.value})}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-white/80">{t('email')}</label>
                  <input 
                    required
                    type="email" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none transition-all"
                    placeholder="email@example.com"
                    value={regData.email}
                    onChange={e => setRegData({...regData, email: e.target.value})}
                  />
                </div>

                {!isLoginMode && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-white/80">{t('profile_pic')}</label>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0 overflow-hidden border border-white/20">
                        {regData.avatar ? (
                          <img src={regData.avatar} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <UserIcon size={24} />
                          </div>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="text-xs text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-4 mt-4">
                  {isLoginMode ? t('login_now') : t('register_now')}
                </button>

                <div className="text-center pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsLoginMode(!isLoginMode)}
                    className="text-sm text-primary hover:underline"
                  >
                    {isLoginMode ? t('no_account') : t('have_account')}
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowRegister(false)}
                  className="w-full text-sm text-white/40 hover:text-white transition-colors"
                >
                  {t('back_home')}
                </button>
              </form>
            </motion.div>
          </div>
        ) : (
          <LandingPage onStart={() => setShowRegister(true)} />
        )
      ) : !selectedBot ? (
        <BotSelection user={user} onSelect={setSelectedBot} onLogout={handleLogout} />
      ) : (
        <Dashboard user={user} bot={selectedBot} onLogout={handleLogout} onBack={() => setSelectedBot(null)} />
      )}
    </div>
  );
}
