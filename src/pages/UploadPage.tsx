import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { uploadAdditionalFiles, uploadFiles } from "../services/api";
import {
  Upload,
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Loader2,
} from "lucide-react";

const UploadPage = () => {
  const navigate = useNavigate();
  const {
    setCurrentProject,
    setCurrentSession,
    upsertSession,
    setLoading,
    loading,
    setError,
    error,
    uploadProgress,
    setUploadProgress,
  } = useApp();

  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<{
    boq?: File;
    breakdown?: File;
    schedule?: File;
  }>({});
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [supportingType, setSupportingType] = useState("bsr");
  const [supportingUploadSuccess, setSupportingUploadSuccess] = useState<{
    fileNames: string[];
    fileType: string;
  } | null>(null);
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const handleDrag = (e: React.DragEvent, fileType: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(fileType);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    fileType: "boq" | "breakdown" | "schedule",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFiles((prev) => ({ ...prev, [fileType]: e.dataTransfer.files[0] }));
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "boq" | "breakdown" | "schedule",
  ) => {
    if (e.target.files && e.target.files[0]) {
      setFiles((prev) => ({ ...prev, [fileType]: e.target.files![0] }));
    }
  };

  const handleUpload = async () => {
    if (!files.boq && !files.breakdown && !files.schedule) {
      setError("Please upload at least one file");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await uploadFiles(files, setUploadProgress);

      if (result.status === "success" && result.data) {
        setUploadResult(result.data);
        const activeProjectId = result.data.project_id;
        const activeSessionId = result.data.session_id;
        setCurrentProject({
          id: activeProjectId,
          name: files.boq?.name || "New Project",
          boq_items: result.data.boq_items,
          rate_breakdowns: result.data.rate_breakdowns,
          schedule_tasks: result.data.schedule_tasks,
          critical_path_activities: result.data.critical_path_activities,
        });
        setCurrentSession({
          id: activeSessionId,
          project_id: activeProjectId,
          session_key: result.data.session_key,
          status: "active",
          created_at: new Date().toISOString(),
        });
        upsertSession({
          id: activeSessionId,
          project_id: activeProjectId,
          session_key: result.data.session_key,
          status: "active",
          created_at: new Date().toISOString(),
        });
        setStep(4); // Move to review step
      } else {
        setError(
          result.message ||
            "Upload failed. The server returned an unexpected response.",
        );
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === "object"
          ? detail.message || JSON.stringify(detail)
          : detail || err.message || "Upload failed. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSupportingUpload = async () => {
    if (!uploadResult?.project_id) {
      setError("Upload the core project files first so the system has a project id.");
      return;
    }

    if (!supportingFiles.length) {
      setError("Select at least one supporting file.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await uploadAdditionalFiles(
        uploadResult.project_id,
        supportingType,
        supportingFiles,
      );

      setSupportingUploadSuccess({
        fileNames: supportingFiles.map((file) => file.name),
        fileType: supportingType,
      });

      setSupportingFiles([]);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const errorMsg =
        typeof detail === "object"
          ? detail.message || JSON.stringify(detail)
          : detail || err.message || "Supporting file upload failed.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderFileUploadZone = (
    fileType: "boq" | "breakdown" | "schedule",
    title: string,
    icon: React.ReactNode,
    acceptedFormats: string,
  ) => {
    const file = files[fileType];
    const isActive = dragActive === fileType;

    return (
      <div
        className={`card relative ${isActive ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
        onDragEnter={(e) => handleDrag(e, fileType)}
        onDragLeave={(e) => handleDrag(e, fileType)}
        onDragOver={(e) => handleDrag(e, fileType)}
        onDrop={(e) => handleDrop(e, fileType)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {icon}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          {file && <CheckCircle className="w-6 h-6 text-green-600" />}
        </div>

        {!file ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-1">
                Drag & drop or click to browse
              </p>
              <p className="text-sm text-gray-500">{acceptedFormats}</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept={acceptedFormats}
              onChange={(e) => handleFileChange(e, fileType)}
            />
          </label>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-900">{file.name}</p>
                <p className="text-sm text-green-700">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={() =>
                  setFiles((prev) => ({ ...prev, [fileType]: undefined }))
                }
                className="text-red-600 hover:text-red-800 font-medium text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Step 1: Upload BOQ
            </h2>
            {renderFileUploadZone(
              "boq",
              "Bill of Quantities",
              <FileText className="w-6 h-6 text-blue-600" />,
              ".csv,.xlsx,.xls",
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Step 2: Upload Rate Breakdown
            </h2>
            {renderFileUploadZone(
              "breakdown",
              "Rate Breakdown",
              <DollarSign className="w-6 h-6 text-emerald-600" />,
              ".csv,.xlsx,.xls,.pdf",
            )}
            {files.breakdown?.name.endsWith(".pdf") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  PDF detected. OCR processing will be applied to extract rate
                  data.
                </p>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Step 3: Upload Master Schedule
            </h2>
            {renderFileUploadZone(
              "schedule",
              "Master Program/Schedule",
              <Calendar className="w-6 h-6 text-amber-600" />,
              ".csv,.xlsx,.xls,.xml",
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Upload Complete!
            </h2>

            {uploadResult && (
              <div className="card bg-green-50 border-2 border-green-200">
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-semibold text-green-900">
                    Files Processed Successfully
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">BOQ Items</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {uploadResult.boq_items || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Schedule Tasks</p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {uploadResult.schedule_tasks || 0}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">
                      Critical Activities
                    </p>
                    <p className="text-3xl font-bold text-amber-600">
                      {uploadResult.critical_path_activities || 0}
                    </p>
                  </div>
                </div>

                {uploadResult.processing_notes &&
                  uploadResult.processing_notes.length > 0 && (
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Processing Notes:
                      </h4>
                      <ul className="space-y-1">
                        {uploadResult.processing_notes.map(
                          (note: string, index: number) => (
                            <li
                              key={index}
                              className="text-sm text-gray-700 flex items-start space-x-2"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>{note}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            <div className="card bg-white border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Supporting Documents
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload BSR, HSR, quotation, drawings, specifications, or Engineer’s Instructions. BSR/HSR/quotation files will be parsed into searchable rate sources.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <label className="block text-sm font-medium text-gray-800 md:col-span-1">
                  Document Type
                  <select
                    value={supportingType}
                    onChange={(e) => setSupportingType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                  >
                    <option value="bsr">BSR</option>
                    <option value="hsr">HSR</option>
                    <option value="quotation">Quotation</option>
                    <option value="rate_breakdown">Rate Breakdown</option>
                    <option value="drawing">Drawing</option>
                    <option value="specification">Specification</option>
                    <option value="engineers_instruction">Engineer’s Instruction</option>
                    <option value="master_programme">Master Programme</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-gray-800 md:col-span-2">
                  Files
                  <input
                    type="file"
                    multiple
                    className="mt-1 w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2"
                    accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => setSupportingFiles(Array.from(e.target.files || []))}
                  />
                </label>
              </div>

              {supportingFiles.length > 0 && (
                <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-medium text-gray-900 mb-2">Selected Files</p>
                  <ul className="space-y-1">
                    {supportingFiles.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleSupportingUpload}
                disabled={!supportingFiles.length || loading}
                className="btn-secondary mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload Supporting Files
              </button>

              {supportingUploadSuccess && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900">
                        Supporting documents uploaded successfully.
                      </p>
                      <p className="mt-1 text-sm text-green-700">
                        Document type: {supportingUploadSuccess.fileType}
                      </p>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-green-700">
                        {supportingUploadSuccess.fileNames.map((fileName) => (
                          <li key={fileName}>{fileName}</li>
                        ))}
                      </ul>

                      <p className="mt-2 text-sm text-green-700">
                        These documents will be used as supporting evidence during human confirmation and report generation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate(`/chat/${uploadResult?.project_id}/${uploadResult?.session_id}`)}
              className="btn-primary w-full text-lg flex items-center justify-center space-x-2"
            >
              <MessageSquare className="w-6 h-6" />
              <span>Start Variation Evaluation</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">File Upload</h1>
            <span className="text-sm text-gray-600">Step {step} of 4</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-6 card bg-blue-50 border-2 border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-blue-900">
                Uploading files...
              </span>
              <span className="text-blue-700">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 card bg-red-50 border-2 border-red-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  Upload Error
                </h3>
                {typeof error === "string" ? (
                  <p className="text-red-700">{error}</p>
                ) : (
                  <div className="text-red-700">
                    <p className="font-medium mb-2">{(error as any).message}</p>
                    {Array.isArray((error as any).errors) && (
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {(error as any).errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="mb-8">{renderStep()}</div>

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : navigate("/"))}
              className="btn-secondary flex items-center space-x-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{step > 1 ? "Previous" : "Cancel"}</span>
            </button>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="btn-primary flex items-center space-x-2"
              >
                <span>Next Step</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleUpload}
                disabled={
                  (!files.boq && !files.breakdown && !files.schedule) || loading
                }
                className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px] justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Upload Files</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
