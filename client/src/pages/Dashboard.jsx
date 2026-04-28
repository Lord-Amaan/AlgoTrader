import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react'; 
import api from '../services/api';
import { SkeletonStats, SkeletonStrategyList } from '../components/Skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
   
  const { getToken } = useAuth(); // ← add this

  // ⬇️ add this block temporarily
  useEffect(() => {
    const logToken = async () => {
      const token = await getToken()
      console.log('🔑 TOKEN:', token)
    }
    logToken()
  }, [])

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        const response = await api.get('/strategies');
        setStrategies(response.data.data); // { success: true, data: [...] }
      } catch (err) {
        setError('Failed to fetch strategies');
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, []);

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.firstName || 'Trader'} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here's your trading overview
        </p>
      </div>

      {/* Stats Row */}
      {loading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-gray-500 text-sm">Total Strategies</p>
            <p className="text-2xl font-bold mt-1">{strategies.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-gray-500 text-sm">Active Strategies</p>
            <p className="text-2xl font-bold mt-1">
              {strategies?.filter(s => s.isActive === true).length || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-gray-500 text-sm">Total Legs</p>
            <p className="text-2xl font-bold mt-1">
              {strategies.reduce((acc, s) => acc + (s.legs?.length || 0), 0)}
            </p>
          </div>
        </div>
      )}

      {/* Strategies List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Your Strategies</h2>
          <button
            onClick={() => navigate('/strategy-builder')}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + New Strategy
          </button>
        </div>

        {/* Loading */}
        {loading && <SkeletonStrategyList />}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && strategies.length === 0 && (
          <div className="text-center py-12 border rounded-xl">
            <p className="text-gray-400">No strategies yet</p>
            <button
              onClick={() => navigate('/strategy-builder')}
              className="text-blue-600 text-sm mt-2 inline-block hover:underline"
            >
              Create your first strategy
            </button>
          </div>
        )}

        {/* Strategy Cards */}
        {!loading && !error && strategies.length > 0 && (
          <div className="grid grid-cols-1 gap-3">
            {strategies.map((strategy) => (
              <div
                key={strategy._id}
                className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/strategies/${strategy._id}`)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{strategy.name || 'Unnamed Strategy'}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {strategy.strategyType || 'No type'} • {strategy.legs?.length || 0} legs
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    strategy.orderConfig?.type === 'MIS'
                      ? 'bg-blue-100 text-blue-700'
                      : strategy.orderConfig?.type === 'CNC'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {strategy.orderConfig?.type || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
