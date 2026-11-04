const express = require("express");
const path = require("path");
const session = require("express-session");
const { getBananaPuzzle } = require("./bananaApi");
const authRouter = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, "../frontend");

app.use(express.json());

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.warn("WARNING: set SESSION_SECRET before deploying.");
}

app.use(
    session({
        name: "bananaquest.sid",
        secret:
            process.env.SESSION_SECRET ||
            "banana-quest-local-development-secret-change-before-deployment",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 1000
        }
    })
);

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(frontendPath, "style.css"));
});

app.get("/game.js", (req, res) => {
    res.sendFile(path.join(frontendPath, "game.js"));
});

app.get("/", (req, res) => {
    if (req.session.playerId) {
        return res.redirect("/dashboard.html");
    }

    res.sendFile(path.join(frontendPath, "login.html"));
});

app.get("/login.html", (req, res) => {
    if (req.session.playerId) {
        return res.redirect("/dashboard.html");
    }

    res.sendFile(path.join(frontendPath, "login.html"));
});

app.get("/register.html", (req, res) => {
    if (req.session.playerId) {
        return res.redirect("/dashboard.html");
    }

    res.sendFile(path.join(frontendPath, "register.html"));
});

app.use("/api/auth", authRouter);

function requireLogin(req, res, next) {
    if (!req.session || !req.session.playerId) {
        if (req.path.startsWith("/api/")) {
            return res.status(401).json({
                error: "Please log in to continue."
            });
        }

        return res.redirect("/login.html");
    }

    next();
}

app.get("/dashboard.html", requireLogin, (req, res) => {
    res.sendFile(path.join(frontendPath, "dashboard.html"));
});

app.get("/game.html", requireLogin, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// Server-side game rules. The frontend never decides the score.
const BASE_POINTS = 100;
const STREAK_BONUS = 10;
const MAX_STREAK_BONUS = 50;
const FAST_SECONDS = 10;
const MAX_SPEED_BONUS = 50;
const MIN_POINTS = 10;

function newGame() {
    return {
        solution: null,
        issuedAt: 0,
        score: 0,
        streak: 0,
        bestStreak: 0,
        correct: 0,
        wrong: 0,
        over: false
    };
}

function startPuzzle(game, solution) {
    game.solution = solution;
    game.issuedAt = Date.now();
}

function pointsFor(game, secondsTaken) {
    // game.streak already includes this answer, so the first correct
    // answer in a row gets no streak bonus.
    const streakBonus = Math.min(
        (game.streak - 1) * STREAK_BONUS,
        MAX_STREAK_BONUS
    );

    const speedBonus = Math.max(
        0,
        Math.round(MAX_SPEED_BONUS * (1 - secondsTaken / FAST_SECONDS))
    );

    return Math.max(MIN_POINTS, BASE_POINTS + streakBonus + speedBonus);
}

function applyAnswer(game, answer) {
    const secondsTaken = (Date.now() - game.issuedAt) / 1000;
    const isCorrect = answer === game.solution;

    if (isCorrect) {
        game.correct += 1;
        game.streak += 1;
        game.bestStreak = Math.max(game.bestStreak, game.streak);
        game.score += pointsFor(game, secondsTaken);
    } else {
        game.wrong += 1;
        game.streak = 0;
    }

    // Prevent the same puzzle from being answered more than once.
    game.solution = null;

    return isCorrect;
}

function feedbackMessage(isCorrect, pointsEarned, game) {
    if (isCorrect) {
        if (game.streak >= 5) {
            return `Perfect! ${game.streak} in a row, +${pointsEarned} points 🍌`;
        }

        if (game.streak >= 3) {
            return `Great! +${pointsEarned} points 🍌`;
        }

        return `Correct! +${pointsEarned} points 🍌`;
    }

    return "Too bad! Wrong answer — streak reset. 💔";
}

// Game state is stored in the login session, so it is per player and expires with the session.
function getGame(req) {
    if (!req.session.game) {
        req.session.game = newGame();
    }

    return req.session.game;
}

// Never send the solution to the browser.
function publicState(game) {
    return {
        score: game.score,
        streak: game.streak,
        bestStreak: game.bestStreak,
        correct: game.correct,
        wrong: game.wrong,
        gameOver: game.over
    };
}

// Express 5 only saves a modified session when the response ends, so save explicitly before replying.
function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

app.post("/api/game/start", requireLogin, async (req, res) => {
    req.session.game = newGame();

    try {
        await saveSession(req);
        res.json(publicState(req.session.game));
    } catch (error) {
        console.error("Error starting game:", error.message);
        res.status(500).json({ error: "Could not start a new game." });
    }
});

app.get("/api/puzzle", requireLogin, async (req, res) => {
    try {
        const game = getGame(req);

        // A finished game needs a restart before more puzzles are served.
        if (game.over) {
            return res.status(409).json({
                error: "Game over. Start a new game to keep playing.",
                ...publicState(game)
            });
        }

        const puzzle = await getBananaPuzzle();

        if (!Number.isInteger(puzzle.solution)) {
            throw new Error("The Banana API returned an invalid solution.");
        }

        startPuzzle(game, puzzle.solution);
        await saveSession(req);

        res.json({
            question: puzzle.question,
            ...publicState(game)
        });
    } catch (error) {
        console.error("Error loading puzzle:", error.message);

        res.status(502).json({
            error: "Could not load the banana puzzle. Please try again."
        });
    }
});

app.post("/api/answer", requireLogin, async (req, res) => {
    try {
        const { answer } = req.body;

        if (!Number.isInteger(answer)) {
            return res.status(400).json({
                error: "Please submit a valid whole-number answer."
            });
        }

        const game = getGame(req);

        if (game.over || game.solution === null) {
            return res.status(404).json({
                error: "No active puzzle was found. Please load a new puzzle."
            });
        }

        const scoreBefore = game.score;
        const isCorrect = applyAnswer(game, answer);

        await saveSession(req);

        const pointsEarned = game.score - scoreBefore;

        res.json({
            correct: isCorrect,
            pointsEarned,
            message: feedbackMessage(isCorrect, pointsEarned, game),
            ...publicState(game)
        });
    } catch (error) {
        console.error("Error checking answer:", error.message);

        res.status(500).json({
            error: "Could not check your answer. Please try again."
        });
    }
});

app.post("/api/game/quit", requireLogin, async (req, res) => {
    try {
        req.session.game = newGame();
        await saveSession(req);

        res.json({ message: "Game ended." });
    } catch (error) {
        console.error("Error quitting game:", error.message);
        res.status(500).json({ error: "Could not end your game." });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Banana Quest is running at http://localhost:${PORT}`);
    });
}

module.exports = app;
