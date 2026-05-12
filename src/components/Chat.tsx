import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { downloadPdf } from "../services/api";
import { Send, Bot, Download } from "lucide-react";

interface Msg {
  sender: "user" | "bot";
  text: string;
  proposal?: any;
}

interface ChatProps {
  projectId: number | null;
}

const Chat: React.FC<ChatProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    {
      sender: "bot",
      text: "Hello! I am your Variation Assistant. Upload your files and tell me what changes you want to evaluate.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;

    if (!projectId) {
      setMessages((prev) => [
        ...prev,
        { sender: "user", text: input },
        {
          sender: "bot",
          text: "Please upload files first to start a project.",
        },
      ]);
      setInput("");
      return;
    }

    const userMsg = input;
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chat", {
        message: userMsg,
        project_id: projectId,
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.data.reply,
          proposal: res.data.proposal,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Error connecting to server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (proposal: any) => {
    try {
      if (proposal?.pdf_url) {
        await downloadPdf(proposal.pdf_url, `Variation_Proposal_${proposal.variation_id || "draft"}.pdf`);
        return;
      }
      alert("PDF download is available after a variation result is generated.");
    } catch (err) {
      alert("Failed to generate PDF.");
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-gray-50 p-4 border-b border-gray-100 font-medium text-gray-700 flex items-center gap-2">
        <Bot className="w-5 h-5 text-blue-600" /> Assistant
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.sender === "user"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              }`}
            >
              {m.text}
            </div>
            {m.proposal && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800 w-64 shadow-sm">
                <p className="font-semibold text-yellow-900 border-b border-yellow-200 pb-1 mb-1">
                  Impact Preview
                </p>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span>Original:</span>
                  <span className="font-mono">${m.proposal.original_rate}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>New Rate:</span>
                  <span className="font-mono">${m.proposal.new_rate}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-yellow-200 flex items-center justify-between text-xs text-yellow-700">
                  <span>Total Cost Impact:</span>
                  <span className="font-bold">
                    {m.proposal.cost_impact > 0 ? "+" : ""}$
                    {m.proposal.cost_impact?.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      navigate(`/proposal/${m.proposal.project_id || projectId}/${m.proposal.variation_id}`)
                    }
                    className="flex-1 bg-blue-600 text-white py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Bot className="w-3.5 h-3.5" /> Review
                  </button>
                  <button
                    onClick={() => downloadPDF(m.proposal)}
                    className="flex-1 bg-yellow-600 text-white py-1.5 rounded-md text-xs font-semibold hover:bg-yellow-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-gray-400 text-xs animate-pulse">
            Assistant is thinking...
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={
            projectId
              ? "Type a variation (e.g., 'Change Tiles to Granite')..."
              : "Upload files to start..."
          }
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          disabled={loading}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Chat;
