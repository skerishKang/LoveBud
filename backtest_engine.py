"""Vectorized Backtesting Engine for OHLCV Data."""

from __future__ import annotations

import numpy as np
import pandas as pd
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol
import warnings


class SignalGenerator(Protocol):
    """Strategy interface: generate signals from OHLCV DataFrame.

    Returns:
        pd.Series: Position signals (-1=short, 0=flat, 1=long), indexed by df.index.
    """

    def __call__(self, df: pd.DataFrame) -> pd.Series: ...


@dataclass(frozen=True, slots=True)
class BacktestConfig:
    """Backtest configuration parameters."""

    initial_capital: float = 100_000.0
    commission_bps: float = 5.0  # basis points per trade (round-trip)
    slippage_bps: float = 2.0    # basis points per trade (round-trip)
    compound: bool = True        # compound returns vs simple
    risk_free_rate: float = 0.02 # annual risk-free rate for Sharpe
    trading_days: int = 252      # trading days per year


@dataclass(frozen=True, slots=True)
class BacktestResult:
    """Complete backtest results."""

    equity_curve: pd.Series       # portfolio value over time
    returns: pd.Series            # period returns
    positions: pd.Series          # position held each period (-1/0/1)
    trades: pd.DataFrame          # trade log with entry/exit/pnl
    metrics: dict[str, float]     # performance metrics

    # Convenience properties
    @property
    def final_value(self) -> float:
        return float(self.equity_curve.iloc[-1])

    @property
    def total_return(self) -> float:
        return float(self.equity_curve.iloc[-1] / self.equity_curve.iloc[0] - 1)


def _compute_metrics(
    returns: pd.Series,
    equity_curve: pd.Series,
    config: BacktestConfig,
) -> dict[str, float]:
    """Compute performance metrics from returns series."""
    if len(returns) == 0:
        return {}

    # Clean returns
    ret = returns.dropna()
    if len(ret) < 2:
        return {}

    # Basic stats
    n_periods = len(ret)
    periods_per_year = config.trading_days

    # CAGR
    total_return = equity_curve.iloc[-1] / equity_curve.iloc[0] - 1
    years = n_periods / periods_per_year
    cagr = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0.0

    # Volatility (annualized)
    vol_annual = ret.std() * np.sqrt(periods_per_year)

    # Sharpe Ratio
    excess_return = ret.mean() * periods_per_year - config.risk_free_rate
    sharpe = excess_return / vol_annual if vol_annual > 0 else 0.0

    # Maximum Drawdown
    cummax = equity_curve.cummax()
    drawdown = (equity_curve - cummax) / cummax
    mdd = float(drawdown.min())

    # Calmar Ratio
    calmar = cagr / abs(mdd) if mdd < 0 else 0.0

    # Win Rate
    wins = (ret > 0).sum()
    losses = (ret < 0).sum()
    total_trades = wins + losses
    win_rate = wins / total_trades if total_trades > 0 else 0.0

    # Profit Factor
    gross_profit = ret[ret > 0].sum()
    gross_loss = abs(ret[ret < 0].sum())
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else np.inf

    return {
        "cagr": float(cagr),
        "volatility_annual": float(vol_annual),
        "sharpe": float(sharpe),
        "max_drawdown": float(mdd),
        "calmar": float(calmar),
        "win_rate": float(win_rate),
        "profit_factor": float(profit_factor),
        "total_return": float(total_return),
        "n_periods": n_periods,
    }


