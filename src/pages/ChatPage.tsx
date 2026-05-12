import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Loader, RotateCcw, Send } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  confirmAndEvaluate,
  createSession,
  getSession,
  sendMessage,
} from "../services/api";

type Candidate = {
  id?: string | number;
  source_priority?: number;
  source_type?: string;
  source_id?: string;
  source_file?: string;
  page_number?: number | null;

  item_reference?: string | null;
  item_number?: string | null;
  item_no?: string | null;
  code?: string | null;

  activity_id?: string | number | null;
  activity_name?: string;
  name?: string;
  duration?: number | string;
  is_critical?: boolean | string;
  float?: number | string;

  description?: string;
  unit?: string | null;
  rate?: number | null;
  quantity?: number | null;

  similarity_score?: number;
  confidence_score?: number;
  reason?: string;
};

type ExtractionPayload = {
  reply: string;
  variation_type?: string;
  evaluation_mode?: string;
  affected_boq_candidates?: Candidate[];
  rate_candidates?: Candidate[];
  affected_activity_candidates?: Candidate[];
  extracted_quantities?: Array<{ value: number; unit?: string; description?: string }>;
  missing_information?: string[];
  selected_rate_candidate?: Candidate | null;
  requires_human_confirmation?: boolean;
};

type ConfirmationDraft = {
  variation_type: string;
  evaluation_mode: string;
  original_boq_item_ref: string;
  replacement_item_ref: string;
  original_description: string;
  replacement_description: string;
  original_quantity: string;
  new_quantity: string;
  replacement_quantity: string;
  unit: string;
  original_rate: string;
  confirmed_rate: string;
  confirmed_rate_source: string;
  confirmed_rate_source_id: string;
  confirmed_activity_ref: string;
  confirmed_productivity: string;
  productivity_source: string;
  supporting_documents: string;
};

const emptyDraft: ConfirmationDraft = {
  variation_type: "TYPE1",
  evaluation_mode: "quantity_change",
  original_boq_item_ref: "",
  replacement_item_ref: "",
  original_description: "",
  replacement_description: "",
  original_quantity: "",
  new_quantity: "",
  replacement_quantity: "",
  unit: "",
  original_rate: "",
  confirmed_rate: "",
  confirmed_rate_source: "",
  confirmed_rate_source_id: "",
  confirmed_activity_ref: "",
  confirmed_productivity: "",
  productivity_source: "",
  supporting_documents: "",
};

const getCandidateRef = (candidate?: Candidate | null) => {
  if (!candidate) return "";
  return String(
    candidate.item_reference ??
      candidate.item_number ??
      candidate.item_no ??
      candidate.code ??
      candidate.source_id ??
      candidate.id ??
      "",
  );
};

const getActivityRef = (candidate?: Candidate | null) => {
  if (!candidate) return "";
  return String(
    candidate.activity_id ??
      candidate.id ??
      candidate.source_id ??
      candidate.item_reference ??
      "",
  );
};

const getCandidateDescription = (candidate?: Candidate | null) => {
  if (!candidate) return "";
  return String(candidate.description ?? candidate.name ?? candidate.activity_name ?? "");
};

const getCandidateLabel = (candidate?: Candidate | null) => {
  if (!candidate) return "Candidate";
  const ref = getCandidateRef(candidate) || getActivityRef(candidate);
  const description = getCandidateDescription(candidate);
  if (ref && description) return `${ref} - ${description}`;
  return ref || description || "Candidate";
};

const getSourceLabel = (candidate?: Candidate | null) => {
  if (!candidate) return "";
  const type = candidate.source_type || "confirmed";
  const ref = getCandidateRef(candidate);
  return ref ? `${type} ${ref}` : type;
};

const filterTopCandidates = (candidates: Candidate[] = []) =>
  candidates
    .filter((candidate) => (candidate.similarity_score ?? candidate.confidence_score ?? 1) >= 0.55)
    .slice(0, 3);

const modeForType = (type: string) => {
  const modeMap: Record<string, string> = {
    TYPE1: "quantity_change",
    TYPE2: "substitution",
    TYPE3: "quantity_change",
    TYPE4: "omission",
    TYPE5: "additional_work",
    TYPE6: "time_sequence_change",
  };

  return modeMap[type] || "quantity_change";
};

