import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  CircleDashed,
  FileText,
  MessageSquare,
  Play,
  XCircle,
} from "lucide-react";
import { closeSession, continueSession, getSessions } from "../services/api";
import { useApp } from "../context/AppContext";

const SessionsPage = () => {
  const navigate = useNavigate();
  const { sessions, setSessions, setCurrentSession } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);

  const orderedSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.id) - Number(a.id)),
    [sessions],
  );

  useEffect(() => {
    refreshSessions().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSessions = async () => {
    const projectIds = Array.from(new Set(sessions.map((session) => session.project_id).filter(Boolean))) as number[];
    if (!projectIds.length) return;

    const merged: any[] = [];
    for (const projectId of projectIds) {
      const response = await getSessions(projectId);
      merged.push(...(response.sessions || []));
    }
    setSessions(merged);
  };

  const handleContinue = async (session: any) => {
    if (!session.project_id) return;
    const key = `${session.project_id}-${session.id}`;
    setBusyId(key);
    try {
      const response = await continueSession(session.project_id, session.id);
      const context = response.context || response;
      const nextSession = {
        id: Number(context.session_id || session.id),
        project_id: session.project_id,
        session_key: context.session_key || session.session_key || "",
        status: context.status || "active",
        created_at: context.created_at || session.created_at,
        session_metadata: context.metadata || context.session_metadata || session.session_metadata || {},
        variation_id: session.variation_id,
        pdf_url: session.pdf_url,
      };
      setCurrentSession(nextSession);
      navigate(`/chat/${session.project_id}/${nextSession.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleViewResult = (session: any) => {
    if (!session.project_id || !session.variation_id) return;
    navigate(`/proposal/${session.project_id}/${session.variation_id}`);
  };

  const handleClose = async (session: any) => {
    if (!session.project_id) return;
    const key = `${session.project_id}-${session.id}`;
    setBusyId(key);
    try {
      await closeSession(session.project_id, session.id);
      await refreshSessions();
    } finally {
      setBusyId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span>Active</span>
          </span>
        );
      case "closed":
        return (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
            <XCircle className="h-4 w-4" />
            <span>Closed</span>
          </span>
        );
      case "calculated":
        return (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            <FileText className="h-4 w-4" />
            <span>Result Ready</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
            <CircleDashed className="h-4 w-4" />
            <span>{status || "Unknown"}</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate("/")} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
                <p className="text-sm text-gray-600">Continue, close, or review past variation workflows.</p>
              </div>
            </div>
            <button onClick={() => navigate("/upload")} className="btn-primary">
              New Evaluation
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">Stored session cards are kept in the browser and updated whenever you continue or close a session.</div>
          <button onClick={refreshSessions} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
            Refresh
          </button>
        </div>

        {orderedSessions.length === 0 ? (
          <div className="card text-center py-12">
            <MessageSquare className="mx-auto mb-4 h-16 w-16 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Sessions Yet</h3>
            <p className="mb-6 text-gray-600">Start a new variation workflow to create your first session.</p>
            <button onClick={() => navigate("/upload")} className="btn-primary">
              Start New Evaluation
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orderedSessions.map((session) => {
              const busy = busyId === `${session.project_id}-${session.id}`;
              return (
                <div key={`${session.project_id}-${session.id}`} className="card hover:shadow-xl transition-shadow">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">Project {session.project_id} · Session {session.id}</h3>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Created {session.created_at ? new Date(session.created_at).toLocaleString() : "unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span>{session.session_key ? session.session_key.slice(0, 8) : "session"}</span>
                        </div>
                        {session.variation_id && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>Variation #{session.variation_id}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => handleContinue(session)}
                        disabled={busy || session.status === "closed"}
                        className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Play className="h-4 w-4" />
                        <span>Continue Session</span>
                      </button>

                      <button
                        onClick={() => handleViewResult(session)}
                        disabled={!session.variation_id}
                        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        View Result
                      </button>

                      <button
                        onClick={() => handleClose(session)}
                        disabled={busy || session.status === "closed"}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "Working..." : "Close Session"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsPage;