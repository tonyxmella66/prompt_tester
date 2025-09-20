import { useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';
import LoginForm from './LoginForm';

// Constants - Updated to match backend models
const MODELS = [
  "gpt-4",
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4.5-preview",
  // Reasoning
  "o1-preview",
  "o1-mini",
  "o1",
  "o3-mini",
  "o3",
  "o3-pro",
  "o4-mini",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano"
];

// Form Component
function PromptForm({ 
  prompt, 
  setPrompt, 
  model, 
  setModel, 
  temperature, 
  setTemperature, 
  webSearch, 
  setWebSearch, 
  onSubmit 
}) {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-blue-600 mb-6">Test Configuration</h2>
      
      <div className="space-y-4">
        {/* Collapsible Configuration Section */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => setIsConfigExpanded(!isConfigExpanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-medium text-gray-700">Configuration Settings</span>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                isConfigExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isConfigExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-200">
              <FormField label="Model">
                <select
                  className="w-full border-gray-300 rounded-md shadow-sm"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS.map(modelName => (
                    <option key={modelName} value={modelName}>{modelName}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Temperature">
                <input
                  type="text"
                  className="w-full border-gray-300 rounded-md shadow-sm"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="1.0"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Temperature must be between 0.0-2.0
                </p>
              </FormField>

              <FormField label="Web Search">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="webSearch"
                    className="mr-2"
                    checked={webSearch}
                    onChange={(e) => setWebSearch(e.target.checked)}
                  />
                  <label htmlFor="webSearch" className="text-gray-700">
                    Enable web search
                  </label>
                </div>
              </FormField>
            </div>
          )}
        </div>

        <FormField label="Prompt">
          <textarea
            className="w-full h-64 border-gray-300 rounded-md shadow-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
          />
        </FormField>

        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          onClick={onSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

// Form Field Component
function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-gray-700 mb-2">{label}</label>
      {children}
    </div>
  );
}

// Helper function to extract text content from response
function extractTextFromResponse(responseData) {
  if (!responseData?.output || !Array.isArray(responseData.output)) {
    return 'No text content found';
  }

  // Find the output entry with non-null content
  const messageEntry = responseData.output.find(entry => 
    entry.type === 'message' && 
    entry.content && 
    Array.isArray(entry.content) &&
    entry.content.length > 0
  );

  if (messageEntry && messageEntry.content[0]?.text) {
    return messageEntry.content[0].text;
  }

  return 'No text content found';
}

// Response Component
function ResponseDisplay({ response, isLoading }) {
  const [activeTab, setActiveTab] = useState('text');

  const getTextContent = () => {
    if (isLoading) return 'Response loading...';
    if (!response?.data) return 'No response yet';
    return extractTextFromResponse(response.data);
  };

  const getJsonContent = () => {
    if (isLoading) return 'Response loading...';
    if (!response?.data) return 'No response yet';
    return JSON.stringify(response.data, null, 2);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-blue-600 mb-6">Response</h2>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('text')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'text'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Text
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'json'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          JSON
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[calc(100vh-200px)]">
        {activeTab === 'text' ? (
          <div className="whitespace-pre-wrap text-gray-900">
            {getTextContent()}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-gray-900">
            {getJsonContent()}
          </pre>
        )}
      </div>
      
      {response?.error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
          <strong>Error:</strong> {response.error}
        </div>
      )}
    </div>
  );
}

// Main App Component
function App() {
  const { user, loading, signOut } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [temperature, setTemperature] = useState('1.0');
  const [webSearch, setWebSearch] = useState(false);
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setResponse(null);
    try {
      // Get the current session and access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session. Please log in again.');
      }

      const url = import.meta.env.VITE_INVOKE_MODEL_ENDPOINT;
      const payload = { 
        prompt, 
        model, 
        temperature: Number(temperature), 
        web_search: webSearch 
      };

      const result = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      setResponse({ data: result.data, error: null });
    } catch (error) {
      setResponse({ data: null, error: error.response?.data?.detail || error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with user info and logout */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Prompt Tester</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              Welcome, {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 gap-8">
          <PromptForm
            prompt={prompt}
            setPrompt={setPrompt}
            model={model}
            setModel={setModel}
            temperature={temperature}
            setTemperature={setTemperature}
            webSearch={webSearch}
            setWebSearch={setWebSearch}
            onSubmit={handleSubmit}
          />
          
          <ResponseDisplay response={response} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default App;
