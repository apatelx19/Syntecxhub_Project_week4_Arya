const API_KEY = "3NUXCXDDSKHBMNXZWRJELREUG";
const HISTORY_KEY = "skies_weather_search_history";
const UNIT_KEY = "skies_weather_unit";
const LAST_CITY_KEY = "skies_last_searched_city";

let currentUnit = localStorage.getItem(UNIT_KEY) || "C";
let currentWeatherData = null;
let activeTab = "tab-overview";

// === DOM ELEMENTS ===
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const geoBtn = document.getElementById("geoBtn");
const weatherCard = document.getElementById("weatherCard");
const errorBox = document.getElementById("errorBox");
const errorMsg = document.getElementById("errorMsg");
const loader = document.getElementById("loader");
const navTabs = document.querySelectorAll(".nav-tab");
const tabPanes = document.querySelectorAll(".tab-pane");
const historyChips = document.getElementById("historyChips");
const emptyHistoryMsg = document.getElementById("emptyHistoryMsg");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const tempUnitToggle = document.getElementById("tempUnitToggle");
const unitToggleHeader = document.getElementById("unitToggleHeader");
const unitIndicator = document.getElementById("unitIndicator");

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", () => {
    setupTabNavigation();
    updateUnitUI();
    renderHistory();

    // Suggested city buttons
    document.querySelectorAll(".suggested-pill").forEach(btn => {
        btn.addEventListener("click", () => {
            const city = btn.getAttribute("data-city");
            if (city) {
                switchTab("tab-overview");
                fetchWeather(city);
            }
        });
    });

    // Auto-load last searched city or default to Ahmedabad
    const lastCity = localStorage.getItem(LAST_CITY_KEY);
    if (lastCity) {
        cityInput.value = lastCity;
        fetchWeather(lastCity);
    } else {
        const history = getHistory();
        if (history.length > 0) {
            cityInput.value = history[0];
            fetchWeather(history[0]);
        } else {
            fetchWeather("Ahmedabad");
        }
    }
});

// === TAB NAVIGATION LOGIC ===
function setupTabNavigation() {
    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.getAttribute("data-tab");
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    activeTab = tabId;

    // Update Tab Buttons
    navTabs.forEach(tab => {
        if (tab.getAttribute("data-tab") === tabId) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    // Update Tab Panes
    tabPanes.forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.remove("hidden");
        } else {
            pane.classList.add("hidden");
        }
    });
}

