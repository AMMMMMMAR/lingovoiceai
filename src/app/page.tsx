'use client';

import { useState, useEffect, useRef } from 'react';
import { Waves, Play, Pause, Download, Loader2, FileText, Volume2, Globe, LogOut, Trash2, Edit2, Check, X, Wand2, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SAMPLE_TEXTS = [
  "The quick brown fox jumps over the lazy dog, demonstrating the clarity of this AI voice.",
  "Did you know that honey never spoils? Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly safe to eat.",
  "Deep in the enchanted forest, a mysterious glowing light danced between the ancient oak trees, guiding the lost traveler back to the path.",
  "Welcome to LingoVoice AI! I'm here to bring your words to life. Try typing something else to hear how I sound."
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Session = {
  id: string;
  title: string;
  full_text: string;
  voice_used: string;
  lang_code?: string;
  audio_url: string;
  duration_seconds: number;
  created_at: string;
};

const LANGUAGES = [
  { id: 'a', name: 'English (US)' },
  { id: 'b', name: 'British English (UK)' }
];

const VOICES: Record<string, { id: string, name: string }[]> = {
  a: [
    { id: 'af_heart', name: 'Bella - Soft & Clear (US Female)' },
    { id: 'am_adam', name: 'Adam - Deep (US Male)' },
    { id: 'af_bella', name: 'Bella - Alternate (US Female)' },
    { id: 'am_michael', name: 'Michael - Clear (US Male)' }
  ],
  b: [
    { id: 'bf_emma', name: 'Emma - Clear (UK Female)' },
    { id: 'bm_george', name: 'George - Deep (UK Male)' },
    { id: 'bf_isabella', name: 'Isabella - Soft (UK Female)' },
    { id: 'bm_lewis', name: 'Lewis - Clear (UK Male)' }
  ]
};

export default function Home() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('a');
  const [voice, setVoice] = useState('af_heart');
  const [speed, setSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<{ url: string, sessionId?: string } | null>(null);

  const [history, setHistory] = useState<Session[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const { session, user, signOut, isLoading: isAuthLoading } = useAuth();

  // Audio Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSurpriseMe = () => {
    const randomText = SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
    setText(randomText);
    toast.success("Sample text loaded!");
  };

  const fetchHistory = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE}/history`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpdateTitle = async (id: string) => {
    if (!editingTitleValue.trim() || !session?.access_token) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/history/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: editingTitleValue.trim() })
      });
      if (res.ok) {
        setHistory(prev => prev.map(s => s.id === id ? { ...s, title: editingTitleValue.trim() } : s));
        setEditingTitleId(null);
        toast.success("Title updated!");
      } else {
        toast.error("Failed to update title");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error updating title");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!session?.access_token || !confirm("Are you sure you want to delete this audio session?")) return;
    try {
      const res = await fetch(`${API_BASE}/history/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (res.ok) {
        setHistory(prev => prev.filter(s => s.id !== id));
        toast.success("Session deleted");
      } else {
        toast.error("Failed to delete session");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error deleting session");
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchHistory();
    }
  }, [session?.access_token]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setCurrentAudio(null);
    setIsPlaying(false);
    setProgress(0);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text,
          voice_id: voice,
          lang_code: language,
          speed: speed
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setCurrentAudio({ url: data.audio_url, sessionId: data.session_id });
      if (session?.access_token) {
        fetchHistory(); // refresh history only if logged in
      }
      toast.success("Audio generated successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Error generating audio: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const syncProgress = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      audioRef.current.currentTime = percentage * audioRef.current.duration;
      setProgress(percentage * 100);
    }
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playHistoryAudio = (url: string) => {
    setCurrentAudio({ url });
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play();
      }
    }, 100);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]">
        <Loader2 className="w-8 h-8 animate-spin text-[#003366]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 font-sans selection:bg-[#003366] selection:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-br from-[#f8f9fa] to-[#e9ecef]" />
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="pt-6 sm:pt-10 pb-4 sm:pb-6 px-4 sm:px-10 max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[14px] sm:rounded-[16px] bg-gradient-to-br from-[#003366] to-[#00509e] flex items-center justify-center text-white shadow-lg shadow-[#003366]/20 shrink-0">
            <Waves className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#003366]">LingoVoice AI</h1>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="hidden sm:inline-block text-sm font-medium text-slate-600 bg-white/50 px-3 py-1.5 rounded-full border border-slate-200">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors bg-white/50 hover:bg-red-50 px-3 sm:px-4 py-2 rounded-xl border border-slate-200 hover:border-red-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <a
              href="/login"
              className="text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-[#003366] to-[#00509e] px-4 sm:px-5 py-2 rounded-xl shadow-lg shadow-[#003366]/20 hover:shadow-[#003366]/30 hover:-translate-y-0.5 transition-all"
            >
              Sign In
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-10 space-y-6 sm:space-y-8 mt-2 sm:mt-4">

        {/* Main Generator Card */}
        <div className="glass rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-8 space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap justify-between items-center text-xs sm:text-sm font-medium text-slate-500 gap-2">
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="flex items-center gap-1.5 sm:gap-2"><FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Text to Speech</span></span>
                <button onClick={handleSurpriseMe} className="flex items-center gap-1 sm:gap-1.5 text-[#003366] hover:text-[#00509e] transition-colors bg-white/50 px-2.5 sm:px-3 py-1 rounded-full border border-[#003366]/20 hover:border-[#003366]/40 shadow-sm"><Wand2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span>Surprise Me</span></button>
              </div>
              <span className={text.length >= 4500 ? "text-orange-500" : text.length >= 5000 ? "text-red-500 font-bold" : ""}>{text.length} / 5000</span>
            </div>

            <textarea
              className="w-full h-48 sm:h-64 p-5 rounded-[1.25rem] bg-white/50 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-[#003366]/50 focus:bg-white transition-all resize-none shadow-inner text-slate-800 text-lg placeholder:text-slate-400"
              placeholder="Paste your English story here to bring it to life with AI speech..."
              maxLength={5000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between mt-2 sm:mt-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
              <div className="relative flex-1 sm:max-w-[200px]">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  className="w-full appearance-none bg-white rounded-xl py-3 pl-10 pr-10 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003366]/50 cursor-pointer shadow-sm"
                  value={language}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setLanguage(newLang);
                    setVoice(VOICES[newLang][0].id);
                  }}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div className="relative flex-1 sm:max-w-[280px]">
                <Volume2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  aria-label="Select voice"
                  className="w-full appearance-none bg-white rounded-xl py-3 pl-10 pr-10 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003366]/50 cursor-pointer shadow-sm"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {VOICES[language]?.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>

              <div className="relative flex-1 sm:max-w-[120px]">
                <Settings2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  aria-label="Select speed"
                  className="w-full appearance-none bg-white rounded-xl py-3 pl-10 pr-10 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003366]/50 cursor-pointer shadow-sm"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className="bg-gradient-to-r from-[#003366] to-[#00509e] text-white px-8 py-3 sm:py-3 rounded-xl font-medium shadow-lg shadow-[#003366]/30 hover:shadow-[#003366]/40 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:pointer-events-none flex justify-center items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  Generate Audio
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Audio Player */}
        <div className={`transition-all duration-500 ease-in-out transform origin-top ${currentAudio ? 'opacity-100 scale-100 h-auto' : 'opacity-0 scale-95 h-0 overflow-hidden'}`}>
          {currentAudio && (
            <div className="glass rounded-[1.25rem] sm:rounded-[1.5rem] p-3 sm:p-4 px-4 sm:px-6 flex flex-row items-center gap-3 sm:gap-6 border-l-4 border-l-[#003366]">
              <audio
                ref={audioRef}
                src={currentAudio.url}
                onTimeUpdate={syncProgress}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              <button
                onClick={togglePlay}
                className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-[#003366] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white ml-1" />}
              </button>

              <div className="flex-1 w-full flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500 tracking-wider">
                  <span>NOW PLAYING</span>
                </div>
                {/* Custom Timeline */}
                <div
                  className="h-2 w-full bg-slate-200 rounded-full cursor-pointer relative overflow-hidden"
                  onClick={handleTimelineClick}
                >
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#003366] to-[#0077b6] rounded-full transition-all duration-100 pointer-events-none"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <a
                href={currentAudio.url}
                download="voice.wav"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:text-[#003366] hover:bg-[#003366]/5 transition-colors"
                title="Download Audio"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative" />
              </a>
            </div>
          )}
        </div>

        {/* History Section */}
        <div className="pt-6">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            Recent Practice Sessions
          </h2>

          <div className="glass rounded-2xl overflow-hidden shadow-sm">
            {isLoadingHistory && user ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p>Loading your sessions...</p>
              </div>
            ) : !user ? (
              <div className="p-10 text-center text-slate-500 bg-white/40">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                  <FileText className="w-8 h-8 text-[#003366]/40" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">Sign in to save your history</h3>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">Create an account or sign in to keep track of your generated voices and download them anytime.</p>
                <a href="/login" className="inline-flex items-center gap-2 text-sm font-medium bg-[#003366] text-white px-6 py-2.5 rounded-xl hover:bg-[#002244] transition-colors shadow-md">
                  Sign In / Sign Up
                </a>
              </div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-medium text-slate-700">No sessions yet</p>
                <p className="text-sm mt-1">Generate your first audio to see it here.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100/80">
                {history.map((sessionItem) => (
                  <div key={sessionItem.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 hover:bg-white/40 transition-colors gap-3 sm:gap-4 group">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                      <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors shrink-0 mt-0.5 sm:mt-0">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {editingTitleId === sessionItem.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              className="w-full min-w-[120px] px-2 py-1 text-sm border-b-2 border-[#003366]/50 bg-white/50 focus:outline-none focus:border-[#003366] text-slate-700 font-medium"
                              value={editingTitleValue}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateTitle(sessionItem.id);
                                if (e.key === 'Escape') setEditingTitleId(null);
                              }}
                            />
                            <button disabled={isUpdating} onClick={() => handleUpdateTitle(sessionItem.id)} className="text-green-600 hover:text-green-700 hover:bg-green-50 p-1 rounded-md"><Check className="w-4 h-4" /></button>
                            <button disabled={isUpdating} onClick={() => setEditingTitleId(null)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="group/edit flex items-center gap-2">
                            <span className="font-semibold text-slate-700 truncate text-sm sm:text-base" title={sessionItem.full_text}>
                              {sessionItem.title || 'Untitled Session'}
                            </span>
                            <button
                              onClick={() => {
                                setEditingTitleId(sessionItem.id);
                                setEditingTitleValue(sessionItem.title);
                              }}
                              className="opacity-0 group-hover/edit:opacity-100 text-slate-400 hover:text-[#003366] transition-opacity p-1"
                            >
                              <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-500">
                          <span>{formatDate(sessionItem.created_at)}</span>
                          <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="flex items-center bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                            <Globe className="w-2.5 h-2.5 mr-1" />
                            {LANGUAGES.find(l => l.id === sessionItem.lang_code)?.name?.split(' ')[0] || 'EN'}
                          </span>
                          <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="truncate max-w-[120px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {Object.values(VOICES).flat().find(v => v.id === sessionItem.voice_used)?.name?.split(' -')[0] || sessionItem.voice_used}
                          </span>
                          <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>{formatDuration(sessionItem.duration_seconds)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 bg-slate-50/50 sm:bg-transparent p-1 sm:p-0 rounded-lg sm:rounded-none w-full sm:w-auto justify-end mt-2 sm:mt-0">
                      <button
                        onClick={() => playHistoryAudio(sessionItem.audio_url)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full sm:rounded-xl bg-white sm:bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-[#003366] hover:text-white transition-all shadow-sm sm:shadow-none border border-slate-200 sm:border-transparent"
                        title="Play"
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
                      </button>
                      <a
                        href={sessionItem.audio_url}
                        download={`session-${sessionItem.id}.wav`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full sm:rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#003366] hover:border-[#003366] transition-all shadow-sm sm:shadow-none"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </a>
                      <div className="w-[1px] h-4 bg-slate-200 mx-1 hidden sm:block"></div>
                      <button
                        onClick={() => handleDeleteSession(sessionItem.id)}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full sm:rounded-xl bg-white sm:bg-transparent border border-slate-200 sm:border-transparent flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-sm sm:shadow-none"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
