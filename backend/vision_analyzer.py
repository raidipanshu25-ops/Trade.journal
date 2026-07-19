"""
Vision AI service — Two-pass pipeline:
  Pass 1: Llama 3.2 90B Vision reads the chart image → raw SMC narrative (NVIDIA NIM)
  Pass 2: Z.ai text model (GLM 5.2) takes that narrative → structured entry coaching JSON
"""
import logging
import asyncio
import json
import re
from openai import OpenAI
from config import NVIDIA_API_KEY, ZAI_API_KEY

logger = logging.getLogger(__name__)

# ─── PASS 1: Vision model reads the chart ───────────────────────────
VISION_READ_PROMPT = """You are an expert Smart Money Concepts (SMC) and Price Action chart analyst.
Analyze this trading chart screenshot and describe EVERYTHING you see. Be extremely detailed.

Cover ALL of the following in your analysis:

1. **Market Structure**: Is it bullish (HH/HL), bearish (LH/LL), or ranging? Any BOS (Break of Structure) or CHoCH (Change of Character)? Which swing points define the structure?

2. **Order Blocks (OB)**: Where are bullish and bearish order blocks? Are they mitigated or unmitigated? What is the last opposing candle before the impulsive move?

3. **Fair Value Gaps (FVG)**: Any price imbalances (3-candle gaps)? Are they filled or unfilled? Where exactly?

4. **Liquidity**: Where is buy-side liquidity (BSL = equal highs, swing highs) and sell-side liquidity (SSL = equal lows, swing lows)? Has any liquidity been swept?

5. **Inducement**: Any false breakouts or liquidity grabs designed to trap retail traders?

6. **Premium vs Discount**: Is price in premium (above 50% of range) or discount (below 50%)?

7. **Key Levels**: Support/resistance levels visible, approximate prices from the axis.

8. **Candlestick Patterns**: Any notable patterns like engulfing, pin bars, doji, inside bars at key levels?

9. **Chart Patterns**: Any patterns like channels, triangles, head and shoulders, flags, wedges?

10. **Trend Direction**: Overall bias — bullish, bearish, or ranging.

11. **Annotations**: Any trader-drawn lines, rectangles, horizontal levels, Fibonacci tools visible?

12. **Indicators**: Any indicators visible (MA, RSI, MACD, etc.)?

13. **Timeframe**: Estimate from candle density and chart header.

14. **Current Price Action**: What is price doing RIGHT NOW? Is it at a key level? Rejecting? Breaking?

Be specific about price levels using the Y-axis values visible in the chart.
Write in clear paragraphs, not JSON. Be thorough — the more detail you provide, the better the coaching will be."""