const inferTypeAndMode = (payload: ExtractionPayload) => {
  const text = `${payload.reply || ""}`.toLowerCase();

  if (text.includes("type 2") || text.includes("substitution") || text.includes("substitut")) {
    return { variation_type: "TYPE2", evaluation_mode: "substitution" };
  }

  if (text.includes("type 4") || text.includes("omission") || text.includes("omit")) {
    return { variation_type: "TYPE4", evaluation_mode: "omission" };
  }

  if (text.includes("type 5") || text.includes("additional work") || text.includes("new work")) {
    return { variation_type: "TYPE5", evaluation_mode: "additional_work" };
  }

  if (text.includes("type 1") || text.includes("quantity change") || text.includes("increase") || text.includes("reduce")) {
    return { variation_type: "TYPE1", evaluation_mode: "quantity_change" };
  }

  return {
    variation_type: payload.variation_type || "TYPE1",
    evaluation_mode: payload.evaluation_mode || "quantity_change",
  };
};

const isSameOriginalBoqRate = (candidate: Candidate | undefined | null, originalRef: string) => {
  if (!candidate) return false;

  const candidateRef = getCandidateRef(candidate).toLowerCase();
  const sourceType = String(candidate.source_type || "").toLowerCase();

  return sourceType.includes("boq") && candidateRef === originalRef.toLowerCase();
};

