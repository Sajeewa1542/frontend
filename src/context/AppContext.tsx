import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface Project {
  id: number;
  name: string;
  boq_items?: number;
  rate_breakdowns?: number;
  schedule_tasks?: number;
  critical_path_activities?: number;
}

interface Session {
  id: number;
  project_id?: number;
  session_key: string;
  status: string;
  created_at: string;
  session_metadata?: any;
    docx_url?: string | null;
  pdf_url?: string | null;
  variation_id?: number | string;
}

interface Message {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

interface Proposal {
  item_id?: number;
  original_item?: string;
  new_item?: string;
  cost_impact?: number;
  time_impact?: number;
  variation_type?: string;
  eot_breakdown?: {
    justification?: string;
    affected_activity?: any;
    original_project_duration?: number;
    new_project_duration?: number;
    is_on_critical_path?: boolean;
  };
  gantt_chart_data?: {
    id: string;
    name: string;
    start_day: number;
    end_day: number;
    duration: number;
    is_critical: boolean;
    total_float: number;
  }[];
}

interface AppState {
  currentProject: Project | null;
  currentSession: Session | null;
  sessions: Session[];
  messages: Message[];
  proposal: Proposal | null;
  loading: boolean;
  error: string | null;
  uploadProgress: number;
}

interface AppContextType extends AppState {
  setCurrentProject: (project: Project | null) => void;
  setCurrentSession: (session: Session | null) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setSessions: (sessions: Session[]) => void;
  upsertSession: (session: Session) => void;
  setProposal: (proposal: Proposal | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUploadProgress: (progress: number) => void;
  resetState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialState: AppState = {
  currentProject: null,
  currentSession: null,
  sessions: [],
  messages: [],
  proposal: null,
  loading: false,
  error: null,
  uploadProgress: 0,
};

const STORAGE_KEY = "hybrid_variation_app_state";

function loadPersistedState(): AppState {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    if (!rawState) {
      return initialState;
    }

    const parsedState = JSON.parse(rawState) as Partial<AppState>;
    return {
      ...initialState,
      ...parsedState,
      currentProject: parsedState.currentProject ?? null,
      currentSession: parsedState.currentSession ?? null,
      sessions: parsedState.sessions ?? [],
      messages: parsedState.messages ?? [],
      proposal: parsedState.proposal ?? null,
    };
  } catch {
    return initialState;
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>(() =>
    typeof window === "undefined" ? initialState : loadPersistedState(),
  );

  useEffect(() => {
    const persistedState: Partial<AppState> = {
      currentProject: state.currentProject,
      currentSession: state.currentSession,
      sessions: state.sessions,
      messages: state.messages,
      proposal: state.proposal,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [state.currentProject, state.currentSession, state.messages, state.proposal]);

  const setCurrentProject = (project: Project | null) => {
    setState((prev) => ({ ...prev, currentProject: project }));
  };

  const setCurrentSession = (session: Session | null) => {
    setState((prev) => ({ ...prev, currentSession: session }));
  };

  const addMessage = (message: Message) => {
    setState((prev) => ({ ...prev, messages: [...prev.messages, message] }));
  };

  const setMessages = (messages: Message[]) => {
    setState((prev) => ({ ...prev, messages }));
  };

  const setSessions = (sessions: Session[]) => {
    setState((prev) => ({ ...prev, sessions }));
  };

  const upsertSession = (session: Session) => {
    setState((prev) => {
      const nextSessions = prev.sessions.filter(
        (item) => !(item.project_id === session.project_id && item.id === session.id),
      );
      return { ...prev, sessions: [session, ...nextSessions] };
    });
  };

  const setProposal = (proposal: Proposal | null) => {
    setState((prev) => ({ ...prev, proposal }));
  };

  const setLoading = (loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  };

  const setError = (error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  };

  const setUploadProgress = (progress: number) => {
    setState((prev) => ({ ...prev, uploadProgress: progress }));
  };

  const resetState = () => {
    setState(initialState);
  };

  const value: AppContextType = {
    ...state,
    setCurrentProject,
    setCurrentSession,
    addMessage,
    setMessages,
    setSessions,
    upsertSession,
    setProposal,
    setLoading,
    setError,
    setUploadProgress,
    resetState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