# ─── PASS 2: Text model generates structured coaching ───────────────
COACHING_PROMPT = """You are AXIOM — an elite SMC/ICT trading coach. A vision AI has read a trading chart and produced the analysis below. Your job is to take this raw analysis and produce ACTIONABLE, STRUCTURED entry coaching.

You are coaching an SMC and Price Action trader. Think like ICT (Inner Circle Trader). Every level is either liquidity, an order block, or a fair value gap.

## Vision AI's Raw Chart Reading:
{vision_analysis}

## Trader's Context:
- Symbol: {symbol}
- Timeframe: {timeframe}
- Trader's Note: {context}

---

Now produce ONLY a valid JSON object (no markdown, no code fences, no explanation) with ALL of these fields. Every field is REQUIRED — do not skip any:

{{
  "trend_direction": "bullish / bearish / ranging",
  "timeframe_estimate": "M1/M5/M15/H1/H4/D1 based on the vision reading",
  "trade_setup": "A/B/C/D/F — Grade with a 2-sentence justification using SMC criteria. A = textbook with all confluences. B = good but missing 1-2 confirmations. C = average. D = weak. F = no edge.",

  "smc_analysis": {{
    "market_structure": "Describe structure: BOS/CHoCH, HH/HL/LH/LL, which swings define it",
    "order_blocks": "Describe all OBs: type (bull/bear), price zone, mitigated or not",
    "fair_value_gaps": "Describe all FVGs: direction, price range, filled or not",
    "liquidity_status": "Where is BSL and SSL? Has liquidity been swept? Where is price hunting?",
    "inducement": "Any false breakouts or traps? Describe",
    "premium_discount": "Is price in premium or discount relative to the range?",
    "poi": "Where is the highest-probability Point of Interest for entry? Be specific with price."
  }},

  "entry_improvement": {{
    "current_assessment": "2-3 sentences: What the trader likely did right and what they missed. Be specific to THIS chart.",
    "what_to_wait_for": [
      "List 4-6 specific steps the trader should wait for before entering. Examples:",
      "Wait for price to sweep SSL below [specific level]",
      "Wait for CHoCH on M5/M15 (lower timeframe confirmation)",
      "Wait for price to retrace into the OB at [zone]",
      "Wait for a displacement candle creating a new FVG",
      "Wait for bullish/bearish engulfing at the POI",
      "Wait for market to cross [key level] with conviction"
    ],
    "perfect_entry_description": "Describe the PERFECT A+ entry for this exact chart. Be ultra-specific: which exact price level for entry, what confirmation candle, what has to happen first. Think: Liquidity Sweep → Displacement → FVG → Entry on retest.",
    "stop_loss_placement": "Where should SL be placed using SMC logic? Below the OB? Below the liquidity sweep wick? Be specific with price level.",
    "take_profit_targets": [
      "TP1: [specific level] — nearest liquidity pool or opposing OB",
      "TP2: [specific level] — next key structural level",
      "TP3: [specific level] — if momentum continues to next major zone"
    ],
    "risk_reward_estimate": "Estimated R:R based on the entry, SL, and TP1 (e.g., 1:2.5)",
    "mistakes_to_avoid": [
      "List 3-5 specific mistakes for THIS setup. Examples:",
      "Do not enter before the CHoCH — a BOS alone is not confirmation",
      "Do not chase the move — wait for the pullback into OB/FVG",
      "Do not place SL too tight — put it below the inducement wick",
      "Do not ignore the HTF bias if it conflicts with LTF setup",
      "Do not take this trade during low-volume hours (e.g., pre-London)"
    ]
  }},

  "confluences_present": ["List all confluences that align, e.g.: HTF_bearish_bias, unmitigated_OB, FVG_unfilled, SSL_swept, CHoCH_on_LTF, session_timing_NY"],
  "confluences_missing": ["List confluences NOT present that would make it A+, e.g.: no_CHoCH_yet, FVG_already_filled, no_liquidity_sweep, HTF_conflicting"],

  "chart_patterns": ["any visible chart patterns"],
  "candlestick_patterns": ["any visible candlestick patterns"],
  "support_resistance": [{{"level": "price", "type": "support/resistance", "strength": "strong/moderate/weak"}}],
  "key_levels": ["important price levels from the chart"],
  "annotations_detected": ["any trader-drawn annotations"],
  "indicators_visible": ["any indicators"],

  "price_action": "3-4 sentence narrative of current price action using SMC terminology",
  "risk_assessment": "2-3 sentences about risk/reward, key invalidation level, and whether this trade is worth the risk"
}}

CRITICAL RULES:
- The "entry_improvement" section is the MOST IMPORTANT part. Be extremely specific and actionable.
- Reference EXACT price levels from the vision analysis (e.g., "Wait for sweep below 1.3420" not "wait for sweep below support")
- The "what_to_wait_for" must be a step-by-step SEQUENCE, not random tips
- If the setup is B or lower, your coaching must explain EXACTLY how to upgrade it to an A+
- Think in terms of: Liquidity Sweep → Displacement → FVG → Entry → SL below inducement → TP at opposing liquidity
- EVERY field must be filled. Do not return empty arrays or empty strings."""


