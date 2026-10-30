// Import Express to create the backend server.
const express = require("express");

// Import path to locate the frontend folder.
const path = require("path");

// Import crypto to generate unique session IDs.
const { randomUUID } = require("crypto");

// Import the Banana API function.
const { getBananaPuzzle } = require("./bananaApi");

// Create the Express application.
const app = express();

// Set the port number.
const PORT = 3000;

// Allow the server to read JSON request bodies.
app.use(express.json());

// Serve the frontend files from the frontend folder.
app.use(express.static(path.join(__dirname, "../frontend")));

// Store each session's current puzzle solution.
const playerPuzzles = new Map();


// ============================================================
// ROUTE: GET /api/puzzle
// Purpose: Load a puzzle from the Banana API.
// ============================================================

app.get("/api/puzzle", async (req, res) => {
    try {
        // Reuse the existing session ID or create a new one.
        let sessionId = req.query.sessionId;

        if (
            typeof sessionId !== "string" ||
            sessionId.trim() === ""
        ) {
            sessionId = randomUUID();
        }

        // Request a puzzle from the Banana API.
        const puzzle = await getBananaPuzzle();

        // Check that the API returned a valid solution.
        if (
            !Number.isFinite(puzzle.solution) ||
            !Number.isInteger(puzzle.solution)
        ) {
            throw new Error("The Banana API returned an invalid solution.");
        }

        // Store the correct answer on the server.
        playerPuzzles.set(sessionId, puzzle.solution);

        // Send the puzzle image and session ID to the frontend.
        // Do not send the correct answer to the browser.
        res.json({
            sessionId: sessionId,
            question: puzzle.question
        });

    } catch (error) {
        console.error("Error loading puzzle:", error.message);

        res.status(500).json({
            error: "Could not load the banana puzzle."
        });
    }
});


// ============================================================
// ROUTE: POST /api/answer
// Purpose: Check the player's submitted answer.
// ============================================================

app.post("/api/answer", (req, res) => {
    try {
        // Read the session ID and answer from the request.
        const { sessionId, answer } = req.body;

        // Validate the session ID.
        if (
            typeof sessionId !== "string" ||
            sessionId.trim() === ""
        ) {
            return res.status(400).json({
                error: "A valid session ID is required."
            });
        }

        // Validate the submitted answer.
        if (
            typeof answer !== "number" ||
            !Number.isFinite(answer) ||
            !Number.isInteger(answer)
        ) {
            return res.status(400).json({
                error: "Please submit a valid whole-number answer."
            });
        }

        // Find the correct answer for this session.
        const correctSolution = playerPuzzles.get(sessionId);

        // Reject submissions for sessions without an active puzzle.
        if (correctSolution === undefined) {
            return res.status(404).json({
                error: "No active puzzle was found. Please load a new puzzle."
            });
        }

        // Compare the submitted answer with the correct answer.
        const isCorrect = answer === correctSolution;

        // Send the result to the frontend.
        res.json({
            correct: isCorrect,
            message: isCorrect
                ? "Correct! Well done!"
                : "Incorrect. Try again!"
        });

    } catch (error) {
        console.error("Error checking answer:", error.message);

        res.status(500).json({
            error: "Could not check your answer. Please try again."
        });
    }
});


// ============================================================
// START THE SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`Banana Quest server is running on port ${PORT}.`);
});