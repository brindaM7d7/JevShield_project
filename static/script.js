/**
 * script.js - Client-Side Controller for JevShield
 * Plain vanilla JavaScript handling tab navigation, API calls, radar animations,
 * score ring count-ups, screenshot upload preview, chatbot state, and scan history.
 *
 * Security: Uses textContent and safe DOM construction (no innerHTML with raw user data).
 */

document.addEventListener("DOMContentLoaded", () => {
    // Current active scan result stored for chatbot context
    let currentScan = null;
    let selectedScreenshotFile = null;

    // DOM Elements - Tabs
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanels = {
        "tab-btn-single": document.getElementById("tab-single"),
        "tab-btn-compare": document.getElementById("tab-compare"),
        "tab-btn-screenshot": document.getElementById("tab-screenshot"),
    };

    // DOM Elements - Single Scan Form
    const urlInput = document.getElementById("url-input");
    const btnPaste = document.getElementById("btn-paste");
    const btnClear = document.getElementById("btn-clear");
    const singleError = document.getElementById("single-error");

    // DOM Elements - Compare Form
    const compareUrlA = document.getElementById("compare-url-a");
    const compareUrlB = document.getElementById("compare-url-b");
    const compareError = document.getElementById("compare-error");

    // DOM Elements - Screenshot Form
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

    // DOM Elements - Results Section
    const resultsSection = document.getElementById("results-section");
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

    // Compare Result DOM Elements
    const compareResultContainer = document.getElementById("compare-result-container");
    const compareBanner = document.getElementById("compare-banner");
    const compareCardA = document.getElementById("compare-card-a");
    const compareCardB = document.getElementById("compare-card-b");
    const badgeA = document.getElementById("badge-a");
    const badgeB = document.getElementById("badge-b");
    const verdictIconA = document.getElementById("verdict-icon-a");
    const verdictIconB = document.getElementById("verdict-icon-b");
    const verdictTitleA = document.getElementById("verdict-title-a");
    const verdictTitleB = document.getElementById("verdict-title-b");
    const urlDisplayA = document.getElementById("url-display-a");
    const urlDisplayB = document.getElementById("url-display-b");
    const scoreA = document.getElementById("score-a");
    const scoreB = document.getElementById("score-b");
    const confidenceA = document.getElementById("confidence-a");
    const confidenceB = document.getElementById("confidence-b");
    const reasonsA = document.getElementById("reasons-a");
    const reasonsB = document.getElementById("reasons-b");

    // DOM Elements - Chatbot
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const btnChatSend = document.getElementById("btn-chat-send");
    const chatStatusHint = document.getElementById("chat-status-hint");
    const typingIndicator = document.getElementById("typing-indicator");
    const quickChipBtns = document.querySelectorAll(".quick-chip-btn");

    // DOM Elements - History Table
    const scansTableBody = document.getElementById("scans-table-body");

    // =========================================================================
    // TAB NAVIGATION
    // =========================================================================
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => {
                b.classList.remove("active");
                b.setAttribute("aria-selected", "false");
            });
            Object.values(tabPanels).forEach(panel => {
                panel.classList.add("hidden");
                panel.classList.remove("active");
            });

            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
            const activePanel = tabPanels[btn.id];
            if (activePanel) {
                activePanel.classList.remove("hidden");
                activePanel.classList.add("active");
            }
            clearAllErrors();
        });
    });

    // =========================================================================
    // INPUT HELPERS (Paste, Clear, Typing)
    // =========================================================================
    urlInput.addEventListener("input", () => {
        if (urlInput.value.trim().length > 0) {
            btnClear.classList.remove("hidden");
        } else {
            btnClear.classList.add("hidden");
        }
        hideError(singleError);
    });

    btnClear.addEventListener("click", () => {
        urlInput.value = "";
        btnClear.classList.add("hidden");
        urlInput.focus();
        hideError(singleError);
    });

    btnPaste.addEventListener("click", async () => {
        try {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
                urlInput.value = clipText.trim();
                btnClear.classList.remove("hidden");
                hideError(singleError);
            }
        } catch {
            showError(singleError, "Clipboard access was denied. Please paste manually.");
        }
    });

    // =========================================================================
    // SCREENSHOT UPLOAD & DRAG/DROP
    // =========================================================================
    btnBrowseFile.addEventListener("click", () => screenshotFileInput.click());
    dropzone.addEventListener("click", (e) => {
        if (e.target !== btnRemoveFile && !selectedScreenshotFile) {
            screenshotFileInput.click();
        }
    });

    ["dragenter", "dragover"].forEach(evtName => {
        dropzone.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        });
    });

    ["dragleave", "drop"].forEach(evtName => {
        dropzone.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    screenshotFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    function handleSelectedFile(file) {
        hideError(screenshotError);
        const validTypes = ["image/png", "image/jpeg", "image/webp"];
        if (!validTypes.includes(file.type)) {
            showError(screenshotError, "Only PNG, JPG, or WEBP images are supported.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showError(screenshotError, "Image exceeds the 5 MB limit. Please choose a smaller file.");
            return;
        }

        selectedScreenshotFile = file;
        previewFilename.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (evt) => {
            previewImage.src = evt.target.result;
            dropzoneEmpty.classList.add("hidden");
            dropzonePreview.classList.remove("hidden");
            btnScanScreenshot.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    btnRemoveFile.addEventListener("click", (e) => {
        e.stopPropagation();
        resetScreenshotDropzone();
    });

    function resetScreenshotDropzone() {
        selectedScreenshotFile = null;
        screenshotFileInput.value = "";
        previewImage.src = "";
        previewFilename.textContent = "";
        dropzonePreview.classList.add("hidden");
        dropzoneEmpty.classList.remove("hidden");
        btnScanScreenshot.disabled = true;
        hideError(screenshotError);
    }

    // =========================================================================
    // ERROR DISPLAY UTILITIES
    // =========================================================================
    function showError(el, message) {
        el.textContent = message;
        el.classList.remove("hidden");
        // Re-trigger shake animation
        el.style.animation = "none";
        void el.offsetWidth;
        el.style.animation = "shakeErr 0.35s ease";
    }

    function hideError(el) {
        el.textContent = "";
        el.classList.add("hidden");
    }

    function clearAllErrors() {
        hideError(singleError);
        hideError(compareError);
        hideError(screenshotError);
    }

    // =========================================================================
    // ANIMATED SCORE RING COUNT-UP
    // =========================================================================
    function animateScoreRing(targetScore, isPhishing) {
        const radius = 50;
        const circumference = 2 * Math.PI * radius; // ~314.16
        ringFill.style.strokeDasharray = `${circumference}`;

        let currentVal = 0;
        const duration = 1200; // ms
        const startTime = performance.now();

        function updateCount(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            currentVal = Math.round(easeOut * targetScore);
            scoreText.textContent = currentVal;

            const offset = circumference - (currentVal / 100) * circumference;
            ringFill.style.strokeDashoffset = `${offset}`;

            if (progress < 1) {
                requestAnimationFrame(updateCount);
            } else {
                scoreText.textContent = targetScore;
            }
        }

        requestAnimationFrame(updateCount);
    }

    // =========================================================================
    // RENDER SINGLE SCAN RESULT
    // =========================================================================
    function renderSingleResult(data, isScreenshot = false) {
        currentScan = data;
        enableChatbot(data);

        // Hide radar and compare view
        scanningRadar.classList.add("hidden");
        compareResultContainer.classList.add("hidden");
        singleResultCard.classList.remove("hidden");

        const isPhishing = data.result === "phishing";

        // Setup card classes
        singleResultCard.classList.remove("state-safe", "state-phishing");
        singleResultCard.classList.add(isPhishing ? "state-phishing" : "state-safe");

        // Set verdict text and icon
        if (isPhishing) {
            verdictIcon.textContent = "⚠️";
            verdictTitle.textContent = "Looks like phishing";
        } else {
            verdictIcon.textContent = "🛡️";
            verdictTitle.textContent = "Looks safe";
        }

        scannedUrlDisplay.textContent = data.url;
        confidenceDisplay.textContent = `Confidence: ${(data.confidence * 100).toFixed(1)}%`;

        // Animate circular ring
        animateScoreRing(data.safety_score, isPhishing);

        // Populate reasons list safely
        reasonsList.innerHTML = "";
        (data.reasons || []).forEach(r => {
            const li = document.createElement("li");
            li.textContent = r;
            reasonsList.appendChild(li);
        });

        // Did you mean / typo suggestions
        if (data.suggestions && data.suggestions.length > 0) {
            suggestionsChips.innerHTML = "";
            data.suggestions.forEach(dom => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "chip-btn";
                btn.textContent = dom;
                btn.title = `Scan ${dom} instead`;
                btn.addEventListener("click", () => {
                    urlInput.value = dom;
                    tabBtns[0].click();
                    handleSingleScan();
                });
                suggestionsChips.appendChild(btn);
            });
            didYouMeanCard.classList.remove("hidden");
        } else {
            didYouMeanCard.classList.add("hidden");
        }

        // Summary Card
        summaryBulletsList.innerHTML = "";
        summaryNoteText.classList.add("hidden");

        if (data.summary && data.summary.points) {
            summaryCategoryChip.textContent = data.summary.category || "Website";
            data.summary.points.forEach(pt => {
                const li = document.createElement("li");
                li.textContent = pt;
                summaryBulletsList.appendChild(li);
            });
            websiteSummaryCard.classList.remove("hidden");
        } else if (data.summary_note) {
            summaryCategoryChip.textContent = isPhishing ? "Blocked" : "Note";
            summaryNoteText.textContent = data.summary_note;
            summaryNoteText.classList.remove("hidden");
            websiteSummaryCard.classList.remove("hidden");
        } else {
            websiteSummaryCard.classList.add("hidden");
        }

        // Screenshot disclaimer note
        if (isScreenshot || data.note) {
            screenshotDisclaimerNote.textContent = data.note || "Image analysis is a best guess. Always check the address bar.";
            screenshotDisclaimerNote.classList.remove("hidden");
        } else {
            screenshotDisclaimerNote.classList.add("hidden");
        }

        // Scroll into view smoothly
        resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
        loadHistory();
    }

    // =========================================================================
    // RENDER COMPARE RESULT
    // =========================================================================
    function renderCompareResult(data) {
        currentScan = data.a;
        enableChatbot(data.a);

        scanningRadar.classList.add("hidden");
        singleResultCard.classList.add("hidden");
        compareResultContainer.classList.remove("hidden");

        // Banner if neither site is safe
        if (data.note && data.note.length > 0) {
            compareBanner.textContent = data.note;
            compareBanner.classList.remove("hidden");
        } else {
            compareBanner.classList.add("hidden");
        }

        // Safer choice badges
        badgeA.classList.add("hidden");
        badgeB.classList.add("hidden");
        if (data.safer === "a") {
            badgeA.classList.remove("hidden");
        } else if (data.safer === "b") {
            badgeB.classList.remove("hidden");
        }

        renderCardSide(compareCardA, data.a, verdictIconA, verdictTitleA, urlDisplayA, scoreA, confidenceA, reasonsA, data.safer === "similar");
        renderCardSide(compareCardB, data.b, verdictIconB, verdictTitleB, urlDisplayB, scoreB, confidenceB, reasonsB, data.safer === "similar");

        resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
        loadHistory();
    }

    function renderCardSide(card, item, iconEl, titleEl, urlEl, scoreEl, confEl, reasonsEl, isSimilar) {
        card.classList.remove("state-safe", "state-phishing", "state-similar");
        const isPhishing = item.result === "phishing";

        if (isSimilar) {
            card.classList.add("state-similar");
            iconEl.textContent = "⚖️";
            titleEl.textContent = isPhishing ? "Looks like phishing" : "Looks safe";
        } else if (isPhishing) {
            card.classList.add("state-phishing");
            iconEl.textContent = "⚠️";
            titleEl.textContent = "Looks like phishing";
        } else {
            card.classList.add("state-safe");
            iconEl.textContent = "🛡️";
            titleEl.textContent = "Looks safe";
        }

        urlEl.textContent = item.url;
        scoreEl.textContent = item.safety_score;
        confEl.textContent = `Confidence: ${(item.confidence * 100).toFixed(1)}%`;

        reasonsEl.innerHTML = "";
        (item.reasons || []).forEach(r => {
            const li = document.createElement("li");
            li.textContent = r;
            reasonsEl.appendChild(li);
        });
    }

    // =========================================================================
    // API CALLS (Single, Compare, Screenshot)
    // =========================================================================
    window.handleSingleScan = async function(isFast = false) {
        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            showError(singleError, "Enter a valid website address, like example.com");
            return;
        }

        hideError(singleError);
        startRadarSweep();

        const delay = isFast ? 100 : 1500;
        const minTimer = new Promise(resolve => setTimeout(resolve, delay));

        try {
            const responsePromise = fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: rawUrl }),
            });

            const [response] = await Promise.all([responsePromise, minTimer]);
            const data = await response.json();

            if (!response.ok) {
                stopRadarSweep();
                showError(singleError, data.error || "Please enter a valid website address");
                return;
            }

            renderSingleResult(data, false);
        } catch {
            stopRadarSweep();
            showError(singleError, "Can't reach the server. Try again.");
        }
    };

    window.handleCompareScan = async function(isFast = false) {
        const urlA = compareUrlA.value.trim();
        const urlB = compareUrlB.value.trim();

        if (!urlA || !urlB) {
            showError(compareError, "Please enter two valid website addresses, like google.com and example.com");
            return;
        }

        hideError(compareError);
        startRadarSweep();

        const delay = isFast ? 100 : 1500;
        const minTimer = new Promise(resolve => setTimeout(resolve, delay));

        try {
            const responsePromise = fetch("/compare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url_a: urlA, url_b: urlB }),
            });

            const [response] = await Promise.all([responsePromise, minTimer]);
            const data = await response.json();

            if (!response.ok) {
                stopRadarSweep();
                showError(compareError, data.error || "Please enter two valid website addresses");
                return;
            }

            renderCompareResult(data);
        } catch {
            stopRadarSweep();
            showError(compareError, "Can't reach the server. Try again.");
        }
    };

    btnScanScreenshot.addEventListener("click", async () => {
        if (!selectedScreenshotFile) {
            showError(screenshotError, "Please choose an image file first.");
            return;
        }

        hideError(screenshotError);
        startRadarSweep();

        const formData = new FormData();
        formData.append("image", selectedScreenshotFile);

        const minTimer = new Promise(resolve => setTimeout(resolve, 1500));

        try {
            const responsePromise = fetch("/scan-image", {
                method: "POST",
                body: formData,
            });

            const [response] = await Promise.all([responsePromise, minTimer]);
            const data = await response.json();

            if (!response.ok) {
                stopRadarSweep();
                showError(screenshotError, data.error || "Failed to analyze screenshot.");
                return;
            }

            renderSingleResult(data, true);
        } catch {
            stopRadarSweep();
            showError(screenshotError, "Can't reach the server. Try again.");
        }
    });

    function startRadarSweep() {
        singleResultCard.classList.add("hidden");
        compareResultContainer.classList.add("hidden");
        scanningRadar.classList.remove("hidden");
        resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function stopRadarSweep() {
        scanningRadar.classList.add("hidden");
    }

    // =========================================================================
    // CHATBOT INTERACTION
    // =========================================================================
    function enableChatbot(scan) {
        chatInput.disabled = false;
        btnChatSend.disabled = false;
        quickChipBtns.forEach(btn => btn.disabled = false);
        chatStatusHint.textContent = `Active Context: ${scan.url}`;

        // Add friendly introduction message if clean
        const msg = document.createElement("div");
        msg.className = "chat-bubble bot-bubble";
        msg.textContent = `I've analyzed ${scan.url}. Feel free to ask why it was flagged, if it is safe to open, or what steps to take.`;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    quickChipBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const query = btn.getAttribute("data-query");
            if (query && currentScan) {
                sendChatMessage(query);
            }
        });
    });

    window.handleSendChat = function() {
        const text = chatInput.value.trim();
        if (!text || !currentScan) return;
        sendChatMessage(text);
        chatInput.value = "";
    };

    async function sendChatMessage(question) {
        if (!currentScan) return;

        // Render user message bubble safely
        const userBubble = document.createElement("div");
        userBubble.className = "chat-bubble user-bubble";
        userBubble.textContent = question;
        chatMessages.appendChild(userBubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Show typing indicator
        typingIndicator.classList.remove("hidden");

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: question,
                    scan: currentScan,
                }),
            });

            const data = await response.json();
            typingIndicator.classList.add("hidden");

            const botBubble = document.createElement("div");
            botBubble.className = "chat-bubble bot-bubble";
            botBubble.textContent = data.answer || "I could not analyze that question. Please try asking about the scan safety.";
            chatMessages.appendChild(botBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch {
            typingIndicator.classList.add("hidden");
            const errBubble = document.createElement("div");
            errBubble.className = "chat-bubble bot-bubble";
            errBubble.textContent = "Could not reach assistant. Please try again.";
            chatMessages.appendChild(errBubble);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // =========================================================================
    // RECENT SCANS TABLE
    // =========================================================================
    async function loadHistory() {
        try {
            const res = await fetch("/history");
            if (!res.ok) return;
            const scans = await res.json();

            scansTableBody.innerHTML = "";
            if (!scans || scans.length === 0) {
                const tr = document.createElement("tr");
                tr.className = "empty-row";
                const td = document.createElement("td");
                td.colSpan = 4;
                td.textContent = "No recent scans yet. Scan a URL above!";
                tr.appendChild(td);
                scansTableBody.appendChild(tr);
                return;
            }

            scans.forEach(s => {
                const tr = document.createElement("tr");

                // URL cell
                const tdUrl = document.createElement("td");
                const spanUrl = document.createElement("span");
                spanUrl.className = "table-url";
                spanUrl.textContent = s.url;
                spanUrl.title = s.url;
                tdUrl.appendChild(spanUrl);

                // Verdict cell
                const tdVerdict = document.createElement("td");
                const badge = document.createElement("span");
                const isSafe = s.result === "safe";
                badge.className = `badge-verdict ${isSafe ? "badge-safe" : "badge-phishing"}`;
                badge.textContent = isSafe ? "✓ Safe" : "⚠️ Phishing";
                tdVerdict.appendChild(badge);

                // Score cell
                const tdScore = document.createElement("td");
                tdScore.textContent = `${s.safety_score}/100`;

                // Time cell
                const tdTime = document.createElement("td");
                tdTime.textContent = s.created_at || "Recent";

                tr.appendChild(tdUrl);
                tr.appendChild(tdVerdict);
                tr.appendChild(tdScore);
                tr.appendChild(tdTime);

                scansTableBody.appendChild(tr);
            });
        } catch {
            // Silently fallback on failure
        }
    }

    // Initial load of history
    loadHistory();

    // Check for automated testing / demonstration query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get("test");
    const isFast = urlParams.get("fast") === "1";

    if (testMode === "safe") {
        urlInput.value = "https://google.com";
        btnClear.classList.remove("hidden");
        handleSingleScan(isFast);
    } else if (testMode === "phishing") {
        urlInput.value = "http://paypal.com-login-verify.secure-update.tk:8080/account";
        btnClear.classList.remove("hidden");
        handleSingleScan(isFast);
    } else if (testMode === "compare") {
        tabBtns[1].click();
        compareUrlA.value = "google.com";
        compareUrlB.value = "http://fake-bank-login.com";
        handleCompareScan(isFast);
    } else if (testMode === "chat") {
        urlInput.value = "http://paypal.com-login-verify.secure-update.tk:8080/account";
        btnClear.classList.remove("hidden");
        handleSingleScan(true);
        setTimeout(() => {
            sendChatMessage("Why was this flagged?");
        }, 500);
    }
});
