const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("./database");

const router = express.Router();

router.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (
        typeof username !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            message: "Username and password are required."
        });
    }

    const cleanUsername = username.trim();

    if (
        cleanUsername.length < 3 ||
        cleanUsername.length > 30
    ) {
        return res.status(400).json({
            message: "Username must contain 3 to 30 characters."
        });
    }

    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({
            message: "Password must contain 8 to 128 characters."
        });
    }

    try {
        const passwordHash = bcrypt.hashSync(password, 10);

        db.prepare(`
            INSERT INTO players (username, password_hash)
            VALUES (?, ?)
        `).run(cleanUsername, passwordHash);

        res.status(201).json({
            message: "Account created successfully. You can now log in."
        });
    } catch (error) {
        if (
            error.code === "SQLITE_CONSTRAINT_UNIQUE"
        ) {
            return res.status(409).json({
                message: "That username is already taken."
            });
        }

        console.error("Registration error:", error.message);

        res.status(500).json({
            message: "Could not create the account."
        });
    }
});

router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        username.trim() === "" ||
        password === ""
    ) {
        return res.status(400).json({
            message: "Username and password are required."
        });
    }

    try {
        const player = db.prepare(`
            SELECT id, username, password_hash
            FROM players
            WHERE username = ?
        `).get(username.trim());

        // Do not reveal whether the username or password was incorrect.
        if (
            !player ||
            !bcrypt.compareSync(password, player.password_hash)
        ) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        // Regenerate the session ID after successful login.
        req.session.regenerate((error) => {
            if (error) {
                console.error("Session error:", error.message);

                return res.status(500).json({
                    message: "Could not start your login session."
                });
            }

            req.session.playerId = player.id;
            req.session.username = player.username;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Session save error:",
                        saveError.message
                    );

                    return res.status(500).json({
                        message: "Could not save your login session."
                    });
                }

                res.json({
                    message: "Login successful.",
                    username: player.username
                });
            });
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "Could not log in. Please try again."
        });
    }
});

router.get("/me", (req, res) => {
    if (!req.session || !req.session.playerId) {
        return res.status(401).json({
            message: "You are not logged in."
        });
    }

    res.json({
        playerId: req.session.playerId,
        username: req.session.username
    });
});

router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.json({
            message: "You are already logged out."
        });
    }

    const sessionId = req.sessionID;

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error.message);

            return res.status(500).json({
                message: "Could not log out."
            });
        }

        res.clearCookie("bananaquest.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        });

        res.json({
            message: "Logged out successfully."
        });
    });
});

module.exports = router;