/**
 * script.js - Client-Side Controller for JevShield
 * Unifies SpaceEdu Hero Mode Switching with JevShield Phishing Detection System
 */

document.addEventListener("DOMContentLoaded", () => {
  let currentScan = null;
  let selectedScreenshotFile = null;

  // Mode Selection Elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = {
    single: document.getElementById("tab-single"),
    compare: document.getElementById("tab-compare"),
    image: document.getElementById("tab-screenshot")
  };
  const tabBtnMap = {
    single: document.getElementById("tab-btn-single"),
    compare: document.getElementById("tab-btn-compare"),
    image: document.getElementById("tab-btn-screenshot")
  };

  /**
   * Global mode switcher: 'single' | 'compare' | 'image'
   */
  function selectMode(mode) {
    if (!tabPanels[mode]) mode = 'single';

    tabBtns.forEach(btn => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
    Object.values(tabPanels).forEach(panel => {
      if (panel) {
        panel.classList.remove("active");
        panel.classList.add("hidden");
      }
    });

    if (tabBtnMap[mode]) {
      tabBtnMap[mode].classList.add("active");
      tabBtnMap[mode].setAttribute("aria-selected", "true");
    }
    if (tabPanels[mode]) {
      tabPanels[mode].classList.remove("hidden");
      tabPanels[mode].classList.add("active");
    }

    // Auto-focus input
    if (mode === 'single') {
      const input = document.getElementById("url-input");
      if (input) setTimeout(() => input.focus(), 300);
    } else if (mode === 'compare') {
      const inputA = document.getElementById("compare-url-a");
      if (inputA) setTimeout(() => inputA.focus(), 300);
    }
  }

  // Expose globally so Hero script and nav links can call it
  window.selectMode = selectMode;

  // Hook tab buttons
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.id === "tab-btn-single") selectMode("single");
      else if (btn.id === "tab-btn-compare") selectMode("compare");
      else if (btn.id === "tab-btn-screenshot") selectMode("image");
    });
  });

  // Hook nav links with data-mode
  document.querySelectorAll('a[data-mode]').forEach(link => {
    link.addEventListener('click', (e) => {
      const mode = link.getAttribute('data-mode');
      if (mode) selectMode(mode);
    });
  });

  // Single Scan Form elements
  const urlInput = document.getElementById("url-input");
  const btnPaste = document.getElementById("btn-paste");
  const btnClear = document.getElementById("btn-clear");
  const singleError = document.getElementById("single-error");

  if (urlInput) {
    urlInput.addEventListener("input", () => {
      if (urlInput.value.trim().length > 0) {
        btnClear.classList.remove("hidden");
      } else {
        btnClear.classList.add("hidden");
      }
      singleError.classList.add("hidden");
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      urlInput.value = "";
      btnClear.classList.add("hidden");
      singleError.classList.add("hidden");
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
          singleError.classList.add("hidden");
          urlInput.focus();
        }
      } catch (err) {
        singleError.textContent = "Could not access clipboard. Please paste manually.";
        singleError.classList.remove("hidden");
      }
    });
  }

  // Compare Form elements
  const compareUrlA = document.getElementById("compare-url-a");
  const compareUrlB = document.getElementById("compare-url-b");
  const compareError = document.getElementById("compare-error");

  // Screenshot Form elements
  const dropzone = document.getElementById("dropzone");
  const screenshotFileInput = document.getElementById("screenshot-file");
  const btnBrowseFile = document.getElementById("btn-browse-file");
  const dropzoneEmpty = document.getElementById("dropzone-empty");
  const dropzonePreview = document.getElementById("dropzone-preview");
  const previewImage = document.getElementById("preview-image");
  const previewFilename = document.getElementById("preview-filename");
  const btnRemoveFile = document.getElementById("btn-remove-file");
  const btnScanScreenshot = document.getElementById("btn-scan-screenshot");
  const screenshotError = document.getElementById("screenshot-error");

  if (btnBrowseFile && screenshotFileInput) {
    btnBrowseFile.addEventListener("click", () => screenshotFileInput.click());
  }
  if (dropzone && screenshotFileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target !== btnRemoveFile && !dropzonePreview.contains(e.target)) {
        screenshotFileInput.click();
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
        handleImageFile(e.dataTransfer.files[0]);
      }
    });
    screenshotFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFile(e.target.files[0]);
      }
    });
  }

  if (btnRemoveFile) {
    btnRemoveFile.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedScreenshotFile = null;
      screenshotFileInput.value = "";
      dropzonePreview.classList.add("hidden");
      dropzoneEmpty.classList.remove("hidden");
      btnScanScreenshot.disabled = true;
      screenshotError.classList.add("hidden");
    });
  }

  function handleImageFile(file) {
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showError(screenshotError, "Only PNG, JPG, or WEBP images are accepted.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError(screenshotError, "Image exceeds the maximum allowed size of 5 MB.");
      return;
    }
    screenshotError.classList.add("hidden");
    selectedScreenshotFile = file;
    previewFilename.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      dropzoneEmpty.classList.add("hidden");
      dropzonePreview.classList.remove("hidden");
      btnScanScreenshot.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  if (btnScanScreenshot) {
    btnScanScreenshot.addEventListener("click", handleScreenshotScan);
  }

  // Results DOM elements
  const scanningRadar = document.getElementById("scanning-radar");
  const singleResultCard = document.getElementById("single-result-card");
  const ringFill = document.getElementById("ring-fill");
  const scoreText = document.getElementById("score-text");
  const verdictIcon = document.getElementById("verdict-icon");
  const verdictTitle = document.getElementById("verdict-title");
  const scannedUrlDisplay = document.getElementById("scanned-url-display");
  const confidenceDisplay = document.getElementById("confidence-display");
  const reasonsList = document.getElementById("reasons-list");
  const didYouMeanCard = document.getElementById("did-you-mean-card");
  const suggestionsChips = document.getElementById("suggestions-chips");
  const websiteSummaryCard = document.getElementById("website-summary-card");
  const summaryCategoryChip = document.getElementById("summary-category-chip");
  const summaryBulletsList = document.getElementById("summary-bullets-list");
  const summaryNoteText = document.getElementById("summary-note-text");
  const screenshotDisclaimerNote = document.getElementById("screenshot-disclaimer-note");

  const compareResultContainer = document.getElementById("compare-result-container");
  const compareBanner = document.getElementById("compare-banner");

  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideAllResults() {
    singleResultCard.classList.add("hidden");
    compareResultContainer.classList.add("hidden");
  }

  function showRadar() {
    hideAllResults();
    scanningRadar.classList.remove("hidden");
  }

  function hideRadar() {
    scanningRadar.classList.add("hidden");
  }

  function animateScoreRing(targetScore, isPhishing) {
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // 314.159
    const offset = circumference - (targetScore / 100) * circumference;

    const rootStyles = getComputedStyle(document.documentElement);
    const earthColor = rootStyles.getPropertyValue('--earth').trim() || '#5BA8F5';
    const marsLineColor = rootStyles.getPropertyValue('--mars-line').trim() || '#E8735A';
    const venusColor = rootStyles.getPropertyValue('--venus').trim() || '#E8B04C';

    let strokeColor = earthColor; // Earth blue safe
    if (isPhishing) strokeColor = marsLineColor; // Mars line unsafe
    else if (targetScore < 70) strokeColor = venusColor; // Venus gold caution

    ringFill.style.stroke = strokeColor;
    ringFill.style.strokeDashoffset = circumference;

    let current = 0;
    const duration = 1000;
    const stepTime = 16;
    const increment = targetScore / (duration / stepTime);

    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        current = targetScore;
        clearInterval(timer);
      }
      scoreText.textContent = Math.round(current);
    }, stepTime);

    setTimeout(() => {
      ringFill.style.strokeDashoffset = offset;
    }, 50);
  }

  /**
   * Single URL scan handler
   */
  async function handleSingleScan() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showError(singleError, "Enter a valid website address, like example.com");
      return;
    }
    singleError.classList.add("hidden");
    showRadar();

    const startTime = Date.now();
    try {
      const res = await fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });
      const data = await res.json();
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1500 - elapsed);

      setTimeout(() => {
        hideRadar();
        if (!res.ok) {
          showError(singleError, data.error || "Please enter a valid website address");
          return;
        }
        renderSingleResult(data, false);
        loadHistory();
      }, delay);
    } catch (err) {
      hideRadar();
      showError(singleError, "Can't reach the server. Try again.");
    }
  }
  window.handleSingleScan = handleSingleScan;

  function renderSingleResult(data, isScreenshot = false) {
    currentScan = data;
    singleResultCard.classList.remove("hidden", "state-safe", "state-phishing");

    const isPhishing = data.result === "phishing";
    if (isPhishing) {
      singleResultCard.classList.add("state-phishing");
      verdictTitle.textContent = "Looks like phishing";
      verdictTitle.className = "verdict-title verdict-phishing";
      verdictIcon.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="var(--mars-line)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`;
    } else {
      singleResultCard.classList.add("state-safe");
      verdictTitle.textContent = "Looks safe";
      verdictTitle.className = "verdict-title verdict-safe";
      verdictIcon.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="var(--earth)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;
    }

    scannedUrlDisplay.textContent = data.url;
    confidenceDisplay.textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}%`;
    animateScoreRing(data.safety_score, isPhishing);

    // Reasons list
    reasonsList.innerHTML = "";
    if (data.reasons && data.reasons.length > 0) {
      data.reasons.forEach(r => {
        const li = document.createElement("li");
        const isSafeNotice = r.toLowerCase().includes("no common phishing") || r.toLowerCase().includes("safe");
        li.className = `reason-item ${isSafeNotice ? 'reason-safe' : 'reason-warning'}`;
        li.textContent = r;
        reasonsList.appendChild(li);
      });
    }

    // Did you mean suggestions
    if (data.suggestions && data.suggestions.length > 0) {
      suggestionsChips.innerHTML = "";
      data.suggestions.forEach(s => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip-btn";
        chip.textContent = s;
        chip.addEventListener("click", () => {
          urlInput.value = s;
          selectMode("single");
          handleSingleScan();
        });
        suggestionsChips.appendChild(chip);
      });
      didYouMeanCard.classList.remove("hidden");
    } else {
      didYouMeanCard.classList.add("hidden");
    }

    // Website summary
    if (data.summary && data.summary.points) {
      summaryCategoryChip.textContent = data.summary.category || "Website";
      summaryBulletsList.innerHTML = "";
      data.summary.points.forEach((pt, i) => {
        const li = document.createElement("li");
        li.textContent = pt;
        li.style.animation = `bubble-slide 0.25s ease-out ${i * 0.1}s both`;
        summaryBulletsList.appendChild(li);
      });
      summaryNoteText.classList.add("hidden");
      websiteSummaryCard.classList.remove("hidden");
    } else if (data.summary_note) {
      summaryCategoryChip.textContent = "Notice";
      summaryBulletsList.innerHTML = "";
      summaryNoteText.textContent = data.summary_note;
      summaryNoteText.classList.remove("hidden");
      websiteSummaryCard.classList.remove("hidden");
    } else {
      websiteSummaryCard.classList.add("hidden");
    }

    if (isScreenshot) screenshotDisclaimerNote.classList.remove("hidden");
    else screenshotDisclaimerNote.classList.add("hidden");

    enableChat(data);
    singleResultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /**
   * Compare Two Links scan handler
   */
  async function handleCompareScan() {
    const urlA = compareUrlA.value.trim();
    const urlB = compareUrlB.value.trim();
    if (!urlA || !urlB) {
      showError(compareError, "Please enter both website addresses to compare.");
      return;
    }
    compareError.classList.add("hidden");
    showRadar();

    const startTime = Date.now();
    try {
      const res = await fetch("/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url_a: urlA, url_b: urlB })
      });
      const data = await res.json();
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1500 - elapsed);

      setTimeout(() => {
        hideRadar();
        if (!res.ok) {
          showError(compareError, data.error || "Error comparing websites.");
          return;
        }
        renderCompareResult(data);
        loadHistory();
      }, delay);
    } catch (err) {
      hideRadar();
      showError(compareError, "Can't reach the server. Try again.");
    }
  }
  window.handleCompareScan = handleCompareScan;

  function renderCompareResult(data) {
    compareResultContainer.classList.remove("hidden");

    if (data.note) {
      compareBanner.textContent = data.note;
      compareBanner.classList.remove("hidden");
      if (data.note.toLowerCase().includes("similar") || data.safer === "similar") {
        compareBanner.className = "compare-banner banner-similar";
        compareResultContainer.classList.add("state-similar");
      } else {
        compareBanner.className = "compare-banner";
        compareResultContainer.classList.remove("state-similar");
      }
    } else {
      compareBanner.classList.add("hidden");
      compareResultContainer.classList.remove("state-similar");
    }

    const badgeA = document.getElementById("badge-a");
    const badgeB = document.getElementById("badge-b");
    badgeA.classList.add("hidden");
    badgeB.classList.add("hidden");

    if (data.safer === "a") badgeA.classList.remove("hidden");
    else if (data.safer === "b") badgeB.classList.remove("hidden");

    renderCompareCard("a", data.a);
    renderCompareCard("b", data.b);

    enableChat(data.a);
    compareResultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderCompareCard(slot, cardData) {
    const vTitle = document.getElementById(`verdict-title-${slot}`);
    const vIcon = document.getElementById(`verdict-icon-${slot}`);
    const isPhishing = cardData.result === "phishing";

    vTitle.textContent = isPhishing ? "Looks like phishing" : "Looks safe";
    vTitle.className = `verdict-title ${isPhishing ? 'verdict-phishing' : 'verdict-safe'}`;

    vIcon.innerHTML = isPhishing
      ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--mars-line)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="22" height="22" fill="var(--earth)"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;

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

  /**
   * Screenshot OCR Scan handler
   */
  async function handleScreenshotScan() {
    if (!selectedScreenshotFile) return;
    screenshotError.classList.add("hidden");
    showRadar();

    const formData = new FormData();
    formData.append("image", selectedScreenshotFile);

    const startTime = Date.now();
    try {
      const res = await fetch("/scan-image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      const elapsed = Date.now() - startTime;
      const delay = Math.max(0, 1500 - elapsed);

      setTimeout(() => {
        hideRadar();
        if (!res.ok) {
          showError(screenshotError, data.error || "Error analyzing image.");
          return;
        }
        renderSingleResult(data, true);
        loadHistory();
      }, delay);
    } catch (err) {
      hideRadar();
      showError(screenshotError, "Can't reach the server. Try again.");
    }
  }

  /**
   * Chatbot functionality
   */
  const chatInput = document.getElementById("chat-input");
  const btnChatSend = document.getElementById("btn-chat-send");
  const chatMessages = document.getElementById("chat-messages");
  const typingIndicator = document.getElementById("typing-indicator");
  const chatStatusHint = document.getElementById("chat-status-hint");

  function enableChat(scanData) {
    currentScan = scanData;
    chatInput.disabled = false;
    btnChatSend.disabled = false;
    chatStatusHint.textContent = `Asking about: ${scanData.url}`;
  }

  async function handleSendChat(customQuery = null) {
    const question = customQuery || chatInput.value.trim();
    if (!question) return;

    appendMessage(question, "user");
    if (!customQuery) chatInput.value = "";
    typingIndicator.classList.remove("hidden");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scan: currentScan })
      });
      const data = await res.json();
      typingIndicator.classList.add("hidden");
      appendMessage(data.answer || "No response received.", "bot");
    } catch (err) {
      typingIndicator.classList.add("hidden");
      appendMessage("Can't reach the server. Try again.", "bot");
    }
  }
  window.handleSendChat = handleSendChat;

  function appendMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}-bubble`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  document.querySelectorAll(".quick-chip-btn").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.getAttribute("data-query");
      if (q) handleSendChat(q);
    });
  });

  /**
   * Recent Scans Table loader
   */
  async function loadHistory() {
    const tbody = document.getElementById("scans-table-body");
    try {
      const res = await fetch("/history");
      if (!res.ok) return;
      const data = await res.json();
      tbody.innerHTML = "";
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No scans recorded yet. Enter a link above to get started.</td></tr>`;
        return;
      }
      data.forEach(scan => {
        const tr = document.createElement("tr");
        const isPhishing = scan.result === "phishing";
        tr.innerHTML = `
          <td><strong>${escapeHtml(scan.url)}</strong></td>
          <td><span class="table-badge ${isPhishing ? 'badge-phishing' : 'badge-safe'}">${isPhishing ? 'Phishing' : 'Safe'}</span></td>
          <td>${scan.safety_score}/100</td>
          <td>${formatDate(scan.created_at)}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {}
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

  // Back to top button listener
  const backToTopBtn = document.getElementById("back-to-top");
  window.addEventListener("scroll", () => {
    if (backToTopBtn) {
      if (window.scrollY > window.innerHeight * 0.7) {
        backToTopBtn.classList.remove("hidden");
      } else {
        backToTopBtn.classList.add("hidden");
      }
    }
  });

  // Reveal on scroll observer
  const reveals = document.querySelectorAll(".reveal-on-scroll");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add("is-visible"));
  }

  // Load history on boot
  loadHistory();
});
