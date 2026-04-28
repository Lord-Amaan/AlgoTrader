const Strategy = require('../models/Strategy');
const Backtest = require('../models/Backtest');
const { getOHLCData } = require('../utils/dataProvider');
const { getRequestAuth } = require('../middleware/auth');
const mongoose = require('mongoose');

const BACKTEST_LIMIT_PER_DAY = Number(process.env.BACKTEST_LIMIT_PER_DAY || 50);

function getIstDayBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const dateString = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    start: new Date(`${dateString}T00:00:00+05:30`),
    end: new Date(`${dateString}T23:59:59.999+05:30`),
  };
}

/**
 * Extract analytics arrays/objects from Python (or stored rawResults).
 */
function analyticsFromRaw(rawResults) {
  if (!rawResults || typeof rawResults !== 'object') {
    return {
      summary: {},
      equity_curve: [],
      daily_pnl: [],
      calendar: {},
      advanced_metrics: {},
      trades: [],
    };
  }
  return {
    summary: rawResults.summary && typeof rawResults.summary === 'object' ? rawResults.summary : {},
    equity_curve: Array.isArray(rawResults.equity_curve) ? rawResults.equity_curve : [],
    daily_pnl: Array.isArray(rawResults.daily_pnl) ? rawResults.daily_pnl : [],
    calendar: rawResults.calendar && typeof rawResults.calendar === 'object' ? rawResults.calendar : {},
    advanced_metrics:
      rawResults.advanced_metrics && typeof rawResults.advanced_metrics === 'object'
        ? rawResults.advanced_metrics
        : {},
    trades: Array.isArray(rawResults.trades) ? rawResults.trades : [],
  };
}

/** Mongoose subdocs (camelCase) → API snake_case (matches Python). */
function mongooseTradesToSnake(trades) {
  return (trades || []).map((t) => ({
    legIndex: t.legIndex ?? 0,
    entry_price: t.entryPrice ?? 0,
    exit_price: t.exitPrice ?? 0,
    entry_time: t.entryTime ?? null,
    exit_time: t.exitTime ?? null,
    pnl: t.pnl ?? 0,
    profit: t.pnl ?? 0,
    status: t.status ?? 'closed',
  }));
}

/**
 * Full dashboard payload for GET /:id and POST success.
 * Prefers rawResults (Python); falls back to denormalized fields for older records.
 */
function buildDashboardData(backtestDoc) {
  const fromRaw = analyticsFromRaw(backtestDoc.rawResults);
  const summary = fromRaw.summary;
  const hasRichSummary =
    summary &&
    (Object.prototype.hasOwnProperty.call(summary, 'total_pnl') ||
      Object.prototype.hasOwnProperty.call(summary, 'total_trades'));

  let trades = fromRaw.trades;
  if (!trades.length && backtestDoc.trades?.length) {
    trades = mongooseTradesToSnake(backtestDoc.trades);
  }

  const mergedSummary = hasRichSummary
    ? { ...summary }
    : {
        total_pnl: backtestDoc.totalPnl ?? 0,
        total_trades: backtestDoc.totalTrades ?? 0,
        win_rate: backtestDoc.winRate ?? 0,
        max_drawdown: backtestDoc.maxDrawdown ?? 0,
        max_drawdown_pct: 0,
        winning_trades: 0,
        losing_trades: 0,
        breakeven_trades: 0,
        profit_factor: 0,
      };

  return {
    backtestId: backtestDoc._id,
    createdAt: backtestDoc.createdAt,
    summary: mergedSummary,
    equity_curve: fromRaw.equity_curve.length ? fromRaw.equity_curve : [],
    daily_pnl: fromRaw.daily_pnl.length ? fromRaw.daily_pnl : [],
    calendar: fromRaw.calendar,
    advanced_metrics: fromRaw.advanced_metrics,
    trades,
  };
}

/**
 * POST /api/backtest
 * Run a backtest for a strategy
 */
