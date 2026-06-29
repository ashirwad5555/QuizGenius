// ==========================================================================
// STATE & CONFIGURATION
// ==========================================================================
const CONFIG = {
    // API_URL: 'http://localhost:5000/api',
    // API_URL: 'http://10.94.119.134:5000/api',
    API_URL: 'https://quizgenius-phi.vercel.app/api',
    CIRCUMFERENCE: 2 * Math.PI * 54 // 2 * pi * r (r=54 for score circle)
};

const state = {
    currentView: 'home',
    topic: '',
    difficulty: 'Medium',
    questions: [],
    userAnswers: [], // Stores selected answer strings
    context: '',     // Retrieved Wikipedia context
    history: [],     // Saved quizzes loaded from localStorage
    theme: 'dark',   // 'dark' or 'light'
    loadingTimer: null,
    loadingStartTime: 0
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const views = {
    home: document.getElementById('home-view'),
    loading: document.getElementById('loading-view'),
    error: document.getElementById('error-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view')
};

// Theme & Header Elements
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Form and Input Elements
const quizForm = document.getElementById('quiz-generation-form');
const topicInput = document.getElementById('topic-input');
const charCounter = document.getElementById('char-counter');
const exampleButtons = document.querySelectorAll('.example-tag-btn');
const generateBtn = document.getElementById('generate-btn');

// Loading View Elements
const loadingSteps = {
    wiki: document.getElementById('step-wiki'),
    context: document.getElementById('step-context'),
    gemini: document.getElementById('step-gemini'),
    status: document.getElementById('loading-status'),
    title: document.getElementById('loading-title'),
    timer: document.getElementById('loading-timer')
};

// Error View Elements
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');
const errorRetryBtn = document.getElementById('error-retry-btn');
const errorBackBtn = document.getElementById('error-back-btn');

// Quiz View Elements
const quizTopicDisplay = document.getElementById('quiz-topic-display');
const quizDiffDisplay = document.getElementById('quiz-diff-display');
const progressText = document.getElementById('progress-text');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const questionsList = document.getElementById('questions-list');
const quizSubmissionForm = document.getElementById('quiz-submission-form');
const quitQuizBtn = document.getElementById('quit-quiz-btn');

// Results View Elements
const resultsTopicDisplay = document.getElementById('results-topic-display');
const resultsDiffDisplay = document.getElementById('results-diff-display');
const scoreCircleVal = document.getElementById('score-circle-val');
const scoreNumberDisplay = document.getElementById('score-number-display');
const scorePercentDisplay = document.getElementById('score-percent-display');
const scoreFeedbackBadge = document.getElementById('score-feedback-badge');
const reviewList = document.getElementById('review-list');
const resultsHomeBtn = document.getElementById('results-home-btn');
const regenerateQuizBtn = document.getElementById('regenerate-quiz-btn');
const resultsContextAccordion = document.getElementById('results-context-accordion');
const resultsContextTextDisplay = document.getElementById('results-context-text-display');

// Scorecard Stats Dashboard
const statCorrectCount = document.getElementById('stat-correct-count');
const statWrongCount = document.getElementById('stat-wrong-count');
const statAccuracyPercent = document.getElementById('stat-accuracy-percent');

// Knowledge Insights Elements
const insightsStrengths = document.getElementById('insights-strengths');
const insightsWeaknesses = document.getElementById('insights-weaknesses');
const insightsRevision = document.getElementById('insights-revision');

// Quick Copy & Export Buttons
const copyQuizBtn = document.getElementById('copy-quiz-btn');
const copyExplanationsBtn = document.getElementById('copy-explanations-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportJsonBtn = document.getElementById('export-json-btn');

// Sidebar Elements
const historySidebar = document.getElementById('history-sidebar');
const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Add Sidebar Overlay
const sidebarOverlay = document.querySelector('.sidebar-overlay');

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadHistory();
    initEventListeners();
});

// ==========================================================================
// THEME MANAGEMENT (FEATURE 15)
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('quiz_theme') || 'dark';
    state.theme = savedTheme;
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.body.classList.remove('light-theme');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}

