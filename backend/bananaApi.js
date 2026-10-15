
// Store the address of the Banana API in a constant variable.
const BANANA_API_URL = "https://marcconrad.com/uob/banana/api.php";

// Create a function to request a banana puzzle from the API.
async function getBananaPuzzle() {

    // Send a request to the Banana API and wait for its response.
    const response = await fetch(BANANA_API_URL);

    // Check whether the API request was successful.
    if (!response.ok) {
        throw new Error("Failed to get a puzzle from the Banana API.");
    }

    // Convert the API response into a JavaScript object.
    const data = await response.json();

    // Check whether the API returned the puzzle image and solution.
    if (!data.question || data.solution === undefined) {
        throw new Error("Invalid puzzle data received from the Banana API.");
    }

    // Return the puzzle image URL and its solution.
    return {
        question: data.question,
        solution: Number(data.solution)
    };
}

// Make the function available to other backend files.
module.exports = { getBananaPuzzle };
