const puzzleImage = document.getElementById("puzzle-image");
const puzzleLoading = document.getElementById("puzzle-loading");
const answerForm = document.getElementById("answer-form");
const answerInput = document.getElementById("answer-input");
const nextButton = document.getElementById("new-puzzle-button");
const dashboardButton = document.getElementById("dashboard-button");
const gameMessage = document.getElementById("game-message");

const hudScore = document.getElementById("hud-score");
const hudStreak = document.getElementById("hud-streak");
const hudTimer = document.getElementById("hud-timer");

const gameOverScreen = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");
const finalDetails = document.getElementById("final-details");
const playAgainButton = document.getElementById("play-again-button");

const numpad = document.getElementById("answer-numpad");
const numpadKeys = [...numpad.querySelectorAll("button")];
const submitButton = answerForm.querySelector("button[type='submit']");

let puzzleLoaded = false;
let isCheckingAnswer = false;
let timerId = null;
let puzzleStart = 0;

function showMessage(text, type) {
    gameMessage.textContent = text;
    gameMessage.className = type || "";
}

function updateHud(state) {
    hudScore.textContent = state.score;
    hudStreak.textContent = state.streak;
}

function startTimer() {
    stopTimer();
    puzzleStart = Date.now();
    hudTimer.textContent = "0s";

    timerId = setInterval(() => {
        hudTimer.textContent =
            Math.floor((Date.now() - puzzleStart) / 1000) + "s";
    }, 250);
}

function stopTimer() {
    clearInterval(timerId);
    timerId = null;
}

function setAnswering(enabled) {
    answerInput.disabled = !enabled;
    submitButton.disabled = !enabled;
    numpadKeys.forEach((key) => {
        key.disabled = !enabled;
    });
}

function appendDigit(digit) {
    if (answerInput.value.length >= 10) {
        return;
    }

    // Avoid awkward leading zeroes like "007".
    answerInput.value =
        answerInput.value === "0"
            ? digit
            : answerInput.value + digit;
}

function applyNumpadAction(action) {
    if (action === "clear") {
        answerInput.value = "";
    } else if (action === "backspace") {
        answerInput.value = answerInput.value.slice(0, -1);
    }
}

async function request(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.error || "Something went wrong.");
        error.data = data;
        error.status = response.status;
        throw error;
    }

    return data;
}

async function loadPuzzle() {
    showMessage("", "");
    nextButton.hidden = true;

    puzzleLoading.textContent = "Loading your banana puzzle...";
    puzzleLoading.hidden = false;

    puzzleImage.hidden = true;
    puzzleImage.style.display = "none";
    puzzleImage.removeAttribute("src");

    answerInput.value = "";
    setAnswering(false);
    puzzleLoaded = false;
    stopTimer();

    try {
        const puzzle = await request("/api/puzzle");
        updateHud(puzzle);

        if (typeof puzzle.question !== "string" || puzzle.question.trim() === "") {
            throw new Error("The API did not return a puzzle image URL.");
        }

        // Wait for the image to load before starting the timer and answers.
        await new Promise((resolve, reject) => {
            puzzleImage.onload = resolve;
            puzzleImage.onerror = () =>
                reject(new Error("The puzzle image could not be displayed."));
            puzzleImage.src = puzzle.question;
        });

        puzzleImage.hidden = false;
        puzzleImage.style.display = "block";
        puzzleLoading.hidden = true;

        puzzleLoaded = true;
        setAnswering(true);
        startTimer();
        answerInput.focus();

    } catch (error) {
        // A 409 means the game ended, so show the game over screen instead.
        if (error.status === 409) {
            showGameOver(error.data);
            return;
        }

        puzzleLoading.textContent = "Could not load the puzzle.";
        puzzleLoading.hidden = false;
        showMessage(error.message, "error");
        console.error("Error loading puzzle:", error);

        // Let the player retry without losing anything.
        nextButton.textContent = "Try Again";
        nextButton.hidden = false;
    }
}

function showGameOver(state) {
    stopTimer();
    setAnswering(false);
    nextButton.hidden = true;

    finalScore.textContent = state.score;
    finalDetails.textContent =
        `${state.correct} correct · ${state.wrong} wrong · best streak ${state.bestStreak}`;

    gameOverScreen.hidden = false;
    playAgainButton.focus();
}

async function startNewGame() {
    try {
        const state = await request("/api/game/start", { method: "POST" });
        updateHud(state);
        gameOverScreen.hidden = true;
        nextButton.textContent = "Next Puzzle";
        loadPuzzle();
    } catch (error) {
        showMessage(error.message, "error");
    }
}

numpad.addEventListener("click", (event) => {
    const key = event.target.closest("button");

    if (!key || key.disabled || !puzzleLoaded || isCheckingAnswer) {
        return;
    }

    if (key.dataset.num !== undefined) {
        appendDigit(key.dataset.num);
    } else if (key.dataset.action) {
        applyNumpadAction(key.dataset.action);
    }

    // Keep focus on the input so Enter still submits.
    answerInput.focus();
});

document.addEventListener("keydown", (event) => {
    if (!puzzleLoaded || isCheckingAnswer) {
        return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    // Only take over keys when the player is not using another control.
    if (event.target !== answerInput && event.target !== document.body) {
        return;
    }

    if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
    } else if (event.key === "Backspace") {
        event.preventDefault();
        applyNumpadAction("backspace");
    } else if (event.key === "Enter") {
        event.preventDefault();
        answerForm.requestSubmit();
    }
});

answerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!puzzleLoaded || isCheckingAnswer) {
        return;
    }

    const enteredAnswer = answerInput.value.trim();

    if (enteredAnswer === "") {
        showMessage("Please enter your answer.", "error");
        return;
    }

    const playerAnswer = Number(enteredAnswer);

    if (!Number.isInteger(playerAnswer)) {
        showMessage("Please enter a valid whole-number answer.", "error");
        return;
    }

    isCheckingAnswer = true;
    setAnswering(false);
    showMessage("Checking your answer...", "");

    try {
        const result = await request("/api/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: playerAnswer })
        });

        stopTimer();
        puzzleLoaded = false;
        updateHud(result);

        showMessage(result.message, result.correct ? "success" : "error");

        if (result.gameOver) {
            // Short pause so the player sees the last result first.
            setTimeout(() => showGameOver(result), 900);
        } else {
            nextButton.hidden = false;
            nextButton.focus();
        }

    } catch (error) {
        showMessage(error.message, "error");
        console.error("Error checking answer:", error);

        // Keep the puzzle playable if the request itself failed.
        if (error.status !== 404) {
            setAnswering(true);
        } else {
            nextButton.hidden = false;
        }
    } finally {
        isCheckingAnswer = false;
    }
});

nextButton.addEventListener("click", () => {
    if (!isCheckingAnswer) {
        loadPuzzle();
    }
});

playAgainButton.addEventListener("click", startNewGame);

// End the current game before leaving mid-game.
dashboardButton.addEventListener("click", async () => {
    dashboardButton.disabled = true;

    try {
        await fetch("/api/game/quit", { method: "POST" });
    } catch (error) {
        console.error("Could not save the game:", error);
    }

    window.location.href = "/dashboard.html";
});

startNewGame();