const ChatPage = () => {
  const { projectId: projectIdParam, sessionId } = useParams<{ projectId?: string; sessionId?: string }>();
  const navigate = useNavigate();
  const {
    currentProject,
    currentSession,
    setCurrentSession,
    upsertSession,
    messages,
    addMessage,
    setMessages,
    setProposal,
    loading,
    setLoading,
  } = useApp();

  const resolvedProjectId = Number(projectIdParam || currentProject?.id || currentSession?.session_metadata?.project_id || 0);
  const resolvedSessionId = Number(sessionId || currentSession?.id || 0);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionPayload | null>(null);
  const [draft, setDraft] = useState<ConfirmationDraft>(emptyDraft);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resolvedProjectId && resolvedSessionId) {
      loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProjectId, resolvedSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, extraction, isTyping, isEvaluating]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadSession = async () => {
    if (!resolvedProjectId || !resolvedSessionId) return;

    setLoading(true);
    try {
      const session = await getSession(resolvedProjectId, resolvedSessionId);
      const normalizedSession = {
        id: session.session_id ?? session.id,
        project_id: resolvedProjectId,
        session_key: session.session_key || "",
        status: session.status || "active",
        created_at: session.created_at || new Date().toISOString(),
        session_metadata: session.metadata || session.session_metadata || {},
        variation_id: session.variations?.[0]?.id,
      };
      setCurrentSession(normalizedSession);
      upsertSession(normalizedSession);
      if (session.conversation_history) {
        setMessages(session.conversation_history);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoading(false);
    }
  };

  const seedDraftFromExtraction = (payload: ExtractionPayload) => {
    const boqCandidate = payload.affected_boq_candidates?.[0];
    const rawRateCandidate = payload.selected_rate_candidate || payload.rate_candidates?.[0];
    const activityCandidate = payload.affected_activity_candidates?.[0];
    const quantityValues = payload.extracted_quantities || [];

    const inferred = inferTypeAndMode(payload);
    const firstQty = quantityValues[0]?.value?.toString() || "";
    const secondQty = quantityValues[1]?.value?.toString() || "";

    setDraft((prev) => {
      const nextType = inferred.variation_type || prev.variation_type;
      const nextMode = inferred.evaluation_mode || modeForType(nextType);

      const originalRef = getCandidateRef(boqCandidate) || prev.original_boq_item_ref;
      const boqRate = boqCandidate?.rate?.toString() || "";
      const boqQuantity = boqCandidate?.quantity?.toString() || "";

      const isType2Substitution = nextType === "TYPE2" && nextMode === "substitution";
      const isType1Quantity = nextType === "TYPE1" && nextMode === "quantity_change";
      const isType4Omission = nextType === "TYPE4" && nextMode === "omission";
      const isType5Additional = nextType === "TYPE5" && nextMode === "additional_work";

      // For TYPE2 substitution: do not use the original BOQ item as the replacement rate.
      const validRateCandidate =
        isType2Substitution && isSameOriginalBoqRate(rawRateCandidate, originalRef)
          ? undefined
          : rawRateCandidate;

      const replacementRate = validRateCandidate?.rate?.toString() || "";

      // TYPE-SPECIFIC AUTO-FILL LOGIC:
      
      // TYPE1: Quantity Change - Use original BOQ side only
      // TYPE4: Omission - Use original BOQ side only
      if (isType1Quantity || isType4Omission) {
        return {
          ...prev,
          variation_type: nextType,
          evaluation_mode: nextMode,

          // ORIGINAL side (from BOQ)
          original_boq_item_ref: originalRef,
          original_description: getCandidateDescription(boqCandidate) || prev.original_description,
          original_quantity: boqQuantity || prev.original_quantity,
          original_rate: boqRate || prev.original_rate,

          // REPLACEMENT side (leave blank for TYPE1, TYPE4)
          replacement_item_ref: "",
          replacement_description: "",
          replacement_quantity: "",

          // New quantity (TYPE1 only)
          new_quantity: isType1Quantity ? (secondQty || firstQty || prev.new_quantity) : prev.new_quantity,

          // Unit from BOQ or extracted
          unit: quantityValues[0]?.unit || quantityValues[1]?.unit || boqCandidate?.unit || prev.unit,

          // Rate source: prefer BOQ item's own rate for TYPE1/TYPE4
          confirmed_rate: boqRate || prev.confirmed_rate,
          confirmed_rate_source: boqCandidate
            ? `BOQ Item ${getCandidateRef(boqCandidate)}`
            : prev.confirmed_rate_source,
          confirmed_rate_source_id: originalRef || prev.confirmed_rate_source_id,

          confirmed_activity_ref: getActivityRef(activityCandidate) || prev.confirmed_activity_ref,
          confirmed_productivity: prev.confirmed_productivity,
          productivity_source: prev.productivity_source,
          supporting_documents: prev.supporting_documents,
        };
      }

      // TYPE2: Substitution - Use original AND replacement sides
      if (isType2Substitution) {
        return {
          ...prev,
          variation_type: nextType,
          evaluation_mode: nextMode,

          // ORIGINAL side (from BOQ)
          original_boq_item_ref: originalRef,
          original_description: getCandidateDescription(boqCandidate) || prev.original_description,
          original_quantity: boqQuantity || prev.original_quantity,
          original_rate: boqRate || prev.original_rate,

          // REPLACEMENT side (from rate candidate, NOT from BOQ)
          replacement_item_ref: getCandidateRef(validRateCandidate) || prev.replacement_item_ref,
          replacement_description: getCandidateDescription(validRateCandidate) || prev.replacement_description,
          replacement_quantity: secondQty || prev.replacement_quantity,

          unit: quantityValues[0]?.unit || quantityValues[1]?.unit || boqCandidate?.unit || validRateCandidate?.unit || prev.unit,

          // Confirmed rate from replacement candidate
          confirmed_rate: replacementRate || prev.confirmed_rate,
          confirmed_rate_source: validRateCandidate ? getSourceLabel(validRateCandidate) : prev.confirmed_rate_source,
          confirmed_rate_source_id: getCandidateRef(validRateCandidate) || prev.confirmed_rate_source_id,

          confirmed_activity_ref: getActivityRef(activityCandidate) || prev.confirmed_activity_ref,
          confirmed_productivity: prev.confirmed_productivity,
          productivity_source: prev.productivity_source,
          supporting_documents: prev.supporting_documents,
        };
      }

      // TYPE5: Additional Work - Use replacement side only
      if (isType5Additional) {
        return {
          ...prev,
          variation_type: nextType,
          evaluation_mode: nextMode,

          // ORIGINAL side (leave blank for TYPE5)
          original_boq_item_ref: "",
          original_description: "",
          original_quantity: "",
          original_rate: "",

          // REPLACEMENT side (new work from candidate)
          replacement_item_ref: getCandidateRef(validRateCandidate) || getCandidateRef(boqCandidate) || prev.replacement_item_ref,
          replacement_description: getCandidateDescription(validRateCandidate) || getCandidateDescription(boqCandidate) || prev.replacement_description,
          replacement_quantity: secondQty || firstQty || prev.replacement_quantity,

          unit: quantityValues[0]?.unit || quantityValues[1]?.unit || validRateCandidate?.unit || boqCandidate?.unit || prev.unit,

          confirmed_rate: replacementRate || boqRate || prev.confirmed_rate,
          confirmed_rate_source: validRateCandidate
            ? getSourceLabel(validRateCandidate)
            : boqCandidate
              ? `BOQ Item ${getCandidateRef(boqCandidate)}`
              : prev.confirmed_rate_source,
          confirmed_rate_source_id: getCandidateRef(validRateCandidate) || originalRef || prev.confirmed_rate_source_id,

          confirmed_activity_ref: getActivityRef(activityCandidate) || prev.confirmed_activity_ref,
          confirmed_productivity: prev.confirmed_productivity,
          productivity_source: prev.productivity_source,
          supporting_documents: prev.supporting_documents,
        };
      }

      // Fallback (should not reach here if types are well-defined)
      return prev;
    });
  };

const applyBoqCandidate = (candidate?: Candidate) => {
  if (!candidate) return;

  setDraft((prev) => ({
    ...prev,
    original_boq_item_ref: getCandidateRef(candidate),
    original_description: getCandidateDescription(candidate) || prev.original_description,
    unit: candidate.unit || prev.unit,
    original_rate: candidate.rate?.toString() || prev.original_rate,
    confirmed_rate:
      prev.evaluation_mode === "quantity_change" || prev.evaluation_mode === "omission"
        ? candidate.rate?.toString() || prev.confirmed_rate
        : prev.confirmed_rate,
    confirmed_rate_source:
      prev.evaluation_mode === "quantity_change" || prev.evaluation_mode === "omission"
        ? `BOQ Item ${getCandidateRef(candidate)}`
        : prev.confirmed_rate_source,
    confirmed_rate_source_id:
      prev.evaluation_mode === "quantity_change" || prev.evaluation_mode === "omission"
        ? getCandidateRef(candidate)
        : prev.confirmed_rate_source_id,
  }));
};

const applyRateCandidate = (candidate?: Candidate) => {
  if (!candidate) return;

  setDraft((prev) => ({
    ...prev,
    replacement_item_ref: getCandidateRef(candidate),
    replacement_description: getCandidateDescription(candidate) || prev.replacement_description,
    unit: candidate.unit || prev.unit,
    confirmed_rate: candidate.rate?.toString() || prev.confirmed_rate,
    confirmed_rate_source: getSourceLabel(candidate) || prev.confirmed_rate_source,
    confirmed_rate_source_id: getCandidateRef(candidate) || prev.confirmed_rate_source_id,
  }));
};

const applyActivityCandidate = (candidate?: Candidate) => {
  if (!candidate) return;

  setDraft((prev) => ({
    ...prev,
    confirmed_activity_ref: getActivityRef(candidate),
  }));
};

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!resolvedProjectId) return;

    let activeSessionId = resolvedSessionId;
    if (!activeSessionId) {
      const session = await createSession(resolvedProjectId, { created_via: "chat" });
      activeSessionId = Number(session.session_id || session.id);
      setCurrentSession({
        id: activeSessionId,
        project_id: resolvedProjectId,
        session_key: session.session_key || "",
        status: session.status || "active",
        created_at: session.created_at || new Date().toISOString(),
      });
      
      navigate(`/chat/${resolvedProjectId}/${activeSessionId}`);
    }

    const userMessage = {
      role: "user" as const,
      content: input,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput("");
    setIsTyping(true);

    try {
      const response = await sendMessage(input, resolvedProjectId, activeSessionId);

      const aiMessage = {
        role: "ai" as const,
        content: response.reply || "No response",
        timestamp: new Date().toISOString(),
      };

      addMessage(aiMessage);

      const nextExtraction: ExtractionPayload = {
        reply: response.reply || "",
        variation_type: response.variation_type,
        evaluation_mode: response.evaluation_mode,
        affected_boq_candidates: response.affected_boq_candidates || [],
        rate_candidates: response.rate_candidates || [],
        affected_activity_candidates: response.affected_activity_candidates || [],
        extracted_quantities: response.extracted_quantities || [],
        missing_information: response.missing_information || [],
        selected_rate_candidate: response.selected_rate_candidate || null,
        requires_human_confirmation: response.requires_human_confirmation,
      };

      setExtraction(nextExtraction);
      seedDraftFromExtraction(nextExtraction);
    } catch (err: any) {
      addMessage({
        role: "ai",
        content: `Error: ${err.response?.data?.detail || "Failed to get response"}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmAndEvaluate = async () => {
  if (!resolvedProjectId || !resolvedSessionId) return;
  setIsEvaluating(true);

  try {
      const missingFields: string[] = [];

      if (!draft.variation_type) missingFields.push("Variation Type");
      if (!draft.evaluation_mode) missingFields.push("Evaluation Mode");

      if (draft.evaluation_mode === "substitution" || draft.variation_type === "TYPE2") {
        if (!draft.original_boq_item_ref) missingFields.push("Original BOQ Item Ref");
        if (!draft.original_quantity) missingFields.push("Original Quantity");
        if (!draft.original_rate) missingFields.push("Original Rate");
        if (!draft.replacement_description && !draft.replacement_item_ref) {
          missingFields.push("Replacement Item / Description");
        }
        if (!draft.replacement_quantity) missingFields.push("Replacement Quantity");
        if (!draft.confirmed_rate) missingFields.push("Confirmed Replacement Rate");
        if (!draft.confirmed_rate_source) missingFields.push("Rate Source");
      }

      if (draft.evaluation_mode === "quantity_change" || draft.variation_type === "TYPE1") {
        if (!draft.original_boq_item_ref) missingFields.push("Original BOQ Item Ref");
        if (!draft.original_quantity) missingFields.push("Original Quantity");
        if (!draft.new_quantity) missingFields.push("New Quantity");
        if (!draft.confirmed_rate) missingFields.push("Confirmed Rate");
      }

      if (draft.evaluation_mode === "omission" || draft.variation_type === "TYPE4") {
        if (!draft.original_boq_item_ref) missingFields.push("Original BOQ Item Ref");
        if (!draft.original_quantity) missingFields.push("Original Quantity");
        if (!draft.confirmed_rate) missingFields.push("Confirmed Rate");
      }

      if (draft.evaluation_mode === "additional_work" || draft.variation_type === "TYPE5") {
        if (!draft.replacement_description && !draft.replacement_item_ref) {
          missingFields.push("Additional Work Description / Ref");
        }
        if (!draft.replacement_quantity && !draft.new_quantity) missingFields.push("Quantity");
        if (!draft.confirmed_rate) missingFields.push("Confirmed Rate");
      }

      if (missingFields.length > 0) {
        addMessage({
          role: "ai",
          content: `Evaluation cannot continue. Please complete these fields first: ${missingFields.join(", ")}.`,
          timestamp: new Date().toISOString(),
        });
        setIsEvaluating(false);
        return;
      }

      const payload = {
      project_id: resolvedProjectId,
      session_id: resolvedSessionId,
      variation_type: draft.variation_type,
      evaluation_mode: draft.evaluation_mode,
      original_boq_item_ref: draft.original_boq_item_ref || null,
      replacement_item_ref: draft.replacement_item_ref || null,
      original_description: draft.original_description || null,
      replacement_description: draft.replacement_description || null,
      original_quantity: draft.original_quantity ? Number(draft.original_quantity) : null,
      new_quantity: draft.new_quantity ? Number(draft.new_quantity) : null,
      replacement_quantity: draft.replacement_quantity ? Number(draft.replacement_quantity) : null,
      unit: draft.unit || null,
      original_rate: draft.original_rate ? Number(draft.original_rate) : null,
      confirmed_rate: draft.confirmed_rate ? Number(draft.confirmed_rate) : null,
      confirmed_rate_source: draft.confirmed_rate_source || null,
      confirmed_rate_source_id: draft.confirmed_rate_source_id || null,
      confirmed_activity_ref: draft.confirmed_activity_ref || null,
      confirmed_productivity: draft.confirmed_productivity ? Number(draft.confirmed_productivity) : null,
      productivity_source: draft.productivity_source || null,
      supporting_documents: draft.supporting_documents
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      human_confirmed: true,
    };

    const result = await confirmAndEvaluate(resolvedProjectId, payload);

    setProposal(result);

    if (currentSession) {
      upsertSession({
        ...currentSession,
        project_id: resolvedProjectId,
        variation_id: result.variation_id,
        pdf_url: result.pdf_url,
        docx_url: result.docx_url,
        status: "calculated",
      } as any);
    }

    navigate(`/proposal/${resolvedProjectId}/${result.variation_id}`);

  } catch (err: any) {
    addMessage({
      role: "ai",
      content: `Evaluation failed: ${err.response?.data?.detail || err.message || "Unable to evaluate variation"}`,
      timestamp: new Date().toISOString(),
    });
  } finally {
    setIsEvaluating(false);
  }
};

  const handleNewEvaluation = () => {
    navigate("/upload");
  };

  const candidateSummary = useMemo(() => {
    return {
      boq: extraction?.affected_boq_candidates || [],
      rates: extraction?.rate_candidates || [],
      activities: extraction?.affected_activity_candidates || [],
      quantities: extraction?.extracted_quantities || [],
      missing: extraction?.missing_information || [],
    };
  }, [extraction]);

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate("/")} className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Variation Evaluation Workflow</h1>
                <p className="text-sm text-gray-600">
                  Project {resolvedProjectId || "-"} • Session {resolvedSessionId || "-"}
                </p>
              </div>
            </div>
            <button
              onClick={handleNewEvaluation}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="text-sm font-medium">New Evaluation</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-blue-600" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Start Your Variation Evaluation</h3>
              <p className="mx-auto max-w-2xl text-sm text-gray-700">
                Use ML-assisted extraction to identify candidates, then confirm the final BOQ and activity choices before the rule-based evaluation runs.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-3xl rounded-2xl px-4 py-3 ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-900 shadow-md"}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`mt-2 text-xs ${message.role === "user" ? "text-blue-100" : "text-gray-500"}`}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-4 py-3 shadow-md">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Extracting candidates...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {extraction && (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Extraction Summary</h2>
                  <p className="text-sm text-gray-600">
                    The system has identified likely variation details. Review and correct the confirmation card before evaluation.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    Suggested: {extraction.variation_type || "Not identified"}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    Mode: {extraction.evaluation_mode || "Pending"}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Human confirmation required
                  </span>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">System Interpretation</p>
                  <p className="mt-1">{extraction.reply}</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                  <p className="font-semibold text-gray-900">Suggested Values</p>
                  <div className="mt-2 space-y-1 text-gray-700">
                    <p>
                      <strong>Suggested BOQ:</strong>{" "}
                      {getCandidateLabel(extraction?.affected_boq_candidates?.[0]) || "Not identified"}
                    </p>
                    <p>
                      <strong>Suggested Rate Source:</strong>{" "}
                      {getCandidateLabel(extraction?.selected_rate_candidate || extraction?.rate_candidates?.[0]) || "Not identified"}
                    </p>
                    <p>
                      <strong>Suggested Activity:</strong>{" "}
                      {getCandidateLabel(extraction?.affected_activity_candidates?.[0]) || "Not identified"}
                    </p>
                  </div>
                </div>

                {candidateSummary.missing.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                    <p className="font-semibold text-amber-900">Information Still Required</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
                      {candidateSummary.missing.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="rounded-lg border border-gray-200 bg-white p-3">
                  <summary className="cursor-pointer font-semibold text-gray-800">
                    View alternative BOQ matches
                  </summary>
                  <div className="mt-2 space-y-2">
                    {filterTopCandidates(extraction?.affected_boq_candidates || []).map((candidate, idx) => (
                      <button
                        type="button"
                        key={`boq-alt-${idx}`}
                        onClick={() => applyBoqCandidate(candidate)}
                        className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="font-medium">{getCandidateLabel(candidate)}</div>
                        <div className="text-xs text-gray-600">
                          Source: {candidate.source_type || "BOQ"}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>

                <details className="rounded-lg border border-gray-200 bg-white p-3">
                  <summary className="cursor-pointer font-semibold text-gray-800">
                    View alternative rate sources
                  </summary>
                  <div className="mt-2 space-y-2">
                    {filterTopCandidates(extraction?.rate_candidates || []).map((candidate, idx) => (
                      <button
                        type="button"
                        key={`rate-alt-${idx}`}
                        onClick={() => applyRateCandidate(candidate)}
                        className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="font-medium">{getCandidateLabel(candidate)}</div>
                        <div className="text-xs text-gray-600">
                          Unit: {candidate.unit || "-"} • Rate: {candidate.rate ? `Rs. ${candidate.rate}` : "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>

                <details className="rounded-lg border border-gray-200 bg-white p-3">
                  <summary className="cursor-pointer font-semibold text-gray-800">
                    View alternative activity matches
                  </summary>
                  <div className="mt-2 space-y-2">
                    {filterTopCandidates(extraction?.affected_activity_candidates || []).map((candidate, idx) => (
                      <button
                        type="button"
                        key={`act-alt-${idx}`}
                        onClick={() => applyActivityCandidate(candidate)}
                        className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="font-medium">{getCandidateLabel(candidate)}</div>
                        <div className="text-xs text-gray-600">
                          Activity ID: {getActivityRef(candidate) || "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Confirmation Card</h2>
                  <p className="text-sm text-gray-700">
                    Review and correct the confirmed values before rule-based evaluation.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-800">
                    Variation Type
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.variation_type}
                      onChange={(e) => {
                        const type = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          variation_type: type,
                          evaluation_mode: modeForType(type),
                        }));
                      }}
                    >
                      {["TYPE1", "TYPE2", "TYPE3", "TYPE4", "TYPE5", "TYPE6"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Evaluation Mode
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.evaluation_mode}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, evaluation_mode: e.target.value }))
                      }
                    >
                      {["quantity_change", "omission", "substitution", "additional_work", "time_sequence_change"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Original BOQ Item Ref
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.original_boq_item_ref}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, original_boq_item_ref: e.target.value }))
                      }
                      placeholder="e.g. 6.03"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Original BOQ Description
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.original_description}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, original_description: e.target.value }))
                      }
                      placeholder="e.g. 600x600mm ceramic floor tiles"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Replacement Item / Rate Ref
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.replacement_item_ref}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, replacement_item_ref: e.target.value }))
                      }
                      placeholder="e.g. RB/19"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Replacement Description
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.replacement_description}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, replacement_description: e.target.value }))
                      }
                      placeholder="e.g. Polished granite floor slabs"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-800">
                      Original Quantity
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.original_quantity}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, original_quantity: e.target.value }))
                        }
                        placeholder="e.g. 96"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-800">
                      Original Rate
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.original_rate}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, original_rate: e.target.value }))
                        }
                        placeholder="e.g. 3850"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-800">
                      New Quantity
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.new_quantity}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, new_quantity: e.target.value }))
                        }
                        placeholder="For TYPE1 only"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-800">
                      Replacement Quantity
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.replacement_quantity}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, replacement_quantity: e.target.value }))
                        }
                        placeholder="e.g. 96"
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-gray-800">
                    Unit
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.unit}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, unit: e.target.value }))
                      }
                      placeholder="e.g. m2"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Activity Ref
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.confirmed_activity_ref}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, confirmed_activity_ref: e.target.value }))
                      }
                      placeholder="e.g. 116"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-800">
                      Productivity
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.confirmed_productivity}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, confirmed_productivity: e.target.value }))
                        }
                        placeholder="e.g. 12"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-800">
                      Productivity Source
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.productivity_source}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, productivity_source: e.target.value }))
                        }
                        placeholder="Schedule / BSR / work study"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-800">
                      Confirmed Rate
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.confirmed_rate}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, confirmed_rate: e.target.value }))
                        }
                        placeholder="e.g. 9300"
                      />
                    </label>

                    <label className="block text-sm font-medium text-gray-800">
                      Rate Source
                      <input
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                        value={draft.confirmed_rate_source}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, confirmed_rate_source: e.target.value }))
                        }
                        placeholder="BOQ / Rate Breakdown / BSR / HSR / Quotation"
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-gray-800">
                    Rate Source ID
                    <input
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      value={draft.confirmed_rate_source_id}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, confirmed_rate_source_id: e.target.value }))
                      }
                      placeholder="e.g. RB/19"
                    />
                  </label>

                  <label className="block text-sm font-medium text-gray-800">
                    Supporting Documents
                    <textarea
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                      rows={3}
                      value={draft.supporting_documents}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, supporting_documents: e.target.value }))
                      }
                      placeholder="BOQ, Rate Breakdown RB/19, EI-021, Revised Specification"
                    />
                  </label>
                </div>

                <button
                  onClick={handleConfirmAndEvaluate}
                  disabled={isEvaluating || loading}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isEvaluating ? "Evaluating..." : "Confirm and Evaluate"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the variation, e.g. 'Change ceramic tiles to granite floor slabs'"
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={loading || isTyping || isEvaluating}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || isTyping || isEvaluating}
              className="btn-primary flex items-center gap-2 px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;