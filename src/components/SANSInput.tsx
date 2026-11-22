import React, { useState } from "react";
import { sendChatToSANS, sendReceiptToSANS, TransactionResult } from "../services/aiService";
import { auth } from "../lib/firebase";

interface Props {
  onSuccess?: (transactions: TransactionResult[]) => void;
  language?: string;
  categories?: string[];
  mainCurrency?: string;
}

export default function SANSInput({
  onSuccess,
  language = "id",
  categories = [],
  mainCurrency = "JPY",
}: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Helper untuk mendapatkan UID User dari Firebase Auth
  const getFirebaseUserId = () => {
    return auth.currentUser?.uid || localStorage.getItem("wgen_user_id") || "";
  };

  // 1. Handle Kirim Pesan Teks
  const handleSendText = async (customText?: string) => {
    const inputMessage = customText || text;
    if (!inputMessage.trim() || loading) return;

    setLoading(true);
    try {
      const userId = getFirebaseUserId();
      const res = await sendChatToSANS(inputMessage, userId, language, categories, mainCurrency);
      setText("");
      if (onSuccess) onSuccess(res);
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat memproses data.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Voice Input (Speech-to-Text)
  const handleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser kamu tidak mendukung Speech Recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === "jp" ? "ja-JP" : language === "en" ? "en-US" : "id-ID";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);
      handleSendText(transcript);
    };

    recognition.start();
  };

  // 3. Handle Upload / Scan Foto Struk
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(",")[1];
      setLoading(true);
      try {
        const userId = getFirebaseUserId();
        const res = await sendReceiptToSANS(base64Str, userId, language, categories, mainCurrency);
        if (onSuccess) onSuccess(res);
      } catch (err: any) {
        alert(err.message || "Gagal memproses gambar struk.");
      } finally {
        setLoading(false);
      }
    };
  };

  return (
    <div className="bg-[#0F1020] border border-emerald-500/20 rounded-2xl p-4 shadow-lg">
      {/* Header Info SANS AI */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/40">
          S
        </div>
        <div>
          <h4 className="text-white text-sm font-semibold">SANS AI Parser</h4>
          <p className="text-[10px] text-gray-400">
            Ketik "kopi 18rb, gojek 24rb", gunakan voice note, atau upload foto struk.
          </p>
        </div>
      </div>

      {/* Input Field & Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Tombol Voice Note */}
        <button
          onClick={handleVoice}
          title="Catat via Suara"
          type="button"
          className={`p-3 rounded-xl border transition ${
            isListening
              ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
              : "bg-[#1A1B30] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          🎤
        </button>

        {/* Tombol Upload / Scan Struk */}
        <label
          title="Scan Struk"
          className="p-3 bg-[#1A1B30] border border-cyan-500/30 text-cyan-400 rounded-xl cursor-pointer hover:bg-cyan-500/10 transition flex items-center justify-center"
        >
          📷
          <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
        </label>

        {/* Input Teks */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendText()}
          placeholder="Tulis transaksi..."
          className="flex-1 bg-[#1A1B30] text-white text-sm px-4 py-3 rounded-xl border border-emerald-500/20 focus:outline-none focus:border-cyan-400 placeholder-gray-500"
        />

        {/* Tombol Submit */}
        <button
          onClick={() => handleSendText()}
          disabled={loading}
          type="button"
          className="bg-emerald-500 text-[#0F1020] px-4 py-3 rounded-xl font-bold text-sm hover:bg-cyan-400 transition disabled:opacity-50"
        >
          {loading ? "..." : "Kirim"}
        </button>
      </div>
    </div>
  );
}
