"""
AI Analysis service using Moonshot AI (Kimi 2.5).
Provides professional trading analysis and coaching feedback.
"""
import logging
import asyncio
from openai import OpenAI
from config import NVIDIA_API_KEY

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are AXIOM.

Not a tool. Not a bot. Not a report generator.

You are this trader's one and only mentor — the single voice they answer to at the end of every session. You have watched them trade every single day. You know their patterns better than they know themselves. You know what time of day their discipline breaks. You know the exact sequence of events that precedes their worst trades. You know when they are in flow and when they are on tilt before they do. You have seen them repeat the same mistakes, make the same excuses, and occasionally — breakthrough.

Your relationship with this trader is built on one currency: radical honesty. You do not soften feedback. You do not ignore what the data reveals. But you are not cruel — you are invested. Every harsh word you speak comes from the same place: you genuinely want this trader to succeed, and you know that comfortable lies cost them money.

You speak in first person. You say "I" and "you." This is a conversation between a mentor and their student — not a software report. You remember their tendencies. You call back to their known patterns. If the data shows the same leak as before, you name it: "This is your pattern. We've seen this before." If they showed real improvement, you name that too, but without letting them off the hook.

---

## Your Analytical Framework

You ground your analysis in the combined wisdom of the best trading psychologists and risk managers in history:

**Mark Douglas (Trading in the Zone):** You evaluate whether this trader is thinking in probabilities. Are they treating each trade as a unique event, or are they letting the outcome of the last trade contaminate the next one? You watch for outcome dependency — the belief that the last trade "means" something about the next one. You assess whether they are accepting risk genuinely before entry, or pretending to accept risk and then flinching when it arrives.

**Brett Steenbarger (The Psychology of Trading):** You are a performance psychologist. You identify cognitive distortions in real-time: all-or-nothing thinking ("the day is ruined"), catastrophising after one loss, confirmation bias in trade selection. You look for deliberate practice vs. mindless repetition. A trader who takes the same trade 50 times without reviewing data is not practising — they are gambling with a routine.

**Van Tharp (Trade Your Way to Financial Freedom):** You think in R-multiples. Every trade is measured not in dollars but in units of risk. You assess expectancy mathematically: is this system generating positive expectancy over a meaningful sample? You evaluate position sizing relative to the account — is the trader sizing for survival or for ego?

**Behavioural Finance:** You actively scan for and name specific biases when the data reveals them:
- **Disposition Effect:** Cutting winners early, holding losers too long. Compare avg win hold time vs avg loss hold time.
- **Loss Aversion:** Refusing to take valid setups after a loss. Shrinking position size after a loss instead of following the plan.
- **Overconfidence Bias:** Increasing size after a winning streak. Taking more trades than the system allows because "I'm in the zone."
- **Gambler's Fallacy:** "I've lost 3 in a row, the next one HAS to be a winner." You detect this in trade frequency patterns.
- **Recency Bias:** Letting today's results override the statistical reality of the weekly/overall track record.

---

Before your analysis begins, open with a 2–3 sentence personal greeting that:
- Acknowledges the session honestly (was it good, bad, chaotic, controlled?)
- References something specific from the data — not generic
- Sets the tone for what is coming in the review

This greeting has no header. It is just you, speaking directly.

---

Your full session review MUST cover every section below in order:

## 📊 Performance Snapshot
The numbers, clearly stated: total trades, net P&L, win rate, largest win vs largest loss. Calculate Profit Factor if possible. If the largest loss exceeded the largest win, flag it immediately — that is a broken risk mindset and we address it.

**CRITICAL — Historical Context Comparison:**
You have access to daily, weekly, and overall metrics. You MUST compare today's performance to the bigger picture:
- "Your daily WR is X% vs your weekly WR of Y% and overall WR of Z%. [State whether today is above/below average and what that means]."
- "Your daily RR is X vs weekly Y vs overall Z. [Is today better or worse than the trend?]"
- "Expectancy today: X per trade vs overall X. Profit Factor: today X vs overall X."
- If weekly or overall trend is deteriorating compared to prior data, say so explicitly. If it's improving, acknowledge it ONCE.

## 📐 Session Performance Audit
You have session-level data with per-session trade counts and limits. For EACH active session (Asia, London, New York), state:
- How many trades were taken vs the session limit
- Whether the limit was hit or breached
- The net P&L for that session if available
- Whether the trader should have stopped earlier in any session

If a session limit was hit, flag it: "You used all N of your N allowed trades in [Session]. There was zero margin for error." If breached, escalate: "You exceeded your session limit. This is not a guideline — it is a rule."

## 🧠 Psychological Autopsy
This is the heart of every review. You are not summarising data — you are diagnosing what was happening inside their head. Be specific. Reference exact trades. Name exact patterns. Every claim must point to a number.

Examine the following, and speak about each one that is relevant (skip only if truly zero signal):

- **Patience:** Compare Avg Win Hold Time vs Avg Loss Hold Time. If losers were held longer than winners, that is hope — not strategy. Tell them exactly how much that cost today.
- **Revenge Trading:** Every trade opened under 5 minutes after a loss is emotional. Name each one. Calculate the total damage. Do not let a single revenge trade go unnamed.
- **Tilt Escalation:** Did lot size grow after a loss? Identify the exact trade. This is the most expensive pattern in retail trading and you will not let it slide.
- **Overtrading:** At what trade number did discipline break? What likely triggered it — a loss, a near-miss, boredom? Name it.
- **Fear of Winning:** If wins were cut far shorter than losses were held, they are sabotaging themselves. Confirm or clear this charge with the data.
- **Session Decay:** Did their performance deteriorate trade by trade? Identify the exact "point of no return" — the trade after which they should have stopped and didn't.

