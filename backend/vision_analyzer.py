"""
Vision AI service — Multi-provider pipeline:
  - Pass 1 (Vision read): NVIDIA NIM llama-3.2-11b-vision-instruct
                       OR Google Gemini Flash Vision
                       OR OpenAI GPT-4o Vision
                       OR OpenRouter Vision model
  - Pass 2 (Coaching):  Same multi-provider text routing as AIAnalyzer

Vision is available when ANY single vision provider is configured.
"""
import logging
import asyncio
import json
import re
from openai import OpenAI
from config import (
    AGENTROUTER_API_KEY, AGENTROUTER_BASE_URL,
    NVIDIA_API_KEY, ZAI_API_KEY,
    GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY,
    VISION_PROVIDER, VISION_MODEL, AI_PROVIDER, AI_MODEL,
)

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
    "perfect_entry_description": "Describe the PERFECT A+ entry for this exact chart. Be ultra-specific: which exact price level for entry, what confirmation candle, what has to happen first. Think: Liquidity Sweep -> Displacement -> FVG -> Entry on retest.",
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
- Think in terms of: Liquidity Sweep -> Displacement -> FVG -> Entry -> SL below inducement -> TP at opposing liquidity
- EVERY field must be filled. Do not return empty arrays or empty strings."""

def _get_vision_providers():
    import os
    from config import (
        AGENTROUTER_API_KEY, AGENTROUTER_BASE_URL,
        NVIDIA_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY
    )
    agent_key = os.getenv("AGENTROUTER_API_KEY", AGENTROUTER_API_KEY)
    agent_url = os.getenv("AGENTROUTER_BASE_URL", AGENTROUTER_BASE_URL) or "https://agentrouter.org/v1/"
    openrouter_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)
    openai_key = os.getenv("OPENAI_API_KEY", OPENAI_API_KEY)
    gemini_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
    nvidia_key = os.getenv("NVIDIA_API_KEY", NVIDIA_API_KEY)

    return [
        (agent_key,      "agentrouter",  agent_url,                                                     "gpt-6.1-sol"),
        (openrouter_key, "openrouter",   "https://openrouter.ai/api/v1/",                               "openai/gpt-4o-mini"),
        (openai_key,     "openai",       "https://api.openai.com/v1/",                                  "gpt-4o-mini"),
        (gemini_key,     "gemini",       "https://generativelanguage.googleapis.com/v1beta/openai/",    "gemini-1.5-flash"),
        (nvidia_key,     "nvidia",       "https://integrate.api.nvidia.com/v1",                         "meta/llama-3.2-11b-vision-instruct"),
    ]


def _get_text_providers():
    import os
    from config import (
        AGENTROUTER_API_KEY, AGENTROUTER_BASE_URL,
        GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, ZAI_API_KEY
    )
    agent_key = os.getenv("AGENTROUTER_API_KEY", AGENTROUTER_API_KEY)
    agent_url = os.getenv("AGENTROUTER_BASE_URL", AGENTROUTER_BASE_URL) or "https://agentrouter.org/v1/"
    openrouter_key = os.getenv("OPENROUTER_API_KEY", OPENROUTER_API_KEY)
    openai_key = os.getenv("OPENAI_API_KEY", OPENAI_API_KEY)
    gemini_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
    groq_key = os.getenv("GROQ_API_KEY", GROQ_API_KEY)
    zai_key = os.getenv("ZAI_API_KEY", ZAI_API_KEY)

    return [
        (agent_key,      "agentrouter",  agent_url,                                                     "gpt-6.1-sol"),
        (openrouter_key, "openrouter",   "https://openrouter.ai/api/v1/",                               "openai/gpt-4o-mini"),
        (openai_key,     "openai",       "https://api.openai.com/v1/",                                  "gpt-4o-mini"),
        (gemini_key,     "gemini",       "https://generativelanguage.googleapis.com/v1beta/openai/",    "gemini-1.5-flash"),
        (groq_key,       "groq",         "https://api.groq.com/openai/v1/",                             "llama-3.1-8b-instant"),
        (zai_key,        "zai",          "https://api.z.ai/api/paas/v4/",                               "glm-4-flash"),
    ]


class VisionAnalyzer:
    """Multi-provider chart vision analysis: vision read -> structured coaching."""

    def __init__(self):
        self._vision_client = None
        self._vision_provider = "none"
        self._vision_model = ""
        self._coaching_client = None
        self._coaching_provider = "none"
        self._coaching_model = ""
        self._init_clients()

    def _normalize_model(self, raw_model: str) -> str:
        m_low = (raw_model or "").lower().strip()
        if m_low in ("opus 4-8", "opus-4-8", "claude-opus-4-8", "opus4-8"):
            return "claude-opus-5-5"
        elif m_low in ("opus 5", "opus-5", "claude-opus-5", "opus5", "claude-opus-5-5", "opus 5-5"):
            return "claude-opus-5-5"
        elif m_low in ("gemini astra", "gemini-astra", "gpt-6-astra", "astra"):
            return "gpt-6-astra"
        elif m_low in ("deepseek", "deepseek-flash", "deepseek-v4-flash"):
            return "deepseek-v4-flash"
        elif m_low in ("sol", "gpt-6.1-sol"):
            return "gpt-6.1-sol"
        return raw_model

    def _call_responses_endpoint(self, prompt_text: str, model: str = None) -> str:
        """Call AgentRouter /v1/responses endpoint for models requiring OpenAI Responses API."""
        import json, ssl, urllib.request
        base = getattr(self, "_coaching_base_url", "https://agentrouter.org/v1/").rstrip("/")
        if base.endswith("/v1"):
            url = base + "/responses"
        elif not base.endswith("/responses"):
            url = base + "/v1/responses"
        else:
            url = base

        req_model = model or getattr(self, "_coaching_model", "") or "gpt-6.1-sol"
        headers = {
            "Authorization": f"Bearer {getattr(self, '_coaching_key', '')}",
            "User-Agent": "codex_cli_rs/0.149.1",
            "Originator": "codex_cli_rs",
            "Content-Type": "application/json"
        }
        payload = {"model": req_model, "input": prompt_text}
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=180) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for item in data.get("output", []):
                    if item.get("type") == "message":
                        for c in item.get("content", []):
                            if c.get("type") == "output_text":
                                return c.get("text", "")
        except Exception as e:
            logger.warning(f"Coaching responses call failed ({req_model}): {e}")
        return ""

    def _call_vision_responses_endpoint(self, prompt_text: str, image_base64: str, model: str = None) -> str:
        """Call AgentRouter /v1/responses endpoint with image input for multimodal models."""
        import json, ssl, urllib.request, time
        base = getattr(self, "_coaching_base_url", "https://agentrouter.org/v1/").rstrip("/")
        if base.endswith("/v1"):
            url = base + "/responses"
        elif not base.endswith("/responses"):
            url = base + "/v1/responses"
        else:
            url = base

        target_model = model or getattr(self, "_vision_model", "") or "gpt-6.1-sol"
        headers = {
            "Authorization": f"Bearer {getattr(self, '_coaching_key', '')}",
            "User-Agent": "codex_cli_rs/0.149.1",
            "Originator": "codex_cli_rs",
            "Content-Type": "application/json"
        }
        full_prompt = f"{VISION_READ_PROMPT}\n\n{prompt_text}"
        payload = {
            "model": target_model,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": full_prompt},
                        {"type": "input_image", "image_url": f"data:image/png;base64,{image_base64}"}
                    ]
                }
            ]
        }
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
                with urllib.request.urlopen(req, context=ctx, timeout=180) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    for item in data.get("output", []):
                        if item.get("type") == "message":
                            for c in item.get("content", []):
                                if c.get("type") == "output_text":
                                    return c.get("text", "")
                return ""
            except Exception as e:
                logger.warning(f"Vision responses call failed ({target_model}): {e}")
                if attempt == 0:
                    time.sleep(2)
                    continue
                return ""

    def _init_clients(self):
        """Initialise vision and coaching clients from available provider keys."""
        import os
        from config import VISION_PROVIDER, VISION_MODEL, AI_PROVIDER, AI_MODEL

        forced_vision = os.getenv("VISION_PROVIDER", VISION_PROVIDER).lower().strip()
        custom_vmodel = os.getenv("VISION_MODEL", VISION_MODEL).strip()
        forced_text   = os.getenv("AI_PROVIDER", AI_PROVIDER).lower().strip()
        custom_tmodel = os.getenv("AI_MODEL", AI_MODEL).strip()

        self._vision_client = None
        self._vision_provider = "none"
        self._vision_model = ""
        self._coaching_client = None
        self._coaching_provider = "none"
        self._coaching_model = ""
        self._coaching_key = ""
        self._coaching_base_url = ""

        # ── Vision client ──
        for key_val, name, base_url, default_model in _get_vision_providers():
            if forced_vision and name != forced_vision:
                continue
            if not key_val:
                continue
            # NVIDIA key must start with nvapi-
            if name == "nvidia" and not key_val.startswith("nvapi-"):
                continue
            try:
                client_kwargs = {"api_key": key_val, "base_url": base_url}
                if name == "agentrouter" or "agentrouter" in str(base_url).lower():
                    client_kwargs["default_headers"] = {
                        "User-Agent": "codex_cli_rs/0.149.1",
                        "Originator": "codex_cli_rs",
                    }
                self._vision_client = OpenAI(**client_kwargs)
                self._vision_provider = name
                self._vision_model = self._normalize_model(custom_vmodel or default_model)
                logger.info(f"VisionAnalyzer vision client: provider={name}, model={self._vision_model}")
                break
            except Exception as e:
                logger.warning(f"VisionAnalyzer: failed to init vision {name}: {e}")

        # ── Coaching (text) client ──
        for key_val, name, base_url, default_model in _get_text_providers():
            if forced_text and name != forced_text:
                continue
            if not key_val:
                continue
            try:
                client_kwargs = {"api_key": key_val, "base_url": base_url}
                if name == "agentrouter" or "agentrouter" in str(base_url).lower():
                    client_kwargs["default_headers"] = {
                        "User-Agent": "codex_cli_rs/0.149.1",
                        "Originator": "codex_cli_rs",
                    }
                self._coaching_client = OpenAI(**client_kwargs)
                self._coaching_provider = name
                self._coaching_key = key_val
                self._coaching_base_url = base_url
                self._coaching_model = self._normalize_model(custom_tmodel or default_model)
                logger.info(f"VisionAnalyzer coaching client: provider={name}, model={self._coaching_model}")
                break
            except Exception as e:
                logger.warning(f"VisionAnalyzer: failed to init coaching {name}: {e}")

        if not self._vision_client:
            logger.warning("VisionAnalyzer: no vision provider available. Add AGENTROUTER_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY.")
        if not self._coaching_client:
            logger.warning("VisionAnalyzer: no coaching provider available.")

    @property
    def is_available(self) -> bool:
        """True when at least the vision client is ready."""
        return self._vision_client is not None

    @property
    def vision_provider(self) -> str:
        return self._vision_provider

    @property
    def coaching_provider(self) -> str:
        return self._coaching_provider

    async def analyze_chart(self, image_base64: str, context: str = "",
                            symbol: str = "", timeframe: str = "") -> dict:
        """
        Two-pass analysis:
          1. Vision model reads the chart -> raw narrative
          2. Text model generates structured entry coaching JSON
        Falls back to vision-only result if coaching unavailable.
        """
        if not self.is_available:
            return self._fallback_result(
                f"Vision AI not available. Configure NVIDIA_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in backend/.env."
            )

        try:
            # ─── PASS 1: Vision reads the chart ───────────────────────
            logger.info(f"Vision Pass 1 [{self._vision_provider}/{self._vision_model}]: reading chart...")
            vision_text = await self._pass1_vision_read(image_base64, symbol, timeframe, context)

            if not vision_text or vision_text.startswith("Error"):
                return self._fallback_result(f"Vision read failed: {vision_text}")

            logger.info(f"Vision Pass 1 complete: {len(vision_text)} chars")

            # ─── PASS 2: Coaching model generates structured JSON ───────
            if self._coaching_client:
                logger.info(f"Vision Pass 2 [{self._coaching_provider}/{self._coaching_model}]: generating coaching...")
                analysis = await self._pass2_coaching(vision_text, symbol, timeframe, context)
            else:
                # No coaching provider: return raw vision text in a minimal structure
                logger.warning("Vision Pass 2 skipped: no coaching client available.")
                analysis = self._empty_result(vision_text)

            analysis["status"] = "done"
            analysis["vision_raw"] = vision_text
            analysis["full_analysis"] = vision_text  # Backward compat
            analysis["_provider"] = f"{self._vision_provider}/{self._vision_model}"
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

        # Build the multimodal message (OpenAI-compatible format)
        def _call():
            models_to_try = [self._vision_model or "gpt-6.1-sol"]
            if self._vision_provider == "agentrouter":
                for fb in ["gpt-6.1-sol", "gpt-6-astra"]:
                    if fb not in models_to_try:
                        models_to_try.append(fb)

            last_err = None
            for m in models_to_try:
                try:
                    if m in ("gpt-6-astra", "gpt-6.1-sol") or self._vision_provider == "agentrouter":
                        ans = self._call_vision_responses_endpoint(user_text, image_base64, model=m)
                        if ans:
                            return ans
                    resp = self._vision_client.chat.completions.create(
                        model=m,
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
                    choice = resp.choices[0].message
                    content = choice.content or ""
                    if not content and hasattr(choice, "reasoning_content") and choice.reasoning_content:
                        content = choice.reasoning_content
                    if content:
                        return content
                except Exception as e:
                    last_err = e
                    err_str = str(e)
                    if "responses" in err_str.lower() or "400" in err_str:
                        ans = self._call_vision_responses_endpoint(user_text, image_base64, model=m)
                        if ans:
                            return ans
                    if "403" in err_str or "无权访问" in err_str or "not support" in err_str.lower() or "不支持" in err_str or "无可用渠道" in err_str:
                        logger.warning(f"Vision model '{m}' unavailable ({err_str[:60]}), trying fallback model...")
                        continue
                    raise
            if last_err:
                raise last_err

        response_content = await asyncio.to_thread(_call)
        return response_content

    async def _pass2_coaching(self, vision_analysis: str, symbol: str,
                               timeframe: str, context: str) -> dict:
        """Pass 2: Feed vision output to text model for structured coaching."""
        prompt = COACHING_PROMPT.format(
            vision_analysis=vision_analysis,
            symbol=symbol or "Unknown",
            timeframe=timeframe or "Unknown",
            context=context or "No additional context",
        )

        def _call():
            models_to_try = [self._coaching_model or "gpt-6.1-sol"]
            if self._coaching_provider == "agentrouter":
                for fb in ["gpt-6.1-sol", "gpt-6-astra"]:
                    if fb not in models_to_try:
                        models_to_try.append(fb)

            last_err = None
            for m in models_to_try:
                try:
                    if m in ("gpt-6-astra", "gpt-6.1-sol"):
                        ans = self._call_responses_endpoint(prompt, model=m)
                        if ans:
                            return ans
                    resp = self._coaching_client.chat.completions.create(
                        model=m,
                        messages=[
                            {"role": "system", "content": "You are AXIOM, an elite SMC trading coach. Return ONLY valid JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.4,
                        max_tokens=4096,
                    )
                    choice = resp.choices[0].message
                    content = choice.content or ""
                    if not content and hasattr(choice, "reasoning_content") and choice.reasoning_content:
                        content = choice.reasoning_content
                    if content:
                        return content
                except Exception as e:
                    last_err = e
                    err_str = str(e)
                    if "responses" in err_str.lower():
                        logger.info(f"Pass 2 model {m} requires /v1/responses endpoint, retrying...")
                        ans = self._call_responses_endpoint(prompt)
                        if ans:
                            return ans
                    if "403" in err_str or "无权访问" in err_str or "not have permission" in err_str.lower():
                        logger.warning(f"Coaching model '{m}' not authorized (403), falling back...")
                        continue
                    raise
            if last_err:
                raise last_err

        raw_text = await asyncio.to_thread(_call)

        # Parse JSON from response
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
        result = VisionAnalyzer._empty_result("")
        result["status"] = "error"
        result["full_analysis"] = f"Error: {error}"
        return result