function toggleTheme() {
    if (state.theme === 'dark') {
        state.theme = 'light';
        document.body.classList.add('light-theme');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        state.theme = 'dark';
        document.body.classList.remove('light-theme');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    localStorage.setItem('quiz_theme', state.theme);
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function initEventListeners() {
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Topic Input Character Counter
    topicInput.addEventListener('input', () => {
        const len = topicInput.value.length;
        charCounter.innerText = `${len} / 60`;
    });

    // Home View: Submit Topic Form
    quizForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
        if (topic) {
            state.difficulty = difficulty;
            generateQuiz(topic, difficulty);
        }
    });

    // Home View: Click Example Pills
    exampleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            topicInput.value = btn.getAttribute('data-topic');
            topicInput.focus();
            // Trigger character counter update
            charCounter.innerText = `${topicInput.value.length} / 60`;
        });
    });

    // Error View: Retry & Back Buttons
    errorRetryBtn.addEventListener('click', () => {
        if (state.topic) {
            generateQuiz(state.topic, state.difficulty);
        }
    });
    errorBackBtn.addEventListener('click', () => {
        showView('home');
    });

    // Quiz View: Submit Answers
    quizSubmissionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const unansweredIdx = getFirstUnansweredQuestionIndex();
        if (unansweredIdx !== -1) {
            alert(`Please answer Question ${unansweredIdx + 1} before submitting.`);
            const qCards = questionsList.querySelectorAll('.question-card');
            qCards[unansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        submitQuiz();
    });

    // Quiz View: Quit Quiz
    quitQuizBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit this quiz? Your progress will be lost.')) {
            showView('home');
        }
    });

    // Results View: Back to Home
    resultsHomeBtn.addEventListener('click', () => {
        topicInput.value = '';
        charCounter.innerText = '0 / 60';
        showView('home');
    });

    // Results View: Generate Another Quiz (Feature 6)
    regenerateQuizBtn.addEventListener('click', () => {
        if (state.topic) {
            generateQuiz(state.topic, state.difficulty);
        }
    });

    // Copy Buttons
    copyQuizBtn.addEventListener('click', copyQuizToClipboard);
    copyExplanationsBtn.addEventListener('click', copyExplanationsToClipboard);

    // Export Buttons (Feature 7)
    exportPdfBtn.addEventListener('click', () => window.print());
    exportJsonBtn.addEventListener('click', exportQuizToJSON);

    // Sidebar: Toggle, Close, Overlay
    toggleHistoryBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Sidebar: Clear History
    clearHistoryBtn.addEventListener('click', clearHistory);
}

