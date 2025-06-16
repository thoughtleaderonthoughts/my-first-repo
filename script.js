const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const hourlyDiv = document.getElementById('hourly');
const dailyDiv = document.getElementById('daily');
const shortsAdvice = document.getElementById('shorts-advice');

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (!city) return;
    fetchCityCoordinates(city).then(coords => {
        if (coords) {
            fetchWeather(coords.latitude, coords.longitude);
        } else {
            hourlyDiv.textContent = '';
            dailyDiv.textContent = '';
            shortsAdvice.textContent = 'City not found';
        }
    });
});

function fetchCityCoordinates(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    return fetch(url)
        .then(resp => resp.json())
        .then(data => {
            if (data.results && data.results.length > 0) {
                return data.results[0];
            }
            return null;
        })
        .catch(() => null);
}

function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m&current_weather=true&timezone=auto&forecast_days=7`;
    fetch(url)
        .then(resp => resp.json())
        .then(data => {
            displayHourly(data.hourly);
            displayDaily(data.daily);
            adviseShorts(data.daily.temperature_2m_max[0]);
        })
        .catch(() => {
            hourlyDiv.textContent = 'Failed to fetch weather';
            dailyDiv.textContent = '';
            shortsAdvice.textContent = '';
        });
}

function displayHourly(hourly) {
    hourlyDiv.innerHTML = '';
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    for (let i = 0; i < hourly.time.length; i++) {
        if (hourly.time[i].startsWith(todayStr)) {
            const p = document.createElement('p');
            const time = new Date(hourly.time[i]).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            p.textContent = `${time}: ${hourly.temperature_2m[i]}°C`;
            hourlyDiv.appendChild(p);
        }
    }
}

function displayDaily(daily) {
    dailyDiv.innerHTML = '';
    for (let i = 0; i < daily.time.length; i++) {
        const p = document.createElement('p');
        const date = new Date(daily.time[i]).toLocaleDateString();
        p.textContent = `${date}: ${daily.temperature_2m_min[i]}°C - ${daily.temperature_2m_max[i]}°C`;
        dailyDiv.appendChild(p);
    }
}

function adviseShorts(todayMax) {
    if (todayMax >= 20) {
        shortsAdvice.textContent = 'You can wear shorts today!';
    } else {
        shortsAdvice.textContent = 'Better wear pants today.';
    }
}
