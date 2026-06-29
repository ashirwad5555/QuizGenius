// ==========================================================================
// STATE & CONFIGURATION
// ==========================================================================
const CONFIG = {
    // API_URL: 'http://localhost:5000/api',
    API_URL: 'http://10.94.119.134:5000/api',
    CIRCUMFERENCE: 2 * Math.PI * 54 // 2 * pi * r (r=54 for score circle)
};

const state = {
    currentView: 'home',
    topic: '',
    questions: [],
    userAnswers: [], // Stores selected answer strings
    history: []      // Saved quizzes loaded from localStorage
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

// Form and Input Elements
const quizForm = document.getElementById('quiz-generation-form');
const topicInput = document.getElementById('topic-input');
const exampleButtons = document.querySelectorAll('.example-tag-btn');
const generateBtn = document.getElementById('generate-btn');

// Loading View Steps
const loadingSteps = {
    wiki: document.getElementById('step-wiki'),
    context: document.getElementById('step-context'),
    gemini: document.getElementById('step-gemini'),
    status: document.getElementById('loading-status'),
    title: document.getElementById('loading-title')
};

// Error View Elements
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');
const errorRetryBtn = document.getElementById('error-retry-btn');
const errorBackBtn = document.getElementById('error-back-btn');

// Quiz View Elements
const quizTopicDisplay = document.getElementById('quiz-topic-display');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const questionsList = document.getElementById('questions-list');
const quizSubmissionForm = document.getElementById('quiz-submission-form');
const quitQuizBtn = document.getElementById('quit-quiz-btn');

// Results View Elements
const resultsTopicDisplay = document.getElementById('results-topic-display');
const scoreCircleVal = document.getElementById('score-circle-val');
const scoreNumberDisplay = document.getElementById('score-number-display');
const scorePercentDisplay = document.getElementById('score-percent-display');
const scoreFeedbackBadge = document.getElementById('score-feedback-badge');
const reviewList = document.getElementById('review-list');
const resultsHomeBtn = document.getElementById('results-home-btn');

// Sidebar Elements
const historySidebar = document.getElementById('history-sidebar');
const toggleHistoryBtn = document.getElementById('toggle-history-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Add Sidebar Overlay to body dynamically
const sidebarOverlay = document.createElement('div');
sidebarOverlay.className = 'sidebar-overlay';
document.body.appendChild(sidebarOverlay);

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    initEventListeners();
});

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================
function initEventListeners() {
    // 1. Home View: Submit Topic Form
    quizForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        if (topic) {
            generateQuiz(topic);
        }
    });

    // 2. Home View: Click Example Pills
    exampleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            topicInput.value = btn.getAttribute('data-topic');
            topicInput.focus();
        });
    });

    // 3. Error View: Retry & Back Buttons
    errorRetryBtn.addEventListener('click', () => {
        if (state.topic) {
            generateQuiz(state.topic);
        }
    });
    errorBackBtn.addEventListener('click', () => {
        showView('home');
    });

    // 4. Quiz View: Submit Answers
    quizSubmissionForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Ensure all questions are answered
        const unansweredIdx = getFirstUnansweredQuestionIndex();
        if (unansweredIdx !== -1) {
            alert(`Please answer Question ${unansweredIdx + 1} before submitting.`);

            // Scroll to the unanswered question
            const qCards = questionsList.querySelectorAll('.question-card');
            qCards[unansweredIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        submitQuiz();
    });

    // 5. Quiz View: Quit Quiz
    quitQuizBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit this quiz? Your progress will be lost.')) {
            showView('home');
        }
    });

    // 6. Results View: Back to Home
    resultsHomeBtn.addEventListener('click', () => {
        topicInput.value = '';
        showView('home');
    });

    // 7. Sidebar: Toggle, Close, Overlay
    toggleHistoryBtn.addEventListener('click', toggleSidebar);
    closeSidebarBtn.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // 8. Sidebar: Clear History
    clearHistoryBtn.addEventListener('click', clearHistory);
}

