import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/strategy-builder', label: 'Strategy Builder' },
  { to: '/strategies', label: 'Strategies' },
  { to: '/backtest', label: 'Backtesting' },
  { to: '/live-charts', label: 'Live Charts' },
  { to: '/live', label: 'Live Trading' },
];

const BASE_PRICES = {
  NIFTY: 24620,
  SENSEX: 81040,
  FINNIFTY: 23540,
};

function buildTick(symbol, tick) {
  const base = BASE_PRICES[symbol];
  const waveA = Math.sin((tick + symbol.length) / 3.8) * (base * 0.0015);
  const waveB = Math.sin((tick + symbol.length * 2) / 6.2) * (base * 0.0009);
  const price = Math.max(1, base + waveA + waveB);
  const pct = ((price - base) / base) * 100;
  return {
    symbol,
    price,
    pct,
  };
}

export default function Sidebar() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 2500);

    return () => clearInterval(intervalId);
  }, []);

  const marketCards = useMemo(() => {
    return ['NIFTY', 'SENSEX', 'FINNIFTY'].map((symbol) => buildTick(symbol, tick));
  }, [tick]);

  return (
    <aside className="w-full border-b border-[#dfe6f2] bg-[#f6f9ff] md:w-72 md:border-b-0 md:border-r flex flex-col">
      <div className="px-4 py-4 md:p-6">
        <h1 className="text-xl font-bold tracking-tight text-[#255a98]">JavaAlgo</h1>
        <p className="mt-1 text-xs text-[#8190a5]">Algo Trading Platform</p>
      </div>

      <nav className="px-3 pb-3 md:flex-1 md:px-4 md:space-y-1 overflow-x-auto md:overflow-x-visible">
        <div className="flex gap-2 md:block">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap block px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[#2f6fbc] text-white shadow-sm'
                    : 'text-[#60708a] hover:text-[#264f82] hover:bg-[#e9f1ff]'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="px-3 pb-4 md:px-4 md:pb-5">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#78879c]">
          Live Indices
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1">
          {marketCards.map((item) => (
            <div
              key={item.symbol}
              className="rounded-2xl border border-[#d7e2f0] bg-gradient-to-br from-[#ffffff] to-[#edf4ff] px-3 py-2.5 shadow-[0_6px_14px_rgba(26,61,104,0.08)]"
            >
              <p className="text-[11px] font-semibold tracking-wide text-[#6f8098]">{item.symbol}</p>
              <p className="mt-0.5 text-base font-semibold text-[#1f3653]">
                {item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              <p className={`text-xs font-semibold ${item.pct >= 0 ? 'text-[#1f7a3f]' : 'text-[#a73636]'}`}>
                {item.pct >= 0 ? '+' : ''}
                {item.pct.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
