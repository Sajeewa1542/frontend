import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import {
  downloadPdf,
  downloadDocx,
  downloadReportByUrl,
  generateVariationDocx,
  getVariation,
} from "../services/api";

const formatMoney = (value: any) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const ProposalPage = () => {
  const { variationId, projectId } = useParams<{
    variationId: string;
    projectId: string;
  }>();

  const navigate = useNavigate();
  const [variation, setVariation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadVariation = async () => {
    if (!variationId || !projectId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getVariation(Number(projectId), Number(variationId));
      setVariation(data);
    } catch (err) {
      setError("Failed to load variation results");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVariation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationId, projectId]);

  const handleDownloadPDF = async () => {
    if (!variation?.pdf_url) {
      setError("PDF report is not available for this variation.");
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      await downloadPdf(variation.pdf_url, `Variation_Proposal_${variationId}.pdf`);
    } catch (err) {
      setError("Failed to download PDF");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!projectId || !variationId) return;

    setDownloading(true);
    setError(null);

    try {
      if (variation?.docx_url) {
        await downloadReportByUrl(
          variation.docx_url,
          `Variation_Proposal_${variationId}.docx`,
        );
      } else {
        const blob = await generateVariationDocx(
          Number(projectId),
          Number(variationId),
        );
        await downloadDocx(blob, `Variation_Proposal_${variationId}.docx`);
      }
    } catch (err) {
      setError("Failed to download editable Word report");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleEditAndRecalculate = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-600">
        Loading variation results...
      </div>
    );
  }

  if (!variation) {
    return (
      <div className="p-8 text-center text-red-600">
        Variation not found.
      </div>
    );
  }

  const costLines = variation.cost_lines || [];
  const timeImpact = variation.time_impact || {};
  const validation = variation.validation || {};
  const totalCost = Number(variation.total_cost_impact || 0);
  const usedRateSources =
    variation.used_rate_sources || variation.rate_sources || [];

  const cpmProof = Boolean(timeImpact.cpm_proof);
  const timeManualRequired = Boolean(timeImpact.manual_required);
  const additionalDuration = Number(timeImpact.additional_duration || 0);
  const eotDays = Number(timeImpact.eot_days || 0);

  const timeSummary = timeManualRequired
    ? timeImpact.message ||
      "Time impact cannot be finalised because activity mapping/productivity is missing."
    : !cpmProof
      ? `Additional duration is ${additionalDuration.toFixed(
          2,
        )} days. EOT is not finalised because CPM proof is not available.`
      : `EOT: ${eotDays.toFixed(2)} days`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-12">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Variation Result
                </h1>
                <p className="text-sm text-gray-600">
                  Project {projectId} • Variation #{variation.id}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={loadVariation}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleEditAndRecalculate}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Edit and Recalculate</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={!variation.pdf_url || downloading}
                className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-5 w-5" />
                <span>{downloading ? "Downloading..." : "Download PDF"}</span>
              </button>

              <button
                onClick={handleDownloadDocx}
                disabled={downloading}
                className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileText className="h-5 w-5" />
                <span>
                  {downloading ? "Downloading..." : "Download Editable Word Report"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <section className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {variation.variation_type}
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {variation.evaluation_mode}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800">
              {variation.status}
            </span>
          </div>

          <p className="text-sm text-gray-700">
            {variation.original_description ||
              variation.replacement_description ||
              variation.description ||
              "Confirmed variation result"}
          </p>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <strong>Disclaimer:</strong> ML-assisted extraction only. Final cost
            and time calculation is rule-based and requires QS / Engineer
            verification.
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="card bg-blue-50">
            <div className="mb-2 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <h2 className="text-sm font-medium text-gray-600">
                Total Cost Impact
              </h2>
            </div>
            <p className="text-3xl font-bold text-blue-700">
              {formatMoney(totalCost)}
            </p>
          </div>

          <div className="card bg-emerald-50">
            <div className="mb-2 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <h2 className="text-sm font-medium text-gray-600">
                Time Impact / EOT
              </h2>
            </div>

            {timeManualRequired || !cpmProof ? (
              <p className="text-sm text-gray-700">{timeSummary}</p>
            ) : (
              <p className="text-3xl font-bold text-emerald-700">
                {eotDays.toFixed(2)} days
              </p>
            )}
          </div>

          <div className="card bg-gray-50">
            <h2 className="mb-2 text-sm font-medium text-gray-600">
              Validation
            </h2>
            <p className="text-sm text-gray-700">
              {validation.valid ? "Valid" : "Review required"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {validation.warnings?.length || 0} warnings
            </p>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Cost Lines</h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Formula
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {costLines.length > 0 ? (
                  costLines.map((line: any, index: number) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-700">
                        {line.line_type}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {line.description}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {Number(line.quantity || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {line.unit || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatMoney(line.rate)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          Number(line.amount || 0) >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {formatMoney(line.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {line.formula}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-gray-500"
                      colSpan={7}
                    >
                      No cost lines available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Time Impact / CPM
            </h2>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Activity:</span>{" "}
                {timeImpact.activity_name || timeImpact.activity_ref || "-"}
              </p>
              <p>
                <span className="font-semibold">Productivity:</span>{" "}
                {timeImpact.productivity ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Additional Duration:</span>{" "}
                {additionalDuration.toFixed(2)} days
              </p>
              <p>
                <span className="font-semibold">Original Float:</span>{" "}
                {Number(timeImpact.original_float || 0).toFixed(2)} days
              </p>
              <p>
                <span className="font-semibold">Delay Absorbed:</span>{" "}
                {timeImpact.delay_absorbed_by_float ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold">Critical Activity:</span>{" "}
                {timeImpact.is_critical ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold">CPM Proof:</span>{" "}
                {cpmProof ? "Available" : "Not available"}
              </p>
              <p>
                <span className="font-semibold">EOT Days:</span>{" "}
                {cpmProof ? `${eotDays.toFixed(2)} days` : "Not finalised"}
              </p>
              <p>
                <span className="font-semibold">Formula:</span>{" "}
                {timeImpact.formula || "-"}
              </p>

              {timeImpact.message ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                  {timeImpact.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="card">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Rate Source Evidence Used
            </h2>

            {usedRateSources.length ? (
              <div className="space-y-3 text-sm">
                {usedRateSources.map((source: any, index: number) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <p className="font-semibold text-gray-900">
                      {source.source_type || "Confirmed source"}{" "}
                      {source.item_reference ? `• ${source.item_reference}` : ""}
                    </p>
                    <p className="text-gray-700">{source.description}</p>
                    <p className="text-gray-600">
                      Unit: {source.unit || "-"} • Rate: {formatMoney(source.rate)}
                    </p>
                    <p className="text-gray-500">
                      Confidence: {source.confidence || "Human confirmed"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No rate source evidence recorded.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Validation Warnings
          </h2>

          {validation.warnings?.length ? (
            <ul className="space-y-2 text-sm text-gray-700">
              {validation.warnings.map((warning: string, index: number) => (
                <li
                  key={index}
                  className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900"
                >
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No validation warnings.</p>
          )}

          {validation.errors?.length ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-red-700">
                Errors
              </h3>
              <ul className="space-y-2 text-sm text-red-700">
                {validation.errors.map((errorItem: string, index: number) => (
                  <li
                    key={index}
                    className="rounded-lg bg-red-50 px-3 py-2"
                  >
                    {errorItem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default ProposalPage;