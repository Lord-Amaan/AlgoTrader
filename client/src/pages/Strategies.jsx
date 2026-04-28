import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { strategyService } from '../services/strategyService';
import StrategyModal from '../components/StrategyModal';
import { SkeletonStrategyList } from '../components/Skeleton';

export default function Strategies() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useAuth();
  const [listLoading, setListLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [cloneLoadingId, setCloneLoadingId] = useState('');
  const [status, setStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [strategies, setStrategies] = useState([]);
  const [strategyNotes, setStrategyNotes] = useState({});
  const [templates, setTemplates] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [strategyToOpen, setStrategyToOpen] = useState(null);

  const loadUserStrategies = async () => {
    const response = await strategyService.getAll();
    setStrategies(response?.data?.data || []);
  };

  const loadAllStrategies = async () => {
    try {
      setListLoading(true);
      setTemplatesLoading(true);
      setStatus('');
      const [userResponse, templatesResponse] = await Promise.all([
        strategyService.getAll(),
        strategyService.getTemplates(),
      ]);
      setStrategies(userResponse?.data?.data || []);
      setTemplates(templatesResponse?.data?.data || []);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Failed to load strategies');
    } finally {
      setListLoading(false);
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadAllStrategies();
    // Check if we came from dashboard with a strategy to open
    if (location.state?.strategyId) {
      setStrategyToOpen(location.state.strategyId);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('algoroom_strategy_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setStrategyNotes(parsed);
        }
      }
    } catch (error) {
      // Ignore invalid saved notes payload.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('algoroom_strategy_notes', JSON.stringify(strategyNotes));
  }, [strategyNotes]);

  // Auto-open modal if we have a strategy to open and strategies are loaded
  useEffect(() => {
    if (strategyToOpen && strategies.length > 0) {
      const strategy = strategies.find((s) => s._id === strategyToOpen);
      if (strategy) {
        setSelectedStrategy(strategy);
        setIsModalOpen(true);
        setStrategyToOpen(null); // Clear it so it doesn't open again
      }
    }
  }, [strategyToOpen, strategies]);

  const handleCardClick = (strategy) => {
    setSelectedStrategy(strategy);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStrategy(null);
  };

  const handleEditClick = () => {
    if (selectedStrategy) {
      navigate(`/strategy-builder?edit=${selectedStrategy._id}`);
    }
  };

  const handleDeleteClick = async () => {
    if (!selectedStrategy) return;
    try {
      await strategyService.delete(selectedStrategy._id);
      setStatus('Strategy deleted successfully');
      handleCloseModal();
      loadUserStrategies();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Failed to delete strategy');
    }
  };

  const handleDuplicateClick = async () => {
    if (!selectedStrategy) return;
    try {
      const newName = `Copy of ${selectedStrategy.name}`;
      const payload = {
        name: newName,
        strategyType: selectedStrategy.strategyType,
        instruments: selectedStrategy.instruments || [],
        orderConfig: selectedStrategy.orderConfig,
        legs: selectedStrategy.legs || [],
        riskManagement: selectedStrategy.riskManagement,
        advanceFeatures: selectedStrategy.advanceFeatures,
      };
      await strategyService.create(payload);
      setStatus('Strategy duplicated successfully');
      loadUserStrategies();
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Failed to duplicate strategy');
    }
  };

  const handleCloneTemplate = async (template) => {
    try {
      setCloneLoadingId(template._id || template.name);
      setStatus('');

      const { _id, isPrebuilt, createdAt, updatedAt, ...rest } = template;
      const clonePayload = {
        ...rest,
        userId,
      };

      await strategyService.create(clonePayload);
      await loadUserStrategies();
      setStatus(`Template "${template.name}" cloned successfully`);
    } catch (error) {
      setStatus(error?.response?.data?.error || 'Failed to clone template');
    } finally {
      setCloneLoadingId('');
    }
  };

  const handleBacktestClick = () => {
    if (selectedStrategy) {
      navigate(`/backtesting?strategyId=${selectedStrategy._id}`);
    }
  };

  const handleDeployClick = () => {
    if (selectedStrategy) {
      navigate(`/live?strategyId=${selectedStrategy._id}`);
    }
  };

  const updateStrategyNote = (strategyId, value) => {
    setStrategyNotes((prev) => ({
      ...prev,
      [strategyId]: value,
    }));
  };

  const filteredStrategies = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return strategies;
    }

    return strategies.filter((strategy) => {
      const byName = strategy?.name?.toLowerCase().includes(query);
      const byType = strategy?.strategyType?.toLowerCase().includes(query);
      const byInstrument = Array.isArray(strategy?.instruments)
        ? strategy.instruments.some((symbol) => symbol.toLowerCase().includes(query))
        : false;
      return byName || byType || byInstrument;
    });
  }, [searchText, strategies]);

  const clonedTemplateNames = useMemo(() => {
    return new Set((strategies || []).map((strategy) => (strategy?.name || '').trim().toLowerCase()));
  }, [strategies]);

  const categoryBadgeClasses = {
    NEUTRAL: 'border-[#d7dee8] bg-[#f4f6f8] text-[#516075]',
    BULLISH: 'border-[#b8e2c5] bg-[#eaf8ef] text-[#1f7a3f]',
    BEARISH: 'border-[#f1c1c1] bg-[#fdeeee] text-[#a73636]',
    VOLATILE: 'border-[#f0da9f] bg-[#fff8e8] text-[#96660a]',
  };

  const riskBadgeClasses = {
    LOW: 'border-[#c7dae9] bg-[#eef5fb] text-[#31556f]',
    MEDIUM: 'border-[#d6cbe9] bg-[#f4f0fb] text-[#5d3a86]',
    HIGH: 'border-[#efc5d2] bg-[#fdf0f4] text-[#943c59]',
  };

  return (
    <div className="relative min-h-full rounded-3xl bg-gradient-to-br from-[#f8fbff] via-[#f4f6fb] to-[#eef1f8] p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-16 -right-14 h-56 w-56 rounded-full bg-[#d9ebff] opacity-70 blur-3xl" />
        <div className="absolute bottom-2 left-8 h-56 w-56 rounded-full bg-[#fde8cf] opacity-60 blur-3xl" />
      </div>

      <section className="relative rounded-2xl border border-[#dce4f0] bg-white/95 p-4 shadow-[0_8px_28px_rgba(21,36,61,0.06)]">
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-[#1d2838]">Prebuilt Strategies</h2>
          <p className="mt-1 text-sm text-[#5f6d80]">Clone curated templates into your account and customize them.</p>
        </div>

        {templatesLoading && <SkeletonStrategyList />}
        {!templatesLoading && !templates.length && (
          <p className="text-sm text-[#61718a]">No prebuilt templates available.</p>
        )}

        {!templatesLoading && templates.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => {
              const templateNameKey = (template?.name || '').trim().toLowerCase();
              const alreadyAdded = clonedTemplateNames.has(templateNameKey);
              const cloneButtonLabel = alreadyAdded
                ? 'Already Added'
                : cloneLoadingId === (template._id || template.name)
                  ? 'Cloning...'
                  : 'Clone to My Strategies';

              return (
                <article
                  key={template._id || template.name}
                  className="rounded-xl border border-[#d7e1ef] bg-[#f8fbff] p-3"
                >
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-[#24466f]">{template.name || 'Untitled Template'}</h3>
                    <p className="mt-1 text-xs text-[#6d7f97]">{template.description || 'No description provided.'}</p>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses[template.category] || categoryBadgeClasses.NEUTRAL}`}
                    >
                      {template.category || 'NEUTRAL'}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskBadgeClasses[template.riskProfile] || riskBadgeClasses.MEDIUM}`}
                    >
                      {template.riskProfile || 'MEDIUM'}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {(template?.instruments || []).map((symbol) => (
                      <span key={symbol} className="rounded-full border border-[#c7d9f2] bg-[#edf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#3a6293]">
                        {symbol}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={alreadyAdded || cloneLoadingId === (template._id || template.name)}
                    onClick={() => handleCloneTemplate(template)}
                    className="rounded-md border border-[#2f6fbc] bg-[#2f6fbc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#255f9f] disabled:cursor-not-allowed disabled:border-[#d2d9e2] disabled:bg-[#eef1f5] disabled:text-[#7a8797]"
                  >
                    {cloneButtonLabel}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="relative mt-4 rounded-2xl border border-[#dce4f0] bg-white/95 p-4 shadow-[0_8px_28px_rgba(21,36,61,0.06)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1d2838]">My Strategies</h1>
            <p className="mt-1 text-sm text-[#5f6d80]">View all created strategies and edit them in the builder.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAllStrategies}
              className="rounded-md border border-[#d2deee] bg-white px-3 py-1.5 text-xs font-semibold text-[#536c8f] hover:bg-[#f3f7ff]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate('/strategy-builder')}
              className="rounded-md border border-[#2f6fbc] bg-[#2f6fbc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#255f9f]"
            >
              + New Strategy
            </button>
          </div>
        </div>

        <div className="mb-4">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by name, type or instrument"
            className="h-10 w-full rounded-lg border border-[#cedaec] bg-[#f5f8ff] px-3 text-sm text-[#1d2838] outline-none ring-[#8caad8] focus:ring"
          />
        </div>

        {status ? <p className="mb-3 text-sm font-semibold text-[#8c3f3f]">{status}</p> : null}
        
        {listLoading && <SkeletonStrategyList />}
        {!listLoading && !filteredStrategies.length && <p className="text-sm text-[#61718a]">No strategies found.</p>}

        {!listLoading && filteredStrategies.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredStrategies.map((strategy) => (
            <article
              key={strategy._id}
              onClick={() => handleCardClick(strategy)}
              className="cursor-pointer rounded-xl border border-[#d7e1ef] bg-[#f8fbff] p-3 transition hover:border-[#99b5dd] hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#24466f]">{strategy.name || 'Untitled Strategy'}</h3>
                  <p className="mt-0.5 text-xs text-[#6d7f97]">{strategy.strategyType || 'TIME_BASED'}</p>
                </div>
              </div>

              <p className="mb-2 text-xs text-[#71849d]">Legs: {strategy?.legs?.length || 0}</p>

              <div className="mb-2 rounded-lg border border-[#d7e2f0] bg-white/80 px-2 py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#73859f]">
                  Strategy Note (click to edit)
                </p>
                <textarea
                  value={strategyNotes[strategy._id] || ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateStrategyNote(strategy._id, event.target.value)}
                  placeholder="Write a quick explanation for this strategy..."
                  className="h-20 w-full resize-none rounded-md border border-[#d6e1ef] bg-white px-2 py-1.5 text-xs text-[#344a66] outline-none ring-[#8caad8] focus:ring"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(strategy?.instruments || []).slice(0, 4).map((symbol) => (
                  <span key={symbol} className="rounded-full border border-[#c7d9f2] bg-[#edf4ff] px-2.5 py-1 text-[11px] font-semibold text-[#3a6293]">
                    {symbol}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
        )}
      </section>

      <StrategyModal
        strategy={selectedStrategy}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onEdit={handleEditClick}
        onDelete={handleDeleteClick}
        onDuplicate={handleDuplicateClick}
        onBacktest={handleBacktestClick}
        onDeploy={handleDeployClick}
      />
    </div>
  );
}