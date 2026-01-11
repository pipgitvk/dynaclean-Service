"use client";

import { useState, useEffect } from "react";

export default function FeedbackViewer() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterServiceId, setFilterServiceId] = useState("");

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const url = filterServiceId 
        ? `/api/feedback/view?service_id=${filterServiceId}`
        : '/api/feedback/view';
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "success") {
        setFeedbacks(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to fetch feedbacks");
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchFeedbacks();
  };

  const clearFilter = () => {
    setFilterServiceId("");
    fetchFeedbacks();
  };

  const getRatingStars = (rating) => {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Feedback</h1>
          
          {/* Filter Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-4 items-end">
              <div>
                <label htmlFor="serviceId" className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Service ID
                </label>
                <input
                  type="text"
                  id="serviceId"
                  value={filterServiceId}
                  onChange={(e) => setFilterServiceId(e.target.value)}
                  placeholder="Enter Service ID"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleFilter}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Filter
              </button>
              <button
                onClick={clearFilter}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Clear
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading feedbacks...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600">No feedback submissions found.</p>
                </div>
              ) : (
                feedbacks.map((feedback) => (
                  <div key={feedback.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{feedback.name}</h3>
                        <p className="text-sm text-gray-600">{feedback.state}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getRatingColor(feedback.rating)}`}>
                          {getRatingStars(feedback.rating)}
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(feedback.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-gray-700">{feedback.description}</p>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Service ID: {feedback.service_id}</span>
                      <span>ID: {feedback.id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
