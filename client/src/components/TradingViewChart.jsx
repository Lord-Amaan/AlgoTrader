import React, { useEffect, useRef, useState } from 'react';

export default function TradingViewChart({ symbol = 'AAPL', interval = '1D', height = 320 }) {
  const containerRef = useRef(null);
  const uidRef = useRef(`tv_chart_${Math.random().toString(36).slice(2,9)}`);
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    let widget = null;
    const scriptId = 'tradingview-widget-script';

    function createWidget(opts = {}) {
      if (!window.TradingView || !containerRef.current) return null;
      try {
        return new window.TradingView.widget({
          container_id: uidRef.current,
          autosize: true,
          timezone: 'exchange',
          theme: 'light',
          style: '1',
          toolbar_bg: '#f1f3f6',
          withdateranges: true,
          allow_symbol_change: true,
          studies: [],
          ...opts,
        });
      } catch (e) {
        return null;
      }
    }

    function initWidget() {
      if (!window.TradingView || !containerRef.current) return;
      setInitError(false);

      // Try to initialize with requested symbol first
      widget = createWidget({ symbol, interval });
      if (!widget) {
        // fallback: try initializing without symbol so user can search on TradingView
        widget = createWidget({ interval });
        if (widget) {
          setInitError(true);
        } else {
          setInitError(true);
        }
      }
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.onload = initWidget;
      document.head.appendChild(script);
    } else {
      initWidget();
    }

    return () => {
      if (widget && widget.remove) {
        try { widget.remove(); } catch (e) {}
      }
    };
  }, [symbol, interval]);

  // Build TradingView symbol-permalink if possible (format: EXCHANGE-SYMBOL)
  const permalink = (() => {
    if (!symbol || !symbol.includes(':')) return null;
    return `https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`;
  })();

  return (
    <div>
      <div id={uidRef.current} ref={containerRef} style={{ width: '100%', height: typeof height === 'number' ? `${height}px` : height }} />
      {initError ? (
        <div className="mt-2 text-sm text-[#6d7f97]">
          Symbol may not be available via the embedded widget — try searching in the chart or open on TradingView.
          {permalink ? (
            <a href={permalink} target="_blank" rel="noreferrer" className="ml-2 font-medium text-[#2f6fbc]">Open on TradingView</a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
