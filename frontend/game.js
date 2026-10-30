// Find the HTML elements used by the game.
const puzzleImage = document.getElementById("puzzle-image");
const answerForm = document.getElementById("answer-form");
const answerInput = document.getElementById("answer-input");
const newPuzzleButton = document.getElementById("new-puzzle-button");
const gameMessage = document.getElementById("game-message");

// Store the session ID returned by the backend.
// This lets the backend identify the current puzzle session.
let currentSessionId = null;


// ============================================================
// FUNCTION: loadPuzzle()
// Purpose: Load a new puzzle from the backend.
// ============================================================

async function loadPuzzle() {
    // Display a loading message while requesting a puzzle.
    gameMessage.textContent = "Loading puzzle...";

    // Hide the previous puzzle while the new one loads.
    puzzleImage.style.display = "none";

    // Clear the previous answer.
    answerInput.value = "";

    // Prevent the player from submitting an answer while loading.
    answerInput.disabled = true;
    newPuzzleButton.disabled = true;

    try {
        // Build the puzzle URL.
        // Reuse the session ID when the player already has one.
        let puzzleUrl = "/api/puzzle";

        if (currentSessionId) {
            puzzleUrl += `?sessionId=${encodeURIComponent(currentSessionId)}`;
        }

        // Request a new puzzle from the backend.
        const response = await fetch(puzzleUrl);

        // Check whether the backend returned a successful response.
        if (!response.ok) {
            throw new Error("Puzzle could not be loaded.");
        }

        // Convert the response into a JavaScript object.
        const puzzle = await response.json();

        // Make sure the response contains a puzzle image URL.
        if (!puzzle.question) {
            throw new Error("Puzzle image is missing.");
        }

        // Make sure the backend returned a session ID.
        if (!puzzle.sessionId) {
            throw new Error("Session ID is missing.");
        }

        // Save the session ID for future answer submissions.
        currentSessionId = puzzle.sessionId;

        // Display the puzzle when its image has loaded successfully.
        puzzleImage.onload = function () {
            puzzleImage.style.display = "block";
        };

        // Handle an image that cannot be displayed.
        puzzleImage.onerror = function () {
            gameMessage.textContent =
                "The puzzle image could not be displayed.";

            answerInput.disabled = true;
        };

        // Set the puzzle image URL.
        puzzleImage.src = puzzle.question;

        // Clear the loading message.
        gameMessage.textContent = "";

        // Allow the player to submit an answer.
        answerInput.disabled = false;
        answerInput.focus();

    } catch (error) {
        // Display a user-friendly message if loading fails.
        gameMessage.textContent =
            "Could not load the puzzle. Please try again.";

        // Log the technical error for debugging.
        console.error("Error loading puzzle:", error);

    } finally {
        // Allow the player to request another puzzle.
        newPuzzleButton.disabled = false;
    }
}


// ============================================================
// EVENT: Answer form submission
// Purpose: Send the player's answer to the backend.
// ============================================================

answerForm.addEventListener("submit", async function (event) {
    // Prevent the browser from reloading the page.
    event.preventDefault();

    // Ensure a puzzle session exists before checking an answer.
    if (!currentSessionId) {
        gameMessage.textContent =
            "Please load a puzzle before submitting an answer.";

        return;
    }

    // Read the player's answer and remove surrounding spaces.
    const enteredAnswer = answerInput.value.trim();

    // Prevent empty answers from being submitted.
    if (enteredAnswer === "") {
        gameMessage.textContent = "Please enter your answer.";
        return;
    }

    // Convert the entered text into a number.
    const playerAnswer = Number(enteredAnswer);

    // Check that the answer is a valid whole number.
    if (
        !Number.isFinite(playerAnswer) ||
        !Number.isInteger(playerAnswer)
    ) {
        gameMessage.textContent =
            "Please enter a valid whole-number answer.";

        return;
    }

    // Display a message while the backend checks the answer.
    gameMessage.textContent = "Checking your answer.";

    // Prevent repeated submissions while checking.
    answerInput.disabled = true;

    try {
        // Send the session ID and answer to the backend.
        const response = await fetch("/api/answer", {
            method: "POST",

            // Tell the backend that the request contains JSON.
            headers: {
                "Content-Type": "application/json"
            },

            // Send the player's session ID and submitted answer.
            body: JSON.stringify({
                sessionId: currentSessionId,
                answer: playerAnswer
            })
        });

        // Convert the backend response into a JavaScript object.
        const result = await response.json();

        // Handle an unsuccessful response.
        if (!response.ok) {
            throw new Error(
                result.error || "Answer checking failed."
            );
        }

        // Display the result returned by the backend.
        gameMessage.textContent = result.correct
            ? "Correct! Well done!"
            : "Incorrect. Try again!";

    } catch (error) {
        // Display a user-friendly message if checking fails.
        gameMessage.textContent =
            "Could not check your answer. Please try again.";

        // Log the technical error for debugging.
        console.error("Error checking answer:", error);

    } finally {
        // Re-enable the answer input after checking.
        answerInput.disabled = false;

        // Return focus to the answer input.
        answerInput.focus();
    }
});


// ============================================================
// EVENT: New Puzzle button
// Purpose: Load another puzzle when clicked.
// ============================================================

newPuzzleButton.addEventListener("click", loadPuzzle);


// ============================================================
// INITIALISE THE GAME
// Purpose: Load the first puzzle when the page opens.
// ============================================================

loadPuzzle();