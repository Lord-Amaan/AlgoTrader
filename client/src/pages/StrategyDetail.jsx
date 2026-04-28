import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import api from '../services/api';
import { SkeletonStats } from '../components/Skeleton';

export default function StrategyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const response = await api.get(`/strategies/${id}`);
        setStrategy(response.data.data);
      } catch (err) {
        setError('Failed to load strategy');
        console.error('Error fetching strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStrategy();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
        <SkeletonStats />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <div className="p-6">
        <div className="text-center py-12 border rounded-xl">
          <p className="text-red-500 font-semibold">{error || 'Strategy not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:underline text-sm mt-4 inline-block"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline text-sm mb-3 inline-block"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold">{strategy.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{strategy.description}</p>
      </div>

      {/* Strategy Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Strategy Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-sm">Status</p>
                <p className="font-medium capitalize">{strategy.status || 'Active'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Type</p>
                <p className="font-medium capitalize">{strategy.type || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm">Created</p>
                <p className="font-medium">{new Date(strategy.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/strategy-builder', { state: { strategyId: strategy._id } })}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Edit Strategy
              </button>
              <button
                onClick={() => navigate('/backtest', { state: { strategyId: strategy._id } })}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
              >
                Run Backtest
              </button>
              <button
                onClick={() => navigate('/live', { state: { strategyId: strategy._id } })}
                className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
              >
                Deploy Live
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">Strategy Configuration</h2>
          <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96">
            {JSON.stringify(strategy, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
