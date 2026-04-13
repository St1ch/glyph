"use client";

import { useMemo, useState } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  currentEmoji?: string;
}

const EMOJIS = [
  "✨",
  "🔥",
  "🌿",
  "🌙",
  "💫",
  "🎯",
  "🫶",
  "😎",
  "🦊",
  "🐺",
  "🐱",
  "🐼",
  "🦄",
  "🍀",
  "🌸",
  "🌊",
  "⚡",
  "🪐",
  "🎵",
  "🎮",
  "📸",
  "🎨",
  "💎",
  "❤️",
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😇",
  "😉",
  "🤩",
  "😌",
  "🤗",
  "😏",
  "🥶",
  "😴",
  "🤖",
  "👻",
  "😺",
  "🙌",
  "👏",
  "🤝",
  "💪",
  "👀",
  "🫡",
  "🧠",
  "🌈",
  "🌻",
  "🌹",
  "🌵",
  "🍓",
  "🍒",
  "🍉",
  "🍕",
  "🍔",
  "☕",
  "🧋",
  "🎧",
  "🎤",
  "🎬",
  "🎹",
  "🥁",
  "🛹",
  "🚲",
  "🚀",
  "✈️",
  "🏝️",
  "🏔️",
  "🌇",
  "🌌",
  "⭐",
  "☁️",
  "⛈️",
  "❄️",
  "🐶",
  "🐰",
  "🐯",
  "🦁",
  "🐻",
  "🐸",
  "🐙",
  "🦋",
  "🐢",
  "🦉",
  "🐝",
  "🍀",
  "🪴",
  "🧩",
  "🕹️",
  "💻",
  "⌨️",
  "📱",
  "📚",
  "📝",
  "📌",
  "🛠️",
  "🔒",
  "🧭",
  "🎁",
  "🪩",
  "🔮",
  "🫧",
  "🧨",
  "💥",
  "💜",
  "🖤",
  "🤍",
  "💚",
  "💙",
  "🧡",
  "💛",
];

export function EmojiPicker({ onSelect, currentEmoji }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(currentEmoji || "✨");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!searchTerm.trim()) {
      return EMOJIS;
    }

    return EMOJIS.filter((emoji) => emoji.includes(searchTerm.trim()));
  }, [searchTerm]);

  const handleSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    onSelect(emoji);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] text-2xl hover:border-[var(--line-strong)] hover:bg-[var(--panel)]"
          aria-label="Выбрать эмодзи"
        >
          {selectedEmoji}
        </button>
        <span className="text-xs text-[var(--muted)]">Нажмите, чтобы выбрать</span>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Поиск по эмодзи"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-xl px-2 py-1 text-xl leading-none text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
          aria-label="Закрыть выбор эмодзи"
        >
          ×
        </button>
      </div>

      <div className="grid max-h-72 grid-cols-6 gap-2 overflow-y-auto sm:grid-cols-8 xl:grid-cols-10">
        {filteredEmojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => handleSelect(emoji)}
            className={`flex h-11 items-center justify-center rounded-xl text-xl transition ${
              selectedEmoji === emoji
                ? "bg-[var(--accent)] text-[var(--page)]"
                : "bg-[var(--panel-soft)] hover:bg-white/[0.04]"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