class VisionAnalyzer:
    """Two-pass chart analysis: Vision reads (NVIDIA) → Z.ai coaches."""

    VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"
    COACHING_MODEL = "glm-5.2"
    VISION_BASE_URL = "https://integrate.api.nvidia.com/v1"
    COACHING_BASE_URL = "https://api.z.ai/api/paas/v4/"

    def __init__(self, api_key: str = ""):
        self._nvidia_key = api_key or NVIDIA_API_KEY
        self._zai_key = ZAI_API_KEY
        self._vision_client = None
        self._coaching_client = None

        # Vision client (NVIDIA NIM for Llama Vision)
        if self._nvidia_key and self._nvidia_key.startswith("nvapi-"):
            try:
                self._vision_client = OpenAI(
                    api_key=self._nvidia_key,
                    base_url=self.VISION_BASE_URL,
                )
            except Exception as e:
                logger.error(f"Failed to initialize Vision AI client: {e}")

        # Coaching client (Z.ai for structured analysis)
        if self._zai_key:
            try:
                self._coaching_client = OpenAI(
                    api_key=self._zai_key,
                    base_url=self.COACHING_BASE_URL,
                )
            except Exception as e:
                logger.error(f"Failed to initialize Z.ai coaching client: {e}")

    @property
    def is_available(self) -> bool:
        return self._vision_client is not None and self._coaching_client is not None

    async def analyze_chart(self, image_base64: str, context: str = "",
                            symbol: str = "", timeframe: str = "") -> dict:
        """
        Two-pass analysis:
          1. Vision model reads the chart → raw narrative
          2. Text model generates structured entry coaching JSON
        """
        if not self.is_available:
            return self._fallback_result("Vision AI not available — check NVIDIA API key")

        try:
            # ─── PASS 1: Vision reads the chart ──────────────
            logger.info("Vision Pass 1: Reading chart with Llama 3.2 90B Vision...")
            vision_text = await self._pass1_vision_read(image_base64, symbol, timeframe, context)
            
            if not vision_text or vision_text.startswith("Error"):
                return self._fallback_result(f"Vision read failed: {vision_text}")

            logger.info(f"Vision Pass 1 complete: {len(vision_text)} chars of analysis")

            # ─── PASS 2: Coaching model generates structured JSON ──
            logger.info("Vision Pass 2: Generating entry coaching with Z.ai...")
            analysis = await self._pass2_coaching(vision_text, symbol, timeframe, context)
            
            analysis["status"] = "done"
            analysis["vision_raw"] = vision_text  # Keep raw reading for reference
            analysis["full_analysis"] = vision_text  # Backward compat
            return analysis

        except Exception as e:
            logger.error(f"Vision AI pipeline error: {e}")
            return self._fallback_result(str(e))

    async def _pass1_vision_read(self, image_base64: str, symbol: str,
                                  timeframe: str, context: str) -> str:
        """Pass 1: Send image to Vision model, get raw narrative analysis."""
        user_text = "Read and analyze this trading chart in full detail."
        if symbol:
            user_text += f" Instrument: {symbol}."
        if timeframe:
            user_text += f" Timeframe: {timeframe}."
        if context:
            user_text += f" Trader's note: {context}"

        def _call():
            return self._vision_client.chat.completions.create(
                model=self.VISION_MODEL,
                messages=[
                    {"role": "system", "content": VISION_READ_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_text},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}"
                                },
                            },
                        ],
                    },
                ],
                temperature=0.3,
                max_tokens=3000,
            )

        response = await asyncio.to_thread(_call)
        return response.choices[0].message.content

    async def _pass2_coaching(self, vision_analysis: str, symbol: str,
                               timeframe: str, context: str) -> dict:
        """Pass 2: Feed vision output to Z.ai for structured coaching."""
        prompt = COACHING_PROMPT.format(
            vision_analysis=vision_analysis,
            symbol=symbol or "Unknown",
            timeframe=timeframe or "Unknown",
            context=context or "No additional context",
        )

        def _call():
            return self._coaching_client.chat.completions.create(
                model=self.COACHING_MODEL,
                messages=[
                    {"role": "system", "content": "You are AXIOM, an elite SMC trading coach. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=4096,
            )

        response = await asyncio.to_thread(_call)
        raw_text = response.choices[0].message.content
        
        # Parse JSON from Kimi response
        analysis = self._parse_json_response(raw_text)
        
        # If parsing failed, build a minimal result with the raw text
        if not analysis.get("entry_improvement"):
            logger.warning("Coaching model didn't return structured entry_improvement, injecting raw")
            analysis["entry_improvement"] = {
                "current_assessment": "Analysis was generated but could not be fully structured. See raw analysis below.",
                "what_to_wait_for": [],
                "perfect_entry_description": raw_text[:500] if raw_text else "",
                "stop_loss_placement": "",
                "take_profit_targets": [],
                "risk_reward_estimate": "",
                "mistakes_to_avoid": [],
            }
            analysis["full_analysis"] = raw_text

        return analysis

    def _parse_json_response(self, text: str) -> dict:
        """Extract JSON from the model response, handling code fences."""
        # Try direct JSON parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code fences
        patterns = [
            r'```json\s*(.*?)\s*```',
            r'```\s*(.*?)\s*```',
            r'\{.*\}',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1) if '```' in pattern else match.group(0))
                except (json.JSONDecodeError, IndexError):
                    continue

        # Fallback: return empty with raw text
        logger.warning("Could not parse coaching response as JSON")
        return self._empty_result(text[:800])

    @staticmethod
    def _empty_result(price_action_text: str = "") -> dict:
        return {
            "chart_patterns": [],
            "candlestick_patterns": [],
            "support_resistance": [],
            "trend_direction": "",
            "annotations_detected": [],
            "key_levels": [],
            "indicators_visible": [],
            "timeframe_estimate": "",
            "price_action": price_action_text,
            "trade_setup": "",
            "risk_assessment": "",
            "smc_analysis": {},
            "entry_improvement": {},
            "confluences_present": [],
            "confluences_missing": [],
        }

    @staticmethod
    def _fallback_result(error: str) -> dict:
        result = VisionAnalyzer._empty_result.__func__("")
        result["status"] = "error"
        result["full_analysis"] = f"Error: {error}"
        return result
