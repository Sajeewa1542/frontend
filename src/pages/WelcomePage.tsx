import { useNavigate } from "react-router-dom";
import {
  FileText,
  Upload,
  MessageSquare,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

const WelcomePage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Upload className="w-8 h-8 text-blue-600" />,
      title: "Multi-File Upload",
      description: "Upload BOQ, Rate Breakdown, and Master Schedule in one go",
    },
    {
      icon: <MessageSquare className="w-8 h-8 text-emerald-600" />,
      title: "ML-Assisted Extraction",
      description: "Candidate matching and extraction from documents and variation descriptions",
    },
    {
      icon: <TrendingUp className="w-8 h-8 text-amber-600" />,
      title: "TF-IDF Matching",
      description: "Semantic similarity matching for BOQ items and rates",
    },
    {
      icon: <CheckCircle className="w-8 h-8 text-green-600" />,
      title: "Rule-Based Calculation",
      description: "Deterministic cost/time formulas with full audit trail",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
              Hybrid Rule-Based & ML-Assisted Variation Evaluation
            </h1>
            </div>
            <button
              onClick={() => navigate("/sessions")}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              My Sessions
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full text-center">
          <div className="mb-8">
            <h2 className="text-5xl font-extrabold text-gray-900 mb-4">
              Professional FIDIC-Compliant
              <span className="block text-blue-600 mt-2">
                Variation Assessment
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional FIDIC-compliant variation evaluation combining 
              ML-assisted extraction with deterministic rule-based cost and time evaluation
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => navigate("/upload")}
            className="btn-primary text-lg px-8 py-4 mb-12 inline-flex items-center space-x-2"
          >
            <Upload className="w-6 h-6" />
            <span>Start New Evaluation</span>
          </button>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {features.map((feature, index) => (
              <div key={index} className="card text-left">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* FIDIC Types Overview */}
          <div className="mt-16 bg-white rounded-xl shadow-md p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Supported FIDIC Variation Types
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              {[
                "Type 1: Quantity Changes",
                "Type 2: Quality/Characteristics Changes",
                "Type 3: Levels/Positions/Dimensions Changes",
                "Type 4: Omission of Work",
                "Type 5: Additional Work/Plant/Materials",
                "Type 6: Sequence/Timing Changes",
              ].map((type, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Hybrid Rule-Based and ML-Assisted Variation Evaluation Prototype v2.0.0
          </p>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;
