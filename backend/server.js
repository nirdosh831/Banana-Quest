// Import Express to create the backend server.
const express = require("express");

// Create the Express application.
const app = express();

// Set the port number for the server.
const PORT = 3000;

// Import the function that gets a banana puzzle from the API.
const { getBananaPuzzle } = require("./bananaApi");

// Allow the server to read JSON data sent by the frontend.
app.use(express.json());

// Create a route to get a new banana puzzle.
app.get("/api/puzzle", async (req, res) => {
    try {
        // Request a puzzle from the Banana API.
        const puzzle = await getBananaPuzzle();

        // Send the puzzle image to the frontend.
        res.json({
            question: puzzle.question
        });

    } catch (error) {
        // Send an error message if the puzzle request fails.
        res.status(500).json({
            error: "Could not load the banana puzzle."
        });
    }
});

// Start the server and listen for requests on port 3000.
app.listen(PORT, () => {
    console.log(`Banana Quest server is running on port ${PORT}.`);
});