// ==========================================================================
// VIEW CONTROLLER
// ==========================================================================
function showView(viewName) {
    state.currentView = viewName;

    // Hide all views, show active view
    Object.keys(views).forEach(name => {
        if (name === viewName) {
            views[name].classList.add('active');
        } else {
            views[name].classList.remove('active');
        }
    });

    // Scroll back to top when switching views
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// API SERVICE: GENERATE QUIZ (RAG)
// ==========================================================================
async function generateQuiz(topic) {
    state.topic = topic;
    showView('loading');
    resetLoadingSteps();

    // Start loading step animations
    const stepInterval = animateLoadingSteps();

    try {
        const response = await fetch(`${CONFIG.API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic })
        });

        clearInterval(stepInterval);

        const data = await response.json();

        if (!response.ok) {
            // Handle specific status codes
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
        state.topic = data.topic; // Use the resolved Wikipedia topic title
        state.userAnswers = new Array(state.questions.length).fill(null);

        // Render and transition
        renderQuiz();
        updateProgressBar();
        showView('quiz');

    } catch (error) {
        clearInterval(stepInterval);
        showError(
            'Network Connection Failure',
            'Unable to communicate with the quiz builder server. Make sure your Flask backend is running on port 5000.',
            error.message
        );
    }
}

// ==========================================================================
// LOADING STATE ANIMATION
// ==========================================================================
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
        if (tick === 6) { // ~3 seconds
            loadingSteps.wiki.className = 'step-item completed';
            loadingSteps.context.className = 'step-item active';
            loadingSteps.title.innerText = 'Injecting Context';
            loadingSteps.status.innerText = 'Structuring Wikipedia summary into RAG prompt...';
        } else if (tick === 12) { // ~6 seconds
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
// QUIZ VIEW RENDERING & INTERACTION
// ==========================================================================
function renderQuiz() {
    quizTopicDisplay.innerText = state.topic;
    questionsList.innerHTML = '';

    state.questions.forEach((q, qIdx) => {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';

        // Generate options HTML
        const optionsHTML = q.options.map((opt, oIdx) => `
            <label class="option-label" id="label-q${qIdx}-o${oIdx}">
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

    // Add event listeners to the new radio buttons for visual selected state
    const radios = questionsList.querySelectorAll('.option-radio');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const qIdx = parseInt(e.target.getAttribute('data-qidx'));
            const oIdx = parseInt(e.target.getAttribute('data-oidx'));

            // Save answer to state
            state.userAnswers[qIdx] = e.target.value;

            // Update progress bar
            updateProgressBar();

            // Clear previous selected styling in this question card
            const labels = questionsList.querySelectorAll(`[id^="label-q${qIdx}-"]`);
            labels.forEach(label => label.classList.remove('selected-ui'));

            // Add selected styling to the clicked label
            const activeLabel = document.getElementById(`label-q${qIdx}-o${oIdx}`);
            if (activeLabel) {
                activeLabel.classList.add('selected-ui');
            }
        });
    });
}

function updateProgressBar() {
    const answeredCount = state.userAnswers.filter(ans => ans !== null).length;
    const totalQuestions = state.questions.length;
    const percentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
    quizProgressBar.style.width = `${percentage}%`;
}

function getFirstUnansweredQuestionIndex() {
    return state.userAnswers.findIndex(ans => ans === null);
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

function renderResults(score, viewPastQuizData = null) {
    let quizTopic = state.topic;
    let questions = state.questions;
    let userAnswers = state.userAnswers;

    // If we are reviewing a past quiz from history
    if (viewPastQuizData) {
        quizTopic = viewPastQuizData.topic;
        questions = viewPastQuizData.questions;
        userAnswers = viewPastQuizData.userAnswers;
        score = viewPastQuizData.score;
    }

    resultsTopicDisplay.innerText = quizTopic;

    // Set score numbers
    const totalQ = questions.length;
    const percentage = Math.round((score / totalQ) * 100);
    scoreNumberDisplay.innerText = `${score} / ${totalQ}`;
    scorePercentDisplay.innerText = `${percentage}%`;

    // Animate Circular Score
    const offset = CONFIG.CIRCUMFERENCE - (score / totalQ) * CONFIG.CIRCUMFERENCE;
    scoreCircleVal.style.strokeDashoffset = offset;

    // Feedback Badge
    let feedback = 'Good Effort!';
    let badgeClass = 'med';
    if (score === totalQ) {
        feedback = 'Perfect Score! 🌟';
        badgeClass = 'high';
    } else if (score >= 3) {
        feedback = 'Great Job! 👍';
        badgeClass = 'high';
    } else {
        feedback = 'Keep Learning! 📚';
        badgeClass = 'low';
    }
    scoreFeedbackBadge.innerText = feedback;
    scoreFeedbackBadge.className = `score-badge ${badgeClass}`;

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
                <span class="text-muted">Question ${qIdx + 1}</span>
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

// ==========================================================================
// LOCAL STORAGE: HISTORY MANAGEMENT
// ==========================================================================
function saveQuizToHistory(score) {
    const newQuiz = {
        id: Date.now(),
        topic: state.topic,
        questions: state.questions,
        userAnswers: state.userAnswers,
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
            state.history = JSON.parse(saved);
        } catch (e) {
            state.history = [];
        }
    }
    updateHistorySidebarUI();
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
        const li = document.createElement('li');
        li.className = 'history-item';
        li.setAttribute('data-id', item.id);

        let scoreClass = 'med';
        if (item.score === item.questions.length) scoreClass = 'high';
        else if (item.score < 3) scoreClass = 'low';

        li.innerHTML = `
            <div class="history-item-top">
                <span class="history-item-topic" title="${escapeHtml(item.topic)}">${escapeHtml(item.topic)}</span>
                <span class="history-item-score ${scoreClass}">${item.score}/${item.questions.length}</span>
            </div>
            <span class="history-item-date">${item.date}</span>
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
        renderResults(pastQuiz.score, pastQuiz);
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
// SIDEBAR TOGGLE
// ==========================================================================
function toggleSidebar() {
    historySidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
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