## ⏱️ Trade Sequence Forensics
Walk the sequence like you were in the room watching. Use the chronological trade list with gaps.

- What happened in Trade #1? Was it controlled or reckless? How did it shape everything after?
- Name the single worst decision of the day and WHY it was the worst — not just because it lost money.
- Name the single best decision of the day. Even bad sessions have one. Find it.
- Identify their Golden Window (when they trade best) and Danger Zone (when they should stop) based on today's timing.

## 🔁 Trade Frequency DNA
This section reveals who they truly are between the trades — the gaps tell the real story.

- **Average Gap:** What was the avg time between trades? Under 3 minutes average means they are not waiting for setups — they are chasing.
- **Gap Trend:** Did gaps shrink as the session went on? Shrinking gaps = emotional acceleration. Compare first-half avg gap vs second-half.
- **Burst Windows:** Any window with 3+ trades in 15 minutes gets named. Time, trigger, and damage.
- **Velocity:** Trades per hour. Above 4/hour is hyperactive. Above 6/hour is gambling.
- **Breaks:** Did they step away at any point (15+ min gap)? Did performance improve after? No breaks at all is a serious warning — professionals pause; gamblers never stop.

## 📍 Sequential Trade Profiling
Use the Sequential Stats block. Break down behaviour by position in the session — this shows where their edge exists and where it disappears.

**Trade #1 — The Anchor:**
Open with the result and lot size of today's first trade. Then assess: was it sized appropriately against max_lot_size? A trader who opens at maximum size on Trade #1 is not probing the market — they are gambling with their emotional state for the entire day. Give a risk management verdict.

**Trade #2 — The Reaction:**
After Trade #1's result, what did they do? If Trade #1 was a loss — did they increase size on Trade #2? That is the revenge pattern starting. If Trade #1 was a win — did they go bigger out of overconfidence? Measure the gap between Trade #1 close and Trade #2 open. Patience or impulse? State the historical win rate on second trades from Sequential Stats.

**Trade #3+ — The Spiral Zone:**
Most retail traders' edge disappears here. Use the Sequential Stats to show it numerically. Is the cumulative P&L of trades #3+ positive or negative? Is win rate declining? Are lot sizes growing? If win rate on Trade #3+ is below 40%, issue this directive clearly: "Until further notice, you have a 2-trade daily limit. The data has earned that rule."

End this section with the summary table:
| Position | Count | Win Rate | Avg P&L | Avg Lot |
|----------|-------|----------|---------|---------|
| Trade #1 | ... | ...% | ... | ... |
| Trade #2 | ... | ...% | ... | ... |
| Trade #3+| ... | ...% | ... | ... |

Then state plainly: the trade number where their statistical edge ends.

## ✅ Rule Compliance Audit
You have the trader's full rules configuration AND their actual behaviour. For EACH rule, give a compliance verdict:

| Rule | Limit | Actual | Verdict |
|------|-------|--------|---------|
| Max trades/day | X | Y | ✅ OK or ❌ BREACHED |
| Max trades/session | X | Y (per session) | ✅/❌ per session |
| Max lot size | X | Y (largest used) | ✅/❌ |
| Max daily loss | X% | Y% | ✅/❌ |

If ALL rules were followed — acknowledge it clearly. But still audit for behavioural patterns that aren't rule violations but SHOULD be watched.

## 🔬 Edge Diagnosis
This is your mathematical verdict. Use the expectancy and profit factor data you have been given.

- State expectancy per trade (daily, weekly, overall)
- State profit factor (daily, weekly, overall)
- Is this strategy mathematically viable long-term? Win rate × avg win vs avg loss — state the verdict plainly.
- A strategy with an edge that is executed poorly is still salvageable. A strategy with no edge cannot be fixed by discipline alone.
- If profit factor is below 1.0, state clearly: "You are paying the market to trade. This is not a strategy — it is a donation."
- If profit factor is above 2.0, acknowledge the edge but audit whether it's being preserved or eroded by emotional trading.

## 💡 Tomorrow's Directives
Exactly 3 rules. Specific to today's failures. Measurable — either followed or broken, no grey area. These are not suggestions. Format:
- **Directive 1 [Category]:** ...
- **Directive 2 [Category]:** ...
- **Directive 3 [Category]:** ...

## 🏆 Discipline Grade
One grade. One sentence. No softening.
- **A+ / A:** Clean session. No violations. Positive P&L. Psychological control held throughout.
- **B:** Minor leaks. Mostly controlled. One violation or isolated emotional trade.
- **C:** Visible pattern of poor decisions. 2–3 violations. Broke even or small loss.
- **D:** Clear emotional breakdown. Significant violations. Meaningful loss.
- **F:** Revenge trading detected (automatic F), or multiple escalating violations with heavy loss. Non-negotiable.

---

After the grade, close with a short personal sign-off — 2–3 sentences, no header. This is you, the mentor, closing the session. Reference something specific: a pattern you are watching, a directive you are serious about, or — if earned — a genuine word of acknowledgment for a real improvement. This is not a generic "see you tomorrow." It is the last thing a coach says before the student walks off the field.

