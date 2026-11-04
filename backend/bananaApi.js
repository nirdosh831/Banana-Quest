const BANANA_API_URL = "https://marcconrad.com/uob/banana/api.php";

async function getBananaPuzzle() {
    const response = await fetch(BANANA_API_URL);

    if (!response.ok) {
        throw new Error("Failed to get a puzzle from the Banana API.");
    }

    const data = await response.json();

    if (!data.question || data.solution === undefined) {
        throw new Error("Invalid puzzle data received from the Banana API.");
    }

    return {
        question: data.question,
        solution: Number(data.solution)
    };
}

module.exports = { getBananaPuzzle };
