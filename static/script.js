/**
 * script.js - Client-Side Controller for JevShield
 * Manages 7 Full-Screen Views, Dynamic Planet Space Backdrops,
 * Hash Routing, Hero Planet Carousel, and Threat Detection APIs.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global Application State
  let currentScreen = "home";
  let featuredPlanet = "earth";
  let lastScannedResult = null;
  let selectedScreenshotFile = null;
  let isTransitioning = false;

  // Reduced motion preference
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================================
  // 1. PLANETS & SCREEN CONFIGURATION
  // ============================================================================
  const PLANET_ORDER = ["earth", "venus", "mars"];

  const PLANETS = {
    earth: {
      name: "earth",
      toolScreen: "scanner",
      eyebrow: "CHECK A LINK",
      label: "CHECK",
      ariaLabel: "Switch to Earth - URL safety scanner",
      lede: "Paste any web address and get a clear verdict in seconds. Our trained model checks the link, explains every warning sign, and suggests the real site if it spots a typo.",
      src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202422_3ffb4889-c520-432d-8458-038009eb40df.mp4",
      still: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202133_508c64b8-a31e-4290-bdfc-1187df70e0a6.png"
    },
    venus: {
      name: "venus",
      toolScreen: "compare",
      eyebrow: "COMPARE TWO LINKS",
      label: "COMPARE",
      ariaLabel: "Switch to Venus - Side-by-side URL comparison",
      lede: "Unsure between two similar addresses? Put them side by side and JevShield will contrast their safety scores, highlight anomalies, and mark the safer choice.",
      src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202422_b211cd74-013b-4dd3-bfd0-64491d8696fa.mp4",
      still: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202133_cf55d1d8-7b59-4a64-80da-d72052ae974e.png"
    },
    mars: {
      name: "mars",
      toolScreen: "screenshot",
      eyebrow: "UPLOAD A SCREENSHOT",
      label: "IMAGE",
      ariaLabel: "Switch to Mars - Webpage screenshot analysis",
      lede: "Received a strange login screen or email snapshot? Upload an image and let our vision model extract visible links and check for spoofed branding.",
      src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202422_51eae59a-2459-4c84-907c-cc5edfe5fea7.mp4",
      still: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202133_0ba6de7c-285d-43dc-b7ab-8c54c73707cb.png"
    }
  };

  // Screen to Backdrop Planet map (Section 1)
  const SCREEN_PLANET_MAP = {
    home: () => featuredPlanet,
    scanner: () => "earth",
    compare: () => "venus",
    screenshot: () => "mars",
    chat: () => "earth",
    history: () => "venus",
    how: () => "mars"
  };

  // DOM Elements
  const stageEl = document.getElementById("stage");
  const skyEl = document.querySelector(".sky");
  const veilEl = document.getElementById("veil");
  const skyVideos = document.querySelectorAll(".sky video");
  const navrow = document.querySelector(".navrow");
  const burgerBtn = document.getElementById("burger-btn");
  const navLinks = document.querySelectorAll(".links a");
  const allScreens = document.querySelectorAll(".screen");

  // Hero Elements
  const heroEyebrowLine = document.querySelector("#hero-eyebrow .ent-line");
  const heroLede = document.getElementById("hero-lede");
  const btnPlanetL = document.getElementById("btn-planet-l");
  const btnPlanetR = document.getElementById("btn-planet-r");
  const labelL = document.getElementById("label-l");
  const labelR = document.getElementById("label-r");
  const heroGetStarted = document.getElementById("hero-get-started");
  const heroArrowBtn = document.getElementById("hero-arrow-btn");
  const navGetStarted = document.getElementById("nav-get-started");

  // ============================================================================
  // 2. VIDEO BACKDROP & WARM-UP (Section 2 & 9)
  // ============================================================================
  function warm(planetName) {
    const video = document.querySelector(`.sky video[data-planet="${planetName}"]`);
    if (video && !video.src && video.dataset.src) {
      video.src = video.dataset.src;
      video.load();
    }
  }

  function warmAll() {
    PLANET_ORDER.forEach(p => warm(p));
  }

  function setBackdropPlanet(planetName) {
    if (!PLANETS[planetName]) planetName = "earth";

    // Set background still fallback
    if (skyEl) {
      skyEl.style.backgroundImage = `url('${PLANETS[planetName].still}')`;
    }

    if (prefersReducedMotion) {
      skyVideos.forEach(v => {
        v.pause();
        v.classList.remove("is-active");
      });
      return;
    }

    // Lazy load if needed
    warm(planetName);

    skyVideos.forEach(v => {
      if (v.dataset.planet === planetName) {
        v.classList.add("is-active");
        if (v.paused) {
          const playPromise = v.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {/* Autoplay policy handled */});
          }
        }
      } else {
        v.classList.remove("is-active");
        v.pause();
      }
    });
  }

  // ============================================================================
  // 3. FULL SCREEN ROUTER & TRANSITION ENGINE (Section 1, 2, 3)
  // ============================================================================
  function goTo(screenName, updateHash = true) {
    if (!SCREEN_PLANET_MAP[screenName]) screenName = "home";
    if (currentScreen === screenName && document.getElementById(`screen-${screenName}`)?.classList.contains("is-active")) {
      return;
    }

    const outgoingScreen = document.getElementById(`screen-${currentScreen}`);
    const incomingScreen = document.getElementById(`screen-${screenName}`);
    if (!incomingScreen) return;

    isTransitioning = true;

    // A. Update backdrop planet
    const targetPlanet = SCREEN_PLANET_MAP[screenName]();
    setBackdropPlanet(targetPlanet);

    // B. Update veil overlay (opacity 0 on home, dark gradient on tool screens)
    if (veilEl) {
      if (screenName === "home") {
        veilEl.classList.remove("is-active");
      } else {
        veilEl.classList.add("is-active");
      }
    }

    // C. Update nav aria-current
    navLinks.forEach(link => {
      const linkScreen = link.dataset.screen;
      if (linkScreen === screenName || (screenName === "home" && link.classList.contains("logo"))) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    // D. Update "Get started" button destination
    updateGetStartedLinks();

    // E. Transition between screens
    if (prefersReducedMotion || !outgoingScreen) {
      if (outgoingScreen) {
        outgoingScreen.classList.remove("is-active", "is-leaving", "is-entering");
        outgoingScreen.setAttribute("aria-hidden", "true");
      }
      incomingScreen.classList.add("is-active");
      incomingScreen.setAttribute("aria-hidden", "false");
      const h2 = incomingScreen.querySelector("h2");
      if (h2) h2.focus();
      isTransitioning = false;
    } else {
      // Outgoing screen lifts 8px and fades in .22s
      outgoingScreen.classList.add("is-leaving");

      setTimeout(() => {
        outgoingScreen.classList.remove("is-active", "is-leaving", "is-entering");
        outgoingScreen.setAttribute("aria-hidden", "true");

        // Incoming screen activates and animates parts with hero keyframes
        incomingScreen.classList.add("is-active", "is-entering");
        incomingScreen.setAttribute("aria-hidden", "false");

        const h2 = incomingScreen.querySelector("h2");
        if (h2) h2.focus();

        setTimeout(() => {
          incomingScreen.classList.remove("is-entering");
          isTransitioning = false;
        }, 580);
      }, 220);
    }

    // Close mobile menu
    setBurgerOpen(false);

    // Update state & hash
    currentScreen = screenName;
    if (updateHash && window.location.hash !== `#/${screenName}`) {
      window.location.hash = `#/${screenName}`;
    }

    // Trigger dynamic data reload if entering history
    if (screenName === "history") {
      loadHistory();
    }
  }

  // Expose goTo globally for inline actions & viva demo
  window.goTo = goTo;
  // Expose renderers globally for verification and viva demos
  window.renderSingleResult = renderSingleResult;
  window.renderCompareResults = renderCompareResults;
  window.renderScreenshotResult = renderScreenshotResult;


  // Hash change listener (supports Back/Forward buttons)
  function handleHashChange() {
    const hash = window.location.hash.replace(/^#\/?/, "") || "home";
    if (SCREEN_PLANET_MAP[hash]) {
      goTo(hash, false);
    } else {
      goTo("home", false);
    }
  }

  window.addEventListener("hashchange", handleHashChange);

  // Hook all navigation and screen links
  document.querySelectorAll("a[href^='#/']").forEach(link => {
    link.addEventListener("click", (e) => {
      const targetScreen = link.dataset.screen || link.getAttribute("href").replace(/^#\/?/, "");
      if (targetScreen === "get-started") {
        e.preventDefault();
        goTo(PLANETS[featuredPlanet].toolScreen);
      } else if (SCREEN_PLANET_MAP[targetScreen]) {
        e.preventDefault();
        goTo(targetScreen);
      }
    });
  });

  // Mobile Burger menu toggle
  function setBurgerOpen(open) {
    if (!navrow || !burgerBtn) return;
    navrow.dataset.open = open ? "true" : "false";
    burgerBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (burgerBtn) {
    burgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setBurgerOpen(navrow.dataset.open !== "true");
    });
  }

  document.addEventListener("click", (e) => {
    if (navrow && navrow.dataset.open === "true" && !navrow.contains(e.target)) {
      setBurgerOpen(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navrow && navrow.dataset.open === "true") {
      setBurgerOpen(false);
      burgerBtn.focus();
    }
  });

  // ============================================================================
  // 4. HERO CAROUSEL ON SCREEN 1 (Home)
  // ============================================================================
  function updateGetStartedLinks() {
    const targetTool = PLANETS[featuredPlanet].toolScreen;
    if (heroGetStarted) heroGetStarted.setAttribute("href", `#/${targetTool}`);
    if (heroArrowBtn) heroArrowBtn.setAttribute("href", `#/${targetTool}`);
    if (navGetStarted) navGetStarted.setAttribute("href", `#/${targetTool}`);
  }

  function setFeaturedPlanet(planet) {
    if (!PLANETS[planet]) planet = "earth";
    featuredPlanet = planet;

    // Update Eyebrow and Lede
    if (heroEyebrowLine) heroEyebrowLine.textContent = PLANETS[planet].eyebrow;
    if (heroLede) heroLede.textContent = PLANETS[planet].lede;

    // Update side planet slots
    const rest = PLANET_ORDER.filter(p => p !== planet);
    const leftPlanet = rest[0];
    const rightPlanet = rest[1];

    if (btnPlanetL) {
      btnPlanetL.dataset.planet = leftPlanet;
      btnPlanetL.setAttribute("aria-label", PLANETS[leftPlanet].ariaLabel);
      btnPlanetL.querySelectorAll("img").forEach(img => {
        img.classList.toggle("is-shown", img.dataset.planet === leftPlanet);
      });
    }
    if (labelL) labelL.textContent = PLANETS[leftPlanet].label;

    if (btnPlanetR) {
      btnPlanetR.dataset.planet = rightPlanet;
      btnPlanetR.setAttribute("aria-label", PLANETS[rightPlanet].ariaLabel);
      btnPlanetR.querySelectorAll("img").forEach(img => {
        img.classList.toggle("is-shown", img.dataset.planet === rightPlanet);
      });
    }
    if (labelR) labelR.textContent = PLANETS[rightPlanet].label;

    updateGetStartedLinks();

    // If currently on home, update backdrop video to match
    if (currentScreen === "home") {
      setBackdropPlanet(planet);
    }
  }

  if (btnPlanetL) {
    btnPlanetL.addEventListener("pointerenter", () => warm(btnPlanetL.dataset.planet));
    btnPlanetL.addEventListener("focus", () => warm(btnPlanetL.dataset.planet));
    btnPlanetL.addEventListener("click", () => setFeaturedPlanet(btnPlanetL.dataset.planet));
  }

  if (btnPlanetR) {
    btnPlanetR.addEventListener("pointerenter", () => warm(btnPlanetR.dataset.planet));
    btnPlanetR.addEventListener("focus", () => warm(btnPlanetR.dataset.planet));
    btnPlanetR.addEventListener("click", () => setFeaturedPlanet(btnPlanetR.dataset.planet));
  }

  if (heroGetStarted) {
    heroGetStarted.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(PLANETS[featuredPlanet].toolScreen);
    });
  }

  if (heroArrowBtn) {
    heroArrowBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(PLANETS[featuredPlanet].toolScreen);
    });
  }

  // ============================================================================
  // 5. SCREEN 2: SCANNER LOGIC (Animated Compact Collapse)
  // ============================================================================
  const urlInput = document.getElementById("url-input");
  const btnPaste = document.getElementById("btn-paste");
  const btnClear = document.getElementById("btn-clear");
  const btnScan = document.getElementById("btn-scan");
  const urlError = document.getElementById("url-error");
  const scannerInputBox = document.getElementById("scanner-input-box");
  const compactResetRow = document.getElementById("compact-reset-row");
  const compactUrlLabel = document.getElementById("compact-url-label");
  const btnScanAnother = document.getElementById("btn-scan-another");

  const singleRadar = document.getElementById("scanning-radar");
  const singleResultCard = document.getElementById("single-result-card");
  const scoreRingFill = document.getElementById("score-ring-fill");
  const scoreText = document.getElementById("score-text");
  const verdictIcon = document.getElementById("verdict-icon");
  const verdictTitle = document.getElementById("verdict-title");
  const scannedUrlDisplay = document.getElementById("scanned-url-display");
  const confidenceDisplay = document.getElementById("confidence-display");
  const reasonsList = document.getElementById("reasons-list");
  const didYouMeanCard = document.getElementById("did-you-mean-card");
  const suggestionChips = document.getElementById("suggestion-chips");
  const websiteSummaryCard = document.getElementById("website-summary-card");
  const categoryChip = document.getElementById("category-chip");
  const summaryBullets = document.getElementById("summary-bullets");
  const summaryNote = document.getElementById("summary-note");

  if (urlInput) {
    urlInput.addEventListener("input", () => {
      btnClear.classList.toggle("hidden", urlInput.value.trim().length === 0);
      urlError.classList.add("hidden");
    });
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSingleScan();
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      urlInput.value = "";
      btnClear.classList.add("hidden");
      urlError.classList.add("hidden");
      urlInput.focus();
    });
  }

  if (btnPaste) {
    btnPaste.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          btnClear.classList.remove("hidden");
          urlError.classList.add("hidden");
          urlInput.focus();
        }
      } catch (err) {
        urlError.textContent = "Could not access clipboard. Please paste manually.";
        urlError.classList.remove("hidden");
      }
    });
  }

  if (btnScan) {
    btnScan.addEventListener("click", handleSingleScan);
  }

  if (btnScanAnother) {
    btnScanAnother.addEventListener("click", () => {
      scannerInputBox.classList.remove("collapsed");
      compactResetRow.classList.add("hidden");
      urlInput.value = "";
      btnClear.classList.add("hidden");
      urlError.classList.add("hidden");
      singleResultCard.classList.add("hidden");
      urlInput.focus();
    });
  }

  async function handleSingleScan() {
    const url = urlInput.value.trim();
    if (!url) {
      urlError.textContent = "Please enter a valid website address.";
      urlError.classList.remove("hidden");
      return;
    }
    urlError.classList.add("hidden");
    singleResultCard.classList.add("hidden");
    singleRadar.classList.remove("hidden");

    const startTime = Date.now();
    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      const delay = Math.max(0, 1000 - (Date.now() - startTime));

      setTimeout(() => {
        singleRadar.classList.add("hidden");
        if (!res.ok) {
          urlError.textContent = data.error || "Failed to scan website. Try again.";
          urlError.classList.remove("hidden");
          return;
        }

        // Collapse input box into compact bar
        scannerInputBox.classList.add("collapsed");
        compactUrlLabel.textContent = data.url;
        compactResetRow.classList.remove("hidden");

        renderSingleResult(data);
        updateChatContext(data);
      }, delay);
    } catch (err) {
      singleRadar.classList.add("hidden");
      urlError.textContent = "Can't reach the server. Make sure Flask is running.";
      urlError.classList.remove("hidden");
    }
  }

  function renderSingleResult(data) {
    lastScannedResult = data;
    const isPhishing = data.result === "phishing";

    singleResultCard.className = `result-card ${isPhishing ? 'verdict-phishing' : 'verdict-safe'}`;
    verdictTitle.textContent = isPhishing ? "Looks like phishing" : "Looks safe";

    verdictIcon.innerHTML = isPhishing
      ? `<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--mars-line)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--earth)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;

    scannedUrlDisplay.textContent = data.url;
    confidenceDisplay.textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}%`;

    // Animate Score Ring
    animateRing(scoreRingFill, scoreText, data.safety_score, isPhishing);

    // Reasons
    reasonsList.innerHTML = "";
    if (data.reasons && data.reasons.length) {
      data.reasons.forEach(r => {
        const li = document.createElement("li");
        li.className = "reason-item";
        li.textContent = r;
        reasonsList.appendChild(li);
      });
    }

    // Typo Suggestions
    if (data.suggestions && data.suggestions.length > 0) {
      didYouMeanCard.classList.remove("hidden");
      suggestionChips.innerHTML = "";
      data.suggestions.forEach(s => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "suggestion-chip";
        chip.textContent = s;
        chip.addEventListener("click", () => {
          urlInput.value = s;
          scannerInputBox.classList.remove("collapsed");
          compactResetRow.classList.add("hidden");
          handleSingleScan();
        });
        suggestionChips.appendChild(chip);
      });
    } else {
      didYouMeanCard.classList.add("hidden");
    }

    // Page Summary
    if (data.summary && (data.summary.bullets?.length || data.summary.category)) {
      websiteSummaryCard.classList.remove("hidden");
      categoryChip.textContent = data.summary.category || "General";
      summaryBullets.innerHTML = "";
      if (data.summary.bullets) {
        data.summary.bullets.forEach(b => {
          const li = document.createElement("li");
          li.textContent = b;
          summaryBullets.appendChild(li);
        });
      }
      summaryNote.textContent = data.summary.note || "";
    } else {
      websiteSummaryCard.classList.add("hidden");
    }

    singleResultCard.classList.remove("hidden");
  }

  function animateRing(ringEl, textEl, targetScore, isPhishing) {
    const circumference = 2 * Math.PI * 50; // 314.159
    const offset = circumference - (targetScore / 100) * circumference;
    ringEl.style.stroke = isPhishing ? "var(--mars-line)" : "var(--earth)";
    ringEl.style.strokeDashoffset = offset;

    let current = 0;
    const step = Math.max(1, Math.floor(targetScore / 30));
    const timer = setInterval(() => {
      current += step;
      if (current >= targetScore) {
        current = targetScore;
        clearInterval(timer);
      }
      textEl.textContent = current;
    }, 25);
  }

  // ============================================================================
  // 6. SCREEN 3: COMPARE LOGIC (Side-by-Side Links)
  // ============================================================================
  const compareUrlA = document.getElementById("compare-url-a");
  const compareUrlB = document.getElementById("compare-url-b");
  const btnCompareScan = document.getElementById("btn-compare-scan");
  const compareError = document.getElementById("compare-error");
  const compareRadar = document.getElementById("compare-radar");
  const compareContainer = document.getElementById("compare-result-container");
  const compareBanner = document.getElementById("compare-banner");
  const compareCardA = document.getElementById("compare-card-a");
  const compareCardB = document.getElementById("compare-card-b");
  const badgeA = document.getElementById("badge-a");
  const badgeB = document.getElementById("badge-b");

  if (btnCompareScan) {
    btnCompareScan.addEventListener("click", handleCompare);
  }

  async function handleCompare() {
    const url_a = compareUrlA.value.trim();
    const url_b = compareUrlB.value.trim();

    if (!url_a || !url_b) {
      compareError.textContent = "Please enter both web addresses to compare.";
      compareError.classList.remove("hidden");
      return;
    }
    compareError.classList.add("hidden");
    compareContainer.classList.add("hidden");
    compareRadar.classList.remove("hidden");

    const startTime = Date.now();
    try {
      const res = await fetch("/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url_a, url_b })
      });
      const data = await res.json();
      const delay = Math.max(0, 1000 - (Date.now() - startTime));

      setTimeout(() => {
        compareRadar.classList.add("hidden");
        if (!res.ok) {
          compareError.textContent = data.error || "Error comparing links.";
          compareError.classList.remove("hidden");
          return;
        }

        renderCompareResults(data);
      }, delay);
    } catch (err) {
      compareRadar.classList.add("hidden");
      compareError.textContent = "Can't reach the server. Try again.";
      compareError.classList.remove("hidden");
    }
  }

  function renderCompareResults(data) {
    const a = data.a || data.result_a;
    const b = data.b || data.result_b;
    const safer = data.safer;

    // Banner setup
    compareBanner.className = "compare-banner";
    if (safer === "similar") {
      compareBanner.classList.add("banner-caution");
      compareBanner.textContent = "Both links have similar security profiles. Exercise caution.";
    } else if (safer === "a") {
      compareBanner.classList.add("banner-safer");
      compareBanner.textContent = `Safer choice: ${a.url}`;
    } else if (safer === "b") {
      compareBanner.classList.add("banner-safer");
      compareBanner.textContent = `Safer choice: ${b.url}`;
    }

    renderCompareSlot("a", a, safer === "a", safer === "similar");
    renderCompareSlot("b", b, safer === "b", safer === "similar");

    compareContainer.classList.remove("hidden");
  }

  function renderCompareSlot(slot, cardData, isSafer, isSimilar) {
    const cardEl = document.getElementById(`compare-card-${slot}`);
    const badgeEl = document.getElementById(`badge-${slot}`);
    const vIcon = document.getElementById(`verdict-icon-${slot}`);
    const vTitle = document.getElementById(`verdict-title-${slot}`);
    const isPhishing = cardData.result === "phishing";

    cardEl.className = "compare-card";
    if (isSimilar) cardEl.classList.add("card-similar");
    else if (isSafer) cardEl.classList.add("card-safer");
    else if (isPhishing) cardEl.classList.add("card-unsafe");

    badgeEl.classList.toggle("hidden", !isSafer);

    vTitle.textContent = isPhishing ? "Looks like phishing" : "Looks safe";
    vTitle.style.color = isPhishing ? "var(--mars-text)" : "#ffffff";

    vIcon.innerHTML = isPhishing
      ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="var(--mars-line)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" fill="var(--earth)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;

    document.getElementById(`url-display-${slot}`).textContent = cardData.url;
    document.getElementById(`score-${slot}`).textContent = cardData.safety_score;
    document.getElementById(`confidence-${slot}`).textContent = `Confidence: ${(cardData.confidence * 100).toFixed(1)}%`;

    const rList = document.getElementById(`reasons-${slot}`);
    rList.innerHTML = "";
    if (cardData.reasons) {
      cardData.reasons.forEach(r => {
        const li = document.createElement("li");
        li.className = "reason-item";
        li.textContent = r;
        rList.appendChild(li);
      });
    }
  }

  // ============================================================================
  // 7. SCREEN 4: SCREENSHOT LOGIC
  // ============================================================================
  const dropzone = document.getElementById("screenshot-dropzone");
  const fileInput = document.getElementById("screenshot-file-input");
  const dropzonePrompt = document.getElementById("dropzone-prompt");
  const dropzonePreview = document.getElementById("dropzone-preview");
  const previewImg = document.getElementById("preview-img");
  const previewFilename = document.getElementById("preview-filename");
  const btnRemoveFile = document.getElementById("btn-remove-file");
  const btnBrowse = document.getElementById("btn-browse");
  const btnScreenshotScan = document.getElementById("btn-screenshot-scan");
  const screenshotError = document.getElementById("screenshot-error");
  const screenshotRadar = document.getElementById("screenshot-radar");
  const screenshotResultCard = document.getElementById("screenshot-result-card");

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target !== btnRemoveFile && !dropzonePreview.contains(e.target)) {
        fileInput.click();
      }
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processImageFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        processImageFile(e.target.files[0]);
      }
    });
  }

  function processImageFile(file) {
    const valid = ["image/png", "image/jpeg", "image/webp"];
    if (!valid.includes(file.type)) {
      screenshotError.textContent = "Only PNG, JPG, or WEBP images are accepted.";
      screenshotError.classList.remove("hidden");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      screenshotError.textContent = "Image exceeds maximum allowed size of 5 MB.";
      screenshotError.classList.remove("hidden");
      return;
    }
    screenshotError.classList.add("hidden");
    selectedScreenshotFile = file;
    previewFilename.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      dropzonePrompt.classList.add("hidden");
      dropzonePreview.classList.remove("hidden");
      btnScreenshotScan.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedScreenshotFile = null;
      fileInput.value = "";
      dropzonePreview.classList.add("hidden");
      dropzonePrompt.classList.remove("hidden");
      btnScreenshotScan.disabled = true;
      screenshotError.classList.add("hidden");
      screenshotResultCard.classList.add("hidden");
    });
  }

  if (btnScreenshotScan) {
    btnScreenshotScan.addEventListener("click", handleScreenshotScan);
  }

  async function handleScreenshotScan() {
    if (!selectedScreenshotFile) return;
    screenshotError.classList.add("hidden");
    screenshotResultCard.classList.add("hidden");
    screenshotRadar.classList.remove("hidden");

    const formData = new FormData();
    formData.append("image", selectedScreenshotFile);
    formData.append("fallback", "true");

    const startTime = Date.now();
    try {
      const res = await fetch("/scan-image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      const delay = Math.max(0, 1000 - (Date.now() - startTime));

      setTimeout(() => {
        screenshotRadar.classList.add("hidden");
        if (!res.ok) {
          screenshotError.textContent = data.error || "Failed to analyze screenshot.";
          screenshotError.classList.remove("hidden");
          return;
        }

        renderScreenshotResult(data);
      }, delay);
    } catch (err) {
      screenshotRadar.classList.add("hidden");
      screenshotError.textContent = "Can't reach the server. Try again.";
      screenshotError.classList.remove("hidden");
    }
  }

  function renderScreenshotResult(data) {
    const isPhishing = data.result === "phishing";
    screenshotResultCard.className = `result-card ${isPhishing ? 'verdict-phishing' : 'verdict-safe'}`;

    document.getElementById("screenshot-verdict-title").textContent = isPhishing ? "Looks like phishing" : "Looks safe";
    document.getElementById("screenshot-verdict-icon").innerHTML = isPhishing
      ? `<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--mars-line)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="24" height="24" fill="var(--earth)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;

    document.getElementById("screenshot-url-display").textContent = data.url || "Visual page inspection";
    document.getElementById("screenshot-confidence-display").textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}%`;

    animateRing(
      document.getElementById("screenshot-score-ring-fill"),
      document.getElementById("screenshot-score-text"),
      data.safety_score,
      isPhishing
    );

    const rList = document.getElementById("screenshot-reasons-list");
    rList.innerHTML = "";
    if (data.reasons) {
      data.reasons.forEach(r => {
        const li = document.createElement("li");
        li.className = "reason-item";
        li.textContent = r;
        rList.appendChild(li);
      });
    }

    screenshotResultCard.classList.remove("hidden");
  }

  // ============================================================================
  // 8. SCREEN 5: CHAT LOGIC (Section 6)
  // ============================================================================
  const chatContextText = document.getElementById("chat-context-text");
  const btnChatGoScan = document.getElementById("btn-chat-go-scan");
  const chatMessages = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");

  function updateChatContext(scanData) {
    if (scanData && scanData.url) {
      chatContextText.textContent = `About: ${scanData.url}`;
      btnChatGoScan.classList.add("hidden");
    } else {
      chatContextText.textContent = "No scan yet";
      btnChatGoScan.classList.remove("hidden");
    }
  }

  if (btnChatGoScan) {
    btnChatGoScan.addEventListener("click", () => goTo("scanner"));
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendChatMessage();
    });
  }

  document.querySelectorAll(".quick-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.question;
      if (q) {
        chatInput.value = q;
        sendChatMessage();
      }
    });
  });

  async function sendChatMessage() {
    const question = chatInput.value.trim();
    if (!question) return;

    appendBubble(question, "user");
    chatInput.value = "";
    typingIndicator.classList.remove("hidden");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scan: lastScannedResult })
      });
      const data = await res.json();
      typingIndicator.classList.add("hidden");
      appendBubble(data.answer || "No response received.", "bot");
    } catch (err) {
      typingIndicator.classList.add("hidden");
      appendBubble("Can't reach the server. Make sure the backend is running.", "bot");
    }
  }

  function appendBubble(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}-bubble`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ============================================================================
  // 9. SCREEN 6: HISTORY LOGIC (Section 6)
  // ============================================================================
  const historyTbody = document.getElementById("history-tbody");
  const historyEmptyState = document.getElementById("history-empty-state");
  const scansTable = document.getElementById("scans-table");
  const btnHistoryScan = document.getElementById("btn-history-scan");

  if (btnHistoryScan) {
    btnHistoryScan.addEventListener("click", () => goTo("scanner"));
  }

  async function loadHistory() {
    if (!historyTbody) return;
    try {
      const res = await fetch("/history");
      if (!res.ok) return;
      const data = await res.json();
      historyTbody.innerHTML = "";

      if (!data || data.length === 0) {
        scansTable.classList.add("hidden");
        historyEmptyState.classList.remove("hidden");
        return;
      }

      scansTable.classList.remove("hidden");
      historyEmptyState.classList.add("hidden");

      data.forEach(scan => {
        const tr = document.createElement("tr");
        const isPhishing = scan.result === "phishing";
        tr.innerHTML = `
          <td><strong>${escapeHtml(scan.url)}</strong></td>
          <td><span class="table-badge ${isPhishing ? 'badge-phishing' : 'badge-safe'}">${isPhishing ? 'Phishing' : 'Safe'}</span></td>
          <td>${scan.safety_score}/100</td>
          <td>${formatDate(scan.created_at)}</td>
        `;

        // Clicking a row opens the scanner with that link filled in (Section 6)
        tr.addEventListener("click", () => {
          urlInput.value = scan.url;
          btnClear.classList.remove("hidden");
          goTo("scanner");
          handleSingleScan();
        });

        historyTbody.appendChild(tr);
      });
    } catch (e) {
      // Offline fallback
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  function formatDate(isoStr) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  }

  // ============================================================================
  // 10. SCREEN 7: HOW IT WORKS (Section 6)
  // ============================================================================
  const howTryBtn = document.getElementById("how-try-btn");
  if (howTryBtn) {
    howTryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goTo("scanner");
    });
  }

  // ============================================================================
  // 11. INITIALIZATION & ENTRANCE CHOREOGRAPHY
  // ============================================================================
  function init() {
    setFeaturedPlanet("earth");

    // Read initial hash route
    const initialRoute = window.location.hash.replace(/^#\/?/, "") || "home";
    goTo(initialRoute, false);

    // Warm planet videos on idle
    setTimeout(warmAll, 2000);
  }

  init();
});