exports.runBacktest = async (req, res) => {
  try {
    const { userId } = getRequestAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { strategyId, instrument, startDate, endDate, timeframe = '1min' } = req.body;

    if (!strategyId || !instrument || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: strategyId, instrument, startDate, endDate',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(strategyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategyId',
      });
    }

    const { start: dayStart, end: dayEnd } = getIstDayBounds(new Date());
    const usedToday = await Backtest.countDocuments({
      user: userId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    if (usedToday >= BACKTEST_LIMIT_PER_DAY) {
      return res.status(429).json({
        success: false,
        error: `Daily backtest limit reached (${BACKTEST_LIMIT_PER_DAY}/day).`,
        data: {
          limit: BACKTEST_LIMIT_PER_DAY,
          used: usedToday,
          remaining: 0,
          resetAt: dayEnd,
        },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [startYear, startMonth, startDay] = startDate.split('-');
    const [endYear, endMonth, endDay] = endDate.split('-');

    const startLocal = new Date(parseInt(startYear, 10), parseInt(startMonth, 10) - 1, parseInt(startDay, 10));
    const endLocal = new Date(parseInt(endYear, 10), parseInt(endMonth, 10) - 1, parseInt(endDay, 10));

    if (isNaN(startLocal.getTime()) || isNaN(endLocal.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format.',
      });
    }

    if (startLocal > endLocal) {
      return res.status(400).json({
        success: false,
        error: 'startDate cannot be after endDate',
      });
    }

    if (endLocal > today) {
      return res.status(400).json({
        success: false,
        error: `endDate cannot be in the future. Today is ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      });
    }

    if (startLocal > today) {
      return res.status(400).json({
        success: false,
        error: `startDate cannot be in the future. Today is ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      });
    }

    const strategy = await Strategy.findOne({
      _id: strategyId,
      userId: userId,
    });

    if (!strategy) {
      return res.status(403).json({
        success: false,
        error: 'Strategy not found or does not belong to you',
      });
    }

    if (!strategy.legs || strategy.legs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Strategy must have at least one leg configured',
      });
    }

    console.log(`Fetching OHLC data for ${instrument} from ${startDate} to ${endDate}`);
    const candles = await getOHLCData(instrument, startDate, endDate, timeframe);

    if (!candles || candles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No OHLC data available for the given date range',
      });
    }

    const pythonEngineUrl = process.env.PYTHON_ENGINE_URL || 'https://algotrader-python.onrender.com';
    const backTestRequest = {
      candles,
      strategy: {
        strategyType: strategy.strategyType,
        instruments: strategy.instruments,
        legs: strategy.legs,
        orderConfig: strategy.orderConfig,
        riskManagement: strategy.riskManagement,
        advanceFeatures: strategy.advanceFeatures,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let pythonResponse;
    try {
      pythonResponse = await fetch(`${pythonEngineUrl}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backTestRequest),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({
          success: false,
          error: 'Python engine timed out (30s). Please try again.',
        });
      }
      return res.status(503).json({
        success: false,
        error: `Python engine connection failed: ${fetchErr.message}`,
      });
    }

    clearTimeout(timeoutId);

    if (!pythonResponse.ok) {
      const errorData = await pythonResponse.text();
      console.error('Python engine error:', errorData);

      let parsedDetail = null;
      try {
        const maybeJson = JSON.parse(errorData);
        parsedDetail = maybeJson?.detail || maybeJson?.error || null;
      } catch (e) {
        parsedDetail = null;
      }

      return res.status(503).json({
        success: false,
        error: parsedDetail || `Python engine error: ${pythonResponse.status}`,
        details: errorData,
      });
    }

    let backTestResults;
    try {
      backTestResults = await pythonResponse.json();
    } catch (jsonErr) {
      return res.status(503).json({
        success: false,
        error: 'Python engine returned invalid JSON',
        details: jsonErr.message,
      });
    }

    const {
      summary = {},
      equity_curve = [],
      daily_pnl = [],
      calendar = {},
      advanced_metrics = {},
      trades = [],
    } = backTestResults;

    const totalPnl = Number(summary.total_pnl) || 0;
    const totalTrades = Number(summary.total_trades) || 0;
    const winRate = Number(summary.win_rate) || 0;
    const maxDrawdown = Number(summary.max_drawdown) || 0;

    const backtest = new Backtest({
      user: userId,
      strategy: strategyId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      instrument,
      timeframe,
      status: 'completed',
      totalPnl,
      totalTrades,
      winRate,
      maxDrawdown,
      trades: (trades || []).map((trade, idx) => ({
        legIndex: trade.legIndex ?? 0,
        entryPrice: trade.entry_price ?? 0,
        exitPrice: trade.exit_price ?? 0,
        entryTime: trade.entry_time ? new Date(trade.entry_time) : null,
        exitTime: trade.exit_time ? new Date(trade.exit_time) : null,
        pnl: trade.profit ?? trade.pnl ?? 0,
        status: 'closed',
      })),
      rawResults: backTestResults,
    });

    await backtest.save();

    const dashboard = buildDashboardData(backtest);
    const data = {
      ...dashboard,
      id: backtest._id,
      instrument: backtest.instrument,
      dateRange: {
        start: backtest.startDate,
        end: backtest.endDate,
      },
      strategy: {
        id: strategy._id,
        name: strategy.name,
        type: strategy.strategyType,
      },
      status: backtest.status,
      usage: {
        limit: BACKTEST_LIMIT_PER_DAY,
        used: usedToday + 1,
        remaining: Math.max(0, BACKTEST_LIMIT_PER_DAY - (usedToday + 1)),
      },
    };

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Backtest error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
};

/**
 * GET /api/backtest
 */
exports.getBacktests = async (req, res) => {
  try {
    const { userId } = getRequestAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const backtests = await Backtest.find({ user: userId })
      .populate('strategy', 'name strategyType')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      data: backtests.map((bt) => {
        const s = bt.rawResults?.summary;
        const totalPnl = s != null && s.total_pnl != null ? Number(s.total_pnl) : bt.totalPnl;
        const totalTrades = s != null && s.total_trades != null ? Number(s.total_trades) : bt.totalTrades;
        const winRate = s != null && s.win_rate != null ? Number(s.win_rate) : bt.winRate;
        const maxDrawdown = s != null && s.max_drawdown != null ? Number(s.max_drawdown) : bt.maxDrawdown;
        return {
          id: bt._id,
          strategyName: bt.strategy?.name || 'Unknown Strategy',
          strategyType: bt.strategy?.strategyType || 'N/A',
          instrument: bt.instrument,
          dateRange: {
            start: bt.startDate,
            end: bt.endDate,
          },
          results: {
            summary: s || null,
            total_pnl: totalPnl,
            total_trades: totalTrades,
            win_rate: winRate,
            max_drawdown: maxDrawdown,
          },
          status: bt.status,
          createdAt: bt.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('Get backtests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch backtests',
      details: error.message,
    });
  }
};

/**
 * GET /api/backtest/:id
 */
exports.getBacktest = async (req, res) => {
  try {
    const { userId } = getRequestAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const { id } = req.params;

    const backtest = await Backtest.findById(id).populate('strategy');

    if (!backtest) {
      return res.status(404).json({
        success: false,
        error: 'Backtest not found',
      });
    }

    if (backtest.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Backtest does not belong to this user',
      });
    }

    const dashboard = buildDashboardData(backtest);

    return res.status(200).json({
      success: true,
      data: {
        id: backtest._id,
        strategy: {
          id: backtest.strategy._id,
          name: backtest.strategy.name,
          type: backtest.strategy.strategyType,
        },
        instrument: backtest.instrument,
        dateRange: {
          start: backtest.startDate,
          end: backtest.endDate,
        },
        status: backtest.status,
        createdAt: backtest.createdAt,
        summary: dashboard.summary,
        equity_curve: dashboard.equity_curve,
        daily_pnl: dashboard.daily_pnl,
        calendar: dashboard.calendar,
        advanced_metrics: dashboard.advanced_metrics,
        trades: dashboard.trades,
        backtestId: dashboard.backtestId,
      },
    });
  } catch (error) {
    console.error('Get backtest error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch backtest',
      details: error.message,
    });
  }
};
