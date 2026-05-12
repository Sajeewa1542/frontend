import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const SESSION_STORAGE_KEY = "hybrid_variation_sessions";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const readSessionRegistry = (): any[] => {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeSessionRegistry = (sessions: any[]) => {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
};

const upsertSessionRegistry = (session: any) => {
  const sessions = readSessionRegistry();

  const sessionId = session.session_id ?? session.id;
  const projectId = session.project_id;

  const next = sessions.filter(
    (item) =>
      !(
        String(item.project_id) === String(projectId) &&
        String(item.session_id ?? item.id) === String(sessionId)
      ),
  );

  next.unshift({
    ...session,
    id: sessionId,
    session_id: sessionId,
    project_id: projectId,
    updated_at: new Date().toISOString(),
  });

  writeSessionRegistry(next);
};

const normalizeDownloadUrl = (url?: string | null): string | null => {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return url;
  }

  return `/${url}`;
};

const downloadBlobFromUrl = async (
  url: string,
  filename: string,
  mimeType: string,
) => {
  const normalizedUrl = normalizeDownloadUrl(url);
  if (!normalizedUrl) throw new Error("Download URL is missing");

  const response = await api.get(normalizedUrl, { responseType: "blob" });

  const blobUrl = window.URL.createObjectURL(
    new Blob([response.data], { type: mimeType }),
  );

  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(blobUrl);
};

// Health & Info
export const getHealth = async () => {
  const response = await api.get("/health");
  return response.data;
};

export const getVariationTypes = async () => {
  const response = await api.get("/variation-types");
  return response.data;
};

// File Upload
export const uploadFiles = async (
  files: {
    boq?: File;
    breakdown?: File;
    schedule?: File;
  },
  onProgress?: (progress: number) => void,
) => {
  const formData = new FormData();

  if (files.boq) formData.append("boq", files.boq);
  if (files.breakdown) formData.append("breakdown", files.breakdown);
  if (files.schedule) formData.append("schedule", files.schedule);

  const response = await api.post("/upload/files", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onProgress(percentCompleted);
      }
    },
  });

  const data = response.data;

  // Important: store uploaded project/session for My Sessions page
  const uploadData = data?.data;
  if (uploadData?.project_id && uploadData?.session_id) {
    upsertSessionRegistry({
      project_id: uploadData.project_id,
      id: uploadData.session_id,
      session_id: uploadData.session_id,
      session_key: uploadData.session_key,
      project_name:
        files.boq?.name?.replace(/\.[^/.]+$/, "") ||
        `Project ${uploadData.project_id}`,
      status: "active",
      boq_items: uploadData.boq_items,
      rate_breakdowns: uploadData.rate_breakdowns,
      schedule_tasks: uploadData.schedule_tasks,
      created_via: "file_upload",
    });
  }

  return data;
};