// === WEATHER FETCHING ===
async function fetchWeather(query) {
    const trimmedQuery = query ? query.trim() : cityInput.value.trim();

    if (!trimmedQuery) {
        showError("Please enter a city name.");
        return;
    }

    // Set UI loading state
    loader.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    errorBox.classList.add("hidden");

    try {
        const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(trimmedQuery)}?unitGroup=metric&key=${API_KEY}&contentType=json`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
                throw new Error(`Could not find weather data for "${trimmedQuery}". Please check the spelling.`);
            } else if (response.status === 429) {
                throw new Error("API request limit reached. Please try again in a few moments.");
            } else {
                throw new Error("Failed to retrieve weather data. Please try again.");
            }
        }

        const data = await response.json();
        currentWeatherData = data;

        // Save successful search to history and localStorage
        const resolvedCityName = extractPrimaryCity(data.resolvedAddress) || trimmedQuery;
        saveToHistory(resolvedCityName);
        localStorage.setItem(LAST_CITY_KEY, resolvedCityName);
        cityInput.value = resolvedCityName;

        // Render all tab views
        renderAllViews(data);

        // Hide loader & show card
        loader.classList.add("hidden");
        weatherCard.classList.remove("hidden");

    } catch (error) {
        loader.classList.add("hidden");
        weatherCard.classList.add("hidden");
        showError(error.message || "An unexpected error occurred. Please try again.");
        console.error("Weather fetch error:", error);
    }
}

// === RENDER ALL TAB VIEWS ===
function renderAllViews(data) {
    if (!data || !data.currentConditions) return;

    const current = data.currentConditions;
    const today = (data.days && data.days.length > 0) ? data.days[0] : null;
    const shortAddress = extractPrimaryCity(data.resolvedAddress) || data.address;

    // Badges in tabs
    const forecastBadge = document.getElementById("forecastLocationBadge");
    const detailsBadge = document.getElementById("detailsLocationBadge");
    if (forecastBadge) forecastBadge.textContent = shortAddress;
    if (detailsBadge) detailsBadge.textContent = shortAddress;

    // Dynamic Theme & Condition Emoji
    const conditionInfo = getConditionDetails(current.conditions);
    applyTheme(conditionInfo.theme);

    // 1. RENDER OVERVIEW TAB
    document.getElementById("cityName").textContent = data.resolvedAddress || data.address;
    document.getElementById("weatherDesc").textContent = current.conditions || "Unknown";
    document.getElementById("weatherIcon").textContent = conditionInfo.icon;

    updateTemperatures();

    // High & Low for today
    if (today && today.tempmax !== undefined && today.tempmin !== undefined) {
        const max = formatTemp(today.tempmax);
        const min = formatTemp(today.tempmin);
        document.getElementById("highLowText").textContent = `High: ${max}° • Low: ${min}°`;
        document.getElementById("highLowLine").classList.remove("hidden");
    } else {
        document.getElementById("highLowLine").classList.add("hidden");
    }

    // Quick highlights on Overview
    document.getElementById("quickFeelsLike").textContent = `${formatTemp(current.feelslike)}°${currentUnit}`;
    document.getElementById("quickHumidity").textContent = `${Math.round(current.humidity ?? 0)}%`;
    document.getElementById("quickWind").textContent = getFormattedWind(current.windspeed);

    // Sunrise & Sunset info on Overview
    let sunInfo = "";
    if (current.sunrise && current.sunset) {
        const formatTime = (t) => t.slice(0, 5);
        sunInfo = `🌅 Sunrise: ${formatTime(current.sunrise)}  •  🌇 Sunset: ${formatTime(current.sunset)}`;
    }
    document.getElementById("sunTimes").textContent = sunInfo;

    const timeString = current.datetime ? `Updated at ${current.datetime.slice(0, 5)}` : `Updated just now`;
    document.getElementById("lastUpdated").textContent = timeString;

    // 2. RENDER 5-DAY FORECAST TAB
    renderForecastTab(data.days);

    // 3. RENDER DETAILS TAB
    renderDetailsTab(current);
}

// === RENDER FORECAST TAB ===
function renderForecastTab(days) {
    const forecastList = document.getElementById("forecastList");
    if (!forecastList || !days || days.length <= 1) return;

    // Next 5 days
    const nextDays = days.slice(1, 6);

    forecastList.innerHTML = nextDays.map(day => {
        const date = new Date(day.datetime + "T00:00:00");
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
        const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const condition = getConditionDetails(day.conditions);
        const max = formatTemp(day.tempmax);
        const min = formatTemp(day.tempmin);

        return `
          <div class="forecast-row">
            <div class="forecast-row-left">
              <div class="forecast-row-day">${dayName} <span style="font-size:0.7rem; font-weight:400; color:var(--text-muted); display:block;">${monthDay}</span></div>
              <span class="forecast-row-icon">${condition.icon}</span>
              <span class="forecast-row-desc">${day.conditions || "Clear"}</span>
            </div>
            <div class="forecast-row-temp">
              <span class="max">${max}°</span>
              <span class="min">${min}°</span>
            </div>
          </div>
        `;
    }).join("");
}

// === RENDER DETAILS TAB ===
function renderDetailsTab(current) {
    document.getElementById("feelsLike").textContent = `${formatTemp(current.feelslike)}°${currentUnit}`;
    document.getElementById("humidity").textContent = `${Math.round(current.humidity ?? 0)}%`;
    document.getElementById("windSpeed").textContent = getFormattedWind(current.windspeed);
    document.getElementById("visibility").textContent = getFormattedVisibility(current.visibility);
    document.getElementById("uvIndex").textContent = current.uvindex !== undefined ? current.uvindex : "N/A";
    document.getElementById("pressure").textContent = current.pressure ? `${Math.round(current.pressure)} hPa` : "N/A";

    const formatTime = (t) => t ? t.slice(0, 5) : "--:--";
    document.getElementById("sunriseTime").textContent = formatTime(current.sunrise);
    document.getElementById("sunsetTime").textContent = formatTime(current.sunset);
}

// === TEMPERATURE UNIT CONVERSION & UI ===
function formatTemp(tempC) {
    if (tempC === null || tempC === undefined) return "--";
    if (currentUnit === "F") {
        return Math.round((tempC * 9 / 5) + 32);
    }
    return Math.round(tempC);
}

function getFormattedWind(windspeed) {
    if (windspeed === undefined || windspeed === null) return "N/A";
    if (currentUnit === "F") {
        return `${Math.round(windspeed * 0.621371)} mph`;
    }
    return `${Math.round(windspeed)} km/h`;
}

function getFormattedVisibility(visibility) {
    if (visibility === undefined || visibility === null) return "N/A";
    if (currentUnit === "F") {
        return `${(visibility * 0.621371).toFixed(1)} mi`;
    }
    return `${visibility} km`;
}

function toggleUnit() {
    currentUnit = currentUnit === "C" ? "F" : "C";
    localStorage.setItem(UNIT_KEY, currentUnit);
    updateUnitUI();

    if (currentWeatherData) {
        renderAllViews(currentWeatherData);
    }
}

function updateUnitUI() {
    const symbol = `°${currentUnit}`;
    if (tempUnitToggle) tempUnitToggle.textContent = symbol;
    if (unitIndicator) unitIndicator.textContent = symbol;
}

function updateTemperatures() {
    if (!currentWeatherData || !currentWeatherData.currentConditions) return;
    const current = currentWeatherData.currentConditions;

    const temp = formatTemp(current.temp);
    document.getElementById("tempValue").textContent = temp;
}

// === WEATHER CONDITION MAPPING & DYNAMIC THEMES ===
function getConditionDetails(conditionText) {
    if (!conditionText) return { icon: "🌤️", theme: null };
    const c = conditionText.toLowerCase();

    if (c.includes("thunder") || c.includes("storm") || c.includes("lightning")) {
        return { icon: "⛈️", theme: "rain" };
    }
    if (c.includes("snow") || c.includes("ice") || c.includes("blizzard") || c.includes("sleet") || c.includes("flurries")) {
        return { icon: "❄️", theme: "snow" };
    }
    if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) {
        return { icon: "🌧️", theme: "rain" };
    }
    if (c.includes("cloud") || c.includes("overcast") || c.includes("fog") || c.includes("mist") || c.includes("haze")) {
        return { icon: "☁️", theme: "clouds" };
    }
    if (c.includes("clear") || c.includes("sun")) {
        return { icon: "☀️", theme: null };
    }
    if (c.includes("wind")) {
        return { icon: "💨", theme: "clouds" };
    }

    return { icon: "🌤️", theme: null };
}

function applyTheme(theme) {
    if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
}

// === SEARCH HISTORY MANAGEMENT ===
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function saveToHistory(city) {
    if (!city) return;
    let history = getHistory();
    history = history.filter(item => item.toLowerCase() !== city.toLowerCase());
    history.unshift(city);
    if (history.length > 8) history = history.slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function removeFromHistory(city, event) {
    if (event) event.stopPropagation();
    let history = getHistory();
    history = history.filter(item => item.toLowerCase() !== city.toLowerCase());
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
}

function renderHistory() {
    const history = getHistory();
    if (!historyChips) return;

    if (history.length === 0) {
        if (emptyHistoryMsg) emptyHistoryMsg.classList.remove("hidden");
        historyChips.innerHTML = "";
        return;
    }

    if (emptyHistoryMsg) emptyHistoryMsg.classList.add("hidden");
    historyChips.innerHTML = history.map(city => {
        const safeCity = city.replace(/"/g, '&quot;').replace(/'/g, "\\'");
        return `
          <button class="history-chip" type="button" onclick="searchCity('${safeCity}')">
            <span>${city}</span>
            <span class="chip-remove" title="Remove" onclick="removeFromHistory('${safeCity}', event)">×</span>
          </button>
        `;
    }).join("");
}

window.searchCity = function(city) {
    cityInput.value = city;
    switchTab("tab-overview");
    fetchWeather(city);
};

window.removeFromHistory = removeFromHistory;

function extractPrimaryCity(address) {
    if (!address) return "";
    return address.split(",")[0].trim();
}

// === GEOLOCATION ===
function useCurrentLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    loader.classList.remove("hidden");
    weatherCard.classList.add("hidden");
    errorBox.classList.add("hidden");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            switchTab("tab-overview");
            fetchWeather(`${lat},${lon}`);
        },
        (err) => {
            loader.classList.add("hidden");
            showError(`Unable to retrieve your location: ${err.message}`);
        },
        { timeout: 10000, enableHighAccuracy: true }
    );
}

// === ERROR HANDLING ===
function showError(message) {
    errorBox.classList.remove("hidden");
    errorMsg.textContent = message;
}

// === EVENT LISTENERS ===
searchBtn.addEventListener("click", () => {
    switchTab("tab-overview");
    fetchWeather(cityInput.value);
});

geoBtn.addEventListener("click", useCurrentLocation);

cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        switchTab("tab-overview");
        fetchWeather(cityInput.value);
    }
});

if (tempUnitToggle) tempUnitToggle.addEventListener("click", toggleUnit);
if (unitToggleHeader) unitToggleHeader.addEventListener("click", toggleUnit);
if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);