// ==========================================================================
// VIEW CONTROLLER
// ==========================================================================
function showView(viewName) {
    state.currentView = viewName;

    Object.keys(views).forEach(name => {
        if (name === viewName) {
            views[name].classList.add('active');
        } else {
            views[name].classList.remove('active');
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// API SERVICE: GENERATE QUIZ (RAG)
// ==========================================================================
async function generateQuiz(topic, difficulty) {
    state.topic = topic;
    state.difficulty = difficulty;
    showView('loading');
    resetLoadingSteps();

    // Start Response Timer (Feature 5)
    startLoadingTimer();

    // Start loading step animations
    const stepInterval = animateLoadingSteps();

    try {
        const response = await fetch(`${CONFIG.API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic, difficulty })
        });

        clearInterval(stepInterval);
        stopLoadingTimer();

        const data = await response.json();

        if (!response.ok) {
            const errDetails = data.details ? `Details: ${data.details}` : '';
            showError(
                data.error || 'Generation Failed',
                data.message || 'An error occurred while building your quiz.',
                errDetails
            );
            return;
        }

        // Successfully generated
        state.questions = data.questions;
        state.topic = data.topic; // Resolved title
        state.context = data.context || ''; // Wikipedia Context
        state.userAnswers = new Array(state.questions.length).fill(null);

        // Render Context Viewer (Feature 4)
        renderContextViewer();

        // Render and transition
        renderQuiz();
        updateProgressBar();
        showView('quiz');

    } catch (error) {
        clearInterval(stepInterval);
        stopLoadingTimer();
        showError(
            'Network Connection Failure',
            'Unable to communicate with the quiz builder server. Make sure your Flask backend is running on port 5000.',
            error.message
        );
    }
}

// ==========================================================================
// LOADING STATE & TIMER (FEATURE 5)
// ==========================================================================
function startLoadingTimer() {
    state.loadingStartTime = Date.now();
    loadingSteps.timer.innerText = 'Response Time: 0.0s';
    state.loadingTimer = setInterval(() => {
        const elapsed = (Date.now() - state.loadingStartTime) / 1000;
        loadingSteps.timer.innerText = `Response Time: ${elapsed.toFixed(1)}s`;
    }, 100);
}

function stopLoadingTimer() {
    if (state.loadingTimer) {
        clearInterval(state.loadingTimer);
    }
}

function resetLoadingSteps() {
    loadingSteps.wiki.className = 'step-item active';
    loadingSteps.context.className = 'step-item';
    loadingSteps.gemini.className = 'step-item';
    loadingSteps.title.innerText = 'Retrieving Knowledge';
    loadingSteps.status.innerText = 'Searching Wikipedia for reference material...';
}

function animateLoadingSteps() {
    let tick = 0;
    return setInterval(() => {
        tick++;
        if (tick === 2) { // 1.0 second
            loadingSteps.wiki.className = 'step-item completed';
            loadingSteps.context.className = 'step-item active';
            loadingSteps.title.innerText = 'Injecting Context';
            loadingSteps.status.innerText = 'Structuring Wikipedia summary into RAG prompt...';
        } else if (tick === 5) { // 2.5 seconds
            loadingSteps.context.className = 'step-item completed';
            loadingSteps.gemini.className = 'step-item active';
            loadingSteps.title.innerText = 'Synthesizing Quiz';
            loadingSteps.status.innerText = 'QuizGenius is synthesizing your questions...';
        }
    }, 500);
}

function showError(title, message, details = '') {
    document.getElementById('error-title').innerText = title;
    errorMessage.innerText = message;
    if (details) {
        errorDetails.style.display = 'block';
        errorDetails.innerText = details;
    } else {
        errorDetails.style.display = 'none';
    }
    showView('error');
}

// ==========================================================================
// WIKIPEDIA CONTEXT VIEWER (FEATURE 4)
// ==========================================================================
function renderContextViewer() {
    if (state.context) {
        resultsContextAccordion.style.display = 'block';
        resultsContextTextDisplay.innerText = state.context;
    } else {
        resultsContextAccordion.style.display = 'none';
    }
    // Ensure accordions are closed by default
    resultsContextAccordion.removeAttribute('open');
}

// ==========================================================================
// QUIZ VIEW RENDERING & ACCESSIBILITY (FEATURE 16)
// ==========================================================================
function renderQuiz() {
    quizTopicDisplay.innerText = state.topic;
    quizDiffDisplay.innerText = state.difficulty;
    questionsList.innerHTML = '';

    state.questions.forEach((q, qIdx) => {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';

        // Generate options HTML with keyboard accessibility (tabindex="0")
        const optionsHTML = q.options.map((opt, oIdx) => `
            <label class="option-label" id="label-q${qIdx}-o${oIdx}" tabindex="0" data-qidx="${qIdx}" data-oidx="${oIdx}">
                <input type="radio" name="question-${qIdx}" value="${escapeHtml(opt)}" class="option-radio" data-qidx="${qIdx}" data-oidx="${oIdx}">
                <span class="custom-radio"></span>
                <span class="option-text">${escapeHtml(opt)}</span>
            </label>
        `).join('');

        questionCard.innerHTML = `
            <div class="question-header">
                <span class="question-num">${qIdx + 1}</span>
                <h3 class="question-text">${escapeHtml(q.question)}</h3>
            </div>
            <div class="options-grid">
                ${optionsHTML}
            </div>
        `;

        questionsList.appendChild(questionCard);
    });

    // Add event listeners for radio changes
    const radios = questionsList.querySelectorAll('.option-radio');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const qIdx = parseInt(e.target.getAttribute('data-qidx'));
            const oIdx = parseInt(e.target.getAttribute('data-oidx'));
            selectOption(qIdx, oIdx, e.target.value);
        });
    });

    // Add Keyboard Navigation support (Space/Enter & Arrows) for Option Cards
    const optionCards = questionsList.querySelectorAll('.option-label');
    optionCards.forEach(card => {
        card.addEventListener('keydown', (e) => {
            const qIdx = parseInt(card.getAttribute('data-qidx'));
            const oIdx = parseInt(card.getAttribute('data-oidx'));
            const radio = card.querySelector('.option-radio');

            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                radio.checked = true;
                selectOption(qIdx, oIdx, radio.value);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                focusSiblingOption(qIdx, oIdx, 1);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                focusSiblingOption(qIdx, oIdx, -1);
            }
        });
    });
}

function selectOption(qIdx, oIdx, value) {
    state.userAnswers[qIdx] = value;
    updateProgressBar();

    // Clear previous selected styling
    const labels = questionsList.querySelectorAll(`[id^="label-q${qIdx}-"]`);
    labels.forEach(label => label.classList.remove('selected-ui'));

    // Add selected styling
    const activeLabel = document.getElementById(`label-q${qIdx}-o${oIdx}`);
    if (activeLabel) {
        activeLabel.classList.add('selected-ui');
    }
}

function focusSiblingOption(qIdx, oIdx, direction) {
    const nextOidx = (oIdx + direction + 4) % 4;
    const siblingCard = document.getElementById(`label-q${qIdx}-o${nextOidx}`);
    if (siblingCard) {
        siblingCard.focus();
    }
}

function updateProgressBar() {
    const answeredCount = state.userAnswers.filter(ans => ans !== null).length;
    const totalQuestions = state.questions.length;
    const percentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
    quizProgressBar.style.width = `${percentage}%`;
    progressText.innerText = `Answered: ${answeredCount} of ${totalQuestions}`;
}

// ==========================================================================
// QUIZ SUBMISSION & RESULTS SCORING
// ==========================================================================
function submitQuiz() {
    // 1. Calculate Score
    let correctCount = 0;
    state.questions.forEach((q, idx) => {
        if (state.userAnswers[idx] === q.correctAnswer) {
            correctCount++;
        }
    });

    // 2. Save to History
    saveQuizToHistory(correctCount);

    // 3. Display Results
    renderResults(correctCount);
}

// ==========================================================================
// RESULT DASHBOARD & KNOWLEDGE INSIGHTS (FEATURE 9 & 10)
// ==========================================================================
function renderResults(score, viewPastQuizData = null) {
    let quizTopic = state.topic;
    let quizDifficulty = state.difficulty;
    let questions = state.questions;
    let userAnswers = state.userAnswers;

    if (viewPastQuizData) {
        quizTopic = viewPastQuizData.topic;
        quizDifficulty = viewPastQuizData.difficulty || 'Medium';
        questions = viewPastQuizData.questions;
        userAnswers = viewPastQuizData.userAnswers;
        score = viewPastQuizData.score;
        state.context = viewPastQuizData.context || '';
        renderContextViewer();
    }

    resultsTopicDisplay.innerText = quizTopic;
    resultsDiffDisplay.innerText = quizDifficulty;

    // 4. Trigger Celebration Confetti for good scores (>= 4) (Feature 9)
    if (score >= 4 && !viewPastQuizData) {
        triggerConfetti();
    }

    // Set score numbers
    const totalQ = questions.length;
    const percentage = Math.round((score / totalQ) * 100);
    scoreNumberDisplay.innerText = `${score} / ${totalQ}`;
    scorePercentDisplay.innerText = `${percentage}%`;

    // Circular Score Progress animation
    const offset = CONFIG.CIRCUMFERENCE - (score / totalQ) * CONFIG.CIRCUMFERENCE;
    scoreCircleVal.style.strokeDashoffset = offset;

    // Accuracy Metrics Dashboard
    statCorrectCount.innerText = score;
    statWrongCount.innerText = totalQ - score;
    statAccuracyPercent.innerText = `${percentage}%`;

    // Performance Feedback Badge
    let feedback = 'Needs Improvement';
    let badgeClass = 'low';
    if (score === totalQ) {
        feedback = 'Perfect Score! 🌟';
        badgeClass = 'high';
    } else if (score >= 3) {
        feedback = 'Great Job! 👍';
        badgeClass = 'high';
    } else if (score >= 2) {
        feedback = 'Good Effort! 📚';
        badgeClass = 'med';
    }
    scoreFeedbackBadge.innerText = feedback;
    scoreFeedbackBadge.className = `score-badge ${badgeClass}`;

    // Generate Knowledge Insights (Feature 10)
    generateKnowledgeInsights(questions, userAnswers, quizTopic);

    // Render Review List
    reviewList.innerHTML = '';
    questions.forEach((q, qIdx) => {
        const reviewCard = document.createElement('div');
        const isCorrect = userAnswers[qIdx] === q.correctAnswer;

        reviewCard.className = `review-card ${isCorrect ? 'correct-q' : 'incorrect-q'}`;

        const optionsHTML = q.options.map(opt => {
            let statusClass = '';
            let iconHTML = '<span class="review-option-icon is-unselected-icon"></span>';

            if (opt === q.correctAnswer) {
                statusClass = 'is-correct';
                iconHTML = '<span class="review-option-icon"><i class="fa-solid fa-check"></i></span>';
            } else if (opt === userAnswers[qIdx]) {
                statusClass = 'is-user-incorrect';
                iconHTML = '<span class="review-option-icon"><i class="fa-solid fa-xmark"></i></span>';
            }

            return `
                <div class="review-option ${statusClass}">
                    ${iconHTML}
                    <span>${escapeHtml(opt)}</span>
                </div>
            `;
        }).join('');

        reviewCard.innerHTML = `
            <div class="review-status-header">
                <span class="status-indicator">
                    ${isCorrect
                ? '<i class="fa-solid fa-circle-check"></i> Correct'
                : '<i class="fa-solid fa-circle-xmark"></i> Incorrect'}
                </span>
                <span class="text-muted">Question ${qIdx + 1} | ${escapeHtml(q.category || 'General')}</span>
            </div>
            <h4 class="review-question-text">${escapeHtml(q.question)}</h4>
            <div class="review-options">
                ${optionsHTML}
            </div>
            <div class="explanation-box">
                <h5 class="explanation-title">
                    <i class="fa-solid fa-lightbulb"></i> Explanation
                </h5>
                <p class="explanation-text">${escapeHtml(q.explanation)}</p>
            </div>
        `;

        reviewList.appendChild(reviewCard);
    });

    showView('results');
}

function generateKnowledgeInsights(questions, userAnswers, topic) {
    const categoryStats = {};

    questions.forEach((q, idx) => {
        const cat = q.category || "General Core";
        if (!categoryStats[cat]) {
            categoryStats[cat] = { correct: 0, total: 0 };
        }
        categoryStats[cat].total++;
        if (userAnswers[idx] === q.correctAnswer) {
            categoryStats[cat].correct++;
        }
    });

    const strengths = [];
    const weaknesses = [];

    Object.keys(categoryStats).forEach(cat => {
        const stat = categoryStats[cat];
        if (stat.correct === stat.total) {
            strengths.push(cat);
        } else {
            weaknesses.push({ name: cat, score: `${stat.correct}/${stat.total}` });
        }
    });

    // Render Strengths
    insightsStrengths.innerHTML = '';
    if (strengths.length > 0) {
        strengths.forEach(str => {
            const li = document.createElement('li');
            li.innerHTML = `You demonstrated a strong understanding of <strong>${escapeHtml(str)}</strong>.`;
            insightsStrengths.appendChild(li);
        });
    } else {
        insightsStrengths.innerHTML = '<li>No strong conceptual areas identified in this attempt. Keep trying!</li>';
    }

    // Render Weak Areas
    insightsWeaknesses.innerHTML = '';
    if (weaknesses.length > 0) {
        weaknesses.forEach(weak => {
            const li = document.createElement('li');
            li.innerHTML = `Need review in <strong>${escapeHtml(weak.name)}</strong> (Score: ${weak.score}).`;
            insightsWeaknesses.appendChild(li);
        });
    } else {
        insightsWeaknesses.innerHTML = '<li><i class="fa-solid fa-circle-check text-success"></i> Perfect! No conceptual weaknesses identified.</li>';
    }

    // Suggested Revision Box
    if (weaknesses.length > 0) {
        const weakListStr = weaknesses.map(w => `"${w.name}"`).join(', ');
        insightsRevision.innerHTML = `<strong>Suggested Revision:</strong> Focus your studying on the core mechanics of ${weakListStr} related to <strong>${escapeHtml(topic)}</strong>. Re-reading the Wikipedia introduction above is highly recommended.`;
    } else {
        insightsRevision.innerHTML = `<strong>Suggested Revision:</strong> Excellent! You have mastered all topics covered in this quiz. Challenge yourself by generating a <strong>Hard</strong> difficulty quiz or exploring a related subject!`;
    }
}

// ==========================================================================
// EXPORTS & QUICK COPY (FEATURE 7 & BONUS)
// ==========================================================================
function copyQuizToClipboard() {
    let quizText = `Quiz on: ${state.topic} (${state.difficulty})\n\n`;
    state.questions.forEach((q, idx) => {
        quizText += `Q${idx + 1}: ${q.question}\n`;
        q.options.forEach((opt, oIdx) => {
            quizText += `  [ ] ${opt}\n`;
        });
        quizText += `\n`;
    });

    navigator.clipboard.writeText(quizText)
        .then(() => alert('Quiz questions copied to clipboard!'))
        .catch(err => console.error('Could not copy quiz: ', err));
}

function copyExplanationsToClipboard() {
    let quizText = `Quiz Explanations: ${state.topic} (${state.difficulty})\n\n`;
    state.questions.forEach((q, idx) => {
        quizText += `Q${idx + 1}: ${q.question}\n`;
        q.options.forEach((opt, oIdx) => {
            const isCorrect = opt === q.correctAnswer;
            const isUser = opt === state.userAnswers[idx];
            let marker = "[ ]";
            if (isCorrect && isUser) marker = "[✓] (Your Correct Answer)";
            else if (isCorrect) marker = "[✓] (Correct Answer)";
            else if (isUser) marker = "[X] (Your Incorrect Answer)";

            quizText += `  ${marker} ${opt}\n`;
        });
        quizText += `Explanation: ${q.explanation}\n\n`;
    });

    navigator.clipboard.writeText(quizText)
        .then(() => alert('Quiz questions and explanations copied to clipboard!'))
        .catch(err => console.error('Could not copy explanations: ', err));
}

function exportQuizToJSON() {
    const exportData = {
        topic: state.topic,
        difficulty: state.difficulty,
        questions: state.questions,
        userAnswers: state.userAnswers,
        score: state.userAnswers.filter((ans, idx) => ans === state.questions[idx].correctAnswer).length,
        date: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quizgenius_${state.topic.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// ==========================================================================
// LOCAL STORAGE: HISTORY MANAGEMENT (FEATURE 3)
// ==========================================================================
function saveQuizToHistory(score) {
    const newQuiz = {
        id: Date.now(),
        topic: state.topic,
        difficulty: state.difficulty,
        questions: state.questions,
        userAnswers: state.userAnswers,
        context: state.context,
        score: score,
        date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    state.history.unshift(newQuiz);
    localStorage.setItem('quiz_history', JSON.stringify(state.history));
    updateHistorySidebarUI();
}

function loadHistory() {
    const saved = localStorage.getItem('quiz_history');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.history = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            state.history = [];
        }
    }
    updateHistorySidebarUI();
}

function getFirstUnansweredQuestionIndex() {
    return state.userAnswers.findIndex(ans => ans === null);
}

function updateHistorySidebarUI() {
    historyList.innerHTML = '';

    if (state.history.length === 0) {
        historyList.innerHTML = '<li class="empty-history-msg">No quizzes taken yet.</li>';
        clearHistoryBtn.style.display = 'none';
        return;
    }

    clearHistoryBtn.style.display = 'block';

    state.history.forEach(item => {
        // Safe check for questions array
        const totalQuestions = (item.questions && Array.isArray(item.questions)) ? item.questions.length : 5;
        const score = typeof item.score === 'number' ? item.score : 0;
        const topic = item.topic || 'Unknown Topic';
        const difficulty = item.difficulty || 'Medium';
        const date = item.date || 'Unknown Date';

        const li = document.createElement('li');
        li.className = 'history-item';
        li.setAttribute('data-id', item.id);

        let scoreClass = 'med';
        if (score === totalQuestions) scoreClass = 'high';
        else if (score < 3) scoreClass = 'low';

        li.innerHTML = `
            <div class="history-item-top">
                <span class="history-item-topic" title="${escapeHtml(topic)}">${escapeHtml(topic)}</span>
                <span class="history-item-score ${scoreClass}">${score}/${totalQuestions}</span>
            </div>
            <div class="history-item-meta">
                <span class="history-item-date">${date}</span>
                <span class="history-item-diff badge" style="font-size: 0.65rem; padding: 0.1rem 0.3rem;">${difficulty}</span>
            </div>
        `;

        li.addEventListener('click', () => {
            reviewPastQuiz(item.id);
            toggleSidebar(); // Close sidebar after clicking
        });

        historyList.appendChild(li);
    });
}

function reviewPastQuiz(quizId) {
    const pastQuiz = state.history.find(q => q.id === quizId);
    if (pastQuiz) {
        state.topic = pastQuiz.topic;
        state.difficulty = pastQuiz.difficulty || 'Medium';
        state.questions = pastQuiz.questions;
        state.userAnswers = pastQuiz.userAnswers;
        renderResults(pastQuiz.score, pastQuiz);
    }
}

// ==========================================================================
// SIDEBAR DRAWER TOGGLE
// ==========================================================================
function toggleSidebar() {
    historySidebar.classList.toggle('active');
    if (sidebarOverlay) {
        sidebarOverlay.classList.toggle('active');
    }
}

function clearHistory() {
    if (confirm('Are you sure you want to delete all quiz history?')) {
        state.history = [];
        localStorage.removeItem('quiz_history');
        updateHistorySidebarUI();
    }
}

// ==========================================================================
// CONFETTI SHOWER ANIMATION
// ==========================================================================
function triggerConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    container.style.display = 'block';

    const colors = ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const count = 80;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        // Randomize positions, colors, delays, and speeds
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2.5 + Math.random() * 2.5;
        const sizeWidth = 8 + Math.random() * 6;
        const sizeHeight = 10 + Math.random() * 6;
        const rotation = Math.random() * 360;
        const color = colors[Math.floor(Math.random() * colors.length)];

        piece.style.left = `${left}vw`;
        piece.style.animationDelay = `${delay}s`;
        piece.style.animationDuration = `${duration}s`;
        piece.style.width = `${sizeWidth}px`;
        piece.style.height = `${sizeHeight}px`;
        piece.style.backgroundColor = color;
        piece.style.transform = `rotate(${rotation}deg)`;

        container.appendChild(piece);
    }

    // Hide container after all animations finish (~5.5 seconds)
    setTimeout(() => {
        container.style.display = 'none';
        container.innerHTML = '';
    }, 5500);
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