export const uploadAdditionalFiles = async (
  projectId: number,
  fileType: string,
  files: File[],
  variationId?: string,
  onProgress?: (progress: number) => void,
) => {
  const formData = new FormData();

  files.forEach((file) => formData.append("files", file));
  formData.append("project_id", projectId.toString());
  formData.append("file_type", fileType);

  if (variationId) {
    formData.append("variation_id", variationId.toString());
  }

  const response = await api.post("/upload/additional-files", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

export const getProjects = async () => {
  const response = await api.get("/projects");
  return response.data?.projects || [];
};

// My Sessions
export const getSessions = async (projectId?: number) => {
  const sessions = readSessionRegistry();

  const filtered = projectId
    ? sessions.filter((session) => Number(session.project_id) === Number(projectId))
    : sessions;

  return {
    project_id: projectId,
    sessions: filtered,
  };
};

// Chat
export const sendMessage = async (
  message: string,
  projectId: number,
  sessionId: number,
) => {
  const response = await api.post("/chat", {
    message,
    project_id: projectId,
    session_id: sessionId,
  });

  upsertSessionRegistry({
    project_id: projectId,
    id: sessionId,
    session_id: sessionId,
    status: "active",
  });

  return response.data;
};

// Sessions
export const createSession = async (projectId: number, metadata?: any) => {
  const response = await api.post(`/session/create?project_id=${projectId}`, metadata || {});

  const session = {
    ...response.data,
    project_id: projectId,
    session_id: response.data.id,
    id: response.data.id,
    status: response.data.status || "active",
  };

  upsertSessionRegistry(session);
  return session;
};

export const getSession = async (projectId: number, sessionId: number) => {
  const response = await api.get(`/session/${projectId}/${sessionId}`);
  return response.data;
};

export const continueSession = async (projectId: number, sessionId: number) => {
  const response = await api.post(`/session/${projectId}/${sessionId}/continue`);

  upsertSessionRegistry({
    project_id: projectId,
    id: sessionId,
    session_id: sessionId,
    status: "active",
  });

  return response.data;
};

export const closeSession = async (projectId: number, sessionId: number) => {
  const response = await api.post(`/session/${projectId}/${sessionId}/close`);

  upsertSessionRegistry({
    project_id: projectId,
    id: sessionId,
    session_id: sessionId,
    status: "completed",
  });

  return response.data;
};

// Variation Management
export const getVariation = async (projectId: number, variationId: number) => {
  const response = await api.get(`/variation/${projectId}/${variationId}`);
  return response.data;
};

export const updateVariationDetail = async (
  projectId: number,
  variationId: number,
  detailId: number,
  updates: any,
) => {
  const response = await api.put(
    `/variation/${projectId}/${variationId}/details/${detailId}`,
    updates,
  );
  return response.data;
};

export const updateVariationStatus = async (
  projectId: number,
  variationId: number,
  status: string,
) => {
  const response = await api.post(`/variation/${projectId}/${variationId}/status`, {
    status,
  });
  return response.data;
};

export const validateVariation = async (projectId: number, variationId: number) => {
  const response = await api.post(`/variation/validate/${projectId}/${variationId}`);
  return response.data;
};

export const confirmAndEvaluate = async (projectId: number, confirmData: any) => {
  const payload = {
    ...confirmData,
    project_id: confirmData.project_id ?? projectId,
  };

  const response = await api.post(
    `/variation/${projectId}/confirm-and-evaluate`,
    payload,
  );

  if (payload?.session_id && response.data?.variation_id) {
    upsertSessionRegistry({
      project_id: projectId,
      id: payload.session_id,
      session_id: payload.session_id,
      status: "calculated",
      variation_id: response.data.variation_id,
      pdf_url: response.data.pdf_url,
      docx_url: response.data.docx_url,
      total_cost_impact: response.data.total_cost_impact,
      time_impact: response.data.time_impact,
      variation_type: payload.variation_type,
      evaluation_mode: payload.evaluation_mode,
      project_name: payload.project_name,
    });
  }

  return response.data;
};

// Report Generation
export const generatePDF = async (proposalData: any) => {
  const response = await api.post("/generate-pdf", proposalData, {
    responseType: "blob",
  });
  return response.data;
};

export const generateVariationDocx = async (
  projectId: number,
  variationId: number,
) => {
  const response = await api.post(
    `/variation/${projectId}/${variationId}/generate-docx`,
    null,
    {
      responseType: "blob",
    },
  );
  return response.data;
};

export const downloadPdf = async (
  pdfUrl: string,
  filename = "variation_proposal.pdf",
) => {
  await downloadBlobFromUrl(pdfUrl, filename, "application/pdf");
};

export const downloadDocx = async (
  docxOrBlob: string | Blob,
  filename = "variation_proposal.docx",
) => {
  if (typeof docxOrBlob === "string") {
    await downloadBlobFromUrl(
      docxOrBlob,
      filename,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    return;
  }

  const blobUrl = window.URL.createObjectURL(
    new Blob([docxOrBlob], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );

  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(blobUrl);
};

export const downloadReportByUrl = async (
  url: string,
  filename?: string,
) => {
  if (url.toLowerCase().endsWith(".docx")) {
    await downloadDocx(url, filename || "variation_proposal.docx");
  } else {
    await downloadPdf(url, filename || "variation_proposal.pdf");
  }
};

export default api;