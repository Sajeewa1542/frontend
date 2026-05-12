import React, { useState } from "react";
import api from "../services/api";
import { Upload, FileText, CheckCircle } from "lucide-react";

interface UploaderProps {
  onUploadSuccess: (projectId: number) => void;
}

const MultiFileUploader: React.FC<UploaderProps> = ({ onUploadSuccess }) => {
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [breakdownFile, setBreakdownFile] = useState<File | null>(null);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleUpload = async () => {
    if (!boqFile || !breakdownFile || !scheduleFile) {
      setStatus("Please select all 3 files.");
      return;
    }

    const formData = new FormData();
    formData.append("boq", boqFile);
    formData.append("breakdown", breakdownFile);
    formData.append("schedule", scheduleFile);

    try {
      setStatus("Uploading...");
      const res = await api.post("/upload/files", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.status === "success") {
        setStatus("Upload Successful!");
        onUploadSuccess(res.data.data.project_id);
      } else {
        setStatus(`Upload Failed: ${res.data.message || "Unknown error"}`);
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || error.message;
      setStatus(`Upload Failed: ${msg}`);
    }
  };

  const FileInput = ({
    label,
    file,
    setFile,
    accept,
  }: {
    label: string;
    file: File | null;
    setFile: (f: File) => void;
    accept: string;
  }) => (
    <div className="border border-gray-300 p-4 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-white transition-colors">
      <label className="cursor-pointer flex flex-col items-center">
        {file ? (
          <CheckCircle className="text-green-500 mb-2" />
        ) : (
          <Upload className="text-gray-400 mb-2" />
        )}
        <span className="text-sm font-medium text-gray-700 text-center">
          {label}
        </span>
        <span className="text-xs text-gray-500 mt-1">
          {file ? file.name : "Click to select"}
        </span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => e.target.files && setFile(e.target.files[0])}
          accept={accept}
        />
      </label>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" /> Project Documents
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <FileInput
          label="BOQ File (Excel)"
          file={boqFile}
          setFile={setBoqFile}
          accept=".xlsx,.xls"
        />
        <FileInput
          label="Rate Breakdown (CSV)"
          file={breakdownFile}
          setFile={setBreakdownFile}
          accept=".csv"
        />
        <FileInput
          label="Schedule (CSV/XML)"
          file={scheduleFile}
          setFile={setScheduleFile}
          accept=".csv,.xml"
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className={`text-sm ${status.includes("Success") ? "text-green-600" : "text-red-500"}`}
        >
          {status}
        </span>
        <button
          onClick={handleUpload}
          disabled={!boqFile || !breakdownFile || !scheduleFile}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Upload All Files
        </button>
      </div>
    </div>
  );
};

export default MultiFileUploader;
