const API_KEY = "3NUXCXDDSKHBMNXZWRJELREUG";

async function getWeather() {
    const city = document.getElementById("cityInput").value.trim();

    if (city === "") {
        alert("Please enter a city name");
        return;
    }

    // Elements to control visibility
    const weatherCard = document.getElementById("weatherCard");
    const errorBox = document.getElementById("errorBox");
    const loader = document.getElementById("loader");

    // RESET STATE: Show loader, hide card and hide old errors completely
    loader.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    errorBox.classList.add("hidden");

    try {
        const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(city)}?unitGroup=metric&key=${API_KEY}&contentType=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("City not found");
        }

        const data = await response.json();

        // Map API responses to correct HTML IDs
        document.getElementById("cityName").textContent = data.resolvedAddress;
        document.getElementById("tempValue").textContent = Math.round(data.currentConditions.temp);
        document.getElementById("weatherDesc").textContent = data.currentConditions.conditions;
        document.getElementById("humidity").textContent = data.currentConditions.humidity + "%";
        document.getElementById("windSpeed").textContent = data.currentConditions.windspeed + " km/h";
        document.getElementById("feelsLike").textContent = Math.round(data.currentConditions.feelslike) + "°C";
        document.getElementById("visibility").textContent = data.currentConditions.visibility ? data.currentConditions.visibility + " km" : "N/A";
        
        if(data.currentConditions.datetime) {
            document.getElementById("lastUpdated").textContent = "Updated: " + data.currentConditions.datetime;
        }

        // Map conditions to weather emojis
        const condition = data.currentConditions.conditions.toLowerCase();
        let icon = "🌤️";
        if (condition.includes("rain")) icon = "🌧️";
        else if (condition.includes("cloud")) icon = "☁️";
        else if (condition.includes("clear")) icon = "☀️";
        else if (condition.includes("snow")) icon = "❄️";

        const iconEl = document.getElementById("weatherIcon");
        if(iconEl) {
            iconEl.outerHTML = `<span id="weatherIcon" style="font-size: 2rem;">${icon}</span>`;
        }

        // SUCCESS STATE: Hide loader and reveal the updated weather card
        loader.classList.add("hidden");
        weatherCard.classList.remove("hidden");

    } catch (error) {
        // ERROR STATE: Hide loader, keep card hidden, and reveal the error box
        loader.classList.add("hidden");
        weatherCard.classList.add("hidden"); 
        errorBox.classList.remove("hidden");
        document.getElementById("errorMsg").textContent = error.message;
        console.error(error);
    }
}

// Event listener for the search button click
document.getElementById("searchBtn").addEventListener("click", getWeather);

// Event listener for the Enter key press
document.getElementById("cityInput").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        getWeather();
    }
});