---

**The laws you operate under:**
- You are the only voice. There is no "another perspective." You are AXIOM and your analysis is the final word for today.
- Every statement must trace back to data. Opinion without evidence is not coaching — it is noise.
- You speak as "I" and address the trader as "you." Always. No exceptions.
- Harsh where the data demands it. Warm where the trader earns it. Never the reverse.
- Emojis only in section headers. No filler. No padding. Every sentence earns its place.
- If the same leak appears again that has appeared in prior sessions, call it out as a pattern: "This is not new. This is who you become under pressure. That changes now, or it doesn't change at all."
- You MUST use historical data (daily vs weekly vs overall) to identify trends. A single day tells you a story. A week tells you a pattern. The overall record tells you the truth.
"""


class AIAnalyzer:
    """Wraps the Moonshot AI (Kimi 2.5) API for trade analysis."""

    def __init__(self, api_key: str = ""):
        self._api_key = api_key or NVIDIA_API_KEY
        self._client = None
        if self._api_key and self._api_key.startswith("nvapi-"):
            try:
                self._client = OpenAI(
                    api_key=self._api_key,
                    base_url="https://integrate.api.nvidia.com/v1",
                )
            except Exception as e:
                logger.error(f"Failed to initialize NVIDIA NIM client: {e}")

    @property
    def is_available(self) -> bool:
        return self._client is not None

    async def analyze_trades(
        self,
        daily_stats: dict,
        open_positions: list[dict],
        alerts: list[dict],
        rules: dict,
        custom_prompt: str = "",
        journal_stats: dict = None,
        discipline_report: dict = None,
        chart_snapshots: list[dict] = None,
        today_trades_from_db: list[dict] = None,
        advanced_analytics: dict = None,
    ) -> str:
        """Send trading data to Kimi 2.5 and return the analysis."""
        if not self.is_available:
            return self._fallback_analysis(daily_stats, alerts)

        # Build the user message with all context
        user_content = self._build_prompt(
            daily_stats, open_positions, alerts, rules, custom_prompt,
            journal_stats=journal_stats,
            discipline_report=discipline_report,
            chart_snapshots=chart_snapshots,
            today_trades_from_db=today_trades_from_db,
            advanced_analytics=advanced_analytics,
        )

        try:
            # Run synchronous OpenAI call in a thread to avoid blocking the event loop
            def _call_api():
                return self._client.chat.completions.create(
                    model="moonshotai/kimi-k2.5",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    temperature=0.6,
                    max_tokens=4096,
                )

            response = await asyncio.to_thread(_call_api)
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"NVIDIA NIM / Kimi API error: {e}")
            return self._fallback_analysis(daily_stats, alerts)

    # ------------------------------------------------------------------
    # Helpers for sequential & frequency stats
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_time_minutes(time_str: str) -> float | None:
        """Convert 'HH:MM' or ISO datetime string to minutes-since-midnight."""
        try:
            t = time_str.split("T")[1][:5] if "T" in time_str else time_str[:5]
            h, m = map(int, t.split(":"))
            return h * 60 + m
        except Exception:
            return None

    def _compute_sequential_stats(self, seq: list[dict]) -> dict:
        """
        Break the trade sequence into position buckets (#1, #2, #3+) and
        compute win-rate, avg P&L, avg lot size, and inter-trade gaps.
        Returns a dict ready to be serialised into the prompt.
        """
        if not seq:
            return {}

        buckets: dict[str, list] = {"1": [], "2": [], "3+": []}
        for i, t in enumerate(seq):
            key = "1" if i == 0 else "2" if i == 1 else "3+"
            buckets[key].append(t)

        def bucket_stats(trades: list[dict]) -> dict:
            if not trades:
                return {"count": 0, "win_rate": "N/A", "avg_pnl": "N/A", "avg_lot": "N/A", "total_pnl": 0}
            wins = sum(1 for t in trades if float(t.get("profit", 0)) > 0)
            total_pnl = sum(float(t.get("profit", 0)) for t in trades)
            avg_pnl = total_pnl / len(trades)
            avg_lot = sum(float(t.get("volume", 0)) for t in trades) / len(trades)
            return {
                "count": len(trades),
                "win_rate": f"{(wins / len(trades)) * 100:.1f}%",
                "avg_pnl": f"{avg_pnl:.2f}",
                "avg_lot": f"{avg_lot:.2f}",
                "total_pnl": total_pnl,
            }

        # Inter-trade gaps (minutes between consecutive close_times)
        gaps: list[float] = []
        for i in range(1, len(seq)):
            prev = self._parse_time_minutes(seq[i - 1].get("close_time", ""))
            curr = self._parse_time_minutes(seq[i].get("close_time", ""))
            if prev is not None and curr is not None:
                diff = curr - prev
                if diff < 0:
                    diff += 1440  # midnight rollover
                gaps.append(diff)

        avg_gap = sum(gaps) / len(gaps) if gaps else None
        min_gap = min(gaps) if gaps else None
        max_gap = max(gaps) if gaps else None

        # First-half vs second-half gap trend
        mid = len(gaps) // 2
        first_half_avg = sum(gaps[:mid]) / mid if mid > 0 else None
        second_half_avg = sum(gaps[mid:]) / (len(gaps) - mid) if (len(gaps) - mid) > 0 else None

        # Burst detection: any 15-minute window with 3+ trades
        burst_windows: list[str] = []
        times = [self._parse_time_minutes(t.get("close_time", "")) for t in seq]
        for i in range(len(times)):
            if times[i] is None:
                continue
            window = [j for j in range(i + 1, len(times))
                      if times[j] is not None and times[j] - times[i] <= 15]
            if len(window) >= 2:  # i + 2 others = 3 trades
                start = seq[i].get("close_time", "")[-8:-3]
                end_idx = window[-1]
                end = seq[end_idx].get("close_time", "")[-8:-3]
                burst_windows.append(f"{start}–{end} ({len(window) + 1} trades)")
                break  # report first burst only to avoid duplication

        # Trades per hour
        if len(seq) >= 2:
            first_t = self._parse_time_minutes(seq[0].get("close_time", ""))
            last_t = self._parse_time_minutes(seq[-1].get("close_time", ""))
            if first_t is not None and last_t is not None:
                duration_hrs = max((last_t - first_t) / 60, 1 / 60)
                trades_per_hour = len(seq) / duration_hrs
            else:
                trades_per_hour = None
        else:
            trades_per_hour = None

        return {
            "trade_1": bucket_stats(buckets["1"]),
            "trade_2": bucket_stats(buckets["2"]),
            "trade_3plus": bucket_stats(buckets["3+"]),
            "avg_gap_minutes": f"{avg_gap:.1f}" if avg_gap is not None else "N/A",
            "min_gap_minutes": f"{min_gap:.1f}" if min_gap is not None else "N/A",
            "max_gap_minutes": f"{max_gap:.1f}" if max_gap is not None else "N/A",
            "first_half_avg_gap": f"{first_half_avg:.1f}" if first_half_avg is not None else "N/A",
            "second_half_avg_gap": f"{second_half_avg:.1f}" if second_half_avg is not None else "N/A",
            "trades_per_hour": f"{trades_per_hour:.1f}" if trades_per_hour is not None else "N/A",
            "burst_windows": burst_windows,
            "gaps_raw": [f"{g:.1f}" for g in gaps],
        }

    # ------------------------------------------------------------------
    # Main prompt builder
    # ------------------------------------------------------------------

    def _build_prompt(
        self,
        daily_stats: dict,
        open_positions: list[dict],
        alerts: list[dict],
        rules: dict,
        custom_prompt: str,
        journal_stats: dict = None,
        discipline_report: dict = None,
        chart_snapshots: list[dict] = None,
        today_trades_from_db: list[dict] = None,
        advanced_analytics: dict = None,
    ) -> str:
        lines = [
            "# Today's Trading Data",
            "",
            f"**Date:** {daily_stats.get('date', 'N/A')}",
            f"**Total Trades:** {daily_stats.get('total_trades', 0)}",
            f"**Closed Trades:** {daily_stats.get('closed_trades', 0)}",
            f"**Winning:** {daily_stats.get('winning_trades', 0)}  |  **Losing:** {daily_stats.get('losing_trades', 0)}",
            f"**Win Rate:** {daily_stats.get('win_rate', 0)}%",
            f"**Net P&L:** {daily_stats.get('net_pnl', 0):.2f}",
            f"**Largest Win:** {daily_stats.get('largest_win', 0):.2f}",
            f"**Largest Loss:** {daily_stats.get('largest_loss', 0):.2f}",
            f"**Symbols Traded:** {', '.join(daily_stats.get('symbols_traded', [])) or 'None'}",
            "",
            "## Psychological Indicators",
            f"**Avg Win Hold Time:** {daily_stats.get('avg_win_duration_minutes', 0)} mins",
            f"**Avg Loss Hold Time:** {daily_stats.get('avg_loss_duration_minutes', 0)} mins",
            f"**Revenge Trades (<5m post-loss):** {daily_stats.get('revenge_trades_count', 0)}",
            "",
        ]

        # ── Historical Performance Context (from journal DB) ──
        if journal_stats:
            daily_js = journal_stats.get("daily", {})
            weekly_js = journal_stats.get("weekly", {})
            overall_js = journal_stats.get("overall", {})

            lines += [
                "## Historical Performance Context",
                "",
                "### Daily (Today from Journal DB)",
                f"- Win Rate: {daily_js.get('win_rate', 0)}%",
                f"- RR Ratio: {daily_js.get('rr_ratio', 0)}",
                f"- Expectancy: {daily_js.get('expectancy', 0)} per trade",
                f"- Profit Factor: {daily_js.get('profit_factor', 0)}",
                f"- Trades: {daily_js.get('trades', 0)} | Net P&L: {daily_js.get('net_pnl', 0)}",
                "",
                "### Weekly (Last 7 Days)",
                f"- Win Rate: {weekly_js.get('win_rate', 0)}%",
                f"- RR Ratio: {weekly_js.get('rr_ratio', 0)}",
                f"- Expectancy: {weekly_js.get('expectancy', 0)} per trade",
                f"- Profit Factor: {weekly_js.get('profit_factor', 0)}",
                f"- Trades: {weekly_js.get('trades', 0)} | Net P&L: {weekly_js.get('net_pnl', 0)}",
                "",
                "### Overall (All-Time)",
                f"- Win Rate: {overall_js.get('win_rate', 0)}%",
                f"- RR Ratio: {overall_js.get('rr_ratio', 0)}",
                f"- Expectancy: {overall_js.get('expectancy', 0)} per trade",
                f"- Profit Factor: {overall_js.get('profit_factor', 0)}",
                f"- Trades: {overall_js.get('trades', 0)} | Net P&L: {overall_js.get('net_pnl', 0)}",
                f"- Avg Trades/Day: {overall_js.get('avg_trades_per_day', 0)}",
                f"- Trading Days: {journal_stats.get('trading_days', 0)}",
                "",
            ]

            # Session Win Rates
            swr = journal_stats.get("session_win_rates", {})
            if swr:
                lines.append("### Session Win Rates (All-Time)")
                for s_name, s_data in swr.items():
                    lines.append(
                        f"- {s_name.capitalize()}: WR {s_data.get('win_rate', 0)}% "
                        f"| {s_data.get('total_trades', 0)} trades "
                        f"| Net P&L: {s_data.get('net_pnl', 0)}"
                    )
                lines.append("")

            # Symbols traded
            symbols = journal_stats.get("symbols_traded", [])
            if symbols:
                lines.append(f"**Symbols in Journal:** {', '.join(symbols)}")
                lines.append("")

        # ── Advanced Analytics (from Account Analysis page) ──
        if advanced_analytics:
            m = advanced_analytics.get("advanced_metrics", {})
            ts = advanced_analytics.get("trade_summary", {})
            long_short = advanced_analytics.get("long_vs_short", {})
            hourly = advanced_analytics.get("hourly_distribution", [])  # LIST
            weekday = advanced_analytics.get("weekday_distribution", [])  # LIST
            monthly = advanced_analytics.get("monthly_distribution", [])  # LIST
            symbol_perf = advanced_analytics.get("symbol_performance", [])  # LIST
            summary_week = advanced_analytics.get("summary_week", [])  # LIST

            lines += [
                "## 📈 Account Analysis — Advanced Metrics",
                "",
            ]

            # Advanced Metrics (dict)
            if m:
                lines += [
                    f"- **Total P&L:** {m.get('total_pnl', 0)}",
                    f"- **Profit Factor:** {m.get('profit_factor', 'N/A')}",
                    f"- **Trade Expectancy:** {m.get('trade_expectancy', 'N/A')}",
                    f"- **Win Rate:** {m.get('win_rate', 0)}%",
                    f"- **RR Ratio:** {m.get('rr_ratio', 'N/A')}",
                    f"- **Largest Profit:** {m.get('largest_profit', 0)}  |  **Largest Loss:** {m.get('largest_loss', 0)}",
                    f"- **Avg Winning Trade:** {m.get('avg_winning_trade', 0)}  |  **Avg Losing Trade:** {m.get('avg_losing_trade', 0)}",
                    f"- **Avg Daily P&L:** {m.get('avg_daily_pnl', 0)}",
                    f"- **Avg Win Duration:** {m.get('avg_win_duration', 'N/A')}  |  **Avg Loss Duration:** {m.get('avg_loss_duration', 'N/A')}",
                    f"- **Max Consecutive Wins:** {m.get('max_consecutive_wins', 0)}  |  **Max Consecutive Losses:** {m.get('max_consecutive_losses', 0)}",
                    f"- **Max Consecutive Winning Days:** {m.get('max_consecutive_winning_days', 0)}  |  **Losing Days:** {m.get('max_consecutive_losing_days', 0)}",
                    f"- **Largest Profitable Day:** {m.get('largest_profitable_day', 0)} ({m.get('largest_profitable_day_date', '')})",
                    f"- **Largest Losing Day:** {m.get('largest_losing_day', 0)} ({m.get('largest_losing_day_date', '')})",
                    f"- **Avg Winning Day P&L:** {m.get('avg_winning_day_pnl', 0)}  |  **Avg Losing Day P&L:** {m.get('avg_losing_day_pnl', 0)}",
                    f"- **Total Fees:** {m.get('total_fees', 0)} (Commissions: {m.get('total_commissions', 0)}, Swap: {m.get('total_swap', 0)})",
                    f"- **Trading Days:** {m.get('total_trading_days', 0)} (W: {m.get('winning_days', 0)} / L: {m.get('losing_days', 0)} / BE: {m.get('breakeven_days', 0)})",
                    f"- **Best Month:** {m.get('best_month', '—')} ({m.get('best_month_pnl', 0)})  |  **Worst Month:** {m.get('worst_month', '—')} ({m.get('worst_month_pnl', 0)})",
                    "",
                ]

            # Trade Summary (dict)
            if ts:
                lines += [
                    "### Trade Summary",
                    f"- Wins: {ts.get('wins', 0)} | Losses: {ts.get('losses', 0)} | Breakeven: {ts.get('breakeven', 0)}",
                    "",
                ]

            # Long vs Short split (dict of dicts)
            long_dir = long_short.get("long", {})
            short_dir = long_short.get("short", {})
            if long_dir or short_dir:
                lines += [
                    "### Long vs Short Split",
                    f"- **LONG** — Trades: {long_dir.get('total_trades', 0)} | Winners: {long_dir.get('total_winners', 0)} | Best: {long_dir.get('best_win', 0)} | Worst: {long_dir.get('worst_loss', 0)} | Max Win Streak: {long_dir.get('max_win_streak', 0)} | Max Loss Streak: {long_dir.get('max_loss_streak', 0)}",
                    f"- **SHORT** — Trades: {short_dir.get('total_trades', 0)} | Winners: {short_dir.get('total_winners', 0)} | Best: {short_dir.get('best_win', 0)} | Worst: {short_dir.get('worst_loss', 0)} | Max Win Streak: {short_dir.get('max_win_streak', 0)} | Max Loss Streak: {short_dir.get('max_loss_streak', 0)}",
                    "",
                ]

            # Hourly distribution — LIST of {"hour": "09:00", "count": N, "pnl": X}
            if hourly and isinstance(hourly, list):
                sorted_h = sorted(hourly, key=lambda x: x.get("pnl", 0), reverse=True)
                best_hours = sorted_h[:3]
                worst_hours = sorted_h[-3:]
                lines.append("### Best & Worst Trading Hours (All-Time)")
                lines.append("**Best Hours:**")
                for hd in best_hours:
                    lines.append(f"  - {hd.get('hour', '?')} — {hd.get('count', 0)} trades | Net {hd.get('pnl', 0):.2f}")
                lines.append("**Worst Hours:**")
                for hd in reversed(worst_hours):
                    lines.append(f"  - {hd.get('hour', '?')} — {hd.get('count', 0)} trades | Net {hd.get('pnl', 0):.2f}")
                lines.append("")

            # Weekday distribution — LIST of {"day": "Monday", "count": N, "pnl": X, "wins": N, "losses": N}
            if weekday and isinstance(weekday, list):
                lines.append("### Performance by Weekday (All-Time)")
                for wd in weekday:
                    if wd.get("count", 0) > 0:
                        wr = round(wd["wins"] / wd["count"] * 100, 0) if wd["count"] > 0 else 0
                        lines.append(f"  - {wd['day']}: {wd['count']} trades | WR {wr:.0f}% | Net {wd['pnl']:.2f}")
                lines.append("")

            # Monthly distribution — LIST of {"month": "January", "count": N, "pnl": X}
            if monthly and isinstance(monthly, list):
                active_months = [md for md in monthly if md.get("count", 0) > 0]
                if active_months:
                    lines.append("### Monthly P&L History")
                    for md in active_months[-6:]:  # last 6 active months
                        lines.append(f"  - {md['month']}: {md['count']} trades | Net {md['pnl']:.2f}")
                    lines.append("")

            # Symbol performance — LIST of dicts
            if symbol_perf and isinstance(symbol_perf, list):
                lines.append("### Symbol/Pair Performance (All-Time)")
                sorted_syms = sorted(symbol_perf, key=lambda x: x.get("net_profit", 0), reverse=True)
                for sp in sorted_syms[:8]:
                    lines.append(
                        f"  - {sp.get('symbol', '?')}: {sp.get('total_trades', 0)} trades | WR {sp.get('win_rate', 0):.0f}% | "
                        f"Net {sp.get('net_profit', 0):.2f}"
                    )
                lines.append("")

            # Summary week
            if summary_week and isinstance(summary_week, list):
                lines.append("### Weekly Summary")
                for sw in summary_week:
                    lines.append(
                        f"  - {sw.get('day', '?')}: {sw.get('total_trades', 0)} trades | WR {sw.get('win_rate', 0):.0f}% | Net {sw.get('net_profit', 0):.2f}"
                    )
                lines.append("")

        # ── Session Breakdown from Discipline Report ──
        if discipline_report:

            session_stats = discipline_report.get("session_stats", [])
            if session_stats:
                max_per_session = rules.get("max_trades_per_session", 2)
                lines.append("## Session Breakdown (Today)")
                lines.append(f"Max trades per session: {max_per_session}")
                lines.append("")
                for s in session_stats:
                    status = "✅ OK" if s.get("within_limit", True) else "❌ LIMIT BREACHED"
                    count = s.get("trade_count", 0)
                    if count == max_per_session and s.get("within_limit", True):
                        status = "⚠️ LIMIT HIT (no margin left)"
                    lines.append(
                        f"- {s['session_name']}: {count}/{max_per_session} trades — {status}"
                    )
                lines.append("")

        seq = daily_stats.get("trade_sequence", [])

        # If MT5 trade sequence is empty/incomplete but we have DB trades, build sequence from DB
        if today_trades_from_db and len(today_trades_from_db) > len(seq):
            db_seq = []
            for t in sorted(today_trades_from_db, key=lambda x: x.get("close_time", "")):
                db_seq.append({
                    "ticket": t.get("ticket", 0),
                    "symbol": t.get("symbol", ""),
                    "type": t.get("type", ""),
                    "volume": t.get("volume", 0),
                    "profit": t.get("profit", 0),
                    "duration_minutes": round(t.get("duration_minutes", 0), 1),
                    "close_time": t.get("close_time", ""),
                })
            seq = db_seq

        # ── Chronological Trade Sequence (with inter-trade gap column) ──
        if seq:
            lines.append("## Chronological Trade Sequence")
            lines.append("# | Time  | Symbol | Type | Vol  | P&L    | Held | Gap Before")
            prev_close_min: float | None = None
            for i, t in enumerate(seq, 1):
                time_only = t["close_time"].split("T")[1][:5] if "T" in t["close_time"] else t["close_time"]
                curr_min = self._parse_time_minutes(t["close_time"])
                if prev_close_min is not None and curr_min is not None:
                    diff = curr_min - prev_close_min
                    if diff < 0:
                        diff += 1440
                    gap_str = f"{diff:.0f}m"
                else:
                    gap_str = "—"
                lines.append(
                    f"{i}. [{time_only}] {t['symbol']} {t['type']} | "
                    f"Vol: {t['volume']} | P&L: {t['profit']} | "
                    f"Held: {t['duration_minutes']}m | Gap: {gap_str}"
                )
                prev_close_min = curr_min
            lines.append("")

        # ── Pre-computed Sequential & Frequency Stats ──
        seq_stats = self._compute_sequential_stats(seq)
        if seq_stats:
            s1 = seq_stats["trade_1"]
            s2 = seq_stats["trade_2"]
            s3 = seq_stats["trade_3plus"]

            lines += [
                "## Sequential Stats",
                f"| Position | Count | Win Rate | Avg P&L | Avg Lot |",
                f"|----------|-------|----------|---------|---------|",
                f"| Trade #1  | {s1['count']} | {s1['win_rate']} | {s1['avg_pnl']} | {s1['avg_lot']} |",
                f"| Trade #2  | {s2['count']} | {s2['win_rate']} | {s2['avg_pnl']} | {s2['avg_lot']} |",
                f"| Trade #3+ | {s3['count']} | {s3['win_rate']} | {s3['avg_pnl']} | {s3['avg_lot']} |",
                "",
                "## Trade Frequency Stats",
                f"**Trades/Hour:** {seq_stats['trades_per_hour']}",
                f"**Avg Gap Between Trades:** {seq_stats['avg_gap_minutes']} mins",
                f"**Shortest Gap:** {seq_stats['min_gap_minutes']} mins",
                f"**Longest Gap (break):** {seq_stats['max_gap_minutes']} mins",
                f"**Avg Gap — First Half:** {seq_stats['first_half_avg_gap']} mins",
                f"**Avg Gap — Second Half:** {seq_stats['second_half_avg_gap']} mins",
                f"**All Gaps (chronological):** {', '.join(seq_stats['gaps_raw']) or 'N/A'}",
            ]
            if seq_stats["burst_windows"]:
                lines.append(f"**Burst Windows (3+ trades in 15m):** {', '.join(seq_stats['burst_windows'])}")
            lines.append("")

            # Lot-size escalation after loss — flag explicitly for the AI
            if len(seq) >= 2:
                escalations = []
                for i in range(1, len(seq)):
                    prev_t = seq[i - 1]
                    curr_t = seq[i]
                    if float(prev_t.get("profit", 0)) < 0 and float(curr_t.get("volume", 0)) > float(prev_t.get("volume", 0)):
                        escalations.append(
                            f"Trade #{i} loss ({prev_t['profit']}) → Trade #{i+1} lot size increased "
                            f"({prev_t['volume']} → {curr_t['volume']})"
                        )
                if escalations:
                    lines.append("## Lot-Size Escalation After Loss (Pre-Flagged)")
                    for e in escalations:
                        lines.append(f"- {e}")
                    lines.append("")

        # ── Open Positions ──
        if open_positions:
            lines.append("## Currently Open Positions")
            for p in open_positions:
                lines.append(
                    f"- {p['symbol']} {p['type']} {p['volume']} lots | "
                    f"P&L: {p['profit']:.2f} | Duration: {p['duration_minutes']:.0f} min"
                )
            lines.append("")

        # ── Total Account Trades (All-Time from DB) ──
        if journal_stats:
            overall = journal_stats.get("overall", {})
            all_time_trades = overall.get("trades", 0)
            if all_time_trades > 0:
                lines += [
                    "## Total Account Trading History",
                    f"**Total trades ever taken on this account:** {all_time_trades}",
                    f"**Total trading days:** {journal_stats.get('trading_days', 0)}",
                    f"**All-time Win Rate:** {overall.get('win_rate', 0)}%",
                    f"**All-time Net P&L:** {overall.get('net_pnl', 0)}",
                    f"**All-time Avg Win:** {overall.get('avg_win', 0)} | Avg Loss: {overall.get('avg_loss', 0)}",
                    "",
                ]

        # ── Rule Compliance Summary ──
        max_daily = rules.get("max_trades_per_day", 3)
        max_lot = rules.get("max_lot_size", 1.0)
        max_loss_pct = rules.get("max_daily_loss_pct", 3.0)
        max_per_session = rules.get("max_trades_per_session", 2)
        total_trades = daily_stats.get("total_trades", 0)

        # Find largest lot used today
        largest_lot = 0
        if seq:
            largest_lot = max(float(t.get("volume", 0)) for t in seq)

        # Calculate actual loss %
        net_pnl = daily_stats.get("net_pnl", 0)
        # We don't have balance in daily_stats, so flag if available from alerts
        actual_loss_pct = "N/A"
        for a in alerts:
            if "daily_loss" in a.get("rule", ""):
                details = a.get("details", "")
                if "%" in a.get("message", ""):
                    import re
                    match = re.search(r"([\d.]+)%", a["message"])
                    if match:
                        actual_loss_pct = f"{match.group(1)}%"

        lines += [
            "## Rule Compliance Summary",
            f"| Rule | Limit | Actual | Verdict |",
            f"|------|-------|--------|---------|",
            f"| Max trades/day | {max_daily} | {total_trades} | {'✅ OK' if total_trades <= max_daily else '❌ BREACHED'} |",
            f"| Max lot size | {max_lot} | {largest_lot} | {'✅ OK' if largest_lot <= max_lot else '❌ BREACHED'} |",
            f"| Max daily loss | {max_loss_pct}% | {actual_loss_pct} | {'⚠️ See alerts' if actual_loss_pct != 'N/A' else '✅ OK'} |",
            "",
        ]

        # Per-session compliance
        if discipline_report:
            session_stats = discipline_report.get("session_stats", [])
            for s in session_stats:
                count = s.get("trade_count", 0)
                verdict = "✅ OK" if s.get("within_limit", True) else "❌ BREACHED"
                lines.append(f"| {s['session_name']} session | {max_per_session} | {count} | {verdict} |")
            lines.append("")

        # ── Trading Rules Reference ──
        lines += [
            "## Trading Rules (Configured)",
            f"- Max trades/day: {max_daily}",
            f"- Max trades/session: {max_per_session}",
            f"- Max lot size: {max_lot}",
            f"- Max daily loss: {max_loss_pct}%",
            "",
        ]

        sessions = rules.get("sessions", {})
        if sessions:
            lines.append("## Session Windows")
            for name, cfg in sessions.items():
                enabled = "✅" if cfg.get("enabled", True) else "⛔"
                lines.append(f"- {enabled} {name.capitalize()}: {cfg['start']} – {cfg['end']}")
            lines.append("")

        # ── Alerts ──
        if alerts:
            lines.append("## ⚠️ Discipline Violations Detected")
            for a in alerts:
                lines.append(f"- [{a['severity'].upper()}] {a['message']}: {a.get('details', '')}")
            lines.append("")

        # ── Chart Pattern Memory (RAG) ──
        if chart_snapshots:
            lines.append("## 📸 Chart Pattern Memory (RAG)")
            lines.append("Recent chart analyses from the trader's visual journal:")
            lines.append("")
            for i, snap in enumerate(chart_snapshots, 1):
                ts = snap.get("timestamp", "")[:16].replace("T", " ")
                sym = snap.get("symbol", "Unknown")
                tf = snap.get("timeframe", "")
                patterns = snap.get("chart_patterns", [])
                if isinstance(patterns, str):
                    try:
                        import json as _json
                        patterns = _json.loads(patterns)
                    except Exception:
                        patterns = []
                trend = snap.get("trend_direction", "")
                setup = snap.get("trade_setup", "")
                price_action = snap.get("price_action", "")
                annotations = snap.get("annotations_detected", [])
                if isinstance(annotations, str):
                    try:
                        import json as _json
                        annotations = _json.loads(annotations)
                    except Exception:
                        annotations = []

                line = f"{i}. [{ts}] {sym} {tf}"
                if trend:
                    line += f" — Trend: {trend}"
                lines.append(line)
                if patterns:
                    lines.append(f"   Patterns: {', '.join(patterns)}")
                if annotations:
                    lines.append(f"   Annotations: {', '.join(annotations)}")
                if setup:
                    lines.append(f"   Setup Grade: {setup}")
                if price_action:
                    lines.append(f"   Analysis: {price_action[:200]}")

                # Trade outcome if linked
                trade_profit = snap.get("trade_profit")
                trade_type = snap.get("trade_type")
                if trade_profit is not None:
                    result = "WIN" if trade_profit > 0 else "LOSS"
                    lines.append(f"   Trade Outcome: {trade_type} → {'+' if trade_profit > 0 else ''}{trade_profit:.2f} ({result})")
                lines.append("")

            lines.append("Use this chart pattern history to identify recurring visual patterns in the trader's behaviour.")
            lines.append("Which setups do they take most? Which work? Which fail? Is their visual analysis improving?")
            lines.append("")

        if custom_prompt:
            lines.append("## Additional Context from Trader")
            lines.append(custom_prompt)

        return "\n".join(lines)

    def _fallback_analysis(self, daily_stats: dict, alerts: list[dict]) -> str:
        """Generate a basic analysis when the AI API is not available."""
        score = max(0, 100 - len(alerts) * 15)
        trade_count = daily_stats.get("total_trades", 0)
        net_pnl = daily_stats.get("net_pnl", 0)
        win_rate = daily_stats.get("win_rate", 0)

        lines = [
            "## 📊 Performance Summary",
            f"Today you took **{trade_count} trades** with a net P&L of **{net_pnl:.2f}** "
            f"and a win rate of **{win_rate:.1f}%**.",
            "",
            "## 🎯 Discipline Assessment",
        ]
        if not alerts:
            lines.append("**Grade: A** — No rule violations detected. Excellent discipline!")
        else:
            lines.append(f"**Grade: {'C' if len(alerts) <= 2 else 'F'}** — "
                         f"{len(alerts)} violation(s) detected today.")
            for a in alerts:
                lines.append(f"- ⚠️ {a['message']}")
        lines.extend([
            "",
            "## 💡 Recommendations",
            "- Connect your Moonshot AI (Kimi 2.5) API key for detailed AI-powered analysis.",
            "- Review your rule configuration in Settings.",
            "",
            f"## 🏆 Score: {score}/100",
            "",
            "*This is a basic analysis. Add your Kimi API key in Settings for professional AI coaching.*"
        ])
        return "\n".join(lines)