class BacktestEngine:
    """Vectorized backtesting engine for OHLCV data."""

    def __init__(self, config: BacktestConfig | None = None):
        self.config = config or BacktestConfig()

    def run(
        self,
        df: pd.DataFrame,
        strategy: SignalGenerator,
    ) -> BacktestResult:
        """Execute vectorized backtest.

        Args:
            df: OHLCV DataFrame with columns ['open', 'high', 'low', 'close', 'volume']
                Index must be DatetimeIndex or ordered timestamp.
            strategy: Callable that takes df and returns signal Series (-1/0/1).

        Returns:
            BacktestResult with equity curve, returns, positions, trades, metrics.
        """
        # Validate input
        required_cols = {"open", "high", "low", "close", "volume"}
        missing = required_cols - set(df.columns.str.lower())
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        # Normalize column names to lowercase
        df = df.copy()
        df.columns = df.columns.str.lower()

        # Generate signals (vectorized)
        signals = strategy(df)
        if not isinstance(signals, pd.Series):
            raise TypeError("Strategy must return pd.Series")
        if not signals.index.equals(df.index):
            raise ValueError("Signal index must match DataFrame index")

        # Clip signals to valid range
        positions = signals.clip(-1, 1).astype(int)

        # Compute period returns from close prices
        close = df["close"]
        price_returns = close.pct_change().fillna(0.0)

        # Position returns: position_t * return_{t+1}
        # Shift positions to avoid lookahead bias (position at t based on signal at t)
        pos_shifted = positions.shift(1).fillna(0)

        # Gross returns before costs
        gross_returns = pos_shifted * price_returns

        # Transaction costs: commission + slippage on position changes
        position_changes = pos_shifted.diff().abs().fillna(0)
        cost_per_trade = (self.config.commission_bps + self.config.slippage_bps) / 10_000
        transaction_costs = position_changes * cost_per_trade

        # Net returns
        net_returns = gross_returns - transaction_costs

        # Equity curve
        if self.config.compound:
            equity_curve = self.config.initial_capital * (1 + net_returns).cumprod()
        else:
            equity_curve = self.config.initial_capital * (1 + net_returns.cumsum())

        equity_curve.iloc[0] = self.config.initial_capital

        # Build trade log
        trades = self._build_trade_log(df, pos_shifted.astype(int), net_returns)

        # Compute metrics
        metrics = _compute_metrics(net_returns, equity_curve, self.config)

        return BacktestResult(
            equity_curve=equity_curve,
            returns=net_returns,
            positions=pos_shifted,
            trades=trades,
            metrics=metrics,
        )

    def _build_trade_log(
        self,
        df: pd.DataFrame,
        positions: pd.Series,
        returns: pd.Series,
    ) -> pd.DataFrame:
        """Build trade log from position changes."""
        pos_changes = positions.diff().fillna(0)
        trade_mask = pos_changes != 0

        if not trade_mask.any():
            return pd.DataFrame(
                columns=["entry_time", "exit_time", "direction", "entry_price",
                         "exit_price", "pnl", "return_pct", "holding_periods"]
            )

        # Get trade boundaries
        trade_idx = positions[trade_mask].index

        trades_list = []
        for i in range(len(trade_idx) - 1):
            entry_time = trade_idx[i]
            exit_time = trade_idx[i + 1]
            direction = positions.loc[entry_time]

            if direction == 0:
                continue

            entry_price = df.loc[entry_time, "close"]
            exit_price = df.loc[exit_time, "close"]

            # PnL calculation
            if direction == 1:  # long
                pnl = exit_price - entry_price
                ret_pct = pnl / entry_price
            else:  # short
                pnl = entry_price - exit_price
                ret_pct = pnl / entry_price

            holding_periods = (exit_time - entry_time).days if hasattr(exit_time, 'days') else 1

            trades_list.append({
                "entry_time": entry_time,
                "exit_time": exit_time,
                "direction": int(direction),
                "entry_price": float(entry_price),
                "exit_price": float(exit_price),
                "pnl": float(pnl),
                "return_pct": float(ret_pct),
                "holding_periods": holding_periods,
            })

        return pd.DataFrame(trades_list)


# Convenience function for quick backtests
def run_backtest(
    df: pd.DataFrame,
    strategy: SignalGenerator,
    config: BacktestConfig | None = None,
) -> BacktestResult:
    """Quick backtest function."""
    engine = BacktestEngine(config)
    return engine.run(df, strategy)