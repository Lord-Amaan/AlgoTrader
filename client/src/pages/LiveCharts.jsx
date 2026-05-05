import { useEffect, useMemo, useState } from 'react';
import { marketService } from '../services/strategyService';
import TradingViewChart from '../components/TradingViewChart';

const RANGES = ['1D', '1W', '1M', '3M', '1Y'];

function toPath(values, width = 100, height = 42) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function toArea(values, width = 100, height = 42) {
  if (!values?.length) return '';
  const line = toPath(values, width, height);
  return `${line} L ${width} ${height} L 0 ${height} Z`;
}

export default function LiveCharts() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  const [selectedRange, setSelectedRange] = useState('1D');
  const [detailBySymbol, setDetailBySymbol] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const loadSearch = async ({ reset = false } = {}) => {
    try {
      setLoadingList(true);
      setError('');
      const cursor = reset ? 0 : nextCursor || 0;
      const response = await marketService.search({
        q: debouncedQuery,
        cursor,
        limit: 24,
      });

      const payload = response?.data?.data || {};
      const fetched = payload.items || [];

      setItems((prev) => (reset ? fetched : [...prev, ...fetched]));
      setNextCursor(payload.nextCursor);
      setTotal(payload.total || fetched.length);

      if (reset && fetched.length) {
        setSelectedSymbol((current) => {
          const exists = fetched.some((item) => item.symbol === current);
          return exists ? current : fetched[0].symbol;
        });
      }
    } catch (loadErr) {
      setError(loadErr?.response?.data?.error || 'Failed to load market symbols');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSearch({ reset: true });
  }, [debouncedQuery]);

  useEffect(() => {
    if (!selectedSymbol) return;

    let cancelled = false;

    const loadDetail = async () => {
      try {
        if (!detailBySymbol[selectedSymbol]) {
          setDetailLoading(true);
        }
        setError('');
        const response = await marketService.getBySymbol(selectedSymbol);
        const detail = response?.data?.data;
        if (!cancelled && detail) {
          setDetailBySymbol((prev) => ({
            ...prev,
            [selectedSymbol]: detail,
          }));
        }
      } catch (loadErr) {
        setError(loadErr?.response?.data?.error || 'Failed to load stock details');
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();

    const intervalId = setInterval(() => {
      loadDetail();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedSymbol]);

  const selectedDetail = detailBySymbol[selectedSymbol];
  const chartValues = selectedDetail?.charts?.[selectedRange] || [];
  const chartPath = useMemo(() => toPath(chartValues), [chartValues]);
  const chartArea = useMemo(() => toArea(chartValues), [chartValues]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#dce4f0] bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#1d2838]">Live Charts</h1>
        <p className="mt-1 text-sm text-[#5f6d80]">
          Apple-style market screen with fast search, paged loading, and detailed symbol view.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-[#dce4f0] bg-white p-4 shadow-sm">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbols or company name"
            className="h-10 w-full rounded-lg border border-[#cedaec] bg-[#f5f8ff] px-3 text-sm outline-none focus:ring-2 focus:ring-[#a8c1e5]"
          />
          <p className="mt-2 text-xs text-[#6d7f97]">Showing {items.length} of {total} symbols</p>

          <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => setSelectedSymbol(item.symbol)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  item.symbol === selectedSymbol
                    ? 'border-[#97b7df] bg-[#ebf4ff]'
                    : 'border-[#dce4f0] bg-white hover:bg-[#f7faff]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#26466c]">{item.symbol}</p>
                    <p className="text-xs text-[#6d7f97] line-clamp-1">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1f3653]">{Number(item.price).toLocaleString('en-IN')}</p>
                    <p className={`text-xs font-semibold ${item.changePct >= 0 ? 'text-[#1f7a3f]' : 'text-[#a73636]'}`}>
                      {item.changePct >= 0 ? '+' : ''}
                      {Number(item.changePct).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {nextCursor != null ? (
            <button
              type="button"
              disabled={loadingList}
              onClick={() => loadSearch({ reset: false })}
              className="mt-3 w-full rounded-lg border border-[#bfd2ea] bg-[#eef5ff] px-3 py-2 text-sm font-semibold text-[#2c588b] hover:bg-[#e4efff] disabled:opacity-60"
            >
              {loadingList ? 'Loading...' : 'Load More'}
            </button>
          ) : null}
        </aside>

        <article className="rounded-2xl border border-[#dce4f0] bg-white p-5 shadow-sm">
          {detailLoading && !selectedDetail ? <p className="text-sm text-[#6d7f97]">Loading stock details...</p> : null}

          {selectedDetail ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-[#6d7f97]">{selectedDetail.exchange}</p>
                  <h2 className="text-2xl font-semibold text-[#1d2838]">{selectedDetail.symbol}</h2>
                  <p className="text-sm text-[#5f6d80]">{selectedDetail.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold text-[#1f3653]">
                    {Number(selectedDetail.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm font-semibold ${selectedDetail.changePct >= 0 ? 'text-[#1f7a3f]' : 'text-[#a73636]'}`}>
                    {selectedDetail.change >= 0 ? '+' : ''}{selectedDetail.change.toFixed(2)} ({selectedDetail.changePct.toFixed(2)}%)
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#d7e5f5] bg-[#f9fcff] p-3">
                <TradingViewChart symbol={selectedDetail.symbol} interval="1D" height={320} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedRange(range)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      selectedRange === range
                        ? 'border-[#2f6fbc] bg-[#2f6fbc] text-white'
                        : 'border-[#cddaea] bg-white text-[#4a678d] hover:bg-[#f1f6ff]'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">Open</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.open.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">High</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.high.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">Low</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.low.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">Prev Close</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.previousClose.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">Volume</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.volume.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-xl border border-[#dce4f0] bg-[#fafcff] p-3">
                  <p className="text-xs text-[#6d7f97]">Market Cap (Cr)</p>
                  <p className="text-sm font-semibold text-[#1f3653]">{selectedDetail.marketCapCr.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#6d7f97]">Select a symbol to view details.</p>
          )}
        </article>
      </section>
    </div>
  );